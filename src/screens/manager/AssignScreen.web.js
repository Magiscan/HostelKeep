import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, useWindowDimensions,
} from 'react-native';
import XLSX from 'xlsx-js-style';
import Icon from '../../components/Icon';
import { COLORS, RADIUS, FONTS, FONT_SIZE, SPACING, SHADOW } from '../../theme';
import { DISPLAY } from '../../theme/typography';
import { useApp } from '../../contexts/AppContext';
import { roomNeedsAssignment, effectiveAttributes } from '../../utils/assignment';
import { BRAND, NEUTRAL, STATUS, ACCENT, GLASS } from '../../theme/tokens';
import { buildCleanerColors } from '../../utils/cleanerColor';
import { Pressable } from 'react-native';
import { BunkBedIcon } from '../../components/brand/Pieces';
import { Drawer, drawerStyles as d } from '../../components/Dashboard/Drawer.web';
import { EmptyState } from '../../components/UI';

// ─── Bed state definitions ────────────────────────────────────────
const BED_STATES = [
  { key: 'clean',    short: 'Dirty',  label: 'To clean',   icon: 'cleaning_services', bg: STATUS.dirty.bg,    border: STATUS.dirty.border,    text: STATUS.dirty.text,    accent: BRAND.yellow },
  { key: 'stayover', short: 'Stay',   label: 'Stay-over',  icon: 'bed',               bg: STATUS.cleaned.bg,   border: STATUS.cleaned.border,   text: STATUS.cleaned.text,   accent: STATUS.cleaned.border },
  { key: 'late',     short: 'Late',   label: 'Late c/out', icon: 'hourglass_top',     bg: STATUS.late.bg,      border: STATUS.late.border,      text: STATUS.late.text,      accent: STATUS.late.border },
  { key: 'early',    short: 'Early',  label: 'Early c/in', icon: 'login',             bg: STATUS.early.bg,     border: STATUS.early.border,     text: STATUS.early.text,     accent: STATUS.early.border },
  { key: 'noone',    short: 'Done',   label: 'Inspected',  icon: 'check_circle',      bg: STATUS.excluded.bg,  border: STATUS.excluded.border,  text: STATUS.excluded.text,  accent: ACCENT.complete },
];
const BED_BY_KEY = Object.fromEntries(BED_STATES.map(s => [s.key, s]));
// Rank: stayover and noone are both "no work", but stayover should not outrank dirty.
const BED_RANK = { stayover: 0, noone: 1, clean: 2, early: 3, late: 4 };

/* ─── Accent colour for the room card ────────────────────────── */
function accentFor(room, status) {
  if (status.cleaned) return ACCENT.complete;
  const assigns = status.assignmentBedStatus || {};
  const beds = room.beds || [];
  if (!beds.length) return BRAND.yellow;
  const worst = beds.reduce((acc, b) => {
    const s = assigns[b.id]?.status || 'noone';
    return BED_RANK[s] > BED_RANK[acc] ? s : acc;
  }, 'noone');
  return BED_BY_KEY[worst].accent;
}

// ─── Confirm dialog ──────────────────────────────────────────────
function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!visible) return null;
  return (
    <View style={confirmStyles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
      <View style={confirmStyles.card}>
        <Text style={confirmStyles.title}>{title}</Text>
        <Text style={confirmStyles.message}>{message}</Text>
        <View style={confirmStyles.actions}>
          <TouchableOpacity onPress={onCancel} style={[confirmStyles.halfBtn, confirmStyles.halfBtnGhost]}>
            <Text style={confirmStyles.halfBtnGhostText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} style={[confirmStyles.halfBtn, { backgroundColor: COLORS.danger }]}>
            <Text style={confirmStyles.halfBtnText}>{confirmLabel || 'Confirm'}</Text>
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
    backgroundColor: COLORS.surface, borderRadius: 20,
    padding: SPACING[5], ...SHADOW.md,
  },
  title: { fontFamily: DISPLAY.semiBold, fontSize: 25, color: COLORS.text, marginBottom: SPACING[2] },
  message: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING[5] },
  actions: { flexDirection: 'row', gap: SPACING[3] },
  halfBtn: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  halfBtnGhost: { backgroundColor: COLORS.surfaceMuted },
  halfBtnGhostText: { fontFamily: DISPLAY.semiBold, fontSize: 17, color: COLORS.primary },
  halfBtnText: { fontFamily: DISPLAY.semiBold, fontSize: 17, color: COLORS.onPrimary },
});

// ─── Excel export helpers ─────────────────────────────────────
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

