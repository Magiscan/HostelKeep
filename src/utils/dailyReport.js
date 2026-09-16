// src/utils/dailyReport.js
//
// Daily housekeeping report → styled .xlsx.
//
// IMPORTANT: this imports `xlsx-js-style`, not `xlsx`. The community `xlsx`
// build silently drops every `.s` style on write, which is why the old report
// was plain. Callers must also WRITE with this same library — use
// `downloadDailyReport()` below instead of `XLSX.writeFile` from 'xlsx'.
//
// Public API (backwards compatible):
//   generateDailyReport(data) → workbook
//   downloadDailyReport(data, fileName?) → triggers the download (web)
//
// `data` = { date, hostelName, rooms, roomStatus, cleaners, floors,
//            extraRequests, lang, snapshotAt? }
import XLSX from 'xlsx-js-style';

/* ─────────────────────────────────────────────────────────────────────────
   Bed-state semantics — must match AssignScreen(.web).js
   A bed with no assignment entry is 'noone' (Inspected) in the Assign UI, so
   it is NOT work for today. The old report defaulted it to 'clean', which
   listed beds the manager never flagged as "Not completed".
   ───────────────────────────────────────────────────────────────────────── */
const DEFAULT_BED_STATE = 'noone';
const NO_WORK_STATES = new Set(['stayover', 'noone']);

/* ── Palette (brand tokens + status tones) ─────────────────────────────── */
const C = {
  navy: '0B1F3A',
  navySoft: 'E8EDF5',
  gold: 'F5B32B',
  goldSoft: 'FEF6E0',
  white: 'FFFFFF',
  zebra: 'F8FAFC',
  border: 'E2E8F0',
  text: '0F172A',
  muted: '64748B',
};

const TONE = {
  good:    { bg: 'DCFCE7', text: '166534' },
  warn:    { bg: 'FEF3C7', text: '92400E' },
  bad:     { bg: 'FEE2E2', text: '991B1B' },
  info:    { bg: 'DBEAFE', text: '1E40AF' },
  late:    { bg: 'EDE9FE', text: '5B21B6' },
  neutral: { bg: 'F1F5F9', text: '475569' },
  brand:   { bg: C.navySoft, text: C.navy },
  gold:    { bg: C.goldSoft, text: '8A5A00' },
};

const STATE_TONE = {
  early: TONE.info,
  clean: TONE.warn,
  late: TONE.late,
  stayover: TONE.neutral,
  noone: TONE.neutral,
  common: TONE.brand,
};

