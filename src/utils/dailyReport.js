import * as XLSX from 'xlsx';

const BED_STATE_LABELS = {
  clean: 'Da pulire',
  stayover: 'Stayover',
  late: 'Late c/out',
  early: 'Early c/in',
  noone: 'Nessuno',
};

const LEGEND_IT = [
  ['Early c/in', 'Ospite in arrivo presto → il letto va fatto per primo'],
  ['Da pulire', 'Turno standard, nessuna priorità particolare'],
  ['Late c/out', 'Ospite esce tardi → il letto va fatto per ultimo'],
  ['Stayover', 'Ospite resta → il letto NON va fatto oggi'],
  ['Nessuno', 'Letto vuoto → solo controllo'],
];

const LEGEND_EN = [
  ['Early c/in', 'Guest arriving early → bed must be done first'],
  ['Da pulire', 'Standard shift, no special priority'],
  ['Late c/out', 'Guest leaving late → bed must be done last'],
  ['Stayover', 'Guest staying → bed must NOT be done today'],
  ['Nessuno', 'Empty bed → check only'],
];

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function floorName(room, floors) {
  const floor = floors.find(f => f.id === room.floorId);
  return floor ? floor.name : '';
}

function getCleanerName(room, cleaners) {
  const cleaner = cleaners.find(c => c.id === room.assignedTo);
  return cleaner ? cleaner.username : '—';
}

function getRoomTypeLabel(type, lang) {
  if (lang === 'it') return type === 'private' ? 'Privata' : 'Dormitorio';
  return type === 'private' ? 'Private' : 'Dormitory';
}

function getBedStateLabel(state, lang) {
  if (lang === 'it') return BED_STATE_LABELS[state] || state;
  const map = {
    clean: 'To clean',
    stayover: 'Stayover',
    late: 'Late check-out',
    early: 'Early check-in',
    noone: 'No one',
  };
  return map[state] || state;
}

