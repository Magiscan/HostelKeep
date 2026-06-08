import React, { useState, useRef, useEffect, useMemo } from 'react';
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

// ─── Room Form Modal (attributes now fully flexible) ────────────
function RoomFormModal({ visible, floors, room, onSave, onCancel, roomAttributes = [] }) {
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

  // Reset form only when a different room is opened (not when floors change)
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
  }, [room]);   // <-- only room, NOT floors

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
    // Keep only attributes that are true
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
          <Text style={styles.modalTitle}>{room ? 'Edit room' : 'Add room'}</Text>
          <Label>Room name / number</Label>
          <Input value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. 101 or Attic" autoCapitalize="words" style={{ marginBottom: SPACING[4] }} />
          <Label>Floor</Label>
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
          <Label>Room type</Label>
          <ToggleGroup options={[{ label: 'Private', value: 'private' }, { label: 'Dormitory', value: 'dorm' }]}
            value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} />

          {/* Custom attributes for private rooms */}
          {form.type === 'private' && roomAttributes.length > 0 && (
            <View style={{ marginTop: SPACING[4], marginBottom: SPACING[4] }}>
              <Label>Room features</Label>
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
              <Label>Bed naming</Label>
              <ToggleGroup
                options={[{ label: 'Letters (A, B, C…)', value: 'letters' }, { label: 'Numbers (1, 2, 3…)', value: 'numbers' }]}
                value={namingScheme}
                onChange={v => setNamingScheme(v)}
              />
              <Label style={{ marginTop: SPACING[4] }}>Number of beds</Label>
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

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!isValid}
              style={[styles.modalBtn, styles.modalBtnPrimary, !isValid && { opacity: 0.5 }]}
            >
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onCancel}
              style={[styles.modalBtn, styles.modalBtnCancel]}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Room Attributes Management Modal (unchanged) ───────────────
function AttributesModal({ visible, attributes, onSave, onClose }) {
  const [newAttr, setNewAttr] = useState('');

  const addAttr = () => {
    if (!newAttr.trim()) return;
    onSave([...attributes, newAttr.trim()]);
    setNewAttr('');
  };

  const removeAttr = (index) => {
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
            <Text style={styles.modalTitle}>Custom Room Attributes</Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING[3] }}>
              Define checkboxes for private rooms (e.g. Twin, Double, Champagne)
            </Text>
            {attributes.length > 0 && (
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                {attributes.map((attr, index) => (
                  <View key={index} style={styles.floorRow}>
                    <Text style={styles.floorRowName}>{attr}</Text>
                    <Button title="Remove" onPress={() => removeAttr(index)} variant="danger" size="sm" />
                  </View>
                ))}
              </ScrollView>
            )}
            <Label style={{ marginTop: SPACING[2] }}>New attribute</Label>
            <View style={{ flexDirection: 'row', gap: SPACING[2], marginBottom: SPACING[2] }}>
              <Input value={newAttr} onChangeText={setNewAttr} placeholder="e.g. Champagne" style={{ flex: 1 }} />
              <Button title="Add" onPress={addAttr} size="sm" />
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
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Floor Management Modal (unchanged) ─────────────────────────
function FloorManagementModal({ visible, floors, onAddFloor, onRemoveFloor, onClose }) {
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
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    const count = parseInt(genCount, 10);
    if (isNaN(count) || count < 0) {
      Alert.alert('Invalid number', 'Please enter 0 or more upper floors.');
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
            <Text style={styles.modalTitle}>Manage Floors</Text>

            {!showGenerator ? (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  paddingVertical: SPACING[2], marginBottom: SPACING[3],
                  backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
                  borderWidth: 1, borderColor: COLORS.primary,
                }}
                onPress={() => setShowGenerator(true)}
              >
                <Ionicons name="flash-outline" size={18} color={COLORS.primary} style={{ marginRight: SPACING[1] }} />
                <Text style={{ fontFamily: FONTS.semiBold, fontSize: FONT_SIZE.md, color: COLORS.primary }}>
                  Generate floors automatically
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginBottom: SPACING[3], padding: SPACING[3], backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[2] }}>
                  <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.md, color: COLORS.primary }}>
                    Auto‑generate floors
                  </Text>
                  <TouchableOpacity onPress={() => setShowGenerator(false)}>
                    <Ionicons name="close-circle" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
                <Label>How many upper floors?</Label>
                <Input
                  value={genCount}
                  onChangeText={setGenCount}
                  placeholder="e.g. 2"
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
                    Include a garage
                  </Text>
                </View>
                <Button
                  title={genLoading ? 'Generating…' : 'Generate floors'}
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
                      <Button title="Remove" onPress={() => onRemoveFloor(f.id)} variant="danger" size="sm" />
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyFloors}>No floors added yet.</Text>
              )}
            </ScrollView>

            <Label style={{ marginTop: SPACING[2] }}>Add a custom floor</Label>
            <View style={{ flexDirection: 'row', gap: SPACING[2], marginBottom: SPACING[2] }}>
              <Input value={newFloorName} onChangeText={setNewFloorName} placeholder="e.g. Rooftop" style={{ flex: 1 }} />
              <Button
                title={saving ? 'Adding…' : 'Add'}
                onPress={handleAdd}
                size="sm"
                disabled={saving}
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
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Confirm Modal (unchanged) ──────────────────────────────────
function ConfirmModal({ visible, title, message, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button title="Delete" variant="danger" onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Kebab Menu (unchanged) ──────────────────────────────────────
function KebabMenu({ onEdit, onDelete }) {
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
            <Text style={styles.kebabOptionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.kebabOption} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            <Text style={[styles.kebabOptionText, { color: COLORS.danger }]}>Delete</Text>
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
      Alert.alert('Error', 'Failed to save room: ' + error.message);
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
      Alert.alert('Invalid number', 'Please enter a valid number of upper floors (0 or more).');
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
            title="Build your hostel"
            subtitle="Start with a name for your property"
          />
          <Card>
            <Label>Property name</Label>
            <Input
              value={hName}
              onChangeText={setHName}
              placeholder="e.g. Sunset Hostel"
              autoCapitalize="words"
              style={{ marginBottom: 16 }}
            />
            <Button
              title="Continue →"
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
            title="Tell us about your floors"
            subtitle="We'll generate them automatically"
          />
          <Card style={{ marginBottom: 16 }}>
            <Label>How many floors above ground? (ground floor is always included)</Label>
            <Input
              value={floorCount}
              onChangeText={setFloorCount}
              placeholder="e.g. 2 (for Ground, 1st, 2nd)"
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
                Include a garage
              </Text>
            </View>
            <Button
              title="Generate floors →"
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
          <SectionTitle title="Rooms" subtitle={`${rooms.length} room${rooms.length !== 1 ? 's' : ''}`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING[2] }}>
            <Button title="Manage Floors" onPress={() => setShowFloorModal(true)} variant="secondary" size="sm" icon="layers-outline" />
            <Button title="Attributes" onPress={() => setShowAttrModal(true)} variant="secondary" size="sm" icon="options-outline" />
            <Button title="+ Add room" onPress={() => openRoomForm()} size="sm" />
          </View>
        </View>

        <RoomFormModal
          visible={showRoom}
          floors={sortedFloors}
          room={editingRoom}
          roomAttributes={roomAttributes}
          onSave={handleSaveRoom}
          onCancel={() => { setShowRoom(false); setEditingRoom(null); }}
        />

        <AttributesModal
          visible={showAttrModal}
          attributes={roomAttributes}
          onSave={updateRoomAttributes}
          onClose={() => setShowAttrModal(false)}
        />

        <FloorManagementModal
          visible={showFloorModal}
          floors={floors}
          onAddFloor={addFloor}
          onRemoveFloor={removeFloor}
          onClose={() => setShowFloorModal(false)}
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
                      ? (bedCount > 0 ? `${bedCount} bed${bedCount !== 1 ? 's' : ''}` : '')
                      : (attrCount > 0 ? `${attrCount} attr${attrCount !== 1 ? 's' : ''}` : '');

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
                              <Badge label={room.type === 'private' ? 'Private' : 'Dorm'}
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
          title="Delete room"
          message="Are you sure you want to delete this room?"
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING[2], flexWrap: 'wrap' },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalTitle: { fontFamily: FONTS.bold, fontSize: FONT_SIZE.xl, color: COLORS.text, marginBottom: SPACING[4] },
  modalActions: { flexDirection: 'row', gap: SPACING[2], marginTop: SPACING[6] },
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