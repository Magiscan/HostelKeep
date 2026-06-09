import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

// ─── Helper to generate beds ─────────────────────────────────────
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

function guessScheme(beds) {
  if (!beds || beds.length === 0) return 'letters';
  const first = beds[0].name;
  if (/^[A-Z]$/.test(first)) return 'letters';
  if (/^\d+$/.test(first)) return 'numbers';
  return 'letters';
}

// ─── Room Form Modal ────────────────────────────────────────────
function RoomFormModal({ visible, floors, room, onSave, onCancel, roomAttributes = [], t }) {
  const [form, setForm] = useState(
    room
      ? { ...room, attributes: room.attributes || {} }
      : { name: '', type: 'private', floorId: floors?.[0]?.id || '', beds: [], attributes: {} }
  );
  const [namingScheme, setNamingScheme] = useState(
    room?.beds?.length ? guessScheme(room.beds) : 'letters'
  );
  const [bedCount, setBedCount] = useState(
    room?.beds?.length || 0
  );

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
      const newBeds = generateBeds(bedCount, namingScheme);
      setForm(f => ({ ...f, beds: newBeds }));
    }
  }, [bedCount, namingScheme, form.type]);

  const toggleAttribute = (attr) => {
    setForm(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [attr]: !prev.attributes?.[attr],
      },
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
    const cleanedForm = { ...form, attributes: cleanAttributes };
    onSave(cleanedForm);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        </Pressable>

        <ScrollView
          contentContainerStyle={{
            backgroundColor: COLORS.surface,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
            padding: SPACING[5],
            paddingTop: SPACING[8],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.modalTitle}>{room ? t('editRoom') : t('addRoom')}</Text>
          <Label>{t('roomName')}</Label>
          <Input value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder={t('setup.roomNamePlaceholder')} autoCapitalize="words" style={{ marginBottom: SPACING[4] }} />
          <Label>{t('floor')}</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING[4] }}>
            <View style={{ flexDirection: 'row', gap: SPACING[2] }}>
              {floors?.map(fl => {
                const isActive = form.floorId === fl.id;
                return (
                  <Chip key={fl.id} label={fl.name} selected={isActive}
                    onPress={() => setForm(f => ({ ...f, floorId: fl.id }))}
                    icon={isActive ? 'checkmark' : undefined} />
                );
              })}
            </View>
          </ScrollView>
          <Label>{t('roomType')}</Label>
          <ToggleGroup options={[{ label: t('private'), value: 'private' }, { label: t('dormitory'), value: 'dorm' }]}
            value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} />

          {/* Custom attributes for private rooms */}
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
                    {form.attributes?.[attr] && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
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
                onChange={v => setNamingScheme(v)}
              />
              <Label style={{ marginTop: SPACING[4] }}>{t('numberOfBeds')}</Label>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING[2] }}>
                <Input
                  value={bedCount.toString()}
                  onChangeText={v => {
                    const num = parseInt(v, 10);
                    if (!isNaN(num) && num >= 0) setBedCount(num);
                    else if (v === '') setBedCount(0);
                  }}
                  placeholder="0"
                  keyboardType="number-pad"
                  style={{ flex: 1 }}
                />
              </View>
              {bedCount > 0 && (
                <View style={styles.bedTags}>
                  {form.beds?.map(b => (
                    <View key={b.id} style={styles.bedChip}>
                      <Text style={styles.bedChipText}>{b.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={[styles.modalActions, { flexWrap: 'wrap' }]}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid}
            style={[styles.modalBtn, styles.modalBtnPrimary, !isValid && { opacity: 0.5 }, { minWidth: 100, flex: 1 }]}
          >
            <Text style={[styles.modalBtnText, { color: COLORS.white }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('save')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCancel}
            style={[styles.modalBtn, styles.modalBtnCancel, { minWidth: 100, flex: 1 }]}
          >
            <Text style={styles.modalBtnText} numberOfLines={1} adjustsFontSizeToFit>
              {t('cancel')}
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Attributes Management Modal ─────────────────────────────────
function AttributesModal({ visible, attributes, rooms, onSave, onClose, t }) {
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
    const updated = attributes.filter((_, i) => i !== index);
    onSave(updated);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('setup.customAttributes')}</Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING[3] }}>
              {t('setup.attributesDescription')}
            </Text>
            {attributes.length > 0 && (
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                {attributes.map((attr, index) => (
                  <View key={index} style={styles.floorRow}>
                    <Text style={styles.floorRowName}>{attr}</Text>
                    <Button title={t('setup.removeAttribute')} onPress={() => removeAttr(index)} variant="danger" size="sm" />
                  </View>
                ))}
              </ScrollView>
            )}
            <Label style={{ marginTop: SPACING[2] }}>{t('setup.newAttribute')}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginBottom: SPACING[2], alignItems: 'center' }}>
                <Input
                  value={newAttr}
                  onChangeText={setNewAttr}
                  placeholder={t('setup.attributePlaceholder')}
                  style={{ flex: 1, minWidth: 120 }}
                />
                <Button
                  title={t('setup.addAttribute')}
                  onPress={addAttr}
                  size="sm"
                  style={{ flexShrink: 0 }}
                />
              </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: RADIUS.sm,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingVertical: SPACING[3],
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: SPACING[2],
              }}
            >
              <Text style={{ fontFamily: 'System', fontWeight: '600', fontSize: 16, color: COLORS.primary }}>
                {t('close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Cannot remove modal */}
      <Modal visible={!!cannotRemove} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setCannotRemove(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('setup.cannotRemoveTitle')}</Text>
            <Text style={styles.modalMessage}>
              {t('setup.cannotRemoveMessage', { name: cannotRemove })}
            </Text>
            <TouchableOpacity
              onPress={() => setCannotRemove(null)}
              style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
            >
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>{t('setup.ok')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}

// ─── Floor Management Modal ──────────────────────────────────────
function FloorManagementModal({ visible, floors, onAddFloor, onRemoveFloor, onClose, t }) {
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('manageFloors')}</Text>

            {!showGenerator ? (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  paddingVertical: SPACING[2], marginBottom: SPACING[3],
                  backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
                  borderWidth: 1, borderColor: COLORS.primary,
                  maxWidth: '100%',                   // keep inside card
                  alignSelf: 'stretch',
                }}
                onPress={() => setShowGenerator(true)}
              >
                <Ionicons name="flash-outline" size={18} color={COLORS.primary} style={{ marginRight: SPACING[1] }} />
                <Text
                  style={{
                    fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary,
                    flexShrink: 1,
                  }}
                  numberOfLines={2}
                >
                  {t('setup.generateFloorsBtn')}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginBottom: SPACING[3], padding: SPACING[3], backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[2] }}>
                  <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.primary }}>
                    {t('setup.autoGenerateFloors')}
                  </Text>
                  <TouchableOpacity onPress={() => setShowGenerator(false)}>
                    <Ionicons name="close-circle" size={20} color={COLORS.primary} />
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
                    {genGarage && <Ionicons name="checkmark" size={18} color={COLORS.white} />}
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

            <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
              {floors.length > 0 ? (
                <View style={{ marginBottom: SPACING[2] }}>
                  {floors.map(f => (
                    <View key={f.id} style={styles.floorRow}>
                      <Text style={styles.floorRowName}>{f.name}</Text>
                      <Button title={t('setup.remove')} onPress={() => onRemoveFloor(f.id)} variant="danger" size="sm" />
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyFloors}>{t('setup.noFloorsAdded')}</Text>
              )}
            </ScrollView>

            <Label style={{ marginTop: SPACING[2] }}>{t('setup.addCustomFloor')}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginBottom: SPACING[2], alignItems: 'center' }}>
              <Input
                value={newFloorName}
                onChangeText={setNewFloorName}
                placeholder={t('setup.customFloorPlaceholder')}
                style={{ flex: 1, minWidth: 120 }}
              />
              <Button
                title={saving ? t('setup.addingFloor') : t('setup.addFloorBtn')}
                onPress={handleAdd}
                size="sm"
                disabled={saving}
                style={{ flexShrink: 0 }}       // never shrink the button, wrap if needed
              />
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: RADIUS.sm,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingVertical: SPACING[3],
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: SPACING[2],
              }}
            >
              <Text style={{ fontFamily: 'System', fontWeight: '600', fontSize: 16, color: COLORS.primary }}>
                {t('close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Confirm Modal ───────────────────────────────────────────────
function ConfirmModal({ visible, title, message, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.modalBtn, styles.modalBtnCancel]}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.modalBtn, { backgroundColor: COLORS.danger }]}
            >
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Kebab Menu ──────────────────────────────────────────────────
function KebabMenu({ onEdit, onDelete, t }) {
  const [visible, setVisible] = useState(false);

  const handleDelete = () => {
    setVisible(false);
    setTimeout(() => { onDelete(); }, 100);
  };

  const handleEdit = () => {
    setVisible(false);
    setTimeout(() => { onEdit(); }, 100);
  };

  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.kebabBtn}>
        <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} />
        </Pressable>
        <View style={styles.kebabSheet}>
          <TouchableOpacity style={styles.kebabOption} onPress={handleEdit}>
            <Ionicons name="create-outline" size={18} color={COLORS.text} />
            <Text style={styles.kebabOptionText}>{t('edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.kebabOption} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            <Text style={[styles.kebabOptionText, { color: COLORS.danger }]}>{t('delete')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
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
  const [expandedRooms, setExpandedRooms] = useState({});
  const [deleteRoomId, setDeleteRoomId] = useState(null);

  const toggleFloor = (floorId) => setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));
  const toggleRoom = (roomId) => setExpandedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));

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

  if (step === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <SectionTitle
            title={t('buildHostel')}
            subtitle={t('setup.startWithName')}
          />
          <Card>
            <Label>{t('propertyName')}</Label>
            <Input
              value={hName}
              onChangeText={setHName}
              placeholder={t('setup.propertyNamePlaceholder')}
              autoCapitalize="words"
              style={{ marginBottom: 16 }}
            />
            <Button
              title={t('continue')}
              onPress={saveHostel}
              disabled={!hName.trim()}
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 1) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <SectionTitle
            title={t('setup.tellAboutFloors')}
            subtitle={t('setup.floorsAutoGenerated')}
          />
          <Card style={{ marginBottom: 16 }}>
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
                {hasGarage && <Ionicons name="checkmark" size={18} color={COLORS.white} />}
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
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step 2: Rooms ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, marginRight: SPACING[2] }}>
            <SectionTitle title={t('rooms')} subtitle={`${rooms.length} ${rooms.length !== 1 ? t('setup.roomsPlural') : t('setup.roomSingular')}`} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], justifyContent: 'flex-end' }}>
            <Button title={t('manageFloors')} onPress={() => setShowFloorModal(true)} variant="secondary" size="sm" icon="layers-outline" />
            <Button title={t('attributes')} onPress={() => setShowAttrModal(true)} variant="secondary" size="sm" icon="options-outline" />
            <Button title={t('addRoom')} onPress={() => openRoomForm()} size="sm" />
          </View>
        </View>

        <RoomFormModal
          visible={showRoom}
          floors={sortedFloors}
          room={editingRoom}
          roomAttributes={roomAttributes}
          onSave={handleSaveRoom}
          onCancel={() => { setShowRoom(false); setEditingRoom(null); }}
          t={t}
        />

        <AttributesModal
          visible={showAttrModal}
          attributes={roomAttributes}
          rooms={rooms}
          onSave={updateRoomAttributes}
          onClose={() => setShowAttrModal(false)}
          t={t}
        />

        <FloorManagementModal
          visible={showFloorModal}
          floors={floors}
          onAddFloor={addFloor}
          onRemoveFloor={removeFloor}
          onClose={() => setShowFloorModal(false)}
          t={t}
        />

        {sortedFloors.map(floor => {
          const fr = rooms.filter(r => r.floorId === floor.id);
          if (!fr.length) return null;
          const isFloorExpanded = expandedFloors[floor.id] !== false;
          return (
            <View key={floor.id}>
              <TouchableOpacity onPress={() => toggleFloor(floor.id)} style={styles.floorHeaderRow} activeOpacity={0.7}>
                <FloorHeader label={floor.name} />
                <Ionicons name={isFloorExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
              {isFloorExpanded && (
                <View style={{ gap: SPACING[2], marginBottom: SPACING[4] }}>
                  {fr.map(room => {
                    const isRoomExpanded = expandedRooms[room.id] || false;
                    const bedCount = room.type === 'dorm' ? (room.beds?.length || 0) : 0;
                    const attrCount = room.type === 'private' && room.attributes
                      ? Object.keys(room.attributes).length
                      : 0;
                    const summary = room.type === 'dorm'
                      ? (bedCount > 0 ? `${bedCount} ${bedCount !== 1 ? t('beds') : t('setup.bedSingular')}` : '')
                      : (attrCount > 0 ? `${attrCount} ${attrCount !== 1 ? t('setup.attrsPlural') : t('setup.attrSingular')}` : '');

                    return (
                      <Card key={room.id} style={styles.roomCard}>
                        <TouchableOpacity
                          onPress={() => toggleRoom(room.id)}
                          activeOpacity={0.7}
                          style={styles.roomCardRow}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.roomCardName}>{room.name}</Text>
                            <View style={{ flexDirection: 'row', gap: SPACING[2], marginTop: 4 }}>
                              <Badge label={room.type === 'private' ? t('private') : t('dormitory')}
                                type={room.type === 'private' ? 'priv' : 'dorm'} />
                              {summary ? <Text style={styles.summaryText}>{summary}</Text> : null}
                            </View>
                          </View>
                          <Ionicons name={isRoomExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>

                        {isRoomExpanded && (
                          <View style={{ marginTop: SPACING[2] }}>
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
                                    <Text style={[styles.bedChipText, value && { color: COLORS.primary }]}>
                                      {attr}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}

                            <View style={{ alignItems: 'flex-end', marginTop: SPACING[2] }}>
                              <KebabMenu
                                onEdit={() => openRoomForm(room)}
                                onDelete={() => setDeleteRoomId(room.id)}
                                t={t}
                              />
                            </View>
                          </View>
                        )}
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <ConfirmModal
          visible={!!deleteRoomId}
          title={t('deleteRoom')}
          message={t('deleteConfirmation')}
          onConfirm={handleDeleteRoom}
          onCancel={() => setDeleteRoomId(null)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING[4], paddingBottom: SPACING[10] },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING[2],
    flexWrap: 'wrap',
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[4] },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING[2],
    marginTop: SPACING[6],
},
  floorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING[3], borderTopWidth: 1, borderTopColor: COLORS.border },
  floorRowName: { fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.text },
  emptyFloors: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING[4], textAlign: 'center' },
  floorHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING[6], marginBottom: SPACING[3] },
  roomCard: { gap: SPACING[2] },
  roomCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomCardName: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text, marginBottom: SPACING[1] },
  summaryText: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, alignSelf: 'center' },
  bedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2], marginTop: SPACING[2] },
  bedChip: { paddingHorizontal: SPACING[3], paddingVertical: SPACING[1], backgroundColor: COLORS.surface, borderRadius: RADIUS.sm },
  bedChipText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  attributeRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[2],
    marginBottom: SPACING[2],
  },
  attributeLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  kebabBtn: { padding: 8 },
  kebabSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    padding: SPACING[4], gap: SPACING[2], ...SHADOW.md,
  },
  kebabOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING[3],
    paddingVertical: SPACING[3], paddingHorizontal: SPACING[2],
    borderRadius: RADIUS.sm,
  },
  kebabOptionText: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: COLORS.text },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING[6],
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING[5], width: '100%', maxWidth: 400, ...SHADOW.md,
  },
  modalMessage: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING[5] },
  modalBtn: { flex: 1, paddingVertical: SPACING[3], borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  modalBtnCancel: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  modalBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalBtnText: { fontFamily: 'System', fontWeight: '600', fontSize: 16, color: COLORS.primary },
});