export function generateDailyReport({
  date,
  hostelName,
  rooms,
  roomStatus,
  cleaners,
  floors,
  extraRequests,
  lang = 'it',
}) {
  const wb = XLSX.utils.book_new();
  const header = `${hostelName} · ${formatDate(date)} · generato automaticamente alle 23:59`;
  const activeCleaners = cleaners.filter(c => rooms.some(r => r.assignedTo === c.id));

  // ── Sheet 1: Riepilogo ───────────────────────────────
  const assignedRooms = rooms.filter(r => r.assignedTo);
  const cleanedRooms = assignedRooms.filter(r => roomStatus[r.id]?.cleaned).length;
  const pendingRooms = assignedRooms.length - cleanedRooms;

  const totalBeds = rooms.reduce((sum, r) => sum + (r.beds?.length || 0), 0);
  const cleanedBeds = rooms.reduce((sum, r) => {
    const bs = roomStatus[r.id]?.bedStatus || {};
    return sum + Object.values(bs).filter(b => b.status === 'cleaned').length;
  }, 0);
  const skippedBeds = rooms.reduce((sum, r) => {
    const assign = roomStatus[r.id]?.assignmentBedStatus || {};
    return sum + Object.values(assign).filter(b => b.status === 'stayover' || b.status === 'noone').length;
  }, 0);

  const extraCleanings = extraRequests.filter(r => r.status === 'approved').length;
  const totalExtraTimeSummary = rooms.reduce((sum, r) => sum + (roomStatus[r.id]?.extraTime || 0), 0);
  const openAlerts = extraRequests.filter(r => r.status === 'pending').length;

  const completionRooms = assignedRooms.length
    ? (cleanedRooms / assignedRooms.length * 100).toFixed(1).replace('.', ',') + '%'
    : '0%';
  const completionBeds = totalBeds
    ? (cleanedBeds / totalBeds * 100).toFixed(1).replace('.', ',') + '%'
    : '0%';

  const summaryIT = [
    ['KeepClean · Report giornaliero'],
    [header],
    [],
    ['INDICATORI DEL GIORNO'],
    ['Indicatore', 'Valore'],
    ['Stanze assegnate', assignedRooms.length],
    ['Stanze completate', cleanedRooms],
    ['Stanze non completate', pendingRooms],
    ['Letti totali da pulire', totalBeds],
    ['Letti puliti', cleanedBeds],
    ['Letti saltati (stayover)', skippedBeds],
    ['Pulizie extra approvate', extraCleanings],
    ['Tempo extra totale (min)', totalExtraTimeSummary],
    ['Cleaner attivi', activeCleaners.length],
    ['Segnalazioni aperte', openAlerts],
    [],
    ['% completamento stanze', completionRooms],
    ['% completamento letti', completionBeds],
  ];

  const summaryEN = [
    ['KeepClean · Daily Report'],
    [header],
    [],
    ['DAY INDICATORS'],
    ['Indicator', 'Value'],
    ['Rooms assigned', assignedRooms.length],
    ['Rooms completed', cleanedRooms],
    ['Rooms not completed', pendingRooms],
    ['Total beds to clean', totalBeds],
    ['Beds cleaned', cleanedBeds],
    ['Beds skipped (stayover)', skippedBeds],
    ['Extra cleanings approved', extraCleanings],
    ['Total extra time (min)', totalExtraTimeSummary],
    ['Active cleaners', activeCleaners.length],
    ['Open alerts', openAlerts],
    [],
    ['% room completion', completionRooms],
    ['% bed completion', completionBeds],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(lang === 'it' ? summaryIT : summaryEN);
  ws1['!cols'] = [{ wch: 35 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, lang === 'it' ? 'Riepilogo' : 'Summary');

  // ── Sheet 2: Attività per letto ───────────────────────
    const bedRows = [
    ['Data', 'Piano', 'Stanza', 'Letto', 'Tipo stanza', 'Cleaner', 'Stato letto', 'Esito', 'Ora inizio', 'Ora completam.', 'Nota del cleaner'],
    ];

    assignedRooms.forEach(room => {
    const floor = floorName(room, floors);
    const cleaner = getCleanerName(room, cleaners);
    const typeLabel = getRoomTypeLabel(room.type, lang);
    const status = roomStatus[room.id] || {};
    const assignmentBedStatus = status.assignmentBedStatus || {};
    const bedStatus = status.bedStatus || {};
    const isCleaned = status.cleaned || false;

    if (room.type === 'dorm' && room.beds?.length) {
        room.beds.forEach(bed => {
        const assign = assignmentBedStatus[bed.id] || { status: 'clean' };
        const bedState = assign.status || 'clean';
        const bedClean = bedStatus[bed.id]?.status === 'cleaned';
        const outcome = bedClean
            ? 'Pulito'
            : (assign.status === 'stayover' || assign.status === 'noone')
            ? 'Saltato'
            : 'Non completato';
        bedRows.push([
            date,
            floor,
            room.name,
            bed.name,
            typeLabel,
            cleaner,
            getBedStateLabel(bedState, lang),
            outcome,
            '',
            '',
            status.notes || '',
        ]);
        });
    } else {
        const outcome = isCleaned ? 'Pulito' : 'Non completato';
        bedRows.push([
        date,
        floor,
        room.name,
        '—',
        typeLabel,
        cleaner,
        'Da pulire',
        outcome,
        '',
        '',
        status.notes || '',
        ]);
    }
    });

    const ws2 = XLSX.utils.aoa_to_sheet(bedRows);
    ws2['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 6 }, { wch: 12 },
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, lang === 'it' ? 'Attività per letto' : 'Bed Activity');

  // ── Sheet 3: Riepilogo per cleaner ───────────────────
  const cleanerRows = [
    [
      lang === 'it' ? 'Cleaner' : 'Cleaner',
      lang === 'it' ? 'Stanze assegn.' : 'Rooms assigned',
      lang === 'it' ? 'Stanze compl.' : 'Rooms completed',
      lang === 'it' ? 'Letti puliti' : 'Beds cleaned',
      lang === 'it' ? 'Letti saltati' : 'Beds skipped',
      lang === 'it' ? 'Tempo extra (min)' : 'Extra time (min)',
      lang === 'it' ? 'Pulizie extra' : 'Extra cleanings',
      '% completamento',
    ],
  ];

  activeCleaners.forEach(cleaner => {
    const assigned = rooms.filter(r => r.assignedTo === cleaner.id);
    const completed = assigned.filter(r => roomStatus[r.id]?.cleaned).length;
    const bedsCleaned = assigned.reduce((sum, room) => {
      const bs = roomStatus[room.id]?.bedStatus || {};
      return sum + Object.values(bs).filter(b => b.status === 'cleaned').length;
    }, 0);
    const bedsSkipped = assigned.reduce((sum, room) => {
      const assign = roomStatus[room.id]?.assignmentBedStatus || {};
      return sum + Object.values(assign).filter(b => b.status === 'stayover' || b.status === 'noone').length;
    }, 0);
    const extraTime = assigned.reduce((sum, room) => sum + (roomStatus[room.id]?.extraTime || 0), 0);
    const extraClean = assigned.filter(room => roomStatus[room.id]?.extraCleaning).length;
    const pct = assigned.length
      ? (completed / assigned.length * 100).toFixed(1).replace('.', ',') + '%'
      : '0%';
    cleanerRows.push([
      cleaner.username,
      assigned.length,
      completed,
      bedsCleaned,
      bedsSkipped,
      extraTime,
      extraClean,
      pct,
    ]);
  });

  const totalAssigned = activeCleaners.reduce(
    (sum, c) => sum + rooms.filter(r => r.assignedTo === c.id).length,
    0
  );
  const totalCompleted = activeCleaners.reduce(
    (sum, c) =>
      sum + rooms.filter(r => r.assignedTo === c.id && roomStatus[r.id]?.cleaned).length,
    0
  );
  const totalBedsCleaned = activeCleaners.reduce(
    (sum, c) =>
      sum +
      rooms
        .filter(r => r.assignedTo === c.id)
        .reduce(
          (s, room) =>
            s + Object.values(roomStatus[room.id]?.bedStatus || {}).filter(b => b.status === 'cleaned').length,
          0
        ),
    0
  );
  const totalBedsSkipped = activeCleaners.reduce(
    (sum, c) =>
      sum +
      rooms
        .filter(r => r.assignedTo === c.id)
        .reduce(
          (s, room) =>
            s +
            Object.values(roomStatus[room.id]?.assignmentBedStatus || {}).filter(
              b => b.status === 'stayover' || b.status === 'noone'
            ).length,
          0
        ),
    0
  );
  const totalExtraTimeCleaners = activeCleaners.reduce(
    (sum, c) =>
      sum +
      rooms
        .filter(r => r.assignedTo === c.id)
        .reduce((s, room) => s + (roomStatus[room.id]?.extraTime || 0), 0),
    0
  );
  const totalExtraClean = activeCleaners.reduce(
    (sum, c) =>
        sum + rooms.filter(r => r.assignedTo === c.id && roomStatus[r.id]?.extraCleaning).length,
    0
    );
  const overallPct = totalAssigned
    ? (totalCompleted / totalAssigned * 100).toFixed(1).replace('.', ',') + '%'
    : '0%';
  cleanerRows.push([
    'TOTALE',
    totalAssigned,
    totalCompleted,
    totalBedsCleaned,
    totalBedsSkipped,
    totalExtraTimeCleaners,
    totalExtraClean,
    overallPct,
  ]);

  const ws3 = XLSX.utils.aoa_to_sheet(cleanerRows);
  ws3['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, lang === 'it' ? 'Riepilogo cleaner' : 'Cleaner Summary');

  // ── Sheet 4: Note & Segnalazioni ─────────────────────
  const notesRows = [
    [
      lang === 'it' ? 'Data' : 'Date',
      lang === 'it' ? 'Piano' : 'Floor',
      lang === 'it' ? 'Stanza' : 'Room',
      lang === 'it' ? 'Letto' : 'Bed',
      lang === 'it' ? 'Origine' : 'Source',
      lang === 'it' ? 'Autore' : 'Author',
      lang === 'it' ? 'Tempo extra (min)' : 'Extra time (min)',
      lang === 'it' ? 'Testo' : 'Text',
    ],
  ];

  rooms.forEach(room => {
    if (!room.assignedTo) return;

    const status = roomStatus[room.id] || {};
    const floor = floorName(room, floors);
    const author = room.assignedTo
      ? cleaners.find(c => c.id === room.assignedTo)?.username
      : '—';

    if (status.managerNotes) {
      notesRows.push([
        date,
        floor,
        room.name,
        '—',
        lang === 'it' ? 'Nota manager' : 'Manager note',
        author,
        0,
        status.managerNotes,
      ]);
    }
    if (status.notes) {
      notesRows.push([
        date,
        floor,
        room.name,
        '—',
        lang === 'it' ? 'Nota cleaner' : 'Cleaner note',
        author,
        status.extraTime || 0,
        status.notes,
      ]);
    }
    if (status.extraTime > 0 && !status.notes) {
      notesRows.push([
        date,
        floor,
        room.name,
        '—',
        lang === 'it' ? 'Tempo extra' : 'Extra time',
        author,
        status.extraTime,
        'Tempo extra',
      ]);
    }
    if (status.earlyCheckIn || status.lateCheckOut) {
      const flags = [];
      if (status.earlyCheckIn) flags.push('Early c/in');
      if (status.lateCheckOut) flags.push('Late c/out');
      notesRows.push([
        date,
        floor,
        room.name,
        '—',
        lang === 'it' ? 'Flag' : 'Flag',
        author,
        0,
        flags.join(', '),
      ]);
    }
  });

  const totalExtraNotes = rooms.reduce((sum, room) => sum + (roomStatus[room.id]?.extraTime || 0), 0);
  notesRows.push(['', '', '', '', '', lang === 'it' ? 'TOTALE MIN' : 'TOTAL MIN', totalExtraNotes, '']);

  const ws4 = XLSX.utils.aoa_to_sheet(notesRows);
  ws4['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 6 },
    { wch: 18 }, { wch: 15 }, { wch: 14 }, { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, ws4, lang === 'it' ? 'Note & Segnalazioni' : 'Notes & Alerts');

  // ── Sheet 5: Legenda ─────────────────────────────────
  const legendData = lang === 'it' ? LEGEND_IT : LEGEND_EN;
  const legendRows = [
    [lang === 'it' ? 'Legenda e note tecniche' : 'Legend and technical notes'],
    [],
    [lang === 'it' ? 'STATI DEL LETTO' : 'BED STATES'],
    ...legendData,
    [],
    [lang === 'it' ? 'ESITI' : 'OUTCOMES'],
    [
      lang === 'it' ? 'Pulito' : 'Cleaned',
      lang === 'it' ? 'Letto/stanza completata dal cleaner' : 'Bed/room completed by cleaner',
    ],
    [
      lang === 'it' ? 'Saltato' : 'Skipped',
      lang === 'it' ? 'Non da pulire oggi (stayover o istruzione del manager)' : 'Not to be cleaned today (stayover or manager instruction)',
    ],
    [
      lang === 'it' ? 'Non completato' : 'Not completed',
      lang === 'it' ? 'Assegnato ma non portato a termine entro fine turno' : 'Assigned but not completed by end of shift',
    ],
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(legendRows);
  ws5['!cols'] = [{ wch: 25 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, ws5, lang === 'it' ? 'Legenda' : 'Legend');

  return wb;
}