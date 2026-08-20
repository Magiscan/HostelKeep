import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert,
} from 'react-native';
// NOTE: switched from the plain 'xlsx' package to 'xlsx-js-style'. Same API
// (utils.book_new, aoa_to_sheet, writeFile, etc.) but it actually WRITES cell
// styles (bold, borders, fills) into the .xlsx file — the vanilla community
// 'xlsx' package silently drops styling on write. Run `npm install xlsx-js-style`.
import XLSX from 'xlsx-js-style';
import Icon from '../../components/Icon';
import { COLORS, RADIUS, FONTS, FONT_SIZE, SPACING, SHADOW } from '../../theme';
import {
  FloorHeader, EmptyState, Badge, Avatar, Label, Input,
} from '../../components/UI';
import { useApp } from '../../contexts/AppContext';

const BED_STATES = [
  { key: 'clean',    label: 'To clean',   color: '#3B82F6', bg: '#EFF6FF' },    // Blue
  { key: 'stayover', label: 'Stay‑over',  color: '#94A3B8', bg: '#F8FAFC' },    // Grey
  { key: 'late',     label: 'Late c/out', color: '#8B5CF6', bg: '#F5F3FF' },    // Violet
  { key: 'early',    label: 'Early c/in', color: '#F97316', bg: '#FFF7ED' },    // Orange
  { key: 'noone',    label: 'Inspected',  color: '#22C55E', bg: '#F0FDF4' },    // Green
];
const BED_CYCLE = ['clean', 'stayover', 'late', 'early', 'noone'];
const BED_STATE_LABELS = Object.fromEntries(BED_STATES.map(s => [s.key, s.label]));

const CLEANER_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#65A30D', '#0891B2', '#4F46E5', '#BE123C',
];

const EXTRA_BLANK_ROWS = 4;
function formatDateIT(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}
function sanitizeSheetName(name) {
  const cleaned = (name || 'Cleaner').replace(/[:\\/?*[\]]/g, '').trim();
  return cleaned.slice(0, 31) || 'Cleaner';
}

// A room "needs assignment" if there's actually something to do: common areas
// checked, a dorm bed that isn't stayover/inspected, or (for private rooms) at
// least one attribute checked. Used by the toolbar filter below.
function roomNeedsAssignment(room, status) {
  if (status.commonOnly) return true;
  if (room.type === 'dorm') {
    const assign = status.assignmentBedStatus || {};
    return (room.beds || []).some(b => {
      const s = assign[b.id]?.status || 'noone';
      return s !== 'noone' && s !== 'stayover';
    });
  }
  if (room.type === 'private') {
    return Object.values(status.assignmentAttributes || {}).some(Boolean);
  }
  return false;
}

/* ─── Excel export styling ─────────────────────────────────────── */
const XLS_BORDER_THIN = { style: 'thin', color: { rgb: 'FFCBD5E1' } };
const XLS_BORDER_ALL = { top: XLS_BORDER_THIN, bottom: XLS_BORDER_THIN, left: XLS_BORDER_THIN, right: XLS_BORDER_THIN };
const XLS_BORDER_BOTTOM_THICK = { bottom: { style: 'medium', color: { rgb: 'FF334155' } } };

const xlsStyles = {
  title: {
    font: { bold: true, sz: 14, color: { rgb: 'FFFFFFFF' } },
    fill: { fgColor: { rgb: 'FF1E3A5F' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  header: {
    font: { bold: true, sz: 11, color: { rgb: 'FFFFFFFF' } },
    fill: { fgColor: { rgb: 'FF334155' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: XLS_BORDER_ALL,
  },
  roomCell: (shaded) => ({
    font: { bold: true, sz: 11 },
    fill: shaded ? { fgColor: { rgb: 'FFF8FAFC' } } : undefined,
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: XLS_BORDER_ALL,
  }),
  dataCell: (shaded) => ({
    font: { sz: 10 },
    fill: shaded ? { fgColor: { rgb: 'FFF8FAFC' } } : undefined,
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: XLS_BORDER_ALL,
  }),
  commonOnlyCell: (shaded) => ({
    font: { bold: true, sz: 10, italic: true, color: { rgb: 'FF1E3A5F' } },
    fill: { fgColor: { rgb: 'FFDCEAFB' } },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: XLS_BORDER_ALL,
  }),
  flagsCell: (shaded) => ({
    font: { bold: true, sz: 10, color: { rgb: 'FFB45309' } },
    fill: shaded ? { fgColor: { rgb: 'FFF8FAFC' } } : undefined,
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: XLS_BORDER_ALL,
  }),
  doneCell: (shaded) => ({
    font: { sz: 11 },
    fill: shaded ? { fgColor: { rgb: 'FFF8FAFC' } } : undefined,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: XLS_BORDER_ALL,
  }),
  signatureLabel: {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: 'left', vertical: 'bottom' },
  },
  signatureLine: {
    border: XLS_BORDER_BOTTOM_THICK,
  },
  blankRow: {
    border: XLS_BORDER_ALL,
  },
};


// ─── Simple "are you sure?" confirmation dialog ──────────────────
function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!visible) return null;
  return (
    <View style={confirmStyles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
      <View style={confirmStyles.card}>
        <Text style={confirmStyles.title}>{title}</Text>
        <Text style={confirmStyles.message}>{message}</Text>
        <View style={confirmStyles.actions}>
          <TouchableOpacity onPress={onCancel} style={[confirmStyles.btn, confirmStyles.btnCancel]}>
            <Text style={confirmStyles.btnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} style={[confirmStyles.btn, confirmStyles.btnDanger]}>
            <Text style={[confirmStyles.btnText, { color: COLORS.white }]}>{confirmLabel || 'Confirm'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const confirmStyles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    padding: SPACING[6], zIndex: 60,
  },
  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING[5], ...SHADOW.md,
  },
  title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[2] },
  message: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING[5] },
  actions: { flexDirection: 'row', gap: SPACING[3] },
  btn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  btnDanger: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  btnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.text },
});

