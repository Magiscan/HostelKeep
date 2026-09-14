// src/components/HostelSwitcher.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import Icon from './Icon';
import { Input, Button } from './UI';
import { useAuth } from '../contexts/AuthContext';
import { useOwnedHostels } from '../hooks/useOwnedHostels';
import { COLORS } from '../theme/colors';
import { FONTS, FONT_SIZE } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { RADIUS } from '../theme/radius';
import { SHADOW } from '../theme/shadows';

/**
 * Lets a manager move between the properties they own, and add another.
 *
 * Renders nothing for cleaners, and nothing for a manager with one hostel and
 * no reason to know this exists — the control appears the moment there's a
 * second property, or via the add flow on the dashboard.
 */
export default function HostelSwitcher({ alwaysShow = false }) {
  const { t } = useTranslation();
  const { user, switchHostel, addHostel } = useAuth();
  const { hostels, loading } = useOwnedHostels();

  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState(null);

  if (!user || user.role !== 'manager') return null;
  if (hostels.length < 2 && !alwaysShow) return null;

  const active = hostels.find(h => h.code === user.hostelCode);
  const activeName = active?.name || user.hostelCode;

  const close = () => {
    setOpen(false);
    setAdding(false);
    setNewName('');
    setError('');
    setCreatedCode(null);
  };

  const handleSwitch = async (code) => {
    if (code === user.hostelCode) { close(); return; }
    setBusy(true);
    setError('');
    try {
      await switchHostel(code);
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      const code = await addHostel(name);
      setCreatedCode(code);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.trigger}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('switchHostel') || 'Switch hostel'}
      >
        <View style={styles.triggerIcon}>
          <Icon name="business-outline" size={15} color={COLORS.primary} />
        </View>
        <View style={styles.triggerText}>
          <Text style={styles.triggerName} numberOfLines={1}>{activeName}</Text>
          <Text style={styles.triggerCode}>{user.hostelCode}</Text>
        </View>
        <Icon name="chevron-down" size={15} color={COLORS.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>

            {/* ── The new hostel's code, once it exists ── */}
            {createdCode ? (
              <View>
                <Text style={styles.sheetTitle}>
                  {t('hostelCreated') || 'Hostel created'}
                </Text>
                <Text style={styles.sheetSub}>
                  {t('newHostelCodeIntro')
                    || 'Give this code to the cleaners who work here. Each hostel has its own.'}
                </Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText} selectable>{createdCode}</Text>
                </View>
                <Text style={styles.sheetSub}>
                  {t('codeEmailedTo') || 'Sent to'} {user.email}
                </Text>
                <Button title={t('done') || 'Done'} onPress={close} glow />
              </View>
            ) : adding ? (
              /* ── Add a hostel ── */
              <View>
                <Text style={styles.sheetTitle}>
                  {t('addHostel') || 'Add a hostel'}
                </Text>
                <Text style={styles.sheetSub}>
                  {t('addHostelSub')
                    || 'A new property under the same account. Your rooms, cleaners and reports stay separate per hostel.'}
                </Text>

                <Input
                  value={newName}
                  onChangeText={setNewName}
                  placeholder={t('hostelNamePlaceholder') || 'e.g. Riverside Hostel'}
                  autoCapitalize="words"
                  editable={!busy}
                />

                {error ? (
                  <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={16} color={COLORS.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Button
                  title={busy ? (t('creating') || 'Creating…') : (t('createBtn') || 'Create hostel')}
                  onPress={handleAdd}
                  disabled={!newName.trim() || busy}
                  glow
                />
                <TouchableOpacity
                  onPress={() => { setAdding(false); setError(''); }}
                  style={styles.textBtn}
                  activeOpacity={0.7}
                  disabled={busy}
                >
                  <Text style={styles.textBtnLabel}>{t('cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Pick a hostel ── */
              <View>
                <Text style={styles.sheetTitle}>
                  {t('yourHostels') || 'Your hostels'}
                </Text>

                {loading && !hostels.length ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.lg }} />
                ) : (
                  <View style={{ gap: SPACING.xs }}>
                    {hostels.map((h) => {
                      const isActive = h.code === user.hostelCode;
                      return (
                        <TouchableOpacity
                          key={h.code}
                          style={[styles.row, isActive && styles.rowActive]}
                          onPress={() => handleSwitch(h.code)}
                          activeOpacity={0.7}
                          disabled={busy}
                        >
                          <View style={styles.rowText}>
                            <Text
                              style={[styles.rowName, isActive && styles.rowNameActive]}
                              numberOfLines={1}
                            >
                              {h.name}
                            </Text>
                            <Text style={styles.rowCode}>{h.code}</Text>
                          </View>
                          {isActive && (
                            <Icon name="checkmark-circle" size={20} color={COLORS.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {error ? (
                  <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={16} color={COLORS.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={() => setAdding(true)}
                  style={styles.addRow}
                  activeOpacity={0.7}
                  disabled={busy}
                >
                  <Icon name="add-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.addRowText}>{t('addHostel') || 'Add a hostel'}</Text>
                </TouchableOpacity>
              </View>
            )}

          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    maxWidth: 260,
    ...SHADOW.sm,
  },
  triggerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  triggerText: { flex: 1, minWidth: 0 },
  triggerName: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  triggerCode: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.md,
  },
  sheetTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.md,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    minHeight: 52,
  },
  rowActive: { backgroundColor: COLORS.primaryLight },
  rowText: { flex: 1, minWidth: 0, marginRight: SPACING.sm },
  rowName: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  rowNameActive: { fontFamily: FONTS.bold, color: COLORS.primary },
  rowCode: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    minHeight: 48,
  },
  addRowText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
  },

  codeBox: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  codeText: {
    fontFamily: FONTS.bold,
    fontSize: 34,
    letterSpacing: 5,
    color: COLORS.primary,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.sm,
    color: COLORS.danger,
  },

  textBtn: {
    alignSelf: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  textBtnLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
});