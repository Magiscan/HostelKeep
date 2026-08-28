// src/screens/manager/RoomFormScreen.js
//
// The add/edit room form, extracted from SetupScreen.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS A FULL-SCREEN MODAL AND NOT A BOTTOM SHEET
//
// The prototype's add-room sheet is minimal — room number, floor chips, a bed
// stepper, save. Four controls. It never scrolls, so a bottom sheet works.
//
// This form also carries room type, attributes, the naming scheme and an
// editable bed grid. In a bottom sheet that produced two failures:
//
//   1. The footer lived inside the scrolling content, so it scrolled away and
//      "Save" became unreachable — worse once the bed grid grew.
//   2. The sheet's height is content-driven, so when the keyboard opened there
//      was nothing to shrink; the inner ScrollView pushed the focused field up
//      and out of view instead.
//
// The fix is structural: a fixed-height container, a header and footer OUTSIDE
// the scroll view, and exactly one scrollable region between them. The footer
// then cannot move, and the keyboard only ever shortens the scroll area.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { COLORS } from '../../theme/colors';
import { FONTS, DISPLAY } from '../../theme/typography';
import { genId } from '../../theme';

/* ── Bed helpers (unchanged behaviour) ─────────────────────────── */
function generateBeds(count, scheme) {
  const beds = [];
  for (let i = 0; i < count; i++) {
    beds.push({
      id: genId(),
      name: scheme === 'letters' ? String.fromCharCode(65 + (i % 26)) : String(i + 1),
    });
  }
  return beds;
}

/** Keeps names the manager already customised; only adds/removes at the end. */
function resizeBeds(existingBeds, count, scheme) {
  const beds = (existingBeds || []).slice(0, count).map(b => ({ ...b }));
  for (let i = beds.length; i < count; i++) {
    beds.push({
      id: genId(),
      name: scheme === 'letters' ? String.fromCharCode(65 + (i % 26)) : String(i + 1),
    });
  }
  return beds;
}

function guessScheme(beds) {
  if (!beds || beds.length === 0) return 'letters';
  if (/^[A-Z]$/.test(beds[0].name)) return 'letters';
  if (/^\d+$/.test(beds[0].name)) return 'numbers';
  return 'letters';
}