export default function AssignScreen() {
  const { t } = useTranslation();
  const {
    rooms, cleaners, floors, assignRoomWithDetails, unassignRoom, roomStatus,
    updateRoomStatus, roomAttributes,
  } = useApp();

  const [search, setSearch] = useState('');
  // Filters the room list down to rooms that actually have something to do —
  // useful when a second manager assigns bed states first and a different
  // manager assigns rooms to cleaners afterwards.
  const [onlyNeedsAssignment, setOnlyNeedsAssignment] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState(new Set());
  const [activeCleanerIds, setActiveCleanerIds] = useState(new Set(cleaners.map(c => c.id)));

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedCleaner, setSelectedCleaner] = useState(null);
  const [bedAssignments, setBedAssignments] = useState({});
  const [managerNotes, setManagerNotes] = useState('');
  const [commonOnly, setCommonOnly] = useState(false);
  const [assignmentAttributes, setAssignmentAttributes] = useState({});
  const [earlyCheckIn, setEarlyCheckIn] = useState(false);
  const [lateCheckOut, setLateCheckOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Pending cleaner chosen for a bulk (multi-room) assignment — not applied until
  // the manager taps "Confirm" in the selection bar.
  const [bulkCleanerId, setBulkCleanerId] = useState(null);

  // Which "are you sure?" dialog is open: null | 'clearAll' | 'resetBeds'
  const [confirmDialog, setConfirmDialog] = useState(null);

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(term));
    }
    if (onlyNeedsAssignment) {
      list = list.filter(r => roomNeedsAssignment(r, roomStatus[r.id] || {}));
    }
    return list;
  }, [rooms, search, onlyNeedsAssignment, roomStatus]);

  const sortedFloors = useMemo(() => {
    return [...floors].sort((a, b) => {
      const order = name => {
        if (name === 'Ground Floor') return 0;
        if (name === 'Garage') return 999;
        const num = parseInt(name);
        if (!isNaN(num)) return num;
        return 500;
      };
      return order(a.name) - order(b.name);
    });
  }, [floors]);

  const activeCleaners = cleaners.filter(c => activeCleanerIds.has(c.id));

  const toggleBedState = useCallback(async (roomId, bedId) => {
    const status = roomStatus[roomId] || {};
    const assignments = status.assignmentBedStatus || {};
    // Default to inspected if no assignment exists yet
    const current = assignments[bedId]?.status || 'noone';
    // Toggle only between 'clean' (To clean) and 'noone' (Inspected)
    const nextStatus = current === 'clean' ? 'noone' : 'clean';

    await updateRoomStatus(roomId, {
      assignmentBedStatus: {
        ...assignments,
        [bedId]: { status: nextStatus, reason: nextStatus },
      },
    });
  }, [roomStatus, updateRoomStatus]);

  const toggleRoomSelection = useCallback((roomId) => {
    setSelectedRoomIds(prev => {
      const next = new Set(prev);
      next.has(roomId) ? next.delete(roomId) : next.add(roomId);
      return next;
    });
  }, []);

  const bulkAssign = useCallback(async (cleanerId) => {
    const ids = Array.from(selectedRoomIds);
    if (!ids.length) return;
    for (const roomId of ids) {
      const status = roomStatus[roomId] || {};
      await assignRoomWithDetails(roomId, cleanerId,
        status.assignmentBedStatus || {}, status.managerNotes || '',
        status.commonOnly || false, status.assignmentAttributes || {},
        status.earlyCheckIn || false, status.lateCheckOut || false);
    }
    setSelectedRoomIds(new Set());
    setBulkCleanerId(null);
  }, [selectedRoomIds, assignRoomWithDetails, roomStatus]);

  const handleUnassign = useCallback((roomId) => {
    unassignRoom(roomId);
    setSelectedRoomIds(prev => { const next = new Set(prev); next.delete(roomId); return next; });
  }, [unassignRoom]);

  const toggleCommonOnly = useCallback(async (roomId) => {
    const status = roomStatus[roomId] || {};
    await updateRoomStatus(roomId, { commonOnly: !status.commonOnly });
  }, [roomStatus, updateRoomStatus]);

  const toggleRoomAttribute = useCallback(async (roomId, attr) => {
    const status = roomStatus[roomId] || {};
    const attrs = { ...(status.assignmentAttributes || {}) };
    attrs[attr] = !attrs[attr];
    await updateRoomStatus(roomId, { assignmentAttributes: attrs });
  }, [roomStatus, updateRoomStatus]);

  // FIXED: now also blanks out assignmentAttributes on private rooms. Without
  // this, a room cleared here could still have leftover checked attributes and
  // wrongly keep passing the "needs assignment" filter above.
  const clearAll = () => {
    rooms.forEach(room => {
      unassignRoom(room.id);
      if (room.type === 'private') {
        updateRoomStatus(room.id, { assignmentAttributes: {} });
      }
    });
  };

  const resetBedStates = useCallback(async () => {
    const updates = [];
    rooms.forEach(room => {
      if (room.type !== 'dorm' || !room.beds?.length) return;

      const defaultAssignments = {};
      room.beds.forEach(bed => {
        // Default state = Inspected (noone)
        defaultAssignments[bed.id] = { status: 'noone', reason: 'noone' };
      });

      updates.push(
        updateRoomStatus(room.id, { assignmentBedStatus: defaultAssignments })
      );
    });

    await Promise.all(updates);
  }, [rooms, updateRoomStatus]);

  const handleExportSheets = () => {
    const assignedCleanerIds = [...new Set(rooms.filter(r => r.assignedTo).map(r => r.assignedTo))];
    if (!assignedCleanerIds.length) {
      Alert.alert('No assignments', 'Assign rooms first.');
      return;
    }
    const wb = XLSX.utils.book_new();
    const dateStr = formatDateIT(new Date());
    const usedSheetNames = new Set();
    const COLS = ['Room', 'Beds', 'Flags', 'Notes', 'Done'];
    const COL_COUNT = COLS.length;

    assignedCleanerIds.forEach(cleanerId => {
      const cleaner = cleaners.find(c => c.id === cleanerId);
      if (!cleaner) return;
      const assigned = rooms.filter(r => r.assignedTo === cleanerId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      // Build plain values first; we'll style cell-by-cell afterwards.
      const aoa = [];
      aoa.push([`${cleaner.username} – ${dateStr}`]);
      aoa.push(COLS);

      // Track per-row metadata needed for styling/row-height (kept in the
      // same order as aoa data rows).
      const rowMeta = [];
      // FIXED: this is now the single source of truth for "which rooms ended
      // up on the sheet". Every downstream row-index calculation (dataEndRow,
      // blank rows, signature row, the per-row styling pass) reads from THIS
      // array's length — never from `assigned` — which is what keeps rowMeta
      // and the printed rows in sync once rooms with nothing to clean are
      // skipped below.
      const printedRooms = [];

      assigned.forEach(room => {
        const status = roomStatus[room.id] || {};
        let bedsText = '';
        let isCommonOnly = false;
        let hasActionableWork = true;

        if (status.commonOnly) {
          isCommonOnly = true;
          bedsText = 'Common areas only';
        } else if (room.type === 'dorm' && room.beds?.length) {
          const assign = status.assignmentBedStatus || {};
          // 'noone' (inspected) and 'stayover' both mean nothing to clean —
          // both are left off the printed sheet entirely, not just labelled.
          const lines = room.beds
            .filter(b => {
              const s = assign[b.id]?.status || 'noone';
              return s !== 'noone' && s !== 'stayover';
            })
            .map(b => {
              const bedState = assign[b.id]?.status || 'clean';
              // "To clean" is the default expected action, so just the bed
              // name is enough; anything else (late, early) gets its state
              // spelled out right next to the bed.
              return bedState === 'clean' ? b.name : `${b.name} — ${BED_STATE_LABELS[bedState]}`;
            });
          bedsText = lines.join('\n');
          hasActionableWork = lines.length > 0;
        } else if (room.type === 'private') {
          const attrs = status.assignmentAttributes || {};
          const selected = Object.keys(attrs).filter(key => attrs[key]);
          bedsText = selected.join(', ');
          hasActionableWork = selected.length > 0;
        }

        // Safety net: if there's nothing to clean here and it isn't a
        // common-only room, leave the room off this cleaner's sheet entirely
        // rather than printing an empty/confusing row.
        if (!isCommonOnly && !hasActionableWork) return;

        const flagParts = [];
        if (status.earlyCheckIn) flagParts.push('Early check-in');
        if (status.lateCheckOut) flagParts.push('Late check-out');
        const flagsText = flagParts.join('\n');

        const notesText = status.managerNotes || '';

        aoa.push([room.name, bedsText, flagsText, notesText, '']);
        rowMeta.push({
          isCommonOnly,
          lineCount: Math.max(
            1,
            bedsText.split('\n').length,
            flagsText.split('\n').length,
            notesText.split('\n').length
          ),
        });
        printedRooms.push(room);
      });

      // A cleaner whose entire shift turned out to be stayovers/inspected
      // beds gets no sheet at all, rather than an empty one.
      if (printedRooms.length === 0) return;

      const dataStartRow = 2; // 0-indexed: row 0 = title, row 1 = header
      const dataEndRow = dataStartRow + printedRooms.length - 1;

      for (let i = 0; i < EXTRA_BLANK_ROWS; i++) aoa.push(['', '', '', '', '']);
      const blankStartRow = dataEndRow + 1;
      const blankEndRow = blankStartRow + EXTRA_BLANK_ROWS - 1;

      const signatureRow = blankEndRow + 1;
      aoa.push(['Signature:', '', '', 'End Time:', '']);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } },
        { s: { r: signatureRow, c: 1 }, e: { r: signatureRow, c: 2 } },
      ];
      ws['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 16 }, { wch: 32 }, { wch: 9 }];

      // ── Title row ──
      for (let c = 0; c < COL_COUNT; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        ws[addr].s = xlsStyles.title;
      }
      ws['!rows'] = ws['!rows'] || [];
      ws['!rows'][0] = { hpt: 24 };

      // ── Header row ──
      for (let c = 0; c < COL_COUNT; c++) {
        const addr = XLSX.utils.encode_cell({ r: 1, c });
        ws[addr].s = xlsStyles.header;
      }
      ws['!rows'][1] = { hpt: 20 };

      // ── Data rows ── (iterate printedRooms, NOT the original `assigned`)
      printedRooms.forEach((room, i) => {
        const r = dataStartRow + i;
        const meta = rowMeta[i];
        const shaded = i % 2 === 1;
        for (let c = 0; c < COL_COUNT; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) ws[addr] = { t: 's', v: '' };
          if (c === 0) ws[addr].s = xlsStyles.roomCell(shaded);
          else if (c === 1) ws[addr].s = meta.isCommonOnly ? xlsStyles.commonOnlyCell(shaded) : xlsStyles.dataCell(shaded);
          else if (c === 2) ws[addr].s = xlsStyles.flagsCell(shaded);
          else if (c === 3) ws[addr].s = xlsStyles.dataCell(shaded);
          else ws[addr].s = xlsStyles.doneCell(shaded);
        }
        ws['!rows'][r] = { hpt: Math.max(18, meta.lineCount * 14) };
      });

      // ── Blank spacer rows (still gridded, so managers/cleaners can jot
      //     down extra notes by hand if needed) ──
      for (let r = blankStartRow; r <= blankEndRow; r++) {
        for (let c = 0; c < COL_COUNT; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) ws[addr] = { t: 's', v: '' };
          ws[addr].s = xlsStyles.blankRow;
        }
      }

      // ── Signature / end-time row ──
      {
        const addrSigLabel = XLSX.utils.encode_cell({ r: signatureRow, c: 0 });
        const addrSigLine = XLSX.utils.encode_cell({ r: signatureRow, c: 1 });
        const addrEndLabel = XLSX.utils.encode_cell({ r: signatureRow, c: 3 });
        const addrEndLine = XLSX.utils.encode_cell({ r: signatureRow, c: 4 });
        if (!ws[addrSigLine]) ws[addrSigLine] = { t: 's', v: '' };
        if (!ws[addrEndLine]) ws[addrEndLine] = { t: 's', v: '' };
        ws[addrSigLabel].s = xlsStyles.signatureLabel;
        ws[addrSigLine].s = xlsStyles.signatureLine;
        ws[addrEndLabel].s = xlsStyles.signatureLabel;
        ws[addrEndLine].s = xlsStyles.signatureLine;
        ws['!rows'][signatureRow] = { hpt: 26 };
      }

      // ── Print setup: one page wide, landscape, small margins ──
      ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, scale: 95 };
      ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };

      let name = sanitizeSheetName(cleaner.username);
      let unique = name, n = 1;
      while (usedSheetNames.has(unique)) unique = `${name.slice(0, 28)}_${n++}`;
      usedSheetNames.add(unique);
      XLSX.utils.book_append_sheet(wb, ws, unique);
    });
    XLSX.writeFile(wb, `assignment_sheets_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };


  const openDetail = (room) => {
    const currentCleaner = cleaners.find(c => c.id === room.assignedTo);
    setSelectedRoom(room);
    setSelectedCleaner(currentCleaner || null);   // unassigned → null
    const existing = roomStatus[room.id] || {};
    const beds = {};
    if (room.type === 'dorm' && room.beds) {
        room.beds.forEach(b => {
        beds[b.id] = (existing.assignmentBedStatus || {})[b.id] || { status: 'noone', reason: 'noone' };
        });
    }
    setBedAssignments(beds);
    setCommonOnly(existing.commonOnly || false);

    // Reconcile with the room's CURRENT attribute configuration (Rooms/Setup is the
    // source of truth for which attributes apply to this room). We only reuse a
    // true/false choice from a previous assignment for attributes that still exist
    // on the room today; anything new or changed since then defaults to selected.
    const roomOwnAttrs = room.attributes
      ? Object.keys(room.attributes).filter(k => room.attributes[k])
      : [];
    const savedAttrs = existing.assignmentAttributes || {};
    const reconciledAttrs = {};
    roomOwnAttrs.forEach(key => {
      reconciledAttrs[key] = Object.prototype.hasOwnProperty.call(savedAttrs, key)
        ? !!savedAttrs[key]
        : true;
    });
    setAssignmentAttributes(reconciledAttrs);

    setEarlyCheckIn(existing.earlyCheckIn || false);
    setLateCheckOut(existing.lateCheckOut || false);
    setManagerNotes(existing.managerNotes || '');
    setPanelOpen(true);
    };

    const closePanel = () => {
    setPanelOpen(false);
    setSelectedRoom(null);
    setSelectedCleaner(null);
    };

  const handleAssignFromPanel = async () => {
    if (!selectedRoom || !selectedCleaner) return;
    const finalBeds = {};
    if (selectedRoom.type === 'dorm' && selectedRoom.beds) {
      selectedRoom.beds.forEach(b => { finalBeds[b.id] = bedAssignments[b.id] || { status: 'noone', reason: 'noone' }; });
    }
    const attrs = {};
    Object.entries(assignmentAttributes).forEach(([k, v]) => { if (v) attrs[k] = true; });
    await assignRoomWithDetails(selectedRoom.id, selectedCleaner.id, finalBeds, managerNotes, commonOnly, attrs, earlyCheckIn, lateCheckOut);
    closePanel();
  };

  // Lets the manager save the bed/attribute state for a room WITHOUT assigning
  // it to a cleaner yet — useful for prepping several rooms' bed states first
  // and deciding who cleans what afterwards.
  // Safety net: if a cleaner IS already selected (e.g. the manager picked one
  // and then tapped this button by mistake, expecting it to assign), treat it
  // as a real assign instead of silently leaving the room unassigned.
  const handleSaveStateFromPanel = async () => {
    if (!selectedRoom) return;
    if (selectedCleaner) {
      await handleAssignFromPanel();
      return;
    }
    const finalBeds = {};
    if (selectedRoom.type === 'dorm' && selectedRoom.beds) {
      selectedRoom.beds.forEach(b => { finalBeds[b.id] = bedAssignments[b.id] || { status: 'noone', reason: 'noone' }; });
    }
    const attrs = {};
    Object.entries(assignmentAttributes).forEach(([k, v]) => { if (v) attrs[k] = true; });
    await updateRoomStatus(selectedRoom.id, {
      assignmentBedStatus: finalBeds,
      commonOnly,
      assignmentAttributes: attrs,
      earlyCheckIn,
      lateCheckOut,
      managerNotes,
    });
    closePanel();
  };

  if (!rooms.length) return <EmptyState icon="📋" title={t('noRoomsToAssign')} subtitle={t('addRoomsFirst')} />;
  if (!cleaners.length) return <EmptyState icon="👤" title={t('noCleaners')} subtitle={t('addCleanersFirst')} />;

  const selectedRoomsList = useMemo(
    () => rooms.filter(r => selectedRoomIds.has(r.id)),
    [rooms, selectedRoomIds]
  );

  // If every currently-selected room already happens to be assigned to the
  // same cleaner (e.g. the manager assigned them one-by-one via the side
  // panel), pre-fill that as the bulk cleaner so Confirm works right away.
  const autoDetectedCleanerId = (() => {
    if (!selectedRoomsList.length) return null;
    const assignedIds = selectedRoomsList.map(r => r.assignedTo).filter(Boolean);
    if (assignedIds.length !== selectedRoomsList.length) return null;
    return assignedIds.every(id => id === assignedIds[0]) ? assignedIds[0] : null;
  })();
  const displayCleanerId = bulkCleanerId || autoDetectedCleanerId;
  const displayCleaner = cleaners.find(c => c.id === displayCleanerId) || null;

  const handleConfirmBulkAssign = async () => {
    if (!displayCleanerId) return;
    await bulkAssign(displayCleanerId);
  };

  const handleClearSelection = () => {
    setSelectedRoomIds(new Set());
    setBulkCleanerId(null);
  };

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.pageTitle}>{t('assignments')}</Text>
          <Text style={styles.subtitle}>{t('tapToAssign')}</Text>
        </View>
        <View style={styles.toolbarRight}>
          <View style={styles.searchBar}>
            <Icon name="search-outline" size={16} color={COLORS.textMuted} style={{ marginRight: SPACING[2] }} />
            <TextInput value={search} onChangeText={setSearch} placeholder={t('search')} placeholderTextColor={COLORS.textMuted} style={styles.searchInput} />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                <Icon name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setOnlyNeedsAssignment(v => !v)}
            style={[styles.toolBtn, onlyNeedsAssignment && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
            activeOpacity={0.7}
          >
            <Icon name={onlyNeedsAssignment ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={onlyNeedsAssignment ? COLORS.white : COLORS.primary} />
            <Text style={[styles.toolBtnText, onlyNeedsAssignment && { color: COLORS.white }]}>
              {t('needsAssignment') || 'Needs assignment'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportSheets} style={styles.toolBtn}>
            <Icon name="print-outline" size={16} color={COLORS.primary} />
            <Text style={styles.toolBtnText}>{t('printSheets') || 'Print'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setConfirmDialog('resetBeds')}
            style={[styles.toolBtn, { backgroundColor: COLORS.background, borderColor: COLORS.border }]}
            activeOpacity={0.7}
          >
            <Icon name="refresh-circle" size={16} color={COLORS.textSecondary} />
            <Text style={[styles.toolBtnText, { color: COLORS.textSecondary }]}>
              {t('resetBeds') || 'Reset Beds'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setConfirmDialog('clearAll')} style={[styles.toolBtn, { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger }]}>
            <Icon name="close-circle-outline" size={16} color={COLORS.danger} />
            <Text style={[styles.toolBtnText, { color: COLORS.danger }]}>{t('clearAll')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.body}>
        <View style={styles.roomAreaWrapper}>
          {/* Persistent selection bar – improved design */}
          {selectedRoomIds.size > 0 && (
            <View style={styles.selectionBar}>
              <View style={styles.selectionBarInner}>
                <View style={styles.selectionLeft}>
                  <Icon name="checkbox-outline" size={18} color={COLORS.primary} style={{ marginRight: SPACING[2] }} />
                  <Text style={styles.selectionBarTitle}>
                    {t('selectedRooms', { count: selectedRoomIds.size }) || `${selectedRoomIds.size} room${selectedRoomIds.size > 1 ? 's' : ''} selected`}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectionScroll}>
                  {selectedRoomsList.map(room => {
                    const roomCleaner = cleaners.find(c => c.id === room.assignedTo);
                    return (
                      <TouchableOpacity key={room.id} style={styles.selectionChip} onPress={() => toggleRoomSelection(room.id)}>
                        <Text style={styles.selectionChipText}>
                          {room.name}{roomCleaner ? ` · ${roomCleaner.username}` : ''}
                        </Text>
                        <Icon name="close" size={12} color={COLORS.primary} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {displayCleaner && (
                  <View style={styles.pendingCleanerTag}>
                    <View style={[styles.cleanerDot, { backgroundColor: CLEANER_COLORS[cleaners.findIndex(c => c.id === displayCleaner.id) % CLEANER_COLORS.length] }]} />
                    <Text style={styles.pendingCleanerText}>
                      {(t('assigningTo') || 'Assigning to') + ': ' + displayCleaner.username}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.confirmSelectionBtn, !displayCleanerId && styles.confirmSelectionBtnDisabled]}
                  onPress={handleConfirmBulkAssign}
                  disabled={!displayCleanerId}
                  activeOpacity={0.7}
                >
                  <Icon name="checkmark-circle-outline" size={16} color={displayCleanerId ? COLORS.white : COLORS.textMuted} />
                  <Text style={[styles.confirmSelectionText, !displayCleanerId && { color: COLORS.textMuted }]}>
                    {t('confirm') || 'Confirm'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearSelectionBtn} onPress={handleClearSelection}>
                  <Text style={styles.clearSelectionText}>{t('clearSelection') || 'Clear'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ScrollView style={styles.roomArea} contentContainerStyle={styles.roomAreaContent}>
            {filteredRooms.length === 0 && (search.trim() !== '' || onlyNeedsAssignment) && (
              <EmptyState icon="🔍" title={t('noResults')} subtitle="" />
            )}
            {sortedFloors.map(floor => {
              const floorRooms = filteredRooms.filter(r => r.floorId === floor.id);
              if (!floorRooms.length) return null;
              return (
                <View key={floor.id} style={{ marginBottom: SPACING[8] }}>
                  <FloorHeader label={floor.name} />
                  <View style={styles.roomGrid}>
                    {floorRooms.map(room => {
                      const currentCleaner = cleaners.find(c => c.id === room.assignedTo);
                      const isSelected = selectedRoomIds.has(room.id);
                      const status = roomStatus[room.id] || {};
                      const bedAssigns = status.assignmentBedStatus || {};
                      const beds = room.beds || [];
                      const cleanerColor = currentCleaner
                        ? CLEANER_COLORS[cleaners.findIndex(c => c.id === currentCleaner.id) % CLEANER_COLORS.length]
                        : COLORS.border;
                      const isFrozen = status.commonOnly;

                      return (
                        <View
                          key={room.id}
                          style={[
                            styles.roomCard,
                            isSelected && styles.roomCardSelected,
                            currentCleaner && { borderLeftWidth: 4, borderLeftColor: cleanerColor },
                          ]}
                        >
                          {/* Top row: name, more button, selection checkbox */}
                          <View style={styles.cardTopRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.roomName}>{room.name}</Text>
                              <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: 4 }}>
                                <Badge label={room.type === 'private' ? t('private') : t('dormitory')} type={room.type === 'private' ? 'priv' : 'dorm'} />
                                {room.type === 'dorm' && beds.length > 0 && (
                                  <Text style={styles.bedCount}>{beds.length} {t('beds')}</Text>
                                )}
                              </View>
                            </View>
                            <View style={styles.cardTopActions}>
                              <TouchableOpacity style={styles.iconBtn} onPress={() => openDetail(room)} activeOpacity={0.7}>
                                <Icon name="create-outline" size={18} color={COLORS.textSecondary} />
                              </TouchableOpacity>
                              {!currentCleaner && (
                                <TouchableOpacity
                                  onPress={() => toggleRoomSelection(room.id)}
                                  style={styles.selectCheckbox}
                                >
                                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                                    {isSelected && <Icon name="checkmark" size={16} color={COLORS.white} />}
                                  </View>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          {/* Bed toggles (dorm only) – frozen when commonOnly */}
                          {room.type === 'dorm' && beds.length > 0 && (
                            <View style={styles.bedList}>
                              {beds.map(bed => {
                                const state = bedAssigns[bed.id]?.status || 'noone';
                                const st = BED_STATES.find(s => s.key === state) || BED_STATES[0];
                                return (
                                  <TouchableOpacity
                                    key={bed.id}
                                    style={[
                                      styles.bedChip,
                                      { backgroundColor: st.bg, borderColor: st.color },
                                      isFrozen && styles.bedChipFrozen,
                                    ]}
                                    onPress={() => toggleBedState(room.id, bed.id)}
                                    disabled={isFrozen}
                                    activeOpacity={isFrozen ? 1 : 0.7}
                                  >
                                    <Text
                                      style={[styles.bedChipName, { color: isFrozen ? COLORS.textMuted : st.color }]}
                                      numberOfLines={1}
                                      ellipsizeMode="tail"
                                    >
                                      {bed.name}
                                    </Text>
                                    <Text
                                      style={[styles.bedChipState, { color: isFrozen ? COLORS.textMuted : st.color }]}
                                      numberOfLines={1}
                                      ellipsizeMode="tail"
                                    >
                                      {t('bedState_' + state)}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}

                          {/* Private room attributes – clickable toggles (ONLY the ones
                              actually configured for THIS room in Setup → Rooms) */}
                          {room.type === 'private' && (() => {
                            const roomOwnAttrs = room.attributes
                              ? Object.keys(room.attributes).filter(a => room.attributes[a])
                              : [];
                            if (roomOwnAttrs.length === 0) return null;
                            const savedAttrs = status.assignmentAttributes;
                            return (
                              <View style={styles.attributeList}>
                                {roomOwnAttrs.map(attr => {
                                  const isActive = savedAttrs && Object.prototype.hasOwnProperty.call(savedAttrs, attr)
                                    ? !!savedAttrs[attr]
                                    : true;
                                  return (
                                    <TouchableOpacity
                                      key={attr}
                                      style={[styles.attrChip, isActive && styles.attrChipActive]}
                                      onPress={() => toggleRoomAttribute(room.id, attr)}
                                      disabled={isFrozen}
                                      activeOpacity={0.7}
                                    >
                                      <Icon
                                        name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={14}
                                        color={isActive ? COLORS.primary : (isFrozen ? COLORS.textMuted : COLORS.textSecondary)}
                                        style={{ marginRight: 4 }}
                                      />
                                      <Text style={[styles.attrChipText, isActive && { color: COLORS.primary }, isFrozen && { color: COLORS.textMuted }]}>
                                        {attr}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            );
                          })()}

                          {/* Common areas checkbox – always active */}
                          <View style={styles.commonRow}>
                            <TouchableOpacity
                              style={styles.commonCheckRow}
                              onPress={() => toggleCommonOnly(room.id)}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.checkbox, status.commonOnly && styles.checkboxActive]}>
                                {status.commonOnly && <Icon name="checkmark" size={16} color={COLORS.white} />}
                              </View>
                              <Text style={styles.commonLabel}>{t('commonOnly')}</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Assigned cleaner + actions */}
                          <View style={styles.cardBottom}>
                            <View style={styles.cleanerInfo}>
                              {currentCleaner ? (
                                <View style={styles.cleanerRow}>
                                  <View style={[styles.cleanerDot, { backgroundColor: cleanerColor }]} />
                                  <Text style={styles.cleanerNameSmall}>{currentCleaner.username}</Text>
                                </View>
                              ) : (
                                <Text style={styles.unassigned}>—</Text>
                              )}
                            </View>
                            <View style={styles.cardActions}>
                              {currentCleaner && (
                                <TouchableOpacity
                                  style={[styles.cardBtn, { borderColor: COLORS.danger }]}
                                  onPress={() => handleUnassign(room.id)}
                                  activeOpacity={0.7}
                                >
                                  <Icon name="close" size={15} color={COLORS.danger} />
                                  <Text style={[styles.cardBtnText, { color: COLORS.danger }]}>{t('unassign')}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>

        {/* Collapsed rail — reopens the sidebar */}
        {selectedRoomIds.size === 0 && !sidebarOpen && (
          <TouchableOpacity
            style={styles.sidebarRail}
            onPress={() => setSidebarOpen(true)}
            activeOpacity={0.7}
          >
            <Icon name="chevron-left" size={18} color={COLORS.textMuted} />
            <Icon name="people-outline" size={20} color={COLORS.textSecondary} style={{ marginTop: SPACING[3] }} />
          </TouchableOpacity>
        )}
        {(selectedRoomIds.size > 0 || sidebarOpen) && (
        <View style={styles.sidebar}>
          {selectedRoomIds.size > 0 ? (
            <View style={[styles.bulkSection, { borderBottomWidth: 0, marginBottom: 0, flex: 1 }]}>
              <Text style={styles.bulkLabel}>{t('assignSelected', { count: selectedRoomIds.size }) || `Assign ${selectedRoomIds.size} rooms`}</Text>
              <Text style={styles.bulkHint}>
                {t('bulkPickHint') || 'Pick a cleaner, then hit Confirm in the bar above.'}
              </Text>
              <ScrollView style={styles.bulkCleanerScroll} nestedScrollEnabled>
                <View style={styles.bulkCleanerCard}>
                  {[...activeCleaners]
                    .sort((a, b) => a.username.localeCompare(b.username))
                    .map((cleaner, i, arr) => {
                      const isPicked = displayCleanerId === cleaner.id;
                      const colorIdx = cleaners.findIndex(c => c.id === cleaner.id);
                      const color = CLEANER_COLORS[colorIdx % CLEANER_COLORS.length];
                      const isLast = i === arr.length - 1;
                      return (
                        <TouchableOpacity
                          key={cleaner.id}
                          style={[
                            styles.bulkCleanerRow,
                            isLast && { borderBottomWidth: 0 },
                            isPicked && styles.bulkCleanerRowActive,
                          ]}
                          onPress={() => setBulkCleanerId(cleaner.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.bulkCleanerAvatar, { backgroundColor: color }]}>
                            <Text style={styles.bulkCleanerAvatarText}>
                              {cleaner.username.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.bulkCleanerRowText, isPicked && styles.bulkCleanerRowTextActive]}>
                            {cleaner.username}
                          </Text>
                          <View style={[styles.radioOuter, isPicked && styles.radioOuterActive]}>
                            {isPicked && <View style={styles.radioInner} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </ScrollView>
            </View>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setSidebarOpen(false)}
                style={styles.sidebarHeader}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarTitle}>{t('workingToday') || 'Working Today'}</Text>
                <Icon name="chevron-right" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
              
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.sidebarScrollContent}>
                  {cleaners.map((cleaner, idx) => {
                    const isActive = activeCleanerIds.has(cleaner.id);
                    const color = CLEANER_COLORS[idx % CLEANER_COLORS.length];
                    return (
                      <TouchableOpacity
                        key={cleaner.id}
                        style={styles.cleanerItem}
                        onPress={() => {
                          setActiveCleanerIds(prev => {
                            const next = new Set(prev);
                            isActive ? next.delete(cleaner.id) : next.add(cleaner.id);
                            return next;
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.cleanerColorDot, { backgroundColor: color }]} />
                        <Text style={[styles.cleanerItemName, !isActive && { color: COLORS.textMuted }]}>{cleaner.username}</Text>
                        <View style={[styles.checkboxMini, isActive && styles.checkboxMiniActive]}>
                          {isActive && <Icon name="checkmark" size={12} color={COLORS.white} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              
            </>
          )}
        </View>
        )}
      </View>

      {/* Side panel — now blocks interaction with the rest of the screen while open */}
      {panelOpen && (
        <View style={styles.panelOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closePanel} />
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
            <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>{t('assign')} {selectedRoom?.name}</Text>
                <Text style={styles.panelSubtitle}>
                {t('cleaner')}: {selectedCleaner?.username || t('unassigned')}
                </Text>
            </View>
            <TouchableOpacity onPress={closePanel} style={styles.panelClose}>
                <Icon name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
            </View>

            <ScrollView style={styles.panelBody} contentContainerStyle={{ paddingBottom: SPACING[6] }}>
            {/* Cleaner picker – shown when unassigned or to change */}
            <View style={{ marginBottom: SPACING[5] }}>
                <Label>{t('assignTo') || 'Assign to'}</Label>
                {selectedCleaner ? (
                <View style={styles.assignedCleanerRow}>
                    <View style={styles.cleanerRow}>
                    <View style={[styles.cleanerDot, { backgroundColor: CLEANER_COLORS[cleaners.findIndex(c => c.id === selectedCleaner.id) % CLEANER_COLORS.length] }]} />
                    <Text style={styles.cleanerNameSmall}>{selectedCleaner.username}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedCleaner(null)}>
                    <Text style={{ color: COLORS.danger, fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs }}>{t('change') || 'Change'}</Text>
                    </TouchableOpacity>
                </View>
                ) : (
                <View style={styles.cleanerPickerList}>
                    {activeCleaners.map((cleaner, idx) => (
                    <TouchableOpacity
                        key={cleaner.id}
                        style={styles.cleanerPickerChip}
                        onPress={() => setSelectedCleaner(cleaner)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.cleanerDot, { backgroundColor: CLEANER_COLORS[idx % CLEANER_COLORS.length] }]} />
                        <Text style={styles.cleanerPickerChipText}>{cleaner.username}</Text>
                    </TouchableOpacity>
                    ))}
                </View>
                )}
            </View>

            {selectedRoom?.type === 'dorm' && selectedRoom.beds?.length > 0 && (
                <View style={{ marginBottom: SPACING[5] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[2] }}>
                    <Label>{t('commonOnly')}</Label>
                    <TouchableOpacity onPress={() => setCommonOnly(!commonOnly)} style={[styles.checkbox, commonOnly && styles.checkboxActive]}>
                    {commonOnly && <Icon name="checkmark" size={16} color={COLORS.white} />}
                    </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>{commonOnly ? t('commonOnly') : t('scrollToSeeOptions')}</Text>

                {!commonOnly && (
                    <View style={{ marginTop: SPACING[3], gap: SPACING[4] }}>
                    {selectedRoom.beds.map(bed => {
                        const current = bedAssignments[bed.id] || { status: 'noone', reason: 'noone' };
                        return (
                        <View key={bed.id} style={styles.bedGroup}>
                            <Text style={styles.bedName}>{bed.name}</Text>
                            <View style={styles.toggleRow}>
                            {BED_STATES.map(state => {
                                const isActive = current.status === state.key;
                                return (
                                <TouchableOpacity
                                    key={state.key}
                                    style={[styles.toggleBtn, { backgroundColor: isActive ? state.bg : COLORS.white }, isActive && { borderColor: state.color, borderWidth: 2 }]}
                                    onPress={() => setBedAssignments(prev => ({ ...prev, [bed.id]: { status: state.key, reason: state.key } }))}
                                >
                                    <Text style={[styles.toggleText, { fontWeight: isActive ? '700' : '400' }, isActive && { color: state.color }]} numberOfLines={1}>
                                    {t('bedState_' + state.key)}
                                    </Text>
                                </TouchableOpacity>
                                );
                            })}
                            </View>
                        </View>
                        );
                    })}
                    </View>
                )}
                </View>
            )}

            {selectedRoom?.type === 'private' && Object.keys(assignmentAttributes).length > 0 && (
                <View style={{ marginBottom: SPACING[5] }}>
                <Label>{t('roomFeatures')}</Label>
                {Object.keys(assignmentAttributes).map(attr => {
                    const isActive = assignmentAttributes[attr];
                    return (
                    <TouchableOpacity key={attr} style={styles.attributeRow} onPress={() => setAssignmentAttributes(prev => ({ ...prev, [attr]: !prev[attr] }))}>
                        <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                        {isActive && <Icon name="checkmark" size={16} color={COLORS.white} />}
                        </View>
                        <Text style={styles.attributeLabel}>{attr}</Text>
                    </TouchableOpacity>
                    );
                })}
                </View>
            )}

            <Label>{t('roomFlags')}</Label>
            <View style={{ flexDirection: 'row', gap: SPACING[3], marginBottom: SPACING[5] }}>
                <TouchableOpacity style={[styles.flagBtn, earlyCheckIn && { backgroundColor: '#FFFBEB', borderColor: '#D97706' }]} onPress={() => setEarlyCheckIn(!earlyCheckIn)}>
                <Text style={[styles.flagText, earlyCheckIn && { color: '#D97706' }]}>{t('earlyCheckInFlag')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.flagBtn, lateCheckOut && { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger }]} onPress={() => setLateCheckOut(!lateCheckOut)}>
                <Text style={[styles.flagText, lateCheckOut && { color: COLORS.danger }]}>{t('lateCheckOutFlag')}</Text>
                </TouchableOpacity>
            </View>

            <Label>{t('notesPlaceholder1')}</Label>
            <Input value={managerNotes} onChangeText={setManagerNotes} placeholder={t('notesPlaceholder2')} multiline style={{ marginBottom: SPACING[2] }} />
            </ScrollView>

            <View style={[styles.panelFooter, { flexWrap: 'wrap' }]}>
            <TouchableOpacity onPress={closePanel} style={[styles.panelBtn, styles.panelBtnCancel]}>
                <Text style={styles.panelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
            {!selectedCleaner && (
              <TouchableOpacity
                  onPress={handleSaveStateFromPanel}
                  style={[styles.panelBtn, styles.panelBtnSecondary]}
              >
                  <Text style={[styles.panelBtnText, { color: COLORS.primary }]}>{t('saveState') || 'Save state'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
                onPress={handleAssignFromPanel}
                disabled={!selectedCleaner}
                style={[styles.panelBtn, styles.panelBtnPrimary, !selectedCleaner && { opacity: 0.5 }]}
            >
                <Text style={[styles.panelBtnText, { color: COLORS.white }]}>{t('assign')}</Text>
            </TouchableOpacity>
            </View>
            {!selectedCleaner && (
              <Text style={styles.panelFooterHint}>
                {t('saveStateHint') || "No cleaner picked yet — \"Save state\" keeps your bed setup without assigning anyone."}
              </Text>
            )}
        </View>
        </View>
        )}

        <ConfirmDialog
          visible={!!confirmDialog}
          title={
            confirmDialog === 'clearAll'
              ? (t('clearAllConfirmTitle') || 'Clear all assignments?')
              : (t('resetBedsConfirmTitle') || 'Reset all bed states?')
          }
          message={
            confirmDialog === 'clearAll'
              ? (t('clearAllConfirmMsg') || "This will unassign every room from its cleaner and clear any private-room features you'd checked. This can't be undone.")
              : (t('resetBedsConfirmMsg') || "This will reset every dorm bed back to Inspected for all rooms. This can't be undone.")
          }
          confirmLabel={t('confirm') || 'Confirm'}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={async () => {
            if (confirmDialog === 'clearAll') clearAll();
            else if (confirmDialog === 'resetBeds') await resetBedStates();
            setConfirmDialog(null);
          }}
        />
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING[6], paddingVertical: SPACING[4],
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexWrap: 'wrap', gap: SPACING[3],
  },
  pageTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  subtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING[3], flexWrap: 'wrap' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    width: 240,
  },
  searchInput: { flex: 1, fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.text },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  toolBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.primary },

  body: { flex: 1, flexDirection: 'row' },
  roomAreaWrapper: { flex: 1 },
  roomArea: { flex: 1 },
  roomAreaContent: { padding: SPACING[6] },

  /* Persistent selection bar – card-like design */
  selectionBar: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING[6],
    marginTop: SPACING[4],
    marginBottom: 0,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[3],
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    flexDirection: 'column',
  },
  selectionBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionLeft: { flexDirection: 'row', alignItems: 'center', marginRight: SPACING[3] },
  selectionBarTitle: {
    fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.primary,
  },
  selectionScroll: { flex: 1 },
  selectionChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING[2], paddingVertical: 2,
    marginRight: SPACING[2],
    borderWidth: 1, borderColor: COLORS.primary,
  },
  selectionChipText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.primary },
  pendingCleanerTag: {
    flexDirection: 'row', alignItems: 'center',
    marginLeft: SPACING[2],
    paddingHorizontal: SPACING[2], paddingVertical: 2,
    gap: 4,
  },
  pendingCleanerText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.text },
  confirmSelectionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginLeft: SPACING[2],
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[1],
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  confirmSelectionBtnDisabled: {
    backgroundColor: COLORS.surface, borderColor: COLORS.border,
  },
  confirmSelectionText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.xs, color: COLORS.white },
  clearSelectionBtn: {
    marginLeft: SPACING[2],
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[1],
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  clearSelectionText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.primary },

  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[4] },
  roomCard: {
    width: 340,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING[4], ...SHADOW.sm,
  },
  roomCardSelected: { borderColor: COLORS.primary, borderWidth: 2 },

  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING[3],
  },
  cardTopActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2] },
  iconBtn: { padding: 4 },
  selectCheckbox: { padding: 2 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  roomName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text },
  bedCount: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  bedList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginBottom: SPACING[3] },
  bedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    minWidth: 110,          // fixed enough for longest state text
  },
  bedChipFrozen: {
    backgroundColor: COLORS.border,
    borderColor: COLORS.textMuted,
    opacity: 0.6,
  },
  bedChipName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.sm, color: COLORS.text },
  bedChipState: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.text },

  /* Private room attributes */
  attributeList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginBottom: SPACING[3] },
  attrChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  attrChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  attrChipText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  commonRow: { marginBottom: SPACING[3] },
  commonCheckRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2] },
  commonLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cleanerInfo: { flex: 1 },
  cleanerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2] },
  cleanerDot: { width: 10, height: 10, borderRadius: 5 },
  cleanerNameSmall: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.text },
  unassigned: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontStyle: 'italic' },

  cardActions: { flexDirection: 'row', gap: SPACING[2] },
  cardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  cardBtnText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  /* Sidebar narrower */
  sidebar: {
    width: 260, backgroundColor: COLORS.surface,
    borderLeftWidth: 1, borderLeftColor: COLORS.border,
    padding: SPACING[4],
  },
  sidebarScrollContent: { paddingBottom: SPACING[6] },
  sidebarTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.text },
  sidebarRail: {
    width: 44,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    alignItems: 'center',
    paddingTop: SPACING[4],
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[3],
  },
  cleanerItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[2],
    borderRadius: RADIUS.sm,
  },
  cleanerColorDot: { width: 10, height: 10, borderRadius: 5 },
  cleanerItemName: { flex: 1, fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text },
  checkboxMini: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxMiniActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  bulkSection: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: SPACING[3], marginBottom: SPACING[3] },
  bulkLabel: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.sm, color: COLORS.text, marginBottom: SPACING[1] },
  bulkHint: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING[2] },

  /* Cleaner picker for bulk assign — a clean, sorted, avatar-based list
     instead of a loose wrap of pill buttons. Height is capped with its own
     scroll so a long roster never pushes the rest of the sidebar out of view. */
  bulkCleanerScroll: { flex: 1 },
  bulkCleanerCard: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface, overflow: 'hidden',
  },
  bulkCleanerRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[3],
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  bulkCleanerRowActive: { backgroundColor: COLORS.primaryLight },
  bulkCleanerAvatar: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bulkCleanerAvatarText: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xs, color: COLORS.white },
  bulkCleanerRowText: { flex: 1, fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text },
  bulkCleanerRowTextActive: { fontFamily: FONTS.bold, color: COLORS.primary },
  radioOuter: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioOuterActive: { borderColor: COLORS.primary },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.primary },

  /* Side panel */
  panelOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 20,
  },
  panel: {
    width: 440, backgroundColor: COLORS.surface,
    borderLeftWidth: 1, borderLeftColor: COLORS.border,
    ...SHADOW.lg,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: SPACING[5], borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  panelTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: 2 },
  panelSubtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  panelClose: { padding: 4 },
  panelBody: { flex: 1, padding: SPACING[5] },
  panelFooter: {
    flexDirection: 'row', gap: SPACING[3],
    padding: SPACING[5],
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  panelBtn: { flex: 1, minWidth: 100, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  panelBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  panelBtnSecondary: { backgroundColor: COLORS.surface, borderColor: COLORS.primary },
  panelBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  panelBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },
  panelFooterHint: {
    fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted,
    textAlign: 'center', paddingHorizontal: SPACING[5], paddingBottom: SPACING[4],
  },

  helperText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  bedGroup: { paddingBottom: SPACING[3], borderBottomWidth: 1, borderBottomColor: COLORS.border },
  bedName: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING[2] },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2] },
  toggleBtn: {
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    minWidth: 78, alignItems: 'center',
  },
  toggleText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  attributeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2], marginBottom: SPACING[2] },
  attributeLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },

  flagBtn: {
    flex: 1, paddingVertical: SPACING[2], borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  flagText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  /* Cleaner picker inside panel */
    assignedCleanerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[2],
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING[2],
    },
    cleanerPickerList: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2],
    },
    cleanerPickerChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    paddingVertical: SPACING[2], paddingHorizontal: SPACING[3],
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    },
    cleanerPickerChipText: {
    fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text,
    },
});