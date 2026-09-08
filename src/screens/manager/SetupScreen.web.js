import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Pressable, Modal,
} from 'react-native';
import Icon from '../../components/Icon';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING, genId } from '../../theme';
import {
  Button, Card, Label, Input, SectionTitle, FloorHeader,
  EmptyState, ToggleGroup, Badge, Chip,
} from '../../components/UI';
import { useApp } from '../../contexts/AppContext';
import { BRAND, NEUTRAL } from '../../theme/tokens';

const SUNKEN = '#F8FAFC';
const DANGER = '#B91C1C';
const DANGER_BG = '#FEE2E2';
const DANGER_BORDER = '#FECACA';

// ─── Helper to generate floors ──────────────────────────────────
function generateFloors(count, hasGarage) {
  const floors = [];
  floors.push({ id: genId(), name: 'Ground Floor' });
  for (let i = 1; i <= count; i++) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = i % 100;
    const suffix = (s[(v - 20) % 10] || s[v] || s[0]);
    floors.push({ id: genId(), name: `${i}${suffix} Floor` });
  }
  if (hasGarage) {
    floors.push({ id: genId(), name: 'Garage' });
  }
  return floors;
}

// ─── Helper to generate beds from scratch (used when the naming scheme is
//     explicitly changed, or a brand-new room is being created) ──────────
function generateBeds(count, scheme) {
  const beds = [];
  for (let i = 0; i < count; i++) {
    const name = scheme === 'letters'
      ? String.fromCharCode(65 + (i % 26))
      : String(i + 1);
    beds.push({ id: genId(), name });
  }
  return beds;
}

// ─── Helper to resize the bed list WITHOUT clobbering names the manager has
//     already customized. Beds are kept/truncated from the front; any newly
//     added beds get a default name based on the naming scheme. ───────────
function resizeBeds(existingBeds, count, scheme) {
  const beds = (existingBeds || []).slice(0, count).map(b => ({ ...b }));
  for (let i = beds.length; i < count; i++) {
    const name = scheme === 'letters'
      ? String.fromCharCode(65 + (i % 26))
      : String(i + 1);
    beds.push({ id: genId(), name });
  }
  return beds;
}

function guessScheme(beds) {
  if (!beds || beds.length === 0) return 'letters';
  const first = beds[0].name;
  if (/^[A-Z]$/.test(first)) return 'letters';
  if (/^\d+$/.test(first)) return 'numbers';
  return 'letters';
}

/* ── Drawer — the shared shell ───────────────────────────────────── */

function Drawer({ visible, onClose, title, subtitle, width = 560, children, footer }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.drawerPanel, { width }]}>
          <View style={styles.drawerHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.drawerTitle}>{title}</Text>
              {!!subtitle && <Text style={styles.drawerSub}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.drawerClose} activeOpacity={0.7}>
              <Icon name="close" size={20} color={NEUTRAL.text3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.drawerBody}>
            {children}
          </ScrollView>

          {!!footer && <View style={styles.drawerFooter}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

/* Overline label — 11px, 600, uppercase, 0.08em. Used for every field. */
function FieldLabel({ children }) {
  return <Text style={styles.overline}>{children}</Text>;
}

// ─── Room Form Drawer ─────────────────────────────────────────────
function RoomFormPanel({ visible, floors, room, onSave, onCancel, roomAttributes = [], t }) {
  const [form, setForm] = useState(
    room
      ? { ...room, attributes: room.attributes || {} }
      : { name: '', type: 'private', floorId: floors?.[0]?.id || '', beds: [], attributes: {} }
  );
  const [namingScheme, setNamingScheme] = useState(
    room?.beds?.length ? guessScheme(room.beds) : 'letters'
  );
  const [bedCount, setBedCount] = useState(room?.beds?.length || 0);

  const prevRoomId = useRef(room?.id);
  useEffect(() => {
    if (prevRoomId.current !== room?.id) {
      prevRoomId.current = room?.id;
      if (room) {
        setForm({ ...room, attributes: room.attributes || {} });
        setNamingScheme(guessScheme(room.beds || []));
        setBedCount((room.beds || []).length);
      } else {
        setForm({ name: '', type: 'private', floorId: floors?.[0]?.id || '', beds: [], attributes: {} });
        setNamingScheme('letters');
        setBedCount(0);
      }
    }
  }, [room]);

  useEffect(() => {
    if (form.type === 'dorm') {
      setForm(f => ({ ...f, beds: resizeBeds(f.beds, bedCount, namingScheme) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedCount, form.type]);

  const handleSchemeChange = (v) => {
    setNamingScheme(v);
    if (form.type === 'dorm') setForm(f => ({ ...f, beds: generateBeds(bedCount, v) }));
  };

  const renameBed = (bedId, newName) => {
    setForm(f => ({
      ...f,
      beds: (f.beds || []).map(b => (b.id === bedId ? { ...b, name: newName } : b)),
    }));
  };

  const deleteBed = (bedId) => {
    setForm(f => {
      const next = (f.beds || []).filter(b => b.id !== bedId);
      setBedCount(next.length);
      return { ...f, beds: next };
    });
  };

  const toggleAttribute = (attr) => {
    setForm(prev => ({
      ...prev,
      attributes: { ...prev.attributes, [attr]: !prev.attributes?.[attr] },
    }));
  };

  const isValid = form.name.trim() && form.floorId;

  const handleSave = () => {
    const cleanAttributes = {};
    if (form.attributes) {
      Object.entries(form.attributes).forEach(([key, val]) => {
        if (val) cleanAttributes[key] = true;
      });
    }
    onSave({ ...form, attributes: cleanAttributes });
  };

  const TYPES = [
    { key: 'dorm', label: t('dormitory'), icon: 'bed' },
    { key: 'private', label: t('private'), icon: 'king_bed' },
  ];

  return (
    <Drawer
      visible={visible}
      onClose={onCancel}
      title={room ? t('editRoom') : t('addRoom')}
      subtitle="Structure only · beds, type and floor"
      footer={
        <>
          <TouchableOpacity onPress={onCancel} style={styles.btnGhost} activeOpacity={0.8}>
            <Text style={styles.btnGhostText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid}
            style={[styles.btnPrimary, !isValid && { opacity: 0.5 }]}
            activeOpacity={0.9}
          >
            <Icon name="save" size={20} color={BRAND.yellow} />
            <Text style={styles.btnPrimaryText}>{t('save')}</Text>
          </TouchableOpacity>
        </>
      }
    >
      {/* Name + floor share a row and wrap on a narrow viewport. */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldName}>
          <FieldLabel>{t('roomName')}</FieldLabel>
          <TextInput
            value={form.name}
            onChangeText={v => setForm(f => ({ ...f, name: v }))}
            placeholder={t('setup.roomNamePlaceholder')}
            placeholderTextColor={NEUTRAL.text4}
            autoCapitalize="words"
            style={styles.textInput}
          />
        </View>

        <View style={styles.fieldFloor}>
          <FieldLabel>{t('floor')}</FieldLabel>
          <View style={styles.chipRow}>
            {floors?.map(fl => {
              const on = form.floorId === fl.id;
              return (
                <TouchableOpacity
                  key={fl.id}
                  onPress={() => setForm(f => ({ ...f, floorId: fl.id }))}
                  style={[styles.pickChip, on && styles.pickChipOn]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pickChipText, on && styles.pickChipTextOn]}>{fl.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Room type — two equal buttons, not a segmented control. */}
      <View>
        <FieldLabel>{t('roomType')}</FieldLabel>
        <View style={styles.typeRow}>
          {TYPES.map(tp => {
            const on = form.type === tp.key;
            return (
              <TouchableOpacity
                key={tp.key}
                onPress={() => setForm(f => ({ ...f, type: tp.key }))}
                style={[styles.typeBtn, on && styles.typeBtnOn]}
                activeOpacity={0.85}
              >
                <Icon name={tp.icon} size={19} color={on ? BRAND.navy : NEUTRAL.text2} />
                <Text style={[styles.typeBtnText, on && { color: BRAND.navy }]}>{tp.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {form.type === 'private' && roomAttributes.length > 0 && (
        <View>
          <FieldLabel>{t('roomFeatures')}</FieldLabel>
          <View style={styles.chipRow}>
            {roomAttributes.map(attr => {
              const on = !!form.attributes?.[attr];
              return (
                <TouchableOpacity
                  key={attr}
                  onPress={() => toggleAttribute(attr)}
                  style={[styles.pickChip, on && styles.pickChipSoft]}
                  activeOpacity={0.8}
                >
                  <Icon
                    name={on ? 'check_circle' : 'radio_button_unchecked'}
                    size={17}
                    color={on ? BRAND.navy : NEUTRAL.text4}
                  />
                  <Text style={[styles.pickChipText, on && { color: BRAND.navy }]}>{attr}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>
            A private room is cleaned as one unit — no individual beds. What to clean is
            set per shift on the Assign screen.
          </Text>
        </View>
      )}

      {form.type === 'dorm' && (
        <View>
          <View style={styles.bedsHead}>
            <FieldLabel>{`${t('beds')} · ${bedCount}`}</FieldLabel>
            <View style={styles.stepperBtns}>
              <TouchableOpacity
                onPress={() => setBedCount(n => Math.max(0, n - 1))}
                disabled={bedCount === 0}
                style={[styles.stepBtn, bedCount === 0 && { opacity: 0.4 }]}
                activeOpacity={0.8}
              >
                <Icon name="remove" size={18} color={NEUTRAL.text2} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBedCount(n => n + 1)}
                style={styles.stepBtnPrimary}
                activeOpacity={0.85}
              >
                <Icon name="add" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Naming scheme — not in the prototype, kept because it works. */}
          <View style={[styles.chipRow, { marginBottom: 12 }]}>
            {[{ v: 'letters', l: t('letters') }, { v: 'numbers', l: t('numbers') }].map(o => {
              const on = namingScheme === o.v;
              return (
                <TouchableOpacity
                  key={o.v}
                  onPress={() => handleSchemeChange(o.v)}
                  style={[styles.pickChip, on && styles.pickChipSoft]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pickChipText, on && { color: BRAND.navy }]}>{o.l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ gap: 8 }}>
            {form.beds?.map((b, i) => (
              <View key={b.id} style={styles.bedRow}>
                <View style={styles.bedIndex}>
                  <Text style={styles.bedIndexText}>{i + 1}</Text>
                </View>
                <TextInput
                  value={b.name}
                  onChangeText={v => renameBed(b.id, v)}
                  placeholder="Bed name"
                  placeholderTextColor={NEUTRAL.text4}
                  maxLength={12}
                  style={styles.bedInput}
                />
                <TouchableOpacity
                  onPress={() => deleteBed(b.id)}
                  style={styles.bedDelete}
                  activeOpacity={0.7}
                >
                  <Icon name="delete" size={18} color={NEUTRAL.text4} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <Text style={styles.hint}>
            Bed names are what housekeepers see on their sheet. Removing a bed drops its
            state for today.
          </Text>
        </View>
      )}
    </Drawer>
  );
}

// ─── Attributes ───────────────────────────────────────────────────
function AttributesDialog({ visible, attributes, rooms, onSave, onClose, t }) {
  const [newAttr, setNewAttr] = useState('');
  const [cannotRemove, setCannotRemove] = useState(null);

  const addAttr = () => {
    if (!newAttr.trim()) return;
    onSave([...attributes, newAttr.trim()]);
    setNewAttr('');
  };

  const removeAttr = (index) => {
    const attrName = attributes[index];
    const isUsed = rooms.some(room => room.attributes && room.attributes[attrName] === true);
    if (isUsed) { setCannotRemove(attrName); return; }
    onSave(attributes.filter((_, i) => i !== index));
  };

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        width={460}
        title={t('setup.customAttributes')}
        subtitle={t('setup.attributesDescription')}
      >
        <View>
          <FieldLabel>{t('setup.newAttribute')}</FieldLabel>
          <View style={styles.addRow}>
            <TextInput
              value={newAttr}
              onChangeText={setNewAttr}
              placeholder={t('setup.attributePlaceholder')}
              placeholderTextColor={NEUTRAL.text4}
              onSubmitEditing={addAttr}
              style={[styles.textInput, { flex: 1, fontFamily: FONTS.regular, fontSize: 14.5 }]}
            />
            <TouchableOpacity
              onPress={addAttr}
              disabled={!newAttr.trim()}
              style={[styles.stepBtnPrimary, styles.addBtn, !newAttr.trim() && { opacity: 0.4 }]}
              activeOpacity={0.85}
            >
              <Icon name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          {attributes.length === 0
            ? <Text style={styles.emptyHint}>{t('setup.noAttributes') || 'No attributes yet.'}</Text>
            : attributes.map((attr, index) => (
                <View key={attr} style={styles.listRow}>
                  <View style={styles.listRowIcon}>
                    <Icon name="tune" size={18} color={BRAND.navy} />
                  </View>
                  <Text style={styles.listRowLabel} numberOfLines={1}>{attr}</Text>
                  <TouchableOpacity
                    onPress={() => removeAttr(index)}
                    style={styles.bedDelete}
                    activeOpacity={0.7}
                  >
                    <Icon name="delete" size={18} color={DANGER} />
                  </TouchableOpacity>
                </View>
              ))}
        </View>
      </Drawer>

      <ConfirmDialog
        visible={!!cannotRemove}
        title={t('setup.cannotRemoveTitle')}
        message={t('setup.cannotRemoveMessage', { name: cannotRemove })}
        confirmLabel={t('setup.ok')}
        onConfirm={() => setCannotRemove(null)}
        onCancel={() => setCannotRemove(null)}
        singleAction
      />
    </>
  );
}

// ─── Floors ───────────────────────────────────────────────────────
function FloorManagementDialog({ visible, floors, onAddFloor, onRemoveFloor, onClose, t }) {
  const [newFloorName, setNewFloorName] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    const taken = new Set(floors.map(f => f.name.toLowerCase()));
    return ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', 'Garage']
      .filter(n => !taken.has(n.toLowerCase())).slice(0, 4);
  }, [floors]);

  const handleAdd = async () => {
    if (!newFloorName.trim()) return;
    setSaving(true);
    try {
      await onAddFloor(newFloorName.trim());
      setNewFloorName('');
    } catch (error) {
      Alert.alert(t('error'), error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      width={460}
      title={t('manageFloors')}
      subtitle={t('setup.floorsHint') || 'Floors group your rooms.'}
    >
      <View>
        <FieldLabel>{t('setup.addCustomFloor')}</FieldLabel>
        <View style={styles.addRow}>
          <TextInput
            value={newFloorName}
            onChangeText={setNewFloorName}
            placeholder={t('setup.customFloorPlaceholder')}
            placeholderTextColor={NEUTRAL.text4}
            onSubmitEditing={handleAdd}
            style={[styles.textInput, { flex: 1, fontFamily: FONTS.regular, fontSize: 14.5 }]}
          />
          <TouchableOpacity
            onPress={handleAdd}
            disabled={saving || !newFloorName.trim()}
            style={[styles.stepBtnPrimary, styles.addBtn, (saving || !newFloorName.trim()) && { opacity: 0.4 }]}
            activeOpacity={0.85}
          >
            <Icon name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {suggestions.length > 0 && (
          <View style={[styles.chipRow, { marginTop: 12 }]}>
            {suggestions.map(name => (
              <TouchableOpacity
                key={name}
                onPress={() => onAddFloor(name)}
                style={styles.suggestChip}
                activeOpacity={0.8}
              >
                <Icon name="add" size={16} color={NEUTRAL.text3} />
                <Text style={styles.pickChipText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={{ gap: 8 }}>
        {floors.length === 0
          ? <Text style={styles.emptyHint}>{t('setup.noFloorsAdded')}</Text>
          : floors.map(f => (
              <View key={f.id} style={styles.listRow}>
                <View style={styles.listRowIcon}>
                  <Icon name="layers" size={18} color={BRAND.navy} />
                </View>
                <Text style={styles.listRowLabel} numberOfLines={1}>{f.name}</Text>
                <TouchableOpacity
                  onPress={() => onRemoveFloor(f.id)}
                  style={styles.bedDelete}
                  activeOpacity={0.7}
                >
                  <Icon name="delete" size={18} color={DANGER} />
                </TouchableOpacity>
              </View>
            ))}
      </View>
    </Drawer>
  );
}

// ─── Confirm ──────────────────────────────────────────────────────
// Stays centered — a destructive confirm is a interruption, not a workspace,
// and sliding it in from the right would read as another editing surface.
function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel, singleAction }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmMessage}>{message}</Text>
          <View style={styles.confirmActions}>
            {!singleAction && (
              <TouchableOpacity onPress={onCancel} style={[styles.btnGhost, { flex: 1 }]} activeOpacity={0.8}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onConfirm}
              style={[
                styles.btnPrimary,
                { flex: 1, justifyContent: 'center' },
                !singleAction && { backgroundColor: DANGER },
              ]}
              activeOpacity={0.9}
            >
              <Text style={styles.btnPrimaryText}>{confirmLabel || 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Icon button with a hover state.
 *
 * The prototype's card buttons are transparent at rest and only grow a fill
 * and a border on hover. RN Web doesn't do :hover, but it does forward
 * onMouseEnter/onMouseLeave on Pressable, so the state is tracked manually.
 * The border is always present at 1px in `transparent` so nothing shifts by a
 * pixel when it appears.
 */
function HoverIconButton({ icon, color, hoverColor, hoverBg, hoverBorder, onPress, label }) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.iconBtn,
        hover && { backgroundColor: hoverBg, borderColor: hoverBorder },
      ]}
    >
      <Icon name={icon} size={19} color={hover ? (hoverColor || color) : color} />
    </Pressable>
  );
}

// ─── Main Setup Screen ───────────────────────────────────────────
export default function SetupScreen({ onReady }) {
  const {
    hostel, floors, rooms, addFloor, removeFloor, saveRoom, deleteRoom, updateHostel,
    roomAttributes, updateRoomAttributes,
  } = useApp();

  const { t } = useTranslation();

  const [step, setStep] = useState(floors.length > 0 ? 2 : 1);
  const [hName, setHName] = useState(hostel.name || '');

  const [floorCount, setFloorCount] = useState('');
  const [hasGarage, setHasGarage] = useState(false);

  const [showRoom, setShowRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showAttrModal, setShowAttrModal] = useState(false);
  const [expandedFloors, setExpandedFloors] = useState({});
  const [deleteRoomId, setDeleteRoomId] = useState(null);
  const [roomSearch, setRoomSearch] = useState('');

  const toggleFloor = (floorId) => setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));

  // The toolbar buttons moved up into PageHeader, so the layout needs handles
  // on them. Registered once — the setters are stable, so this won't loop.
  useEffect(() => {
    if (!onReady) return;
    onReady({
      addRoom:     () => { setEditingRoom(null); setShowRoom(true); },
      openFloors:  () => setShowFloorModal(true),
      openAttrs:   () => setShowAttrModal(true),
    });
  }, [onReady]);

  const sortedFloors = useMemo(() => {
    return [...floors].sort((a, b) => {
      const order = (name) => {
        if (name === 'Ground Floor') return 0;
        if (name === 'Garage') return 999;
        const num = parseInt(name);
        if (!isNaN(num)) return num;
        return 500;
      };
      return order(a.name) - order(b.name);
    });
  }, [floors]);

  const openRoomForm = (room = null) => {
    setEditingRoom(room);
    setShowRoom(true);
  };

  const handleSaveRoom = async (form) => {
    try {
      if (editingRoom) {
        await saveRoom({ ...form, id: editingRoom.id });
      } else {
        await saveRoom({ ...form, id: genId() });
      }
    } catch (error) {
      Alert.alert(t('error'), t('setup.failedToSaveRoom', { message: error.message }));
    } finally {
      setShowRoom(false);
      setEditingRoom(null);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deleteRoomId) return;
    try {
      await deleteRoom(deleteRoomId);
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeleteRoomId(null);
    }
  };

  const saveHostel = () => {
    if (!hName.trim()) return;
    updateHostel({ name: hName.trim() });
    setStep(1);
  };

  const handleGenerateFloors = async () => {
    const count = parseInt(floorCount, 10);
    if (isNaN(count) || count < 0) {
      Alert.alert(t('error'), t('setup.invalidNumber'));
      return;
    }
    const newFloors = generateFloors(count, hasGarage);
    for (const floor of newFloors) {
      await addFloor(floor.name);
    }
    setStep(2);
  };

  // ── Step 0: Hostel name ──────────────────────────────────────
  if (step === 0) {
    return (
      <View style={styles.safe}>
        <View style={styles.wizardWrap}>
          <View style={styles.wizardCard}>
            <SectionTitle title={t('buildHostel')} subtitle={t('setup.startWithName')} />
            <Label>{t('propertyName')}</Label>
            <Input
              value={hName}
              onChangeText={setHName}
              placeholder={t('setup.propertyNamePlaceholder')}
              autoCapitalize="words"
              style={{ marginBottom: SPACING[4] }}
            />
            <Button title={t('continue')} onPress={saveHostel} disabled={!hName.trim()} />
          </View>
        </View>
      </View>
    );
  }

  // ── Step 1: Floors ───────────────────────────────────────────
  if (step === 1) {
    return (
      <View style={styles.safe}>
        <View style={styles.wizardWrap}>
          <View style={styles.wizardCard}>
            <SectionTitle title={t('setup.tellAboutFloors')} subtitle={t('setup.floorsAutoGenerated')} />
            <Label>{t('floorsQuestion')}</Label>
            <Input
              value={floorCount}
              onChangeText={setFloorCount}
              placeholder={t('setup.floorsPlaceholder')}
              keyboardType="number-pad"
              style={{ marginBottom: SPACING[3] }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING[4] }}>
              <TouchableOpacity
                onPress={() => setHasGarage(!hasGarage)}
                style={[styles.checkbox, hasGarage && styles.checkboxActive]}
              >
                {hasGarage && <Icon name="checkmark" size={18} color={COLORS.white} />}
              </TouchableOpacity>
              <Text style={{ marginLeft: SPACING[2], fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text }}>
                {t('includeGarage')}
              </Text>
            </View>
            <Button
              title={t('generateFloors')}
              onPress={handleGenerateFloors}
              disabled={isNaN(parseInt(floorCount, 10)) || parseInt(floorCount, 10) < 0}
            />
          </View>
        </View>
      </View>
    );
  }

  // ── Step 2: Rooms ────────────────────────────────────────────
  return (
    <View style={styles.safe}>
      <View style={styles.filterBar}>
        <View style={styles.searchBar}>
          <Icon name="search" size={19} color={COLORS.textMuted} />
          <TextInput
            value={roomSearch}
            onChangeText={setRoomSearch}
            placeholder="Search a room…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {roomSearch.length > 0 && (
            <TouchableOpacity onPress={() => setRoomSearch('')} style={{ padding: 2 }}>
              <Icon name="cancel" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.countLine}>
          {rooms.length} {rooms.length !== 1 ? t('setup.roomsPlural') : t('setup.roomSingular')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.mainAreaContent}>
        {rooms.length === 0 && (
          <EmptyState icon="🛏" title={t('noRoomsToAssign') || t('rooms')} subtitle={t('addRoomsFirst') || ''} />
        )}

        {roomSearch.trim() !== '' && !rooms.some(r =>
          r.name.toLowerCase().includes(roomSearch.trim().toLowerCase())
        ) && (
          <EmptyState icon="🔍" title={t('noResults')} subtitle="" />
        )}

        {sortedFloors.map(floor => {
          const fr = rooms.filter(r =>
            r.floorId === floor.id &&
            (!roomSearch.trim() || r.name.toLowerCase().includes(roomSearch.trim().toLowerCase()))
          );
          if (!fr.length) return null;
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
                  {fr.length} {fr.length !== 1 ? 'rooms' : 'room'}
                </Text>
                <View style={{ flex: 1 }} />
                <Icon
                  name={isFloorExpanded ? 'expand_less' : 'expand_more'}
                  size={22}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {isFloorExpanded && (
                <View style={styles.roomGrid}>
                  {fr.map(room => {
                    const bedCount = room.type === 'dorm' ? (room.beds?.length || 0) : 0;
                    const attrCount = room.type === 'private' && room.attributes
                      ? Object.keys(room.attributes).length
                      : 0;
                    const summary = room.type === 'dorm'
                      ? (bedCount > 0 ? `${bedCount} ${bedCount !== 1 ? t('beds') : t('setup.bedSingular')}` : '')
                      : (attrCount > 0 ? `${attrCount} ${attrCount !== 1 ? t('setup.attrsPlural') : t('setup.attrSingular')}` : '');

                    return (
                      <View key={room.id} style={styles.roomCard}>
                        <View style={styles.roomCardRow}>
                          <View style={{ minWidth: 0 }}>
                            <Text style={styles.roomCardName} numberOfLines={1}>{room.name}</Text>
                            <View style={styles.roomMetaRow}>
                              <View style={[
                                styles.typePill,
                                { backgroundColor: room.type === 'dorm' ? NEUTRAL.beigePill : NEUTRAL.slateChip },
                              ]}>
                                <Text style={[
                                  styles.typePillText,
                                  { color: room.type === 'dorm' ? '#7C4A15' : NEUTRAL.text2 },
                                ]}>
                                  {room.type === 'dorm' ? t('dormitory') : t('private')}
                                </Text>
                              </View>
                              {!!summary && <Text style={styles.summaryText}>{summary}</Text>}
                            </View>
                          </View>

                          <View style={styles.cardBtns}>
                            <HoverIconButton
                              icon="edit"
                              label={t('editRoom')}
                              color={NEUTRAL.text3}
                              hoverColor={BRAND.navy}
                              hoverBg={NEUTRAL.slateChip}
                              hoverBorder={NEUTRAL.border}
                              onPress={() => openRoomForm(room)}
                            />
                            <HoverIconButton
                              icon="delete"
                              label={t('deleteRoom')}
                              color="#B91C1C"
                              hoverBg="#FEE2E2"
                              hoverBorder="#FECACA"
                              onPress={() => setDeleteRoomId(room.id)}
                            />
                          </View>
                        </View>

                        {room.type === 'dorm' && room.beds?.length > 0 && (
                          <View style={styles.bedTags}>
                            {room.beds.map(b => (
                              <View key={b.id} style={[styles.chip, {
                                backgroundColor: '#F8FAFC',
                                borderColor: NEUTRAL.border,
                              }]}>
                                <Text style={[styles.chipText, { color: NEUTRAL.text2 }]}>{b.name}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {room.type === 'private' && room.attributes && Object.keys(room.attributes).length > 0 && (
                          <View style={styles.bedTags}>
                            {Object.entries(room.attributes).map(([attr, value]) => (
                              <View key={attr} style={[styles.chip, {
                                backgroundColor: value ? NEUTRAL.slateChip : '#F8FAFC',
                                borderColor: value ? BRAND.navy : NEUTRAL.border,
                              }]}>
                                <Text style={[styles.chipText, {
                                  color: value ? BRAND.navy : NEUTRAL.text4,
                                }]}>{attr}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <RoomFormPanel
        visible={showRoom}
        floors={sortedFloors}
        room={editingRoom}
        roomAttributes={roomAttributes}
        onSave={handleSaveRoom}
        onCancel={() => { setShowRoom(false); setEditingRoom(null); }}
        t={t}
      />

      <AttributesDialog
        visible={showAttrModal}
        attributes={roomAttributes}
        rooms={rooms}
        onSave={updateRoomAttributes}
        onClose={() => setShowAttrModal(false)}
        t={t}
      />

      <FloorManagementDialog
        visible={showFloorModal}
        floors={floors}
        onAddFloor={addFloor}
        onRemoveFloor={removeFloor}
        onClose={() => setShowFloorModal(false)}
        t={t}
      />

      <ConfirmDialog
        visible={!!deleteRoomId}
        title={t('deleteRoom')}
        message={t('deleteConfirmation')}
        onConfirm={handleDeleteRoom}
        onCancel={() => setDeleteRoomId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background, position: 'relative' },

  /* wizard steps */
  wizardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING[6] },
  wizardCard: {
    width: '100%', maxWidth: 460,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING[6], ...SHADOW.md,
  },

  /* toolbar */
  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: SPACING[3],
    paddingHorizontal: SPACING[6], paddingVertical: SPACING[4],
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  subtitle: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2] },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING[3], paddingVertical: SPACING[2],
    minWidth: 240,
  },
  searchInput: { flex: 1, fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.text },

  floorHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[3] },
  cardActions: { flexDirection: 'row', gap: 4 },
  cardActionBtn: { padding: 6, borderRadius: 6 },


  /* shared checkbox / attribute rows */
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  attributeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2], marginBottom: SPACING[2] },
  attributeLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },

  floorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING[3], borderTopWidth: 1, borderTopColor: COLORS.border },

  filterBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    paddingHorizontal: 28, paddingTop: 20, paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    width: 320, maxWidth: '100%', minHeight: 44, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
  },
  searchInput: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontSize: 15, color: NEUTRAL.text,
    outlineStyle: 'none',
  },
  countLine: { fontFamily: FONTS.medium, fontSize: 14, color: NEUTRAL.text3 },

  mainAreaContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
  },

  /* Floor header — a rule, not a bare row */
  floorRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
  },
  floorBar: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: BRAND.yellow,
  },
  floorName: {
    fontFamily: FONTS.display,
    fontWeight: '600',
    fontSize: 20,
    color: NEUTRAL.text,
  },
  floorMeta: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: NEUTRAL.text3,
    fontVariant: ['tabular-nums'],
  },

   /* Cards flow at min 300px */
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  roomCard: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 300,
    maxWidth: '100%',
    backgroundColor: NEUTRAL.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    padding: 18,
    gap: 14,
    shadowColor: BRAND.navy,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  roomCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  roomCardName: {
    fontFamily: FONTS.display,
    fontWeight: '600',
    fontSize: 20,
    color: NEUTRAL.text,
    fontVariant: ['tabular-nums'],
  },
  roomMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 6,
  },
  summaryText: {
    fontFamily: FONTS.regular,
    fontSize: 12.5,
    color: NEUTRAL.text4,
    fontVariant: ['tabular-nums'],
  },

  typePill: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePillText: {
    fontFamily: FONTS.semiBold,
    fontWeight: '600',
    fontSize: 12,
  },

  /* Icon buttons invisible until hovered */
  cardBtns: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontWeight: '500',
    fontSize: 12.5,
  },
  drawerScrim: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11,31,58,0.55)',
  },
  drawerPanel: {
    maxWidth: '92vw',
    height: '100%',
    backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy,
    shadowOpacity: 0.28,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingTop: 24,
    paddingHorizontal: 26,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
  },
  drawerTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 23, color: NEUTRAL.text,
  },
  drawerSub: {
    marginTop: 4, fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3,
  },
  drawerClose: {
    width: 40, height: 40, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  drawerBody: { paddingTop: 24, paddingHorizontal: 26, paddingBottom: 30, gap: 26 },
  drawerFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16, paddingHorizontal: 26,
    borderTopWidth: 1, borderTopColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
  },
 
  overline: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 11,
    letterSpacing: 0.88, textTransform: 'uppercase',
    color: NEUTRAL.text3, marginBottom: 10,
  },
  hint: {
    marginTop: 12, fontFamily: FONTS.regular, fontSize: 13,
    lineHeight: 19, color: NEUTRAL.text4,
  },
  emptyHint: {
    fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text4,
    textAlign: 'center', paddingVertical: 18,
  },
 
  fieldRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  fieldName: { flexGrow: 1, flexBasis: 160, minWidth: 0 },
  fieldFloor: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
 
  textInput: {
    height: 48, paddingHorizontal: 15, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 16, color: NEUTRAL.text,
    outlineStyle: 'none',
  },
 
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 40, paddingHorizontal: 14, borderRadius: 13,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  pickChipOn:   { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  pickChipSoft: { backgroundColor: NEUTRAL.slateChip, borderColor: BRAND.navy },
  pickChipText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 13.5, color: NEUTRAL.text2,
  },
  pickChipTextOn: { color: '#FFFFFF' },
 
  suggestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 40, paddingHorizontal: 14, borderRadius: 13,
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1',
  },
 
  typeRow: { flexDirection: 'row', gap: 9 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    height: 52, borderRadius: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  typeBtnOn: { backgroundColor: NEUTRAL.slateChip, borderColor: BRAND.navy },
  typeBtnText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14.5, color: NEUTRAL.text2,
  },
 
  bedsHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, marginBottom: 12,
  },
  stepperBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnPrimary: {
    width: 36, height: 36, borderRadius: 12,
    borderWidth: 1, borderColor: BRAND.navy, backgroundColor: BRAND.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: { width: 48, height: 48, borderRadius: 14, flexShrink: 0 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
 
  bedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bedIndex: {
    width: 34, height: 34, borderRadius: 11, flexShrink: 0,
    backgroundColor: NEUTRAL.slateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  bedIndexText: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 14, color: NEUTRAL.text3,
  },
  bedInput: {
    flex: 1, minWidth: 0, height: 44, paddingHorizontal: 14, borderRadius: 13,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
    fontFamily: FONTS.regular, fontSize: 14.5, color: NEUTRAL.text,
    outlineStyle: 'none',
  },
  bedDelete: {
    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
    borderWidth: 1, borderColor: 'transparent', backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
 
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 60, paddingHorizontal: 14, borderRadius: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  listRowIcon: {
    width: 34, height: 34, borderRadius: 11, flexShrink: 0,
    backgroundColor: NEUTRAL.slateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  listRowLabel: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 15, color: NEUTRAL.text,
  },
 
  btnGhost: {
    height: 52, paddingHorizontal: 22, borderRadius: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  btnGhostText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 15, color: NEUTRAL.text2,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    height: 52, paddingHorizontal: 24, borderRadius: 16,
    backgroundColor: BRAND.navy, justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15, color: '#FFFFFF',
  },
 
  confirmScrim: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, backgroundColor: 'rgba(11,31,58,0.55)',
  },
  confirmCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: NEUTRAL.surface, borderRadius: 22, padding: 24,
    shadowColor: BRAND.navy, shadowOpacity: 0.28,
    shadowRadius: 40, shadowOffset: { width: 0, height: 18 },
  },
  confirmTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 23, color: NEUTRAL.text,
  },
  confirmMessage: {
    marginTop: 8, marginBottom: 22,
    fontFamily: FONTS.regular, fontSize: 14.5, lineHeight: 21, color: NEUTRAL.text2,
  },
  confirmActions: { flexDirection: 'row', gap: 10 },
});