/* ── Strings ───────────────────────────────────────────────────────────── */
const STRINGS = {
  it: {
    locale: 'it-IT',
    reportTitle: 'HostelKeep · Report giornaliero',
    generated: 'Generato il',
    snapshot: 'Istantanea salvata il',
    sheets: {
      summary: 'Riepilogo',
      beds: 'Attività per letto',
      cleaners: 'Riepilogo addetti',
      notes: 'Note & Segnalazioni',
      legend: 'Legenda',
    },
    kpi: {
      rooms: 'COMPLETAMENTO STANZE',
      roomsCaption: (a, b) => `${a} di ${b} stanze`,
      beds: 'LETTI DORMITORIO PULITI',
      bedsCaption: (a, b) => `${a} di ${b} letti da pulire`,
      privates: 'CAMERE PRIVATE PULITE',
      privatesCaption: (a, b) => `${a} di ${b} camere private`,
      extra: 'TEMPO EXTRA',
      extraCaption: 'minuti segnalati',
      team: 'ADDETTI ATTIVI',
      teamCaption: 'con stanze assegnate',
    },
    indicatorsTitle: 'Indicatori del giorno',
    indicator: 'Indicatore',
    value: 'Valore',
    indicators: {
      roomsAssigned: 'Stanze assegnate',
      roomsCompleted: 'Stanze completate',
      roomsPending: 'Stanze non completate',
      privateAssigned: 'Camere private assegnate',
      privateCleaned: 'Camere private pulite',
      dormAssigned: 'Dormitori assegnati',
      dormCleaned: 'Dormitori completati',
      bedsToClean: 'Letti dormitorio da pulire',
      bedsCleaned: 'Letti dormitorio puliti',
      bedsSkipped: 'Letti senza lavoro (stay-over / ispezionati)',
      extraApproved: 'Pulizie extra approvate',
      extraTime: 'Tempo extra totale (min)',
      activeCleaners: 'Addetti attivi',
      pendingRequests: 'Richieste extra in attesa',
      roomPct: '% completamento stanze',
      privatePct: '% camere private pulite',
      bedPct: '% completamento letti dormitorio',
    },
    floorsTitle: 'Avanzamento per piano',
    floor: 'Piano',
    noFloor: 'Senza piano',
    roomsDone: 'Stanze',
    completion: 'Completamento',
    teamTitle: 'Addetti in sintesi',
    progress: 'Avanzamento',
    cols: {
      date: 'Data', floor: 'Piano', room: 'Stanza', bed: 'Letto', roomType: 'Tipo stanza',
      cleaner: 'Addetto', bedState: 'Stato letto', outcome: 'Esito', cleanerNote: 'Nota addetto',
      roomsAssigned: 'Stanze assegn.', roomsCompleted: 'Stanze compl.', bedsCleaned: 'Letti dorm. puliti',
      privateCleaned: 'Camere priv. pulite', bedsSkipped: 'Letti senza lavoro', extraTime: 'Tempo extra (min)', extraCleanings: 'Pulizie extra',
      source: 'Origine', author: 'Autore', text: 'Testo',
    },
    types: { private: 'Privata', dorm: 'Dormitorio' },
    states: {
      clean: 'Da pulire', stayover: 'Stay-over', late: 'Late c/out',
      early: 'Early c/in', noone: 'Ispezionato', common: 'Solo aree comuni',
    },
    outcomes: { cleaned: 'Pulito', pending: 'Non completato' },
    sources: { manager: 'Nota manager', cleaner: 'Nota addetto', extra: 'Tempo extra', flag: 'Flag' },
    managerAuthor: 'Manager',
    total: 'TOTALE',
    totalMin: 'TOTALE MIN',
    noActivity: 'Nessuna stanza assegnata in questa giornata.',
    noNotes: 'Nessuna nota o segnalazione in questa giornata.',
    legend: {
      title: 'Legenda',
      bedStates: 'Stati del letto',
      bedStateRows: [
        ['early', 'Ospite in arrivo presto → il letto va fatto per primo'],
        ['clean', 'Turno standard, nessuna priorità particolare'],
        ['late', 'Ospite esce tardi → il letto va fatto per ultimo'],
        ['stayover', 'Ospite resta → il letto NON va fatto oggi'],
        ['noone', 'Letto vuoto o già a posto → solo controllo'],
        ['common', 'Stanza con sole aree comuni da pulire'],
      ],
      outcomesTitle: 'Esiti',
      outcomeRows: [
        ['cleaned', 'Letto/stanza completata dall\'addetto'],
        ['pending', 'Assegnato ma non completato al momento del report'],
      ],
      colorsTitle: 'Colori di completamento',
      colorRows: [
        [TONE.good, '100%', 'Tutto completato'],
        [TONE.warn, '50–99%', 'In corso'],
        [TONE.bad, '< 50%', 'Indietro rispetto al piano'],
      ],
      note: 'I letti in stay-over o ispezionati non compaiono in "Attività per letto": sono conteggiati come "senza lavoro" nel Riepilogo.',
    },
  },
  en: {
    locale: 'en-GB',
    reportTitle: 'HostelKeep · Daily report',
    generated: 'Generated',
    snapshot: 'Snapshot saved',
    sheets: {
      summary: 'Summary',
      beds: 'Bed activity',
      cleaners: 'Housekeepers',
      notes: 'Notes & Alerts',
      legend: 'Legend',
    },
    kpi: {
      rooms: 'ROOM COMPLETION',
      roomsCaption: (a, b) => `${a} of ${b} rooms`,
      beds: 'DORM BEDS CLEANED',
      bedsCaption: (a, b) => `${a} of ${b} beds to clean`,
      privates: 'PRIVATE ROOMS CLEANED',
      privatesCaption: (a, b) => `${a} of ${b} private rooms`,
      extra: 'EXTRA TIME',
      extraCaption: 'minutes reported',
      team: 'ACTIVE HOUSEKEEPERS',
      teamCaption: 'with rooms assigned',
    },
    indicatorsTitle: 'Day indicators',
    indicator: 'Indicator',
    value: 'Value',
    indicators: {
      roomsAssigned: 'Rooms assigned',
      roomsCompleted: 'Rooms completed',
      roomsPending: 'Rooms not completed',
      privateAssigned: 'Private rooms assigned',
      privateCleaned: 'Private rooms cleaned',
      dormAssigned: 'Dorms assigned',
      dormCleaned: 'Dorms completed',
      bedsToClean: 'Dorm beds to clean',
      bedsCleaned: 'Dorm beds cleaned',
      bedsSkipped: 'Beds with no work (stay-over / inspected)',
      extraApproved: 'Extra cleanings approved',
      extraTime: 'Total extra time (min)',
      activeCleaners: 'Active housekeepers',
      pendingRequests: 'Pending extra-room requests',
      roomPct: 'Room completion %',
      privatePct: 'Private rooms cleaned %',
      bedPct: 'Dorm bed completion %',
    },
    floorsTitle: 'Progress by floor',
    floor: 'Floor',
    noFloor: 'No floor',
    roomsDone: 'Rooms',
    completion: 'Completion',
    teamTitle: 'Housekeepers at a glance',
    progress: 'Progress',
    cols: {
      date: 'Date', floor: 'Floor', room: 'Room', bed: 'Bed', roomType: 'Room type',
      cleaner: 'Housekeeper', bedState: 'Bed state', outcome: 'Outcome', cleanerNote: 'Housekeeper note',
      roomsAssigned: 'Rooms assigned', roomsCompleted: 'Rooms completed', bedsCleaned: 'Dorm beds cleaned',
      privateCleaned: 'Private rooms cleaned', bedsSkipped: 'Beds no work', extraTime: 'Extra time (min)', extraCleanings: 'Extra cleanings',
      source: 'Source', author: 'Author', text: 'Text',
    },
    types: { private: 'Private', dorm: 'Dormitory' },
    states: {
      clean: 'To clean', stayover: 'Stay-over', late: 'Late c/out',
      early: 'Early c/in', noone: 'Inspected', common: 'Common areas only',
    },
    outcomes: { cleaned: 'Cleaned', pending: 'Not completed' },
    sources: { manager: 'Manager note', cleaner: 'Housekeeper note', extra: 'Extra time', flag: 'Flag' },
    managerAuthor: 'Manager',
    total: 'TOTAL',
    totalMin: 'TOTAL MIN',
    noActivity: 'No rooms were assigned on this day.',
    noNotes: 'No notes or alerts on this day.',
    legend: {
      title: 'Legend',
      bedStates: 'Bed states',
      bedStateRows: [
        ['early', 'Guest arriving early → bed must be done first'],
        ['clean', 'Standard shift, no special priority'],
        ['late', 'Guest leaving late → bed must be done last'],
        ['stayover', 'Guest staying → bed must NOT be done today'],
        ['noone', 'Empty or already fine → check only'],
        ['common', 'Room where only the common areas are cleaned'],
      ],
      outcomesTitle: 'Outcomes',
      outcomeRows: [
        ['cleaned', 'Bed/room completed by the housekeeper'],
        ['pending', 'Assigned but not completed when the report was taken'],
      ],
      colorsTitle: 'Completion colours',
      colorRows: [
        [TONE.good, '100%', 'Everything done'],
        [TONE.warn, '50–99%', 'In progress'],
        [TONE.bad, '< 50%', 'Behind plan'],
      ],
      note: 'Stay-over and inspected beds are not listed in "Bed activity"; they are counted as "no work" in the Summary.',
    },
  },
};