export default function AssignScreen({ onReady }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  const {
    rooms, cleaners, floors, assignRoomWithDetails, unassignRoom, roomStatus,
    updateRoomStatus, roomAttributes, can,
  } = useApp();
  const canAssign = can('assign');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');   // 'all' | 'todo' | 'unassigned'
  const [showMore, setShowMore] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState(new Set());
  const [roomType, setRoomType] = useState(null);
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const [expandedFloors, setExpandedFloors] = useState({});

  const [bulkCleanerId, setBulkCleanerId] = useState(null);
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);

  // ── Counts (unfiltered) ──────────────────────────────────────
  const counts = useMemo(() => {
    const c = { all: 0, todo: 0, unassigned: 0 };
    rooms.forEach(r => {
      const hasWork = roomNeedsAssignment(r, roomStatus[r.id] || {});
      c.all += 1;
      if (hasWork) c.todo += 1;
      if (hasWork && !r.assignedTo) c.unassigned += 1;
    });
    return c;
  }, [rooms, roomStatus]);

  // ── Dirty beds (for glance) ──────────────────────────────────
  const dirtyBeds = useMemo(() => rooms.reduce((n, r) => {
    if (r.type !== 'dorm' || (roomStatus[r.id] || {}).commonOnly) return n;
    const assigns = (roomStatus[r.id] || {}).assignmentBedStatus || {};
    return n + (r.beds || []).filter(b => {
      const s = assigns[b.id]?.status || 'noone';
      return s !== 'noone' && s !== 'stayover';
    }).length;
  }, 0), [rooms, roomStatus]);

  // ── Filtered rooms ───────────────────────────────────────────
  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(term));
    }
    if (roomType) list = list.filter(r => r.type === roomType);
    if (filter !== 'all') {
      list = list.filter(r => {
        const hasWork = roomNeedsAssignment(r, roomStatus[r.id] || {});
        return filter === 'todo' ? hasWork : (hasWork && !r.assignedTo);
      });
    }
    return list;
  }, [rooms, search, filter, roomType, roomStatus]);

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

  // ── Handlers ──────────────────────────────────────────────────
  const toggleBedState = useCallback(async (roomId, bedId) => {
    const status = roomStatus[roomId] || {};
    const assignments = status.assignmentBedStatus || {};
    const current = assignments[bedId]?.status || 'noone';
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
    const room = rooms.find(r => r.id === roomId);
    const status = roomStatus[roomId] || {};
    const active = new Set(effectiveAttributes(room, status));
    const attrs = { ...(status.assignmentAttributes || {}) };
    attrs[attr] = !active.has(attr);
    await updateRoomStatus(roomId, { assignmentAttributes: attrs });
  }, [rooms, roomStatus, updateRoomStatus]);

  // ── Clear all & reset beds ──────────────────────────────────
  const clearAll = useCallback(() => {
    rooms.forEach(room => {
      unassignRoom(room.id);
      if (room.type === 'private') {
        const attrs = {};
        Object.keys(room.attributes || {}).forEach(key => {
          if (room.attributes[key]) attrs[key] = false;
        });
        updateRoomStatus(room.id, { assignmentAttributes: attrs });
      }
    });
  }, [rooms, unassignRoom, updateRoomStatus]);

  const resetBedStates = useCallback(async () => {
    const updates = [];
    rooms.forEach(room => {
      if (room.type === 'dorm' && room.beds?.length) {
        const defaultAssignments = {};
        room.beds.forEach(bed => {
          defaultAssignments[bed.id] = { status: 'noone', reason: 'noone' };
        });
        updates.push(updateRoomStatus(room.id, { assignmentBedStatus: defaultAssignments }));
      }
      if (room.type === 'private') {
        const attrs = {};
        Object.keys(room.attributes || {}).forEach(key => {
          if (room.attributes[key]) attrs[key] = false;
        });
        updates.push(updateRoomStatus(room.id, { assignmentAttributes: attrs }));
      }
    });
    await Promise.all(updates);
  }, [rooms, updateRoomStatus]);

  // ── Export sheets (memoized) ─────────────────────────────────
  const handleExportSheets = useCallback(() => {
    const orphaned = rooms.filter(r =>
      !r.assignedTo && roomNeedsAssignment(r, roomStatus[r.id] || {})
    );
    if (orphaned.length) {
      const names = orphaned.map(r => r.name).join(', ');
      const msg = `${names}\n\n` + (t('unassignedWarningMsg')
        || "These won't appear on any sheet. Assign them first, or print anyway.");
      const proceed = window.confirm(msg + '\n\nPrint anyway?');
      if (!proceed) return;
    }
    const assignedCleanerIds = [...new Set(rooms.filter(r => r.assignedTo).map(r => r.assignedTo))];
    if (!assignedCleanerIds.length) {
      window.alert(t('noAssignmentsMsg') || 'Assign rooms first.');
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

      const aoa = [];
      aoa.push([`${cleaner.username} – ${dateStr}`]);
      aoa.push(COLS);
      const rowMeta = [];
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
          const lines = room.beds
            .filter(b => {
              const s = assign[b.id]?.status || 'noone';
              return s !== 'noone' && s !== 'stayover';
            })
            .map(b => {
              const bedState = assign[b.id]?.status || 'clean';
              return bedState === 'clean' ? b.name : `${b.name} — ${BED_BY_KEY[bedState].label}`;
            });
          bedsText = lines.join('\n');
          hasActionableWork = lines.length > 0;
        } else if (room.type === 'private') {
          const selected = effectiveAttributes(room, status);
          bedsText = selected.join(', ');
          hasActionableWork = selected.length > 0;
        }

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

      if (printedRooms.length === 0) return;

      const dataStartRow = 2;
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

      // Title row
      for (let c = 0; c < COL_COUNT; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        ws[addr].s = xlsStyles.title;
      }
      ws['!rows'] = ws['!rows'] || [];
      ws['!rows'][0] = { hpt: 24 };

      // Header row
      for (let c = 0; c < COL_COUNT; c++) {
        const addr = XLSX.utils.encode_cell({ r: 1, c });
        ws[addr].s = xlsStyles.header;
      }
      ws['!rows'][1] = { hpt: 20 };

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

      for (let r = blankStartRow; r <= blankEndRow; r++) {
        for (let c = 0; c < COL_COUNT; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) ws[addr] = { t: 's', v: '' };
          ws[addr].s = xlsStyles.blankRow;
        }
      }

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

      ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, scale: 95 };
      ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };

      let name = sanitizeSheetName(cleaner.username);
      let unique = name, n = 1;
      while (usedSheetNames.has(unique)) unique = `${name.slice(0, 28)}_${n++}`;
      usedSheetNames.add(unique);
      XLSX.utils.book_append_sheet(wb, ws, unique);
    });
    XLSX.writeFile(wb, `assignment_sheets_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [cleaners, rooms, roomStatus, t]);

  // ── Register header actions ──────────────────────────────────
  useEffect(() => {
    if (!onReady) return;
    onReady({
      print: handleExportSheets,
      ...(canAssign ? { clearAll: () => setConfirmDialog('clearAll') } : {}),
    });
  }, [onReady, handleExportSheets, canAssign]);

  // ── Panel handlers ───────────────────────────────────────────
  const openDetail = (room) => {
    const currentCleaner = cleaners.find(c => c.id === room.assignedTo);
    setSelectedRoom(room);
    setSelectedCleaner(currentCleaner || null);
    const existing = roomStatus[room.id] || {};
    const beds = {};
    if (room.type === 'dorm' && room.beds) {
      room.beds.forEach(b => {
        beds[b.id] = (existing.assignmentBedStatus || {})[b.id] || { status: 'noone', reason: 'noone' };
      });
    }
    setBedAssignments(beds);
    setCommonOnly(existing.commonOnly || false);

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

  // ── Bulk bar handlers ────────────────────────────────────────
  const bulkSetBeds = useCallback(async (state) => {
    const updates = [];
    selectedRoomIds.forEach(id => {
      const room = rooms.find(r => r.id === id);
      if (!room || room.type !== 'dorm' || !room.beds?.length) return;
      const next = {};
      room.beds.forEach(b => { next[b.id] = { status: state, reason: state }; });
      updates.push(updateRoomStatus(id, { assignmentBedStatus: next }));
    });
    await Promise.all(updates);
  }, [selectedRoomIds, rooms, updateRoomStatus]);

  const bulkToggleCommon = useCallback(async () => {
    const ids = Array.from(selectedRoomIds);
    const turnOn = ids.some(id => !(roomStatus[id] || {}).commonOnly);
    await Promise.all(ids.map(id => updateRoomStatus(id, { commonOnly: turnOn })));
  }, [selectedRoomIds, roomStatus, updateRoomStatus]);

  const selectedRoomsList = useMemo(
    () => rooms.filter(r => selectedRoomIds.has(r.id)),
    [rooms, selectedRoomIds]
  );

  const autoDetectedCleanerId = (() => {
    if (!selectedRoomsList.length) return null;
    const assignedIds = selectedRoomsList.map(r => r.assignedTo).filter(Boolean);
    if (assignedIds.length !== selectedRoomsList.length) return null;
    return assignedIds.every(id => id === assignedIds[0]) ? assignedIds[0] : null;
  })();
  const displayCleanerId = bulkCleanerId || autoDetectedCleanerId;
  const displayCleaner = cleaners.find(c => c.id === displayCleanerId) || null;

  const handleClearSelection = () => {
    setSelectedRoomIds(new Set());
    setBulkCleanerId(null);
  };

  const toggleFloor = (floorId) => {
    setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));
  };

  if (!rooms.length) return <EmptyState icon="📋" title={t('noRoomsToAssign')} subtitle={t('addRoomsFirst')} />;
  if (!cleaners.length) return <EmptyState icon="👤" title={t('noCleaners')} subtitle={t('addCleanersFirst')} />;

  return (
    <View style={styles.container}>
      {/* ── Filter bar ── */}
      <View style={styles.filterBar}>
        <View style={styles.search}>
          <Icon name="search" size={19} color={NEUTRAL.text3} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search a room…"
            placeholderTextColor={NEUTRAL.text4}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.segment}>
          {[
            { key: 'all',        label: t('filterAll')       || 'All',        count: counts.all },
            { key: 'todo',       label: t('filterToPrepare') || 'To prepare', count: counts.todo },
            { key: 'unassigned', label: t('filterUnassigned')|| 'Unassigned', count: counts.unassigned },
          ].map(f => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                  {f.label}
                </Text>
                <View style={[styles.segmentCount, active && styles.segmentCountActive]}>
                  <Text style={[styles.segmentCountText, active && styles.segmentCountTextActive]}>
                    {f.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => setRoomType(v => (v === 'private' ? null : 'private'))}
          style={[styles.typeBtn, roomType === 'private' && styles.typeBtnOn]}
          activeOpacity={0.8}
        >
          <Icon name="king_bed" size={18} color={roomType === 'private' ? BRAND.navy : NEUTRAL.text3} />
          <Text style={[styles.typeBtnText, roomType === 'private' && { color: BRAND.navy }]}>
            {t('private')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setRoomType(v => (v === 'dorm' ? null : 'dorm'))}
          style={[styles.typeBtn, roomType === 'dorm' && styles.typeBtnOn]}
          activeOpacity={0.8}
        >
          <BunkBedIcon size={18} color={roomType === 'dorm' ? BRAND.navy : NEUTRAL.text3} />
          <Text style={[styles.typeBtnText, roomType === 'dorm' && { color: BRAND.navy }]}>
            {t('dormitory')}
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <Text style={styles.resultCount}>{filteredRooms.length} {t('rooms')}</Text>

        {canAssign && (
          <TouchableOpacity onPress={() => setShowMore(true)} style={styles.moreBtn} activeOpacity={0.7}>
            <Icon name="more_horiz" size={20} color={NEUTRAL.text3} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Main content ── */}
      <View style={styles.body}>
        <View style={styles.roomAreaWrapper}>
          <ScrollView style={styles.roomArea} contentContainerStyle={styles.roomAreaContent}>
            {filteredRooms.length === 0 && (search.trim() !== '' || filter !== 'all' || roomType) && (
              <EmptyState icon="🔍" title={t('noResults')} subtitle="" />
            )}
            {sortedFloors.map(floor => {
              const floorRooms = filteredRooms.filter(r => r.floorId === floor.id);
              if (!floorRooms.length) return null;
              const isFloorExpanded = expandedFloors[floor.id] !== false;
              return (
                <View key={floor.id} style={{ marginBottom: SPACING[6] }}>
                  <TouchableOpacity
                    onPress={() => toggleFloor(floor.id)}
                    style={styles.floorRowHead}
                    activeOpacity={0.7}
                  >
                    <View style={styles.floorBar} />
                    <Text style={styles.floorName}>{floor.name}</Text>
                    <Text style={styles.floorMeta}>
                      {floorRooms.length} {floorRooms.length !== 1 ? 'rooms' : 'room'}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Icon
                      name={isFloorExpanded ? 'expand_less' : 'expand_more'}
                      size={22}
                      color={NEUTRAL.text3}
                    />
                  </TouchableOpacity>

                  {isFloorExpanded && (
                    <View style={styles.roomGrid}>
                      {floorRooms.map(room => {
                        const status = roomStatus[room.id] || {};
                        const isSelected = selectedRoomIds.has(room.id);
                        const currentCleaner = cleaners.find(c => c.id === room.assignedTo);
                        const beds = room.beds || [];
                        const isFrozen = status.commonOnly;
                        const cardColor = currentCleaner ? colors[currentCleaner.id] : '#CBD5E1';
                        const accent = accentFor(room, status);

                        return (
                          <View key={room.id} style={styles.roomCard}>
                            {/* <View style={[styles.cardAccent, { backgroundColor: accent }]} /> */}
                            {isSelected && <View style={styles.cardSelected} pointerEvents="none" />}

                            <View style={styles.cardHead}>
                              <View style={styles.cardHeadLeft}>
                                {canAssign && (
                                <TouchableOpacity
                                  onPress={() => toggleRoomSelection(room.id)}
                                  style={[styles.checkbox, isSelected && styles.checkboxOn]}
                                  activeOpacity={0.7}
                                  accessibilityLabel="Select room"
                                >
                                  {isSelected && <Icon name="check" size={15} color="#FFFFFF" />}
                                </TouchableOpacity>
                                )}
                                <Text style={styles.roomNumber}>{room.name}</Text>
                                <View style={[styles.typePill, {
                                  backgroundColor: room.type === 'dorm' ? NEUTRAL.beigePill : NEUTRAL.slateChip,
                                }]}>
                                  <Text style={[styles.typePillText, {
                                    color: room.type === 'dorm' ? '#7C4A15' : NEUTRAL.text2,
                                  }]}>
                                    {room.type === 'dorm' ? 'Dorm' : 'Private'}
                                  </Text>
                                </View>
                                <Text style={styles.bedsLabel} numberOfLines={1}>
                                  {room.type === 'dorm' ? `${beds.length} ${t('beds')}` : ''}
                                </Text>
                              </View>
                              <View style={styles.cardHeadRight}>
                                {!!status.managerNotes && (
                                  <Icon name="sticky_note_2" size={19} color={BRAND.yellow} />
                                )}
                                {canAssign && (
                                  <TouchableOpacity onPress={() => openDetail(room)} style={styles.editBtn} activeOpacity={0.7}>
                                    <Icon name="edit" size={19} color={NEUTRAL.text3} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>

                            {(status.earlyCheckIn || status.lateCheckOut) && (
                              <View style={styles.flagRow}>
                                {status.earlyCheckIn && (
                                  <View style={[styles.flag, { backgroundColor: STATUS.early.bg, borderColor: STATUS.early.border }]}>
                                    <Icon name="login" size={15} color={STATUS.early.text} />
                                    <Text style={[styles.flagText, { color: STATUS.early.text }]}>Early c/in</Text>
                                  </View>
                                )}
                                {status.lateCheckOut && (
                                  <View style={[styles.flag, { backgroundColor: STATUS.late.bg, borderColor: STATUS.late.border }]}>
                                    <Icon name="hourglass_top" size={15} color={STATUS.late.text} />
                                    <Text style={[styles.flagText, { color: STATUS.late.text }]}>Late c/out</Text>
                                  </View>
                                )}
                              </View>
                            )}

                            {room.type === 'dorm' && beds.length > 0 && !isFrozen && (
                              <View style={styles.bedGrid}>
                                {beds.map(bed => {
                                  const assigns = status.assignmentBedStatus || {};
                                  const st = BED_BY_KEY[assigns[bed.id]?.status || 'noone'];
                                  return (
                                    <TouchableOpacity
                                      key={bed.id}
                                      onPress={() => toggleBedState(room.id, bed.id)}
                                      disabled={!canAssign}
                                      style={[styles.bedChip, { backgroundColor: st.bg, borderColor: st.border }]}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={[styles.bedLetter, { color: st.text }]}>{bed.name}</Text>
                                      <Icon name={st.icon} size={16} color={st.text} />
                                      <Text style={[styles.bedLabel, { color: st.text }]} numberOfLines={1}>
                                        {st.short}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}

                            {room.type === 'private' && !isFrozen && (() => {
                              const own = room.attributes
                                ? Object.keys(room.attributes).filter(a => room.attributes[a]) : [];
                              if (!own.length) return null;
                              const active = new Set(effectiveAttributes(room, status));
                              return (
                                <View style={styles.attrRow}>
                                  {own.map(attr => {
                                    const on = active.has(attr);
                                    return (
                                      <TouchableOpacity
                                        key={attr}
                                        onPress={() => toggleRoomAttribute(room.id, attr)}
                                        disabled={isFrozen || !canAssign}
                                        style={[styles.attrChip, on && {
                                          backgroundColor: STATUS.dirty.bg, borderColor: STATUS.dirty.border,
                                        }]}
                                        activeOpacity={0.7}
                                      >
                                        <Icon
                                          name={on ? 'check_circle' : 'radio_button_unchecked'}
                                          size={16}
                                          color={on ? STATUS.dirty.text : NEUTRAL.text4}
                                        />
                                        <Text style={[styles.attrChipText, on && { color: STATUS.dirty.text }]}>
                                          {attr}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              );
                            })()}

                            {/* ── Common areas only – now shown for ALL rooms ── */}
                            <TouchableOpacity
                              onPress={() => toggleCommonOnly(room.id)}
                              disabled={!canAssign}
                              style={styles.commonToggle}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.checkboxSm, isFrozen && styles.checkboxOn]}>
                                {isFrozen && <Icon name="check" size={14} color="#FFFFFF" />}
                              </View>
                              <Text style={styles.commonToggleText}>Clean common areas only</Text>
                            </TouchableOpacity>

                            <View style={styles.cardFoot}>
                              <View style={styles.hkCell}>
                                <View style={[styles.hkDot, {
                                  backgroundColor: currentCleaner ? cardColor : '#CBD5E1',
                                }]} />
                                <Text
                                  style={[styles.hkName, !currentCleaner && { color: NEUTRAL.text4 }]}
                                  numberOfLines={1}
                                >
                                  {currentCleaner ? currentCleaner.username : 'Unassigned'}
                                </Text>
                              </View>
                              <View style={styles.footBtns}>
                                {canAssign && currentCleaner && (
                                  <TouchableOpacity
                                    onPress={() => handleUnassign(room.id)}
                                    style={styles.unassignBtn}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.unassignText}>{t('unassign')}</Text>
                                  </TouchableOpacity>
                                )}
                                {canAssign && (
                                  <TouchableOpacity
                                    onPress={() => openDetail(room)}
                                    style={styles.assignBtn}
                                    activeOpacity={0.8}
                                  >
                                    <Icon name="person_add" size={17} color={BRAND.navy} />
                                    <Text style={styles.assignText}>
                                      {currentCleaner ? 'Reassign' : t('assign')}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>

        {/* ── Shift Panel (rail) ── */}
        {!isNarrow && (
          <View style={[styles.rail, sidebarOpen ? styles.railOpen : styles.railClosed]}>
            {!sidebarOpen ? (
              <View style={styles.railIcons}>
                <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.railBtn} activeOpacity={0.7}>
                  <Icon name="left_panel_open" size={21} color={BRAND.navy} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.railBtn} activeOpacity={0.7}>
                  <Icon name="groups" size={21} color={BRAND.navy} />
                  <View style={styles.railBadge}>
                    <Text style={styles.railBadgeText}>{activeCleaners.length}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.railBtn} activeOpacity={0.7}>
                  <Icon name="insights" size={21} color={BRAND.navy} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={styles.railHead}>
                  <Text style={styles.railOverline}>Shift panel</Text>
                  <TouchableOpacity onPress={() => setSidebarOpen(false)} style={styles.railClose} activeOpacity={0.7}>
                    <Icon name="right_panel_close" size={19} color={NEUTRAL.text3} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.railBody}>
                  <TouchableOpacity
                    onPress={() => setTeamOpen(o => !o)}
                    style={styles.railSection}
                    activeOpacity={0.8}
                  >
                    <Icon name="groups" size={20} color={BRAND.navy} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.railSectionTitle}>Working today</Text>
                      <Text style={styles.railSectionSub}>
                        {activeCleaners.length} on shift
                      </Text>
                    </View>
                    <Icon name={teamOpen ? 'expand_less' : 'expand_more'} size={22} color={NEUTRAL.text3} />
                  </TouchableOpacity>

                  {teamOpen && (
                    <View style={{ gap: 10, marginTop: 12 }}>
                      <View style={styles.railHint}>
                        <Text style={styles.railHintText}>Tap a name to put them on shift.</Text>
                        <TouchableOpacity
                          onPress={() => setActiveCleanerIds(new Set(cleaners.map(c => c.id)))}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.railAllOn}>All on</Text>
                        </TouchableOpacity>
                      </View>

                      {cleaners.map(c => {
                        const on = activeCleanerIds.has(c.id);
                        const mine = rooms.filter(r => r.assignedTo === c.id);
                        const done = mine.filter(r => roomStatus[r.id]?.cleaned).length;
                        const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            onPress={() => setActiveCleanerIds(prev => {
                              const next = new Set(prev);
                              on ? next.delete(c.id) : next.add(c.id);
                              return next;
                            })}
                            style={[styles.hkRow, on ? styles.hkRowOn : styles.hkRowOff]}
                            activeOpacity={0.8}
                          >
                            <View style={[
                              styles.hkAvatar,
                              { backgroundColor: on ? colors[c.id] : NEUTRAL.slateChip },
                            ]}>
                              <Text style={[styles.hkAvatarText, !on && { color: NEUTRAL.text4 }]}>
                                {c.username?.[0]?.toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={styles.hkRowTop}>
                                <Text style={styles.hkRowName} numberOfLines={1}>{c.username}</Text>
                                <Text style={styles.hkRowLoad}>{done}/{mine.length}</Text>
                              </View>
                              <View style={styles.hkTrack}>
                                <View style={[styles.hkFill, {
                                  width: `${pct}%`,
                                  backgroundColor: pct === 100 && mine.length ? ACCENT.complete : BRAND.yellow,
                                }]} />
                              </View>
                            </View>
                            <Icon
                              name={on ? 'check_circle' : 'radio_button_unchecked'}
                              size={20}
                              color={on ? BRAND.navy : NEUTRAL.text4}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <View style={styles.glance}>
                    <Text style={styles.railOverline}>Today at a glance</Text>
                    <View style={{ gap: 12, marginTop: 14 }}>
                      <View style={styles.glanceRow}>
                        <Text style={styles.glanceLabel}>Rooms in play</Text>
                        <Text style={styles.glanceValue}>{counts.all}</Text>
                      </View>
                      <View style={styles.glanceRow}>
                        <Text style={styles.glanceLabel}>Needs assignment</Text>
                        <Text style={[styles.glanceValue, { color: STATUS.waiting.text }]}>
                          {counts.unassigned}
                        </Text>
                      </View>
                      <View style={styles.glanceRow}>
                        <Text style={styles.glanceLabel}>Beds to clean</Text>
                        <Text style={[styles.glanceValue, { color: STATUS.dirty.text }]}>
                          {dirtyBeds}
                        </Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

            {/* ── Floating bulk bar ── */}
      {selectedRoomIds.size > 0 && (
        <View style={styles.bulkBar}>
          {/* Count */}
          <View style={styles.bulkCount}>
            <View style={styles.bulkBadge}>
              <Text style={styles.bulkBadgeText}>{selectedRoomIds.size}</Text>
            </View>
            <Text style={styles.bulkCountText}>selected</Text>
          </View>

          {/* Divider */}
          <View style={styles.bulkDivider} />

          {/* ── Scrollable selection chips ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bulkChipScroll}
            contentContainerStyle={styles.bulkChipRow}
          >
            {selectedRoomsList.map(room => {
              const hk = cleaners.find(c => c.id === room.assignedTo);
              return (
                <TouchableOpacity
                  key={room.id}
                  onPress={() => toggleRoomSelection(room.id)}
                  style={styles.bulkChip}
                  activeOpacity={0.7}
                  accessibilityLabel={`Deselect room ${room.name}`}
                >
                  {!!hk && (
                    <View style={[styles.bulkChipDot, { backgroundColor: colors[hk.id] }]} />
                  )}
                  <Text style={styles.bulkChipText}>{room.name}</Text>
                  <Icon name="close" size={13} color={NEUTRAL.text3} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.bulkDivider} />

          {/* Assign button */}
          {canAssign && (
          <TouchableOpacity
            onPress={() => setBulkPickerOpen(true)}
            style={styles.bulkPrimary}
            activeOpacity={0.9}
          >
            <Icon name="person_add" size={18} color={BRAND.yellow} />
            <Text style={styles.bulkPrimaryText}>
              {displayCleaner ? `Assign to ${displayCleaner.username}` : 'Assign to…'}
            </Text>
          </TouchableOpacity>
          )}

          {/* Clear assign */}
          {canAssign && (
            <TouchableOpacity
              onPress={() => selectedRoomIds.forEach(id => unassignRoom(id))}
              style={styles.bulkDanger}
              activeOpacity={0.8}
            >
              <Icon name="person_remove" size={18} color="#B91C1C" />
              <Text style={styles.bulkDangerText}>Clear assign</Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={styles.bulkDivider} />

          {/* Bulk actions */}
          {canAssign && (
            <TouchableOpacity onPress={() => bulkSetBeds('clean')} style={styles.bulkGhost} activeOpacity={0.8}>
              <Icon name="cleaning_services" size={18} color={NEUTRAL.text2} />
              <Text style={styles.bulkGhostText}>All dirty</Text>
            </TouchableOpacity>
          )}

          {canAssign && (
            <TouchableOpacity onPress={() => bulkSetBeds('noone')} style={styles.bulkGhost} activeOpacity={0.8}>
              <Icon name="verified" size={18} color={NEUTRAL.text2} />
              <Text style={styles.bulkGhostText}>Reset states</Text>
            </TouchableOpacity>
          )}

          {canAssign && (
            <TouchableOpacity onPress={bulkToggleCommon} style={styles.bulkGhost} activeOpacity={0.8}>
              <Icon name="layers" size={18} color={NEUTRAL.text2} />
              <Text style={styles.bulkGhostText}>Common only</Text>
            </TouchableOpacity>
          )}

          {/* Close */}
          <TouchableOpacity onPress={handleClearSelection} style={styles.bulkClose} activeOpacity={0.7}>
            <Icon name="close" size={18} color={NEUTRAL.text3} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bulk picker modal ── */}
      <Modal visible={bulkPickerOpen} transparent animationType="fade" onRequestClose={() => setBulkPickerOpen(false)}>
        <Pressable style={styles.pickerScrim} onPress={() => setBulkPickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>
              Assign {selectedRoomIds.size} {selectedRoomIds.size === 1 ? 'room' : 'rooms'} to
            </Text>
            {activeCleaners.map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={async () => {
                  setBulkPickerOpen(false);
                  setBulkCleanerId(c.id);
                  await bulkAssign(c.id);
                }}
                style={styles.pickerRow}
                activeOpacity={0.7}
              >
                <View style={[styles.hkPickDot, { backgroundColor: colors[c.id] }]} />
                <Text style={styles.pickerRowText}>{c.username}</Text>
              </TouchableOpacity>
            ))}
            {activeCleaners.length === 0 && (
              <Text style={styles.pickerEmpty}>
                Nobody is on shift — turn someone on in the shift panel.
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Room drawer ── */}
      {panelOpen && selectedRoom && (
        <Drawer
          visible
          onClose={closePanel}
          width={580}
          title={`Room ${selectedRoom.name}`}
          subtitle={`${selectedRoom.type === 'dorm'
            ? `Dorm · ${selectedRoom.beds?.length || 0} ${t('beds')}`
            : t('private')}${selectedCleaner ? ` · ${selectedCleaner.username}` : ' · Unassigned'}`}
          footer={
            <>
              <TouchableOpacity onPress={closePanel} style={d.btnGhost} activeOpacity={0.8}>
                <Text style={d.btnGhostText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveStateFromPanel}
                style={styles.saveStatesBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.saveStatesText}>Save states only</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={handleAssignFromPanel}
                disabled={!selectedCleaner}
                style={[d.btnPrimary, !selectedCleaner && styles.assignBtnOff]}
                activeOpacity={0.9}
              >
                <Icon
                  name="assignment_turned_in"
                  size={20}
                  color={selectedCleaner ? BRAND.yellow : NEUTRAL.text4}
                />
                <Text style={[d.btnPrimaryText, !selectedCleaner && { color: NEUTRAL.text4 }]}>
                  {selectedCleaner ? `Assign to ${selectedCleaner.username}` : 'Pick a housekeeper first'}
                </Text>
              </TouchableOpacity>
            </>
          }
        >
          {/* ── Housekeeper ── */}
          <View>
            <Text style={d.overline}>Housekeeper</Text>
            <View style={styles.hkPickRow}>
              {activeCleaners.map(c => {
                const on = selectedCleaner?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setSelectedCleaner(on ? null : c)}
                    style={[styles.hkPick, on && styles.hkPickOn]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.hkPickDot, { backgroundColor: colors[c.id] }]} />
                    <Text style={[styles.hkPickText, on && { color: '#FFFFFF' }]}>
                      {c.username}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Common areas only ── */}
          <TouchableOpacity
            onPress={() => setCommonOnly(v => !v)}
            style={[styles.commonCard, commonOnly && styles.commonCardOn]}
            activeOpacity={0.85}
          >
            <View style={[styles.checkbox, commonOnly && styles.checkboxOn]}>
              {commonOnly && <Icon name="check" size={15} color="#FFFFFF" />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.commonCardTitle}>Clean common areas only</Text>
              <Text style={styles.commonCardSub}>Bed states are ignored for today.</Text>
            </View>
          </TouchableOpacity>

          {/* ── Bed states ── */}
          {selectedRoom.type === 'dorm' && selectedRoom.beds?.length > 0 && !commonOnly && (
            <View>
              <View style={styles.sectionHead}>
                <Text style={[d.overline, { marginBottom: 0 }]}>Bed states</Text>
                <TouchableOpacity
                  onPress={() => setBedAssignments(prev => {
                    const next = { ...prev };
                    selectedRoom.beds.forEach(b => {
                      next[b.id] = { status: 'clean', reason: 'clean' };
                    });
                    return next;
                  })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionAction}>Set all to dirty</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bedTable}>
                {selectedRoom.beds.map((bed, i) => {
                  const current = bedAssignments[bed.id]?.status || 'noone';
                  const last = i === selectedRoom.beds.length - 1;
                  return (
                    <View key={bed.id} style={[styles.bedTableRow, last && { borderBottomWidth: 0 }]}>
                      <View style={styles.bedLetterBox}>
                        <Text style={styles.bedLetterBoxText}>{bed.name}</Text>
                      </View>
                      <View style={styles.bedOptions}>
                        {BED_STATES.map(st => {
                          const on = current === st.key;
                          return (
                            <TouchableOpacity
                              key={st.key}
                              onPress={() => setBedAssignments(prev => ({
                                ...prev,
                                [bed.id]: { status: st.key, reason: st.key },
                              }))}
                              style={[
                                styles.bedOption,
                                on
                                  ? { backgroundColor: st.bg, borderColor: st.border }
                                  : { backgroundColor: NEUTRAL.surface, borderColor: NEUTRAL.border },
                              ]}
                              activeOpacity={0.8}
                              accessibilityLabel={`${bed.name}: ${st.label}`}
                            >
                              <Icon name={st.icon} size={15} color={on ? st.text : NEUTRAL.text4} />
                              <Text
                                style={[styles.bedOptionText, { color: on ? st.text : NEUTRAL.text4 }]}
                                numberOfLines={1}
                              >
                                {st.short}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── What to clean (private) ── */}
          {selectedRoom.type === 'private' && !commonOnly && Object.keys(assignmentAttributes).length > 0 && (
            <View>
              <Text style={d.overline}>What to clean</Text>
              <View style={styles.hkPickRow}>
                {Object.keys(assignmentAttributes).map(attr => {
                  const on = !!assignmentAttributes[attr];
                  return (
                    <TouchableOpacity
                      key={attr}
                      onPress={() => setAssignmentAttributes(prev => ({ ...prev, [attr]: !prev[attr] }))}
                      style={[
                        styles.attrPick,
                        on && { backgroundColor: STATUS.dirty.bg, borderColor: STATUS.dirty.border },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Icon
                        name={on ? 'check_circle' : 'radio_button_unchecked'}
                        size={17}
                        color={on ? STATUS.dirty.text : NEUTRAL.text4}
                      />
                      <Text style={[styles.attrPickText, on && { color: STATUS.dirty.text }]}>
                        {attr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Room flags ── */}
          <View>
            <Text style={d.overline}>Room flags</Text>
            <View style={styles.flagBtnRow}>
              <TouchableOpacity
                onPress={() => setEarlyCheckIn(v => !v)}
                style={[
                  styles.flagBtn,
                  earlyCheckIn && { backgroundColor: STATUS.early.bg, borderColor: STATUS.early.border },
                ]}
                activeOpacity={0.85}
              >
                <Icon name="login" size={18} color={earlyCheckIn ? STATUS.early.text : NEUTRAL.text2} />
                <Text style={[styles.flagBtnText, earlyCheckIn && { color: STATUS.early.text }]}>
                  Early check-in
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLateCheckOut(v => !v)}
                style={[
                  styles.flagBtn,
                  lateCheckOut && { backgroundColor: STATUS.late.bg, borderColor: STATUS.late.border },
                ]}
                activeOpacity={0.85}
              >
                <Icon name="hourglass_top" size={18} color={lateCheckOut ? STATUS.late.text : NEUTRAL.text2} />
                <Text style={[styles.flagBtnText, lateCheckOut && { color: STATUS.late.text }]}>
                  Late check-out
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Note ── */}
          <View>
            <Text style={d.overline}>Note for the housekeeper</Text>
            <TextInput
              value={managerNotes}
              onChangeText={setManagerNotes}
              placeholder="e.g. missing towel, broken lock…"
              placeholderTextColor={NEUTRAL.text4}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={styles.noteInput}
            />
          </View>
        </Drawer>
      )}

      {/* ── Overflow menu ── */}
      <Modal
        visible={showMore}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMore(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }}
          onPress={() => setShowMore(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {canAssign && (
                <>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => { setShowMore(false); setConfirmDialog('resetBeds'); }}
                    activeOpacity={0.7}
                  >
                    <Icon name="refresh" size={19} color={NEUTRAL.text2} />
                    <Text style={styles.menuItemText}>{t('resetBeds') || 'Reset beds'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => { setShowMore(false); setConfirmDialog('clearAll'); }}
                    activeOpacity={0.7}
                  >
                    <Icon name="cancel" size={19} color="#B91C1C" />
                    <Text style={[styles.menuItemText, { color: '#B91C1C' }]}>
                      {t('clearAll')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

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

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Container and filter bar ──
  container: { flex: 1, backgroundColor: NEUTRAL.appBg },
  filterBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    paddingVertical: 12, paddingHorizontal: 28,
    backgroundColor: NEUTRAL.surface,
    borderBottomWidth: 1, borderBottomColor: NEUTRAL.border,
    zIndex: 10,
  },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 40, minWidth: 200, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
  },
  searchInput: {
    flex: 1, minWidth: 0, outlineStyle: 'none',
    fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text,
  },
  moreBtn: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Segment and type buttons ──
  segment: {
    flexDirection: 'row', gap: 4, padding: 4,
    backgroundColor: NEUTRAL.slateChip, borderRadius: 14,
  },
  segmentItem: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 36, paddingHorizontal: 14, borderRadius: 10,
  },
  segmentItemActive: {
    backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.06,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  segmentLabel: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14, color: NEUTRAL.text3,
  },
  segmentLabelActive: { color: NEUTRAL.text },
  segmentCount: {
    minWidth: 22, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 8, backgroundColor: 'rgba(15,23,42,0.06)',
  },
  segmentCountActive: { backgroundColor: BRAND.yellowSoft },
  segmentCountText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12,
    color: NEUTRAL.text3, textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  segmentCountTextActive: { color: '#B45309' },

  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 44, paddingHorizontal: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  typeBtnOn: { borderColor: BRAND.yellow, backgroundColor: BRAND.yellowSoft },
  typeBtnText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14, color: NEUTRAL.text3,
  },
  resultCount: { fontFamily: FONTS.medium, fontSize: 14, color: NEUTRAL.text3 },

  // ── Body and layout ──
  body: {
    flex: 1, minHeight: 0,
    flexDirection: 'row', alignItems: 'stretch',
  },
  roomAreaWrapper: { flex: 1, minWidth: 0, minHeight: 0 },
  roomArea: { flex: 1 },
  roomAreaContent: { paddingTop: 24, paddingHorizontal: 28, paddingBottom: 130 },

  // ── Floor header ──
  floorRowHead: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    width: '100%', paddingBottom: 12, marginBottom: 16,
    borderBottomWidth: 1, borderBottomColor: NEUTRAL.border,
  },
  floorBar: { width: 4, height: 22, borderRadius: 2, backgroundColor: BRAND.yellow },
  floorName: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 20, color: NEUTRAL.text,
  },
  floorMeta: {
    fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text3,
    fontVariant: ['tabular-nums'],
  },

  // ── Room cards ──
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  roomCard: {
    position: 'relative', overflow: 'hidden',
    flexGrow: 1, flexBasis: 340, maxWidth: '100%',
    borderRadius: 20, borderWidth: 1, borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
    paddingTop: 16, paddingHorizontal: 18, paddingBottom: 14,
    shadowColor: BRAND.navy, shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  cardSelected: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 20, borderWidth: 2, borderColor: BRAND.navy,
    backgroundColor: 'rgba(245,179,43,0.16)',
  },

  cardHead: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 12,
  },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  cardHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  checkbox: {
    width: 22, height: 22, flexShrink: 0, borderRadius: 7,
    borderWidth: 1.5, borderColor: NEUTRAL.border, backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSm: {
    width: 20, height: 20, flexShrink: 0, borderRadius: 6,
    borderWidth: 1.5, borderColor: NEUTRAL.border, backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  roomNumber: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 22, lineHeight: 22,
    color: NEUTRAL.text, fontVariant: ['tabular-nums'],
  },
  typePill: {
    height: 24, paddingHorizontal: 10, borderRadius: 9, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  typePillText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12 },
  bedsLabel: {
    flexShrink: 1, minWidth: 0,
    fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text3,
    fontVariant: ['tabular-nums'],
  },
  editBtn: {
    width: 32, height: 32, borderRadius: 10,
    borderWidth: 1, borderColor: 'transparent', backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },

  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  flag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 26, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1,
  },
  flagText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12 },

  bedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  bedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    flexGrow: 1, flexBasis: '46%', minWidth: 0,
    height: 34, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1,
  },
  bedLetter: { fontFamily: FONTS.display, fontWeight: '600', fontSize: 14 },
  bedLabel: {
    flexShrink: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13,
  },

  commonToggle: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14 },
  commonToggleText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, color: NEUTRAL.text2,
  },

  attrRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  attrChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 30, paddingHorizontal: 11, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  attrChipText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 12.5, color: NEUTRAL.text3,
  },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, marginTop: 16, paddingTop: 13,
    borderTopWidth: 1, borderTopColor: '#EEF2F7',
  },
  hkCell: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  hkDot: { width: 8, height: 8, borderRadius: 999, flexShrink: 0 },
  hkName: {
    flexShrink: 1, minWidth: 0,
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 15, color: NEUTRAL.text,
  },
  footBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  unassignBtn: {
    height: 32, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#FECACA',
    alignItems: 'center', justifyContent: 'center',
  },
  unassignText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13, color: '#B91C1C',
  },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 32, paddingHorizontal: 13, borderRadius: 12,
    borderWidth: 1, borderColor: BRAND.navy, backgroundColor: 'transparent',
  },
  assignText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13, color: BRAND.navy,
  },

  // ── Rail ──
  rail: {
    alignSelf: 'stretch', height: '100%',
    borderLeftWidth: 1, borderLeftColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
    overflow: 'hidden',
  },
  railClosed: { width: 61, flexGrow: 0, flexShrink: 0, flexBasis: 61 },
  railOpen:   { width: 319, flexGrow: 0, flexShrink: 0, flexBasis: 319 },

  railIcons: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  railBtn: {
    position: 'relative', width: 44, height: 44, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  railBadge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 999,
    backgroundColor: BRAND.yellow, borderWidth: 2, borderColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  railBadgeText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 11, color: BRAND.navy,
  },

  railHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: NEUTRAL.border,
  },
  railOverline: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 11,
    letterSpacing: 0.88, textTransform: 'uppercase', color: NEUTRAL.text3,
  },
  railClose: {
    width: 36, height: 36, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  railBody: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 130 },

  railSection: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 15, borderRadius: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: '#F8FAFC',
  },
  railSectionTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 16, color: NEUTRAL.text,
  },
  railSectionSub: {
    marginTop: 2, fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3,
  },
  railHint: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 10, paddingHorizontal: 2, paddingBottom: 2,
  },
  railHintText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text3 },
  railAllOn: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12.5, color: BRAND.navy,
  },

  hkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 13, borderRadius: 16,
    borderWidth: 1,
  },
  hkRowOn:  { backgroundColor: NEUTRAL.surface, borderColor: BRAND.navy },
  hkRowOff: { backgroundColor: NEUTRAL.surface, borderColor: NEUTRAL.border },
  hkAvatar: {
    width: 32, height: 32, borderRadius: 999, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  hkAvatarText: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 13, color: '#FFFFFF',
  },
  hkRowTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  hkRowName: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 15, color: NEUTRAL.text,
  },
  hkRowLoad: {
    flexShrink: 0, fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13,
    color: NEUTRAL.text2, fontVariant: ['tabular-nums'],
  },
  hkTrack: {
    height: 5, borderRadius: 999, marginTop: 8,
    backgroundColor: NEUTRAL.slateChip, overflow: 'hidden',
  },
  hkFill: { height: '100%', borderRadius: 999 },

  glance: {
    marginTop: 24, padding: 18, borderRadius: 22,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: '#F8FAFC',
  },
  glanceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  glanceLabel: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text2 },
  glanceValue: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 14,
    color: NEUTRAL.text, fontVariant: ['tabular-nums'],
  },

  // ── Bulk bar ──
  bulkBar: {
    position: 'fixed', bottom: 24, left: '50%', transform: [{ translateX: '-50%' }],
    maxWidth: 'calc(100vw - 340px)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, flexWrap: 'wrap',
    paddingVertical: 10, paddingLeft: 16, paddingRight: 12, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.68)',
    shadowColor: BRAND.navy, shadowOpacity: 0.18,
    shadowRadius: 34, shadowOffset: { width: 0, height: 14 },
    zIndex: 40,
    ...GLASS.webStyle,
  },
  bulkCount: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 2 },
  bulkBadge: {
    minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 8,
    backgroundColor: BRAND.yellow, alignItems: 'center', justifyContent: 'center',
  },
  bulkBadgeText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12.5,
    color: BRAND.navy, fontVariant: ['tabular-nums'],
  },
  bulkCountText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13.5, color: NEUTRAL.text,
  },
  bulkDivider: { width: 1, height: 24, backgroundColor: NEUTRAL.border },
  bulkPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 40, paddingHorizontal: 15, borderRadius: 14, backgroundColor: BRAND.navy,
  },
  bulkPrimaryText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13.5, color: '#FFFFFF',
  },
  bulkDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 40, paddingHorizontal: 13, borderRadius: 14,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: NEUTRAL.surface,
  },
  bulkDangerText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, color: '#B91C1C',
  },
  bulkGhost: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 40, paddingHorizontal: 13, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  bulkGhostText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, color: NEUTRAL.text2,
  },
  bulkClose: {
    width: 40, height: 40, borderRadius: 14, flexShrink: 0,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },

    /* ── Bulk chips ── */
    bulkChipScroll: { flexGrow: 0, flexShrink: 1, maxWidth: 320 },
    bulkChipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    bulkChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      height: 28, paddingHorizontal: 10, borderRadius: 999,
      borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    },
    bulkChipDot: { width: 7, height: 7, borderRadius: 999, flexShrink: 0 },
    bulkChipText: {
      fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12.5,
      color: NEUTRAL.text, fontVariant: ['tabular-nums'],
    },

  // ── Bulk picker modal ──
  pickerScrim: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, backgroundColor: 'rgba(11,31,58,0.45)',
  },
  pickerCard: {
    width: 300, maxHeight: '70%', padding: 16, borderRadius: 22,
    backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy, shadowOpacity: 0.28,
    shadowRadius: 40, shadowOffset: { width: 0, height: 18 },
  },
  pickerTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 16,
    color: NEUTRAL.text, marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 46, paddingHorizontal: 12, borderRadius: 14,
  },
  pickerRowText: { fontFamily: FONTS.medium, fontWeight: '500', fontSize: 15, color: NEUTRAL.text },
  pickerEmpty: {
    fontFamily: FONTS.regular, fontSize: 13.5, color: NEUTRAL.text3, paddingVertical: 10,
  },

  // ── Drawer content styles ──
  hkPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  hkPick: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    height: 40, paddingHorizontal: 15, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  hkPickOn: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  hkPickDot: { width: 9, height: 9, borderRadius: 999, flexShrink: 0 },
  hkPickText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: NEUTRAL.text2,
  },

  commonCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 15, paddingHorizontal: 17, borderRadius: 18,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  commonCardOn: { backgroundColor: STATUS.cleaned.bg, borderColor: STATUS.cleaned.border },
  commonCardTitle: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14.5, color: NEUTRAL.text,
  },
  commonCardSub: {
    marginTop: 3, fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text3,
  },

  sectionHead: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', gap: 12, marginBottom: 12,
  },
  sectionAction: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 13, color: BRAND.navy,
  },

  bedTable: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: NEUTRAL.border,
  },
  bedTableRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 11, paddingHorizontal: 15,
    borderBottomWidth: 1, borderBottomColor: '#EEF2F7',
  },
  bedLetterBox: {
    width: 30, height: 30, flexShrink: 0, borderRadius: 10,
    backgroundColor: NEUTRAL.slateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  bedLetterBoxText: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 15, color: NEUTRAL.text,
  },
  bedOptions: { flexDirection: 'row', gap: 7, flex: 1, minWidth: 0 },
  bedOption: {
    flex: 1, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    height: 34, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1,
    overflow: 'hidden',
  },
  bedOptionText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12 },

  attrPick: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 38, paddingHorizontal: 14, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  attrPickText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: NEUTRAL.text2,
  },

  flagBtnRow: { flexDirection: 'row', gap: 9 },
  flagBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  flagBtnText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14, color: NEUTRAL.text2,
  },

  noteInput: {
    minHeight: 92, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
    fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text,
    outlineStyle: 'none',
  },

  saveStatesBtn: {
    height: 52, paddingHorizontal: 22, borderRadius: 16,
    borderWidth: 1, borderColor: BRAND.navy, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  saveStatesText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15, color: BRAND.navy,
  },
  assignBtnOff: { backgroundColor: NEUTRAL.deskBg },

  // ── Overflow menu ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingRight: 24,
  },
  modalCard: {
    width: 220,
    backgroundColor: NEUTRAL.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    paddingVertical: 6,
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 44, paddingHorizontal: 14,
  },
  menuItemText: { fontFamily: FONTS.medium, fontSize: 14, color: NEUTRAL.text },
});