import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import Icon from '../../components/Icon';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING, genId } from '../../theme';
import {
  Button, Card, Label, Input, SectionTitle, FloorHeader,
  EmptyState, ToggleGroup, Badge, Chip,
} from '../../components/UI';
import { useApp } from '../../contexts/AppContext';

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

// ─── Generic centered overlay/dialog ─────────────────────────────
function Overlay({ visible, onClose, children, maxWidth = 440 }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={[styles.overlayCard, { maxWidth }]}>
        {children}
      </View>
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

  if (!visible) return null;

  return (
    <View style={styles.drawerOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
      <View style={styles.drawerPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>{room ? t('editRoom') : t('addRoom')}</Text>
          <TouchableOpacity onPress={onCancel} style={styles.panelClose}>
            <Icon name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.panelBody} contentContainerStyle={{ paddingBottom: SPACING[6] }}>
          <Label>{t('roomName')}</Label>
          <Input
            value={form.name}
            onChangeText={v => setForm(f => ({ ...f, name: v }))}
            placeholder={t('setup.roomNamePlaceholder')}
            autoCapitalize="words"
            style={{ marginBottom: SPACING[4] }}
          />

          <Label>{t('floor')}</Label>
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

          <Label>{t('roomType')}</Label>
          <ToggleGroup
            options={[{ label: t('private'), value: 'private' }, { label: t('dormitory'), value: 'dorm' }]}
            value={form.type}
            onChange={v => setForm(f => ({ ...f, type: v }))}
          />

          {form.type === 'private' && roomAttributes.length > 0 && (
            <View style={{ marginTop: SPACING[4], marginBottom: SPACING[4] }}>
              <Label>{t('roomFeatures')}</Label>
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
              <Label>{t('bedNaming')}</Label>
              <ToggleGroup
                options={[{ label: t('letters'), value: 'letters' }, { label: t('numbers'), value: 'numbers' }]}
                value={namingScheme}
                onChange={handleSchemeChange}
              />
              <Text style={styles.bedNamingHint}>
                {t('setup.bedNamingHint', "Tap any bed below to rename it — handy if beds aren't lettered in order (e.g. A, B, D, F) or your hostel uses its own naming.")}
              </Text>
              <Label style={{ marginTop: SPACING[4] }}>{t('numberOfBeds')}</Label>
              <Input
                value={bedCount.toString()}
                onChangeText={v => {
                  const num = parseInt(v, 10);
                  if (!isNaN(num) && num >= 0) setBedCount(num);
                  else if (v === '') setBedCount(0);
                }}
                placeholder="0"
                keyboardType="number-pad"
              />
              {bedCount > 0 && (
                <View style={styles.bedTags}>
                  {form.beds?.map(b => (
                    <Input
                      key={b.id}
                      value={b.name}
                      onChangeText={v => renameBed(b.id, v)}
                      style={styles.bedNameInput}
                      maxLength={12}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.panelFooter}>
          <TouchableOpacity onPress={onCancel} style={[styles.panelBtn, styles.panelBtnCancel]}>
            <Text style={styles.panelBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid}
            style={[styles.panelBtn, styles.panelBtnPrimary, !isValid && { opacity: 0.5 }]}
          >
            <Text style={[styles.panelBtnText, { color: COLORS.white }]}>{t('save')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
      <Overlay visible={visible} onClose={onClose}>
        <View style={styles.dialogHeaderRow}>
          <Text style={styles.modalTitle}>{t('setup.customAttributes')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.dialogDescription}>{t('setup.attributesDescription')}</Text>

        {attributes.length > 0 && (
          <ScrollView style={{ maxHeight: 200 }}>
            {attributes.map((attr, index) => (
              <View key={index} style={styles.floorRow}>
                <Text style={styles.floorRowName}>{attr}</Text>
                <Button title={t('setup.removeAttribute')} onPress={() => removeAttr(index)} variant="danger" size="sm" />
              </View>
            ))}
          </ScrollView>
        )}

        <Label style={{ marginTop: SPACING[3] }}>{t('setup.newAttribute')}</Label>
        <View style={{ flexDirection: 'row', gap: SPACING[2], marginBottom: SPACING[2], alignItems: 'center' }}>
          <Input value={newAttr} onChangeText={setNewAttr} placeholder={t('setup.attributePlaceholder')} style={{ flex: 1 }} />
          <Button title={t('setup.addAttribute')} onPress={addAttr} size="sm" style={{ flexShrink: 0 }} />
        </View>
      </Overlay>

      <Overlay visible={!!cannotRemove} onClose={() => setCannotRemove(null)} maxWidth={380}>
        <Text style={styles.modalTitle}>{t('setup.cannotRemoveTitle')}</Text>
        <Text style={styles.modalMessage}>{t('setup.cannotRemoveMessage', { name: cannotRemove })}</Text>
        <Button title={t('setup.ok')} onPress={() => setCannotRemove(null)} size="sm" style={{ alignSelf: 'center', minWidth: 100 }} />
      </Overlay>
    </>
  );
}

// ─── Floor Management Dialog ─────────────────────────────────────
function FloorManagementDialog({ visible, floors, onAddFloor, onRemoveFloor, onClose, t }) {
  const [newFloorName, setNewFloorName] = useState('');
  const [saving, setSaving] = useState(false);

  const [showGenerator, setShowGenerator] = useState(false);
  const [genCount, setGenCount] = useState('');
  const [genGarage, setGenGarage] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

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

  const handleGenerate = async () => {
    const count = parseInt(genCount, 10);
    if (isNaN(count) || count < 0) {
      Alert.alert(t('setup.invalidNumber'), t('setup.invalidNumberMsg'));
      return;
    }
    setGenLoading(true);
    const newFloors = generateFloors(count, genGarage);
    for (const floor of newFloors) {
      await onAddFloor(floor.name);
    }
    setGenLoading(false);
    setShowGenerator(false);
    setGenCount('');
    setGenGarage(false);
  };

  return (
    <Overlay visible={visible} onClose={onClose}>
      <View style={styles.dialogHeaderRow}>
        <Text style={styles.modalTitle}>{t('manageFloors')}</Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="close" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {!showGenerator ? (
        <TouchableOpacity style={styles.generateBtn} onPress={() => setShowGenerator(true)}>
          <Icon name="flash-outline" size={18} color={COLORS.primary} style={{ marginRight: SPACING[1] }} />
          <Text style={styles.generateBtnText}>{t('setup.generateFloorsBtn')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.generatorBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[2] }}>
            <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.primary }}>
              {t('setup.autoGenerateFloors')}
            </Text>
            <TouchableOpacity onPress={() => setShowGenerator(false)}>
              <Icon name="close-circle" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <Label>{t('setup.upperFloorsQuestion')}</Label>
          <Input
            value={genCount}
            onChangeText={setGenCount}
            placeholder={t('setup.upperFloorsPlaceholder')}
            keyboardType="number-pad"
            style={{ marginBottom: SPACING[2] }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING[3] }}>
            <TouchableOpacity
              onPress={() => setGenGarage(!genGarage)}
              style={[styles.checkbox, genGarage && styles.checkboxActive]}
            >
              {genGarage && <Icon name="checkmark" size={18} color={COLORS.white} />}
            </TouchableOpacity>
            <Text style={{ marginLeft: SPACING[2], fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm, color: COLORS.text }}>
              {t('includeGarage')}
            </Text>
          </View>
          <Button
            title={genLoading ? t('setup.generatingFloors') : t('generateFloors')}
            onPress={handleGenerate}
            disabled={isNaN(parseInt(genCount, 10)) || parseInt(genCount, 10) < 0 || genLoading}
            size="sm"
          />
        </View>
      )}

      <ScrollView style={{ maxHeight: 200 }}>
        {floors.length > 0 ? (
          floors.map(f => (
            <View key={f.id} style={styles.floorRow}>
              <Text style={styles.floorRowName}>{f.name}</Text>
              <Button title={t('setup.remove')} onPress={() => onRemoveFloor(f.id)} variant="danger" size="sm" />
            </View>
          ))
        ) : (
          <Text style={styles.emptyFloors}>{t('setup.noFloorsAdded')}</Text>
        )}
      </ScrollView>

      <Label style={{ marginTop: SPACING[3] }}>{t('setup.addCustomFloor')}</Label>
      <View style={{ flexDirection: 'row', gap: SPACING[2], alignItems: 'center' }}>
        <Input value={newFloorName} onChangeText={setNewFloorName} placeholder={t('setup.customFloorPlaceholder')} style={{ flex: 1 }} />
        <Button
          title={saving ? t('setup.addingFloor') : t('setup.addFloorBtn')}
          onPress={handleAdd}
          size="sm"
          disabled={saving}
          style={{ flexShrink: 0 }}
        />
      </View>
    </Overlay>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────
function ConfirmDialog({ visible, title, message, onConfirm, onCancel }) {
  return (
    <Overlay visible={visible} onClose={onCancel} maxWidth={400}>
      <Text style={styles.modalTitle}>{title}</Text>
      <Text style={styles.modalMessage}>{message}</Text>
      <View style={styles.modalActions}>
        <TouchableOpacity onPress={onCancel} style={[styles.modalBtn, styles.modalBtnCancel]}>
          <Text style={styles.modalBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onConfirm} style={[styles.modalBtn, { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]}>
          <Text style={[styles.modalBtnText, { color: COLORS.white }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Overlay>
  );
}

// ─── Main Setup Screen ───────────────────────────────────────────
export default function SetupScreen() {
  const {
    hostel, floors, rooms, addFloor, removeFloor, saveRoom, deleteRoom, updateHostel,
    roomAttributes, updateRoomAttributes,
  } = useApp();

  const { t } = useTranslation();

  const [step, setStep] = useState(hostel.name ? 2 : 0);
  const [hName, setHName] = useState(hostel.name || '');

  const [floorCount, setFloorCount] = useState('');
  const [hasGarage, setHasGarage] = useState(false);

  const [showRoom, setShowRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showAttrModal, setShowAttrModal] = useState(false);
  const [expandedFloors, setExpandedFloors] = useState({});
  const [deleteRoomId, setDeleteRoomId] = useState(null);

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
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.title}>{t('rooms')}</Text>
          <Text style={styles.subtitle}>
            {rooms.length} {rooms.length !== 1 ? t('setup.roomsPlural') : t('setup.roomSingular')}
          </Text>
        </View>
        <View style={styles.toolbarActions}>
          <Button title={t('manageFloors')} onPress={() => setShowFloorModal(true)} variant="secondary" size="sm" icon="layers-outline" />
          <Button title={t('attributes')} onPress={() => setShowAttrModal(true)} variant="secondary" size="sm" icon="options-outline" />
          <Button title={t('addRoom')} onPress={() => openRoomForm()} size="sm" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.mainAreaContent}>
        {rooms.length === 0 && (
          <EmptyState icon="🛏" title={t('noRoomsToAssign') || t('rooms')} subtitle={t('addRoomsFirst') || ''} />
        )}

        {sortedFloors.map(floor => {
          const fr = rooms.filter(r => r.floorId === floor.id);
          if (!fr.length) return null;
          const isFloorExpanded = expandedFloors[floor.id] !== false;
          return (
            <View key={floor.id} style={{ marginBottom: SPACING[6] }}>
              <TouchableOpacity onPress={() => toggleFloor(floor.id)} style={styles.floorHeaderRow} activeOpacity={0.7}>
                <FloorHeader label={floor.name} />
                <Icon name={isFloorExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
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
                          <View style={{ flex: 1 }}>
                            <Text style={styles.roomCardName}>{room.name}</Text>
                            <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: 4, alignItems: 'center' }}>
                              <Badge label={room.type === 'private' ? t('private') : t('dormitory')}
                                type={room.type === 'private' ? 'priv' : 'dorm'} />
                              {summary ? <Text style={styles.summaryText}>{summary}</Text> : null}
                            </View>
                          </View>
                          <View style={styles.cardActions}>
                            <TouchableOpacity onPress={() => openRoomForm(room)} style={styles.cardActionBtn}>
                              <Icon name="create-outline" size={17} color={COLORS.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setDeleteRoomId(room.id)} style={styles.cardActionBtn}>
                              <Icon name="trash-outline" size={17} color={COLORS.danger} />
                            </TouchableOpacity>
                          </View>
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
                              <View key={attr} style={[styles.bedChip, value && { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary }]}>
                                <Text style={[styles.bedChipText, value && { color: COLORS.primary }]}>{attr}</Text>
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

  mainAreaContent: { padding: SPACING[6] },

  floorHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[3] },

  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[4] },
  roomCard: {
    width: 300,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING[4], ...SHADOW.sm,
  },
  roomCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  roomCardName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text, marginBottom: SPACING[1] },
  summaryText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  cardActions: { flexDirection: 'row', gap: 4 },
  cardActionBtn: { padding: 6, borderRadius: 6 },

  bedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginTop: SPACING[3] },
  bedChip: { paddingHorizontal: SPACING[3], paddingVertical: SPACING[1], backgroundColor: COLORS.background, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
  bedChipText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  /* editable bed name input (replaces the read-only bed chip in the room form) */
  bedNameInput: {
    minWidth: 56, maxWidth: 90,
    textAlign: 'center',
    paddingVertical: 6, paddingHorizontal: 8,
    fontFamily: FONTS.medium, fontSize: FONT_SIZE.sm,
  },
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
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    padding: SPACING[6], zIndex: 50,
  },
  overlayCard: {
    width: '100%',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING[5], ...SHADOW.md,
  },
  dialogHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING[2] },
  dialogDescription: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING[3] },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  modalMessage: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING[2], marginBottom: SPACING[5] },
  modalActions: { flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[4] },
  modalBtn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  modalBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  modalBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },

  floorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING[3], borderTopWidth: 1, borderTopColor: COLORS.border },
  floorRowName: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.text },
  emptyFloors: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING[4], textAlign: 'center' },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING[3], marginBottom: SPACING[3],
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  generateBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },
  generatorBox: { marginBottom: SPACING[3], padding: SPACING[3], backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm },

  /* side drawer (room form) */
  drawerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
  },
  drawerPanel: { width: 440, backgroundColor: COLORS.surface, ...SHADOW.md },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: SPACING[5], borderBottomWidth: 1, borderBottomColor: COLORS.border },
  panelTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text },
  panelClose: { padding: 4 },
  panelBody: { flex: 1, padding: SPACING[5] },
  panelFooter: { flexDirection: 'row', gap: SPACING[3], padding: SPACING[5], borderTopWidth: 1, borderTopColor: COLORS.border },
  panelBtn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  panelBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  panelBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  panelBtnText: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary },
});