/* ── Style helpers ─────────────────────────────────────────────────────── */
const FONT = 'Arial';
const font = (o = {}) => ({ name: FONT, sz: 10, color: { rgb: C.text }, ...o });
const fill = (rgb) => ({ patternType: 'solid', fgColor: { rgb } });
const line = (rgb = C.border, style = 'thin') => ({ style, color: { rgb } });
const box = (rgb = C.border) => ({ top: line(rgb), bottom: line(rgb), left: line(rgb), right: line(rgb) });

const S = {
  banner: {
    font: font({ sz: 18, bold: true, color: { rgb: C.white } }),
    fill: fill(C.navy),
    alignment: { vertical: 'center', horizontal: 'left' },
  },
  bannerSub: {
    font: font({ sz: 11, bold: true, color: { rgb: C.gold } }),
    fill: fill(C.navy),
    alignment: { vertical: 'center', horizontal: 'left' },
  },
  meta: {
    font: font({ sz: 9, italic: true, color: { rgb: C.muted } }),
    alignment: { vertical: 'center', horizontal: 'left' },
  },
  section: {
    font: font({ sz: 12, bold: true, color: { rgb: C.navy } }),
    border: { bottom: line(C.gold, 'medium') },
    alignment: { vertical: 'bottom' },
  },
  th: {
    font: font({ bold: true, color: { rgb: C.white } }),
    fill: fill(C.navy),
    border: box(C.navy),
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
  },
  kpiLabel: {
    font: font({ sz: 8, bold: true, color: { rgb: C.muted } }),
    fill: fill(C.navySoft),
    border: { top: line(C.gold, 'thick'), left: line(C.navySoft), right: line(C.navySoft) },
    alignment: { vertical: 'center', horizontal: 'center' },
  },
  kpiValue: (tone) => ({
    font: font({ sz: 22, bold: true, color: { rgb: tone ? tone.text : C.navy } }),
    fill: fill(C.navySoft),
    border: { left: line(C.navySoft), right: line(C.navySoft) },
    alignment: { vertical: 'center', horizontal: 'center' },
  }),
  kpiCaption: {
    font: font({ sz: 9, color: { rgb: C.muted } }),
    fill: fill(C.navySoft),
    border: { bottom: line(C.border), left: line(C.navySoft), right: line(C.navySoft) },
    alignment: { vertical: 'center', horizontal: 'center' },
  },
  td: (row, o = {}) => ({
    font: font({ bold: !!o.bold, color: { rgb: o.color || C.text }, sz: o.sz || 10 }),
    fill: fill(o.bg || (row % 2 ? C.zebra : C.white)),
    border: box(),
    alignment: {
      vertical: 'center',
      horizontal: o.align || 'left',
      wrapText: !!o.wrap,
    },
    ...(o.numFmt ? { numFmt: o.numFmt } : {}),
  }),
  tag: (tone) => ({
    font: font({ bold: true, color: { rgb: tone.text } }),
    fill: fill(tone.bg),
    border: box(C.white),
    alignment: { vertical: 'center', horizontal: 'center' },
  }),
  total: (o = {}) => ({
    font: font({ bold: true, color: { rgb: C.navy } }),
    fill: fill(C.goldSoft),
    border: { top: line(C.navy, 'medium'), bottom: line(C.navy, 'medium'), left: line(C.border), right: line(C.border) },
    alignment: { vertical: 'center', horizontal: o.align || 'center' },
    ...(o.numFmt ? { numFmt: o.numFmt } : {}),
  }),
  bar: (tone, row) => ({
    font: { name: 'Consolas', sz: 10, color: { rgb: tone.text } },
    fill: fill(row % 2 ? C.zebra : C.white),
    border: box(),
    alignment: { vertical: 'center', horizontal: 'left' },
  }),
  empty: {
    font: font({ italic: true, color: { rgb: C.muted } }),
    alignment: { vertical: 'center', horizontal: 'center' },
    border: box(),
  },
};

const PCT = '0.0%';
const INT = '#,##0';

