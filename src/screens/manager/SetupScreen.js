import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import Icon from '../../components/Icon';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING, genId } from '../../theme';
import {
  Button, Card, Label, Input, SectionTitle,
  EmptyState, ToggleGroup, Badge, Chip,
} from '../../components/UI';
import { useApp } from '../../contexts/AppContext';
import { DISPLAY } from '../../theme/typography';
import BottomSheet from '../../components/BottomSheet'; 
import RoomFormScreen from './RoomFormScreen';

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

/**
 * One removable item — a floor or an attribute.
 */
function ManageRow({ icon, label, onRemove, removeLabel }) {
  return (
    <View style={styles.manageRow}>
      <View style={styles.manageIcon}>
        <Icon name={icon} size={20} color={COLORS.primary} />
      </View>
      <Text style={styles.manageLabel} numberOfLines={1}>{label}</Text>
      <TouchableOpacity
        onPress={onRemove}
        style={[styles.iconBtn, styles.iconBtnDanger]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
      >
        <Icon name="delete" size={19} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );
}

function AddRow({ value, onChangeText, placeholder, onAdd, disabled }) {
  return (
    <View style={styles.addRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        style={styles.addInput}
        onSubmitEditing={disabled ? undefined : onAdd}
        returnKeyType="done"
      />
      <TouchableOpacity
        onPress={onAdd}
        disabled={disabled}
        style={[styles.addBtn, disabled && { backgroundColor: COLORS.disabledBg }]}
        activeOpacity={0.85}
      >
        <Icon name="add" size={24} color={disabled ? COLORS.textMuted : COLORS.accent} />
      </TouchableOpacity>
    </View>
  );
}

function FloorSuggestions({ existing, onAdd, t }) {
  const suggestions = useMemo(() => {
    const taken = new Set(existing.map(f => f.name.toLowerCase()));
    const candidates = ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', 'Garage'];
    return candidates.filter(n => !taken.has(n.toLowerCase())).slice(0, 4);
  }, [existing]);

  if (!suggestions.length) return null;
  return (
    <View style={styles.chipWrap}>
      {suggestions.map(name => (
        <TouchableOpacity
          key={name}
          onPress={() => onAdd(name)}
          style={styles.suggestChip}
          activeOpacity={0.7}
        >
          <Icon name="add" size={16} color={COLORS.textTertiary} />
          <Text style={styles.suggestChipText}>{name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
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

  // Adding/removing beds only touches the beds at the edges — it never
  // overwrites names you've already customized on the beds that remain.
  useEffect(() => {
    if (form.type === 'dorm') {
      setForm(f => ({ ...f, beds: resizeBeds(f.beds, bedCount, namingScheme) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedCount, form.type]);

  // Explicitly switching Letters/Numbers is a deliberate "start over" action,
  // so it regenerates every bed name from scratch.
  const handleSchemeChange = (v) => {
    setNamingScheme(v);
    if (form.type === 'dorm') {
      setForm(f => ({ ...f, beds: generateBeds(bedCount, v) }));
    }
  };

  const renameBed = (bedId, newName) => {
    setForm(f => ({
      ...f,
      beds: (f.beds || []).map(b => (b.id === bedId ? { ...b, name: newName } : b)),
    }));
  };

  const toggleAttribute = (attr) => {
    setForm(prev => ({
      ...prev,
      attributes: { ...prev.attributes, [attr]: !prev.attributes?.[attr] },
    }));
  };

    // A private room with no attributes can never register as "needs work",
  // so it would silently vanish from every filter and printed sheet.
  const needsAttribute = form.type === 'private' && roomAttributes.length > 0;
  const hasAttribute = Object.values(form.attributes || {}).some(Boolean);

  // A dorm with zero beds is equally inert.
  const needsBeds = form.type === 'dorm';

  const isValid = !!form.name.trim()
    && !!form.floorId
    && (!needsAttribute || hasAttribute)
    && (!needsBeds || bedCount > 0);

  const handleSave = () => {
    const cleanAttributes = {};
    if (form.attributes) {
      Object.entries(form.attributes).forEach(([key, val]) => {
        if (val) cleanAttributes[key] = true;
      });
    }
    onSave({ ...form, attributes: cleanAttributes });
  };

  if (!visible) return null;

    return (
      <BottomSheet
        visible={visible}
        onClose={onCancel}
        maxHeightRatio={0.92}
        scrollable
      >
        <View style={styles.panelHeader}>
          <Text style={styles.sheetTitle}>{room ? t('editRoom') : t('addRoom')}</Text>
          <TouchableOpacity onPress={onCancel} style={styles.panelClose}>
            <Icon name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <View style={{ gap: 4 }}>
          <Text style={styles.fieldLabel}>{t('roomName')}</Text>
          <Input
            value={form.name}
            onChangeText={v => setForm(f => ({ ...f, name: v }))}
            placeholder={t('setup.roomNamePlaceholder')}
            autoCapitalize="words"
            style={{ marginBottom: SPACING[4] }}
          />

          <Text style={styles.fieldLabel}>{t('floor')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginBottom: SPACING[4] }}>
            {floors?.map(fl => {
              const isActive = form.floorId === fl.id;
              return (
                <Chip
                  key={fl.id}
                  label={fl.name}
                  selected={isActive}
                  onPress={() => setForm(f => ({ ...f, floorId: fl.id }))}
                  icon={isActive ? 'checkmark' : undefined}
                />
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>{t('roomType')}</Text>
          <ToggleGroup
            options={[{ label: t('private'), value: 'private' }, { label: t('dormitory'), value: 'dorm' }]}
            value={form.type}
            onChange={v => setForm(f => ({ ...f, type: v }))}
          />

          {form.type === 'private' && roomAttributes.length > 0 && (
            <View style={{ marginTop: SPACING[4], marginBottom: SPACING[4] }}>
              <Text style={styles.fieldLabel}>{t('roomFeatures')}</Text>
              {!hasAttribute && (
                <Text style={styles.warn}>
                  {t('setup.attributeRequired')
                    || 'Pick at least one — a private room with nothing to clean never shows up on a sheet.'}
                </Text>
              )}
              {roomAttributes.map(attr => (
                <TouchableOpacity
                  key={attr}
                  style={styles.attributeRow}
                  onPress={() => toggleAttribute(attr)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, form.attributes?.[attr] && styles.checkboxActive]}>
                    {form.attributes?.[attr] && <Icon name="checkmark" size={16} color={COLORS.white} />}
                  </View>
                  <Text style={styles.attributeLabel}>{attr}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {form.type === 'dorm' && (
            <View style={{ marginTop: SPACING[4] }}>
              <Text style={styles.fieldLabel}>{t('bedNaming')}</Text>
              <ToggleGroup
                options={[{ label: t('letters'), value: 'letters' }, { label: t('numbers'), value: 'numbers' }]}
                value={namingScheme}
                onChange={handleSchemeChange}
              />
              <Text style={styles.bedNamingHint}>
                {t('setup.bedNamingHint', "Tap any bed below to rename it — handy if beds aren't lettered in order (e.g. A, B, D, F) or your hostel uses its own naming.")}
              </Text>
              <Text style={styles.fieldLabel}>{t('numberOfBeds')}</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setBedCount(n => Math.max(0, n - 1))}
                    disabled={bedCount === 0}
                    activeOpacity={0.7}
                  >
                    <Icon name="remove" size={24} color={bedCount === 0 ? COLORS.textMuted : COLORS.primary} />
                  </TouchableOpacity>
                  <View style={styles.stepperValue}>
                    <Text style={styles.stepperNum}>{bedCount}</Text>
                    <Text style={styles.stepperUnit}>{t('beds')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setBedCount(n => n + 1)}
                    activeOpacity={0.7}
                  >
                    <Icon name="add" size={24} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              {bedCount > 0 && (
                <>
                  <Text style={styles.bedGridHint}>
                    {t('setup.bedRenameHint') || 'Tap a bed to rename it.'}
                  </Text>
                <View style={styles.bedGrid}>
                  {form.beds?.map(b => (
                    <View key={b.id} style={styles.bedGridCell}>
                      <TextInput
                        value={b.name}
                        onChangeText={v => renameBed(b.id, v)}
                        style={styles.bedNameInput}
                        maxLength={12}
                      />
                    </View>
                  ))}
                </View>
                </>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

        <View style={styles.panelFooter}>
          <TouchableOpacity onPress={onCancel} style={[styles.halfBtn, styles.halfBtnGhost]}>
            <Text style={styles.halfBtnGhostText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid}
            style={[styles.halfBtn, { backgroundColor: COLORS.primary }, !isValid && { opacity: 0.5 }]}
          >
            <Text style={[styles.halfBtnText, { color: COLORS.white }]}>{t('save')}</Text>
          </TouchableOpacity>
        </View>
    </BottomSheet>
  );
}

// ─── Attributes Management Dialog ────────────────────────────────
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
    if (isUsed) {
      setCannotRemove(attrName);
      return;
    }
    onSave(attributes.filter((_, i) => i !== index));
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.85} scrollable>
        <Text style={styles.sheetTitle}>{t('setup.customAttributes')}</Text>
        <Text style={styles.sheetSub}>{t('setup.attributesDescription')}</Text>

        <AddRow
          value={newAttr}
          onChangeText={setNewAttr}
          placeholder={t('setup.attributePlaceholder')}
          onAdd={addAttr}
          disabled={!newAttr.trim()}
        />

        {attributes.length === 0
          ? <Text style={styles.emptyHint}>{t('setup.noAttributes') || 'No attributes yet.'}</Text>
          : attributes.map((attr, index) => (
              <ManageRow
                key={attr}
                icon="tune"
                label={attr}
                onRemove={() => removeAttr(index)}
                removeLabel={t('setup.removeAttribute')}
              />
            ))}
      </BottomSheet>

      <BottomSheet visible={!!cannotRemove} onClose={() => setCannotRemove(null)} maxHeightRatio={0.45}>
        <Text style={styles.sheetTitle}>{t('setup.cannotRemoveTitle')}</Text>
        <Text style={styles.modalMessage}>{t('setup.cannotRemoveMessage', { name: cannotRemove })}</Text>
        <TouchableOpacity
          onPress={() => setCannotRemove(null)}
          style={[styles.halfBtn, styles.halfBtnGhost]}
          activeOpacity={0.8}
        >
          <Text style={styles.halfBtnGhostText}>{t('setup.ok')}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </>
  );
}

// ─── Floor Management Dialog ─────────────────────────────────────
function FloorManagementDialog({ visible, floors, onAddFloor, onRemoveFloor, onClose, t }) {
  const [newFloorName, setNewFloorName] = useState('');
  const [saving, setSaving] = useState(false);

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
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.85} scrollable>
      <Text style={styles.sheetTitle}>{t('manageFloors')}</Text>
      <Text style={styles.sheetSub}>{t('setup.floorsHint') || 'Floors group your rooms.'}</Text>

      <AddRow
        value={newFloorName}
        onChangeText={setNewFloorName}
        placeholder={t('setup.customFloorPlaceholder')}
        onAdd={handleAdd}
        disabled={saving || !newFloorName.trim()}
      />

      <FloorSuggestions existing={floors} onAdd={onAddFloor} t={t} />

      {floors.length === 0
        ? <Text style={styles.emptyHint}>{t('setup.noFloorsAdded')}</Text>
        : floors.map(f => (
            <ManageRow
              key={f.id}
              icon="layers"
              label={f.name}
              onRemove={() => onRemoveFloor(f.id)}
              removeLabel={t('setup.remove')}
            />
          ))}
    </BottomSheet>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────
function ConfirmDialog({ visible, title, message, onConfirm, onCancel }) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      maxHeightRatio={0.45}
    >
      <Text style={styles.sheetTitle}>{title}</Text>
      <Text style={styles.modalMessage}>{message}</Text>
      <View style={styles.modalActions}>
        <TouchableOpacity onPress={onCancel} style={[styles.modalBtn, styles.modalBtnCancel]}>
          <Text style={styles.modalBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onConfirm} style={[styles.modalBtn, { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]}>
          <Text style={[styles.modalBtnText, { color: COLORS.white }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// ─── Main Setup Screen ───────────────────────────────────────────
export default function SetupScreen({ bottomPad = 0 }) {
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

  // NEW: lets the manager find a room to edit without scrolling through every
  // floor, especially useful once a hostel has a lot of rooms.
  const [roomSearch, setRoomSearch] = useState('');

  const toggleFloor = (floorId) => setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));

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
            <Text style={styles.fieldLabel}>{t('propertyName')}</Text>
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
            <Text style={styles.fieldLabel}>{t('floorsQuestions')}</Text>
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
      <View style={styles.toolbarCol}>
        <View style={styles.searchBar}>
          <Icon name="search" size={21} color={COLORS.textMuted} />
          <TextInput
            value={roomSearch}
            onChangeText={setRoomSearch}
            placeholder={t('search')}
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {roomSearch.length > 0 && (
            <TouchableOpacity onPress={() => setRoomSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="cancel" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.btnCol}>
          <TouchableOpacity onPress={() => openRoomForm()} style={styles.primaryBtn} activeOpacity={0.85}>
            <Icon name="add" size={20} color={COLORS.accent} />
            <Text style={styles.primaryBtnText}>{t('addRoom')}</Text>
          </TouchableOpacity>

          <View style={styles.btnRow}>
            <TouchableOpacity onPress={() => setShowFloorModal(true)} style={styles.outlineBtn} activeOpacity={0.8}>
              <Icon name="layers" size={19} color={COLORS.textTertiary} />
              <Text style={styles.outlineBtnText} numberOfLines={1}>{t('manageFloors')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowAttrModal(true)} style={styles.outlineBtn} activeOpacity={0.8}>
              <Icon name="tune" size={19} color={COLORS.textTertiary} />
              <Text style={styles.outlineBtnText} numberOfLines={1}>{t('attributes')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.countLine}>
          {rooms.length} {rooms.length !== 1 ? t('setup.roomsPlural') : t('setup.roomSingular')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.mainAreaContent, { paddingBottom: bottomPad + 24 }]}>
        {rooms.length === 0 && (
          <EmptyState icon="🛏" title={t('noRoomsToAssign') || t('rooms')} subtitle={t('addRoomsFirst') || ''} />
        )}

        {roomSearch.trim() !== '' && sortedFloors.every(
          floor => !rooms.some(r => r.floorId === floor.id && r.name.toLowerCase().includes(roomSearch.trim().toLowerCase()))
        ) && (
          <EmptyState icon="🔍" title={t('noResults')} subtitle="" />
        )}

        {sortedFloors.map(floor => {
          // FIXED: room list is now filtered by roomSearch. Floors with no
          // matching rooms are skipped entirely while searching, so the
          // manager lands directly on the room instead of scrolling for it.
          const fr = rooms.filter(r =>
            r.floorId === floor.id &&
            (!roomSearch.trim() || r.name.toLowerCase().includes(roomSearch.trim().toLowerCase()))
          );
          if (!fr.length) return null;
          const isFloorExpanded = Platform.OS === 'web'
            ? expandedFloors[floor.id] !== false
            : expandedFloors[floor.id] === true;   // native: collapsed until tapped
          return (
            <View key={floor.id} style={{ marginBottom: SPACING[6] }}>
              <TouchableOpacity
                onPress={() => toggleFloor(floor.id)}
                style={styles.floorRow}
                activeOpacity={0.7}
              >
                <View style={styles.floorBar} />
                <Text style={styles.floorName}>{floor.name}</Text>
                <Text style={styles.floorCount}>{fr.length}</Text>
                <Icon
                  name={isFloorExpanded ? 'expand_less' : 'expand_more'}
                  size={24}
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
                          {/* Room name – no flex:1, so it hugs its own text */}
                          <Text style={styles.roomCardName} numberOfLines={1}>{room.name}</Text>

                          {/* Type pill – background wraps only the text */}
                          <View style={styles.typePill}>
                            <Text style={styles.typePillText}>
                              {room.type === 'dorm' ? `${t('dormitory')} · ${bedCount} ${t('beds')}` : t('private')}
                            </Text>
                          </View>

                          {/* Spacer fills the remaining space and right-aligns the buttons */}
                          <View style={{ flex: 1 }} />

                          {/* Edit button */}
                          <TouchableOpacity
                            onPress={() => openRoomForm(room)}
                            style={styles.iconBtn}
                            activeOpacity={0.7}
                          >
                            <Icon name="edit" size={17} color={COLORS.textSecondary} />
                          </TouchableOpacity>

                          {/* Delete button */}
                          <TouchableOpacity
                            onPress={() => setDeleteRoomId(room.id)}
                            style={[styles.iconBtn, styles.iconBtnDanger]}
                            activeOpacity={0.7}
                          >
                            <Icon name="delete" size={17} color={COLORS.danger} />
                          </TouchableOpacity>
                        </View>

                        {room.type === 'dorm' && room.beds?.length > 0 && (
                          <View style={styles.bedTags}>
                            {room.beds.map(b => (
                              <View key={b.id} style={styles.bedChip}>
                                <Text style={styles.bedChipText}>{b.name}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {room.type === 'private' && room.attributes && Object.keys(room.attributes).length > 0 && (
                          <View style={styles.bedTags}>
                            {Object.entries(room.attributes).map(([attr, value]) => (
                              <View key={attr} style={[styles.bedChip, value && { backgroundColor: COLORS.accentLight }]}>
                                <Text style={[styles.bedChipText, value && { color: COLORS.accentDark }]}>{attr}</Text>
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

      <RoomFormScreen
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
  toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], alignItems: 'center' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    minWidth: 0, // remove old minWidth: 200
  },
  searchInput: { flex: 1, fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.text },

  mainAreaContent: { paddingHorizontal: 18, paddingTop: 4 },

  floorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    minHeight: 44,
  },
  floorBar: {
    width: 5,
    height: 20,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  floorName: {
    flex: 1,
    minWidth: 0,
    fontFamily: DISPLAY.semiBold,
    fontSize: 20,
    color: COLORS.primary,
  },
  floorCount: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textTertiary,
  },

  roomGrid: {},
  roomCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 15,
    marginBottom: 11,
    gap: 11,
    ...SHADOW.card,
  },
  roomCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roomCardName: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 30,
    lineHeight: 32,
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  cardActions: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 13,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnDanger: { borderColor: COLORS.dangerBorder },

  bedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING[3] },
  bedChip: {
    minWidth: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.slate,
    borderRadius: 11,
    alignItems: 'center',
  },
  bedChipText: {
    fontFamily: DISPLAY.semiBold,
    fontSize: 17,
    color: '#334155',
  },

  /* editable bed name input (replaces the read-only bed chip in the room form) */
  bedNamingHint: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: SPACING[2] },

  /* shared checkbox / attribute rows */
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  attributeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING[2], marginBottom: SPACING[2] },
  attributeLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },

  /* centered overlay/dialog */
  dialogHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING[2] },
  dialogDescription: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING[3] },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  modalMessage: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING[2], marginBottom: SPACING[5] },
  modalActions: { flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[4] },
  modalBtn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  modalBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  modalBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },

  floorRowName: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.text },
  emptyFloors: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING[4], textAlign: 'center' },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING[3], marginBottom: SPACING[3],
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  generateBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },

  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  panelTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  panelClose: { padding: 4 },
  panelBody: { flex: 1, padding: SPACING[5] },
  panelFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },
  panelBtn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  panelBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  panelBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  panelBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },
  toolbarCol: { paddingHorizontal: 18, paddingTop: 8, gap: 14 },
  btnCol: { gap: 9 },
  btnRow: { flexDirection: 'row', gap: 9 },
  outlineBtn: {
    flex: 1, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 48, paddingHorizontal: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  outlineBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.text, flexShrink: 1 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 52, borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.onPrimary },
  countLine: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textTertiary },
  typePill: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.beige,
  },
  typePillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  sheetTitle: {
    fontFamily: DISPLAY.semiBold, fontSize: 25,
    color: COLORS.primary, marginBottom: 2,
  },
  sheetSub: {
    fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21,
    color: COLORS.textSecondary, marginBottom: 6,
  },
  manageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 66, paddingHorizontal: 14,
    borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginBottom: 9,
  },
  manageIcon: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  manageLabel: {
    flex: 1, minWidth: 0,
    fontFamily: DISPLAY.semiBold, fontSize: 19, color: COLORS.primary,
  },
  addRow: { flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 12 },
  addInput: {
    flex: 1, minWidth: 0, height: 54,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 16,
    paddingHorizontal: 14,
    fontFamily: FONTS.medium, fontSize: 16,
    color: COLORS.text, backgroundColor: COLORS.surfaceAlt,
  },
  addBtn: {
    width: 54, height: 54, borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  suggestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    minHeight: 40, paddingHorizontal: 12,
    borderRadius: 14, borderWidth: 1.5,
    borderStyle: 'dashed', borderColor: '#CBD5E1',
  },
  suggestChipText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },
  emptyHint: {
    fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textMuted,
    textAlign: 'center', paddingVertical: 18,
  },
  bedGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  bedGridCell: { width: '25%', paddingHorizontal: 4, paddingBottom: 8 },
  bedNameInput: {
    height: 48, borderRadius: 13,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    textAlign: 'center',
    fontFamily: DISPLAY.semiBold, fontSize: 18, color: COLORS.primary,
  },
  fieldLabel: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: '#334155',
    marginBottom: 4,
  },
  halfBtn: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfBtnGhost: { backgroundColor: COLORS.surfaceMuted },
  halfBtnGhostText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.primary },
  halfBtnText: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.lg, color: COLORS.onPrimary },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 16, padding: 6, marginBottom: 12,
  },
  stepperBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperValue: { flex: 1, alignItems: 'center' },
  stepperNum: { fontFamily: DISPLAY.semiBold, fontSize: 26, lineHeight: 30, color: COLORS.primary },
  stepperUnit: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textTertiary },
  bedGridHint: {
    fontFamily: FONTS.regular, fontSize: 13,
    color: COLORS.textTertiary, marginBottom: 8,
  },
  warn: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.accentDark, marginBottom: 8 },
});