export default function RoomFormScreen({
  visible, floors, room, roomAttributes = [], onSave, onCancel, t,
}) {
  const [form, setForm] = useState(() => (
    room
      ? { ...room, attributes: room.attributes || {} }
      : { name: '', type: 'private', floorId: floors?.[0]?.id || '', beds: [], attributes: {} }
  ));
  const [namingScheme, setNamingScheme] = useState(
    room?.beds?.length ? guessScheme(room.beds) : 'letters',
  );
  const [bedCount, setBedCount] = useState(room?.beds?.length || 0);

  const prevRoomId = useRef(room?.id);
  useEffect(() => {
    if (prevRoomId.current === room?.id) return;
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
  }, [room, floors]);

  useEffect(() => {
    if (form.type === 'dorm') {
      setForm(f => ({ ...f, beds: resizeBeds(f.beds, bedCount, namingScheme) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedCount, form.type]);

  // Switching Letters/Numbers is a deliberate "start over", so it regenerates.
  const handleSchemeChange = (v) => {
    setNamingScheme(v);
    if (form.type === 'dorm') setForm(f => ({ ...f, beds: generateBeds(bedCount, v) }));
  };

  const renameBed = (bedId, name) => setForm(f => ({
    ...f,
    beds: (f.beds || []).map(b => (b.id === bedId ? { ...b, name } : b)),
  }));

  const toggleAttribute = (attr) => setForm(f => ({
    ...f,
    attributes: { ...f.attributes, [attr]: !f.attributes?.[attr] },
  }));

  const isValid = form.name.trim() && form.floorId;

  const handleSave = () => {
    const cleanAttributes = {};
    Object.entries(form.attributes || {}).forEach(([k, v]) => { if (v) cleanAttributes[k] = true; });
    onSave({ ...form, attributes: cleanAttributes });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ── Header (fixed) ── */}
          <View style={s.header}>
            <Text style={s.title}>{room ? t('editRoom') : t('addRoom')}</Text>
            <TouchableOpacity onPress={onCancel} style={s.closeBtn} activeOpacity={0.7}>
              <Icon name="close" size={22} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* ── Fields (the only scrollable region) ── */}
          <ScrollView
            style={s.flex}
            contentContainerStyle={s.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            // iOS: keeps the focused field above the keyboard without any
            // manual scroll maths.
            automaticallyAdjustKeyboardInsets
          >
            <Text style={s.label}>{t('roomName')}</Text>
            <TextInput
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder={t('setup.roomNamePlaceholder') || 'e.g. 104'}
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              style={s.input}
              returnKeyType="done"
            />

            <Text style={s.label}>{t('floor')}</Text>
            <View style={s.chipWrap}>
              {floors?.map(fl => {
                const on = form.floorId === fl.id;
                return (
                  <TouchableOpacity
                    key={fl.id}
                    onPress={() => setForm(f => ({ ...f, floorId: fl.id }))}
                    style={[s.chip, on && s.chipOn]}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, on && s.chipTextOn]}>{fl.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.label}>{t('roomType')}</Text>
            <View style={s.toggleRow}>
              {[
                { value: 'private', label: t('private') },
                { value: 'dorm', label: t('dormitory') },
              ].map(opt => {
                const on = form.type === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setForm(f => ({ ...f, type: opt.value }))}
                    style={[s.toggleBtn, on && s.toggleBtnOn]}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.toggleText, on && s.toggleTextOn]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {form.type === 'private' && roomAttributes.length > 0 && (
              <>
                <Text style={s.label}>{t('roomFeatures')}</Text>
                {roomAttributes.map(attr => {
                  const on = !!form.attributes?.[attr];
                  return (
                    <TouchableOpacity
                      key={attr}
                      style={s.checkRow}
                      onPress={() => toggleAttribute(attr)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.checkbox, on && s.checkboxOn]}>
                        {on && <Icon name="check" size={17} color={COLORS.primary} />}
                      </View>
                      <Text style={s.checkLabel}>{attr}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {form.type === 'dorm' && (
              <>
                <Text style={s.label}>{t('bedNaming')}</Text>
                <View style={s.toggleRow}>
                  {[
                    { value: 'letters', label: t('letters') },
                    { value: 'numbers', label: t('numbers') },
                  ].map(opt => {
                    const on = namingScheme === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => handleSchemeChange(opt.value)}
                        style={[s.toggleBtn, on && s.toggleBtnOn]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.toggleText, on && s.toggleTextOn]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Compact stepper, matching the prototype: two 48px buttons
                    either side of a 70px value box. No keyboard involved. */}
                <Text style={s.label}>{t('numberOfBeds')}</Text>
                <View style={s.stepperRow}>
                  <TouchableOpacity
                    style={s.stepperBtn}
                    onPress={() => setBedCount(n => Math.max(0, n - 1))}
                    disabled={bedCount === 0}
                    activeOpacity={0.7}
                  >
                    <Icon name="remove" size={21} color={bedCount === 0 ? COLORS.textMuted : COLORS.primary} />
                  </TouchableOpacity>
                  <View style={s.stepperValue}>
                    <Text style={s.stepperNum}>{bedCount}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.stepperBtn}
                    onPress={() => setBedCount(n => n + 1)}
                    activeOpacity={0.7}
                  >
                    <Icon name="add" size={21} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                {bedCount > 0 && (
                  <>
                    <Text style={s.hint}>
                      {t('setup.bedRenameHint')
                        || "Tap a bed to rename it — useful if yours aren't lettered in order."}
                    </Text>
                    <View style={s.bedGrid}>
                      {form.beds?.map(b => (
                        <View key={b.id} style={s.bedCell}>
                          <TextInput
                            value={b.name}
                            onChangeText={v => renameBed(b.id, v)}
                            style={s.bedInput}
                            maxLength={12}
                            returnKeyType="done"
                          />
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          {/* ── Footer (fixed — outside the ScrollView, so it never scrolls
                 away and the keyboard can't cover it) ── */}
          <View style={s.footer}>
            <TouchableOpacity onPress={onCancel} style={[s.halfBtn, s.halfBtnGhost]} activeOpacity={0.8}>
              <Text style={s.halfBtnGhostText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!isValid}
              style={[s.halfBtn, s.halfBtnPrimary, !isValid && s.halfBtnDisabled]}
              activeOpacity={0.85}
            >
              <Text style={[s.halfBtnText, !isValid && { color: COLORS.textMuted }]}>
                {t('save')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12,
  },
  title: { flex: 1, fontFamily: DISPLAY.semiBold, fontSize: 25, color: COLORS.primary },
  closeBtn: {
    width: 44, height: 44, borderRadius: 13,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  body: { paddingHorizontal: 18, paddingBottom: 24 },

  label: {
    fontFamily: FONTS.medium, fontSize: 15, color: '#334155',
    marginTop: 16, marginBottom: 7,
  },
  input: {
    height: 52, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 14,
    fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.text,
  },
  hint: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textTertiary, marginBottom: 8 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44, paddingHorizontal: 13, justifyContent: 'center',
    borderRadius: 13, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textSecondary },
  chipTextOn: { color: COLORS.primary },

  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1, minHeight: 48, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBtnOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  toggleText: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textSecondary },
  toggleTextOn: { color: COLORS.onPrimary },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 44 },
  checkbox: {
    width: 26, height: 26, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkLabel: { fontFamily: FONTS.medium, fontSize: 16, color: COLORS.text },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 48, height: 48, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 70, height: 48, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperNum: { fontFamily: DISPLAY.semiBold, fontSize: 22, color: COLORS.primary },

  bedGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  bedCell: { width: '25%', paddingHorizontal: 4, paddingBottom: 8 },
  bedInput: {
    height: 48, borderRadius: 13,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt,
    textAlign: 'center',
    fontFamily: DISPLAY.semiBold, fontSize: 18, color: COLORS.primary,
  },

  footer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  halfBtn: { flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  halfBtnGhost: { backgroundColor: COLORS.surfaceMuted },
  halfBtnGhostText: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.text },
  halfBtnPrimary: { backgroundColor: COLORS.primary },
  halfBtnDisabled: { backgroundColor: COLORS.disabledBg },
  halfBtnText: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.onPrimary },
});