/* ── Tiny sheet builder (cell-level so every cell can carry a style) ───── */
function createSheet() {
  const ws = {};
  const merges = [];
  const rows = [];
  let maxR = 0;
  let maxC = 0;

  const set = (r, c, v, s, f) => {
    const cell = (typeof v === 'number' && Number.isFinite(v))
      ? { t: 'n', v }
      : { t: 's', v: v == null ? '' : String(v) };
    if (f) cell.f = f;
    if (s) cell.s = s;
    ws[XLSX.utils.encode_cell({ r, c })] = cell;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  };

  // Styles every cell in the range so fills/borders cover the whole merge.
  const merge = (r1, c1, r2, c2, v, s) => {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) set(r, c, r === r1 && c === c1 ? v : '', s);
    }
    if (r1 !== r2 || c1 !== c2) merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  };

  const height = (r, hpt) => { rows[r] = { hpt }; };

  const finish = ({ cols, autofilter } = {}) => {
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    ws['!merges'] = merges;
    ws['!rows'] = rows;
    if (cols) ws['!cols'] = cols.map(wch => ({ wch }));
    if (autofilter) ws['!autofilter'] = { ref: autofilter };
    ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
    return ws;
  };

  return { set, merge, height, finish };
}

/* ── Data helpers ──────────────────────────────────────────────────────── */
function formatDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(value, locale) {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function weekday(dateStr, locale) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const ratio = (a, b) => (b > 0 ? a / b : null);

function toneFor(pct) {
  if (pct == null) return TONE.neutral;
  if (pct >= 1) return TONE.good;
  if (pct >= 0.5) return TONE.warn;
  return TONE.bad;
}

function progressBar(pct, width = 20) {
  if (pct == null) return '';
  const filled = Math.max(0, Math.min(width, Math.round(pct * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

const bedStateOf = (status, bedId) =>
  status.assignmentBedStatus?.[bedId]?.status || DEFAULT_BED_STATE;

function roomMetrics(room, status) {
  const beds = room.type === 'dorm' ? (room.beds || []) : [];
  let bedsToClean = 0;
  let bedsCleaned = 0;
  let bedsSkipped = 0;
  beds.forEach(bed => {
    if (NO_WORK_STATES.has(bedStateOf(status, bed.id))) { bedsSkipped++; return; }
    bedsToClean++;
    if (status.bedStatus?.[bed.id]?.status === 'cleaned') bedsCleaned++;
  });
  return {
    cleaned: !!status.cleaned,
    isDorm: room.type === 'dorm',
    bedsToClean,
    bedsCleaned,
    bedsSkipped,
    extraTime: Number(status.extraTime || 0),
    extraCleaning: !!status.extraCleaning,
  };
}

function sumMetrics(list) {
  return list.reduce((acc, m) => ({
    rooms: acc.rooms + 1,
    roomsCleaned: acc.roomsCleaned + (m.cleaned ? 1 : 0),
    privateRooms: acc.privateRooms + (m.isDorm ? 0 : 1),
    privateCleaned: acc.privateCleaned + (!m.isDorm && m.cleaned ? 1 : 0),
    dormRooms: acc.dormRooms + (m.isDorm ? 1 : 0),
    dormCleaned: acc.dormCleaned + (m.isDorm && m.cleaned ? 1 : 0),
    bedsToClean: acc.bedsToClean + m.bedsToClean,
    bedsCleaned: acc.bedsCleaned + m.bedsCleaned,
    bedsSkipped: acc.bedsSkipped + m.bedsSkipped,
    extraTime: acc.extraTime + m.extraTime,
    extraCleanings: acc.extraCleanings + (m.extraCleaning ? 1 : 0),
  }), {
    rooms: 0, roomsCleaned: 0, privateRooms: 0, privateCleaned: 0, dormRooms: 0, dormCleaned: 0,
    bedsToClean: 0, bedsCleaned: 0, bedsSkipped: 0, extraTime: 0, extraCleanings: 0 });
}

/* ── Banner shared by every sheet ──────────────────────────────────────── */
function drawBanner(sh, lastCol, L, { title, hostelName, date, generatedAt, snapshotAt }) {
  sh.merge(0, 0, 0, lastCol, title, S.banner);
  sh.height(0, 34);
  sh.merge(1, 0, 1, lastCol, `${hostelName} · ${weekday(date, L.locale)} ${formatDate(date)}`, S.bannerSub);
  sh.height(1, 22);
  const meta = [`${L.generated} ${formatDateTime(generatedAt, L.locale)}`];
  if (snapshotAt) meta.push(`${L.snapshot} ${formatDateTime(snapshotAt, L.locale)}`);
  sh.merge(2, 0, 2, lastCol, meta.join('   ·   '), S.meta);
  sh.height(2, 18);
}

/* ═════════════════════════════════════════════════════════════════════════
   generateDailyReport
   ═════════════════════════════════════════════════════════════════════════ */
export function generateDailyReport({
  date,
  hostelName,
  rooms = [],
  roomStatus = {},
  cleaners = [],
  floors = [],
  extraRequests = [],
  lang = 'it',
  snapshotAt = null,
}) {
  const L = STRINGS[lang] || STRINGS.en;
  const name = hostelName || 'HostelKeep';
  const generatedAt = new Date();
  const bannerInfo = { hostelName: name, date, generatedAt, snapshotAt };

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: `${L.reportTitle} ${formatDate(date)}`, Author: 'HostelKeep', CreatedDate: generatedAt };

  const statusOf = (room) => roomStatus[room.id] || {};
  const assignedRooms = rooms.filter(r => r.assignedTo);
  const metricsById = {};
  assignedRooms.forEach(r => { metricsById[r.id] = roomMetrics(r, statusOf(r)); });

  const floorById = Object.fromEntries(floors.map(f => [f.id, f]));
  const floorLabel = (room) => floorById[room.floorId]?.name || '';
  const cleanerById = Object.fromEntries(cleaners.map(c => [c.id, c]));
  const cleanerLabel = (room) => cleanerById[room.assignedTo]?.username || '—';

  const activeCleaners = cleaners.filter(c => assignedRooms.some(r => r.assignedTo === c.id));
  const totals = sumMetrics(assignedRooms.map(r => metricsById[r.id]));
  const extraApproved = extraRequests.filter(r => r.status === 'approved').length;
  const pendingRequests = extraRequests.filter(r => r.status === 'pending' || !r.status).length;
  const roomPct = ratio(totals.roomsCleaned, totals.rooms);
  const bedPct = ratio(totals.bedsCleaned, totals.bedsToClean);
  const privatePct = ratio(totals.privateCleaned, totals.privateRooms);

  const perCleaner = activeCleaners.map(c => {
    const t = sumMetrics(assignedRooms.filter(r => r.assignedTo === c.id).map(r => metricsById[r.id]));
    return { name: c.username, ...t, pct: ratio(t.roomsCleaned, t.rooms) };
  });

  /* ── Sheet 1: Summary ───────────────────────────────────────────────── */
  {
    const sh = createSheet();
    const LAST = 7;
    drawBanner(sh, LAST, L, { title: L.reportTitle, ...bannerInfo });

    // KPI cards: rows 4–6, four cards two columns wide each
    // Four slots. Dorm beds and private rooms each get a card only when the
    // day actually had some; the freed slot goes to the next card in line.
    const cards = [
      { label: L.kpi.rooms, value: roomPct ?? '—', numFmt: PCT, tone: toneFor(roomPct),
        caption: L.kpi.roomsCaption(totals.roomsCleaned, totals.rooms) },
      totals.dormRooms > 0 && { label: L.kpi.beds, value: bedPct ?? '—', numFmt: PCT, tone: toneFor(bedPct),
        caption: L.kpi.bedsCaption(totals.bedsCleaned, totals.bedsToClean) },
      totals.privateRooms > 0 && { label: L.kpi.privates, value: privatePct ?? '—', numFmt: PCT, tone: toneFor(privatePct),
        caption: L.kpi.privatesCaption(totals.privateCleaned, totals.privateRooms) },
      { label: L.kpi.extra, value: totals.extraTime, numFmt: INT, tone: null, caption: L.kpi.extraCaption },
      { label: L.kpi.team, value: activeCleaners.length, numFmt: INT, tone: null, caption: L.kpi.teamCaption },
    ].filter(Boolean).slice(0, 4);
    cards.forEach((card, i) => {
      const c1 = i * 2;
      sh.merge(4, c1, 4, c1 + 1, card.label, S.kpiLabel);
      sh.merge(5, c1, 5, c1 + 1, card.value, { ...S.kpiValue(card.tone), numFmt: card.numFmt });
      sh.merge(6, c1, 6, c1 + 1, card.caption, S.kpiCaption);
    });
    sh.height(4, 20);
    sh.height(5, 40);
    sh.height(6, 18);

    // Indicators table (A:D) and floor progress (F:H), side by side
    const top = 8;
    sh.merge(top, 0, top, 3, L.indicatorsTitle, S.section);
    sh.merge(top, 5, top, LAST, L.floorsTitle, S.section);
    sh.height(top, 22);

    sh.merge(top + 1, 0, top + 1, 2, L.indicator, S.th);
    sh.set(top + 1, 3, L.value, S.th);
    sh.set(top + 1, 5, L.floor, S.th);
    sh.set(top + 1, 6, L.roomsDone, S.th);
    sh.set(top + 1, 7, L.completion, S.th);
    sh.height(top + 1, 20);

    const I = L.indicators;
    const indicatorRows = [
      [I.roomsAssigned, totals.rooms, INT],
      [I.roomsCompleted, totals.roomsCleaned, INT, TONE.good.text],
      [I.roomsPending, totals.rooms - totals.roomsCleaned, INT,
        totals.rooms - totals.roomsCleaned > 0 ? TONE.bad.text : null],
      [I.privateAssigned, totals.privateRooms, INT],
      [I.privateCleaned, totals.privateCleaned, INT, totals.privateCleaned ? TONE.good.text : null],
      [I.dormAssigned, totals.dormRooms, INT],
      [I.dormCleaned, totals.dormCleaned, INT, totals.dormCleaned ? TONE.good.text : null],
      [I.bedsToClean, totals.bedsToClean, INT],
      [I.bedsCleaned, totals.bedsCleaned, INT, TONE.good.text],
      [I.bedsSkipped, totals.bedsSkipped, INT, C.muted],
      [I.extraApproved, extraApproved, INT],
      [I.extraTime, totals.extraTime, INT],
      [I.activeCleaners, activeCleaners.length, INT],
      [I.pendingRequests, pendingRequests, INT, pendingRequests > 0 ? TONE.warn.text : null],
      [I.roomPct, roomPct ?? '—', PCT, toneFor(roomPct).text, true],
      [I.privatePct, privatePct ?? '—', PCT, toneFor(privatePct).text, true],
      [I.bedPct, bedPct ?? '—', PCT, toneFor(bedPct).text, true],
    ];
    indicatorRows.forEach(([label, value, numFmt, color, bold], i) => {
      const r = top + 2 + i;
      sh.merge(r, 0, r, 2, label, S.td(i, { bold }));
      sh.set(r, 3, value, S.td(i, { align: 'center', numFmt, color, bold: true }));
      sh.height(r, 18);
    });

    // Floor progress
    const floorGroups = new Map();
    assignedRooms.forEach(room => {
      const key = room.floorId && floorById[room.floorId] ? room.floorId : '__none__';
      if (!floorGroups.has(key)) floorGroups.set(key, []);
      floorGroups.get(key).push(metricsById[room.id]);
    });
    // Same ordering the Assign/Dashboard screens use: Ground Floor first,
    // numeric floors ascending, Garage last, anything else in between.
    const floorRank = (n) => {
      if (n === 'Ground Floor') return 0;
      if (n === 'Garage') return 999;
      const num = parseInt(n, 10);
      return Number.isNaN(num) ? 500 : num;
    };
    const floorOrder = [...floors]
      .sort((a, b) => floorRank(a.name) - floorRank(b.name))
      .map(f => f.id)
      .filter(id => floorGroups.has(id));
    if (floorGroups.has('__none__')) floorOrder.push('__none__');

    if (!floorOrder.length) {
      sh.merge(top + 2, 5, top + 2, LAST, '—', S.empty);
    }
    floorOrder.forEach((id, i) => {
      const r = top + 2 + i;
      const t = sumMetrics(floorGroups.get(id));
      const pct = ratio(t.roomsCleaned, t.rooms);
      const tone = toneFor(pct);
      sh.set(r, 5, id === '__none__' ? L.noFloor : floorById[id].name, S.td(i, { bold: true }));
      sh.set(r, 6, `${t.roomsCleaned} / ${t.rooms}`, S.td(i, { align: 'center' }));
      sh.set(r, 7, pct ?? '—', { ...S.tag(tone), numFmt: PCT });
    });

    // Housekeepers at a glance
    const teamTop = top + 2 + Math.max(indicatorRows.length, floorOrder.length) + 1;
    sh.merge(teamTop, 0, teamTop, LAST, L.teamTitle, S.section);
    sh.height(teamTop, 22);
    sh.merge(teamTop + 1, 0, teamTop + 1, 1, L.cols.cleaner, S.th);
    sh.set(teamTop + 1, 2, L.roomsDone, S.th);
    sh.set(teamTop + 1, 3, L.completion, S.th);
    sh.merge(teamTop + 1, 4, teamTop + 1, LAST, L.progress, S.th);
    sh.height(teamTop + 1, 20);

    if (!perCleaner.length) {
      sh.merge(teamTop + 2, 0, teamTop + 2, LAST, L.noActivity, S.empty);
    }
    perCleaner.forEach((pc, i) => {
      const r = teamTop + 2 + i;
      const tone = toneFor(pc.pct);
      sh.merge(r, 0, r, 1, pc.name, S.td(i, { bold: true }));
      sh.set(r, 2, `${pc.roomsCleaned} / ${pc.rooms}`, S.td(i, { align: 'center' }));
      sh.set(r, 3, pc.pct ?? '—', { ...S.tag(tone), numFmt: PCT });
      sh.merge(r, 4, r, LAST, progressBar(pc.pct, 32), S.bar(tone, i));
      sh.height(r, 18);
    });

    XLSX.utils.book_append_sheet(wb, sh.finish({ cols: [16, 16, 16, 16, 16, 16, 16, 16] }), L.sheets.summary);
  }

  /* ── Sheet 2: Bed activity ──────────────────────────────────────────── */
  {
    const sh = createSheet();
    const headers = [L.cols.date, L.cols.floor, L.cols.room, L.cols.bed, L.cols.roomType,
      L.cols.cleaner, L.cols.bedState, L.cols.outcome, L.cols.cleanerNote];
    const LAST = headers.length - 1;
    drawBanner(sh, LAST, L, { title: `${L.sheets.beds}`, ...bannerInfo });

    const H = 4;
    headers.forEach((h, c) => sh.set(H, c, h, S.th));
    sh.height(H, 22);

    const rows = [];
    assignedRooms.forEach(room => {
      const status = statusOf(room);
      const base = {
        floor: floorLabel(room),
        room: room.name,
        type: L.types[room.type] || room.type || '',
        cleaner: cleanerLabel(room),
        note: status.notes || '',
      };

      if (room.type === 'dorm' && room.beds?.length) {
        let added = 0;
        room.beds.forEach(bed => {
          const state = bedStateOf(status, bed.id);
          if (NO_WORK_STATES.has(state)) return;
          added++;
          rows.push({ ...base, bed: bed.name, state, done: status.bedStatus?.[bed.id]?.status === 'cleaned' });
        });
        if (!added && status.commonOnly) {
          rows.push({ ...base, bed: '—', state: 'common', done: !!status.cleaned });
        }
      } else {
        rows.push({ ...base, bed: '—', state: status.commonOnly ? 'common' : 'clean', done: !!status.cleaned });
      }
    });

    if (!rows.length) {
      sh.merge(H + 1, 0, H + 1, LAST, L.noActivity, S.empty);
      sh.height(H + 1, 24);
    }
    rows.forEach((row, i) => {
      const r = H + 1 + i;
      const outcomeTone = row.done ? TONE.good : TONE.bad;
      sh.set(r, 0, formatDate(date), S.td(i, { align: 'center', color: C.muted }));
      sh.set(r, 1, row.floor, S.td(i));
      sh.set(r, 2, row.room, S.td(i, { bold: true, align: 'center' }));
      sh.set(r, 3, row.bed, S.td(i, { align: 'center' }));
      sh.set(r, 4, row.type, S.td(i));
      sh.set(r, 5, row.cleaner, S.td(i));
      sh.set(r, 6, L.states[row.state] || row.state, S.tag(STATE_TONE[row.state] || TONE.neutral));
      sh.set(r, 7, row.done ? L.outcomes.cleaned : L.outcomes.pending, S.tag(outcomeTone));
      sh.set(r, 8, row.note, S.td(i, { wrap: true }));
      sh.height(r, row.note.length > 45 ? 30 : 18);
    });

    const last = H + Math.max(rows.length, 1);
    XLSX.utils.book_append_sheet(wb, sh.finish({
      cols: [12, 14, 10, 8, 13, 18, 18, 16, 44],
      autofilter: rows.length ? XLSX.utils.encode_range({ s: { r: H, c: 0 }, e: { r: last, c: LAST } }) : undefined,
    }), L.sheets.beds);
  }

  /* ── Sheet 3: Housekeepers ──────────────────────────────────────────── */
  {
    const sh = createSheet();
    const headers = [L.cols.cleaner, L.cols.roomsAssigned, L.cols.roomsCompleted, L.cols.bedsCleaned,
      L.cols.privateCleaned, L.cols.bedsSkipped, L.cols.extraTime, L.cols.extraCleanings, L.completion, L.progress];
    const LAST = headers.length - 1;
    drawBanner(sh, LAST, L, { title: L.sheets.cleaners, ...bannerInfo });

    const H = 4;
    headers.forEach((h, c) => sh.set(H, c, h, S.th));
    sh.height(H, 30);

    if (!perCleaner.length) {
      sh.merge(H + 1, 0, H + 1, LAST, L.noActivity, S.empty);
      sh.height(H + 1, 24);
    }
    perCleaner.forEach((pc, i) => {
      const r = H + 1 + i;
      const tone = toneFor(pc.pct);
      sh.set(r, 0, pc.name, S.td(i, { bold: true }));
      sh.set(r, 1, pc.rooms, S.td(i, { align: 'center', numFmt: INT }));
      sh.set(r, 2, pc.roomsCleaned, S.td(i, { align: 'center', numFmt: INT }));
      sh.set(r, 3, pc.bedsCleaned, S.td(i, { align: 'center', numFmt: INT }));
      sh.set(r, 4, pc.privateCleaned, S.td(i, { align: 'center', numFmt: INT }));
      sh.set(r, 5, pc.bedsSkipped, S.td(i, { align: 'center', numFmt: INT, color: C.muted }));
      sh.set(r, 6, pc.extraTime, S.td(i, { align: 'center', numFmt: INT, color: pc.extraTime ? TONE.warn.text : null }));
      sh.set(r, 7, pc.extraCleanings, S.td(i, { align: 'center', numFmt: INT }));
      sh.set(r, 8, pc.pct ?? '—', { ...S.tag(tone), numFmt: PCT });
      sh.set(r, 9, progressBar(pc.pct), S.bar(tone, i));
      sh.height(r, 20);
    });

    if (perCleaner.length) {
      const r = H + 1 + perCleaner.length;
      const first = H + 2;              // 1-based Excel row of the first data row
      const lastRow = r;                // 1-based Excel row of the last data row
      const col = (c) => XLSX.utils.encode_col(c);
      sh.set(r, 0, L.total, S.total({ align: 'left' }));
      [
        [1, totals.rooms], [2, totals.roomsCleaned], [3, totals.bedsCleaned],
        [4, totals.privateCleaned], [5, totals.bedsSkipped], [6, totals.extraTime],
        [7, totals.extraCleanings],
      ].forEach(([c, v]) => {
        sh.set(r, c, v, S.total({ numFmt: INT }), `SUM(${col(c)}${first}:${col(c)}${lastRow})`);
      });
      sh.set(r, 8, roomPct ?? 0, S.total({ numFmt: PCT }), `IF(B${r + 1}=0,0,C${r + 1}/B${r + 1})`);
      sh.set(r, 9, progressBar(roomPct), { ...S.total({ align: 'left' }), font: { name: 'Consolas', sz: 10, bold: true, color: { rgb: C.navy } } });
      sh.height(r, 22);
    }

    XLSX.utils.book_append_sheet(wb, sh.finish({ cols: [22, 12, 12, 12, 12, 12, 13, 12, 14, 24] }), L.sheets.cleaners);
  }

  /* ── Sheet 4: Notes & alerts ────────────────────────────────────────── */
  {
    const sh = createSheet();
    const headers = [L.cols.date, L.cols.floor, L.cols.room, L.cols.source, L.cols.author, L.cols.extraTime, L.cols.text];
    const LAST = headers.length - 1;
    drawBanner(sh, LAST, L, { title: L.sheets.notes, ...bannerInfo });

    const H = 4;
    headers.forEach((h, c) => sh.set(H, c, h, S.th));
    sh.height(H, 22);

    const entries = [];
    assignedRooms.forEach(room => {
      const status = statusOf(room);
      const base = { floor: floorLabel(room), room: room.name };
      const cleanerName = cleanerLabel(room);
      const extra = Number(status.extraTime || 0);

      if (status.managerNotes) {
        entries.push({ ...base, source: 'manager', author: L.managerAuthor, minutes: null, text: status.managerNotes });
      }
      if (status.notes) {
        entries.push({ ...base, source: 'cleaner', author: cleanerName, minutes: extra || null, text: status.notes });
      } else if (extra > 0) {
        entries.push({ ...base, source: 'extra', author: cleanerName, minutes: extra, text: `+${extra} min` });
      }
      if (status.earlyCheckIn || status.lateCheckOut) {
        const flags = [];
        if (status.earlyCheckIn) flags.push(L.states.early);
        if (status.lateCheckOut) flags.push(L.states.late);
        entries.push({ ...base, source: 'flag', author: L.managerAuthor, minutes: null, text: flags.join(', ') });
      }
    });

    const SOURCE_TONE = { manager: TONE.brand, cleaner: TONE.gold, extra: TONE.warn, flag: TONE.info };

    if (!entries.length) {
      sh.merge(H + 1, 0, H + 1, LAST, L.noNotes, S.empty);
      sh.height(H + 1, 24);
    }
    entries.forEach((e, i) => {
      const r = H + 1 + i;
      sh.set(r, 0, formatDate(date), S.td(i, { align: 'center', color: C.muted }));
      sh.set(r, 1, e.floor, S.td(i));
      sh.set(r, 2, e.room, S.td(i, { bold: true, align: 'center' }));
      sh.set(r, 3, L.sources[e.source], S.tag(SOURCE_TONE[e.source]));
      sh.set(r, 4, e.author, S.td(i));
      sh.set(r, 5, e.minutes ?? '', S.td(i, { align: 'center', numFmt: INT, color: e.minutes ? TONE.warn.text : null, bold: !!e.minutes }));
      sh.set(r, 6, e.text, S.td(i, { wrap: true }));
      sh.height(r, e.text.length > 60 ? 32 : 18);
    });

    if (entries.length) {
      const r = H + 1 + entries.length;
      for (let c = 0; c <= LAST; c++) sh.set(r, c, '', S.total());
      sh.set(r, 4, L.totalMin, S.total({ align: 'right' }));
      sh.set(r, 5, totals.extraTime, S.total({ numFmt: INT }), `SUM(F${H + 2}:F${r})`);
      sh.height(r, 22);
    }

    const last = H + Math.max(entries.length, 1);
    XLSX.utils.book_append_sheet(wb, sh.finish({
      cols: [12, 14, 10, 18, 18, 14, 60],
      autofilter: entries.length ? XLSX.utils.encode_range({ s: { r: H, c: 0 }, e: { r: last, c: LAST } }) : undefined,
    }), L.sheets.notes);
  }

  /* ── Sheet 5: Legend ────────────────────────────────────────────────── */
  {
    const sh = createSheet();
    const LAST = 2;
    const G = L.legend;
    sh.merge(0, 0, 0, LAST, G.title, S.banner);
    sh.height(0, 34);

    let r = 2;
    const section = (title) => {
      sh.merge(r, 0, r, LAST, title, S.section);
      sh.height(r, 22);
      r += 1;
    };

    section(G.bedStates);
    G.bedStateRows.forEach(([key, desc], i) => {
      sh.set(r, 0, L.states[key], S.tag(STATE_TONE[key]));
      sh.merge(r, 1, r, LAST, desc, S.td(i));
      sh.height(r, 20);
      r += 1;
    });
    r += 1;

    section(G.outcomesTitle);
    G.outcomeRows.forEach(([key, desc], i) => {
      sh.set(r, 0, L.outcomes[key], S.tag(key === 'cleaned' ? TONE.good : TONE.bad));
      sh.merge(r, 1, r, LAST, desc, S.td(i));
      sh.height(r, 20);
      r += 1;
    });
    r += 1;

    section(G.colorsTitle);
    G.colorRows.forEach(([tone, range, desc], i) => {
      sh.set(r, 0, range, S.tag(tone));
      sh.merge(r, 1, r, LAST, desc, S.td(i));
      sh.height(r, 20);
      r += 1;
    });
    r += 1;

    sh.merge(r, 0, r + 1, LAST, G.note, {
      font: font({ sz: 9, italic: true, color: { rgb: C.muted } }),
      fill: fill(C.goldSoft),
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
    });

    XLSX.utils.book_append_sheet(wb, sh.finish({ cols: [22, 40, 40] }), L.sheets.legend);
  }

  return wb;
}

/* Web download. Uses xlsx-js-style's writer so the styles survive. */
export function downloadDailyReport(data, fileName) {
  const wb = generateDailyReport(data);
  const safeHostel = String(data.hostelName || 'HostelKeep').replace(/[\\/:*?"<>|]+/g, '').trim();
  XLSX.writeFile(wb, fileName || `HostelKeep_Report_${data.date}_${safeHostel}.xlsx`);
}