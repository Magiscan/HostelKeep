import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from '../../components/Icon';
import BottomSheet from '../../components/BottomSheet';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../theme/colors';
import { FONTS, DISPLAY, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';
import { RADIUS } from '../../theme/radius';
import { SHADOW } from '../../theme/shadows';
import { buildCleanerColors } from '../../utils/cleanerColor';
import { useTeamSwitch, TeamSwitchChip } from '../../components/maintenance/TeamSwitch';

/**
 * HostelKeep 2.0 team screen.
 *
 * The addition over the old version is the per-cleaner PROGRESS BAR on each
 * card. Previously this screen was purely administrative — add, reset, delete
 * — which meant a manager checking "how is everyone doing?" had to go
 * elsewhere. The data was already in context; it just wasn't shown.
 *
 * Password reset routes through resetCleanerPassword in AuthContext. On the
 * Spark plan the client SDK cannot change another user's password, so it
 * DELETES AND RECREATES the account and migrates their room assignments to the
 * new uid. Known consequence: extraRequests keep the old cleanerId, and
 * buildCleanerColors sorts by uid, so a reset reshuffles avatar colours.
 */

const MIN_PASSWORD = 8;

/* ─── Labelled field ──────────────────────────────────────────── */
function Field({ label, value, onChangeText, placeholder, secure, autoCapitalize = 'none' }) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secure && !reveal}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            focused && { borderColor: COLORS.accent },
            secure && { paddingRight: 48 },
          ]}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setReveal(v => !v)}
            style={styles.eyeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name={reveal ? 'visibility_off' : 'visibility'}
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ─── Cleaner card (memoised) ─────────────────────────────────── */
const CleanerCard = React.memo(function CleanerCard({
  cleaner, color, done, total, pct, t, onReset, onDelete, onSwitchTeam, canManage, showTeam,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>
            {cleaner.username.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={styles.name} numberOfLines={1}>{cleaner.username}</Text>
          {(showTeam || cleaner.team === 'maintenance') && (
            <TeamSwitchChip
              member={cleaner}
              variant="small"
              disabled={!canManage}
              onPress={() => onSwitchTeam(cleaner)}
            />
          )}
          {cleaner.team !== 'maintenance' && (
            <Text style={styles.roomsLabel}>
              {total === 0
                ? (t('noRoomsAssigned') || 'No rooms assigned')
                : `${done}/${total} ${t('rooms')}`}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => onReset(cleaner)}
          style={styles.iconBtn}
          activeOpacity={0.7}
          accessibilityLabel={t('resetPassword')}
        >
          <Icon name="key" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onDelete(cleaner)}
          style={[styles.iconBtn, styles.iconBtnDanger]}
          activeOpacity={0.7}
          accessibilityLabel={t('delete')}
        >
          <Icon name="delete" size={22} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Progress — only meaningful once they have rooms */}
      {total > 0 && cleaner.team !== 'maintenance' && (
        <View style={styles.track}>
          <View
            style={[
              styles.trackFill,
              {
                width: `${pct}%`,
                backgroundColor: pct === 100 ? COLORS.success : COLORS.accent,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}, (prev, next) => (
  prev.cleaner.id === next.cleaner.id
  && prev.cleaner.username === next.cleaner.username
  && prev.cleaner.team === next.cleaner.team
  && prev.canManage === next.canManage
  && prev.showTeam === next.showTeam
  && prev.done === next.done
  && prev.total === next.total
  && prev.color === next.color
));

/* ─── Screen ──────────────────────────────────────────────────── */
export default function TeamScreen({ bottomPad = 0 }) {
  const { t } = useTranslation();
  const { cleaners, rooms, roomStatus, deleteCleaner, hostelCode, can, subscription } = useApp();
  const { registerCleaner, resetCleanerPassword } = useAuth();
  // Maintenance is Pro+. Without it, don't offer a team that leads to a
  // locked screen (and, on iOS, to a paid-feature teaser).
  const maintenanceOn = !!subscription?.proPlus;

  const canManageTeam = can('manageTeam');
  const teamSwitch = useTeamSwitch();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [team, setTeam] = useState('housekeeping');
  const [saving, setSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // One pass over rooms rather than filtering per cleaner — that was
  // O(cleaners × rooms) and this screen re-renders on every status change.
  const statsById = useMemo(() => {
    const m = {};
    cleaners.forEach(c => { m[c.id] = { done: 0, total: 0 }; });
    rooms.forEach(r => {
      if (!r.assignedTo || !m[r.assignedTo]) return;
      m[r.assignedTo].total += 1;
      if (roomStatus[r.id]?.cleaned) m[r.assignedTo].done += 1;
    });
    return m;
  }, [cleaners, rooms, roomStatus]);

  const colors = useMemo(() => buildCleanerColors(cleaners), [cleaners]);

  const handleAdd = async () => {
    if (!name.trim() || !password.trim()) return;
    if (password.length < MIN_PASSWORD) {
      Alert.alert(
        t('passwordTooShort') || `Password must be at least ${MIN_PASSWORD} characters.`,
      );
      return;
    }
    setSaving(true);
    try {
      await registerCleaner(name.trim(), password, hostelCode, team);
      setShowAdd(false);
      setName('');
      setPassword('');
      setTeam('housekeeping');
    } catch (e) {
      Alert.alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (newPassword.length < MIN_PASSWORD) {
      Alert.alert(
        t('passwordTooShort') || `Password must be at least ${MIN_PASSWORD} characters.`,
      );
      return;
    }
    setResetting(true);
    try {
      await resetCleanerPassword(resetTarget.id, newPassword, hostelCode);
      setResetTarget(null);
      setNewPassword('');
      Alert.alert(t('passwordResetSuccess') || 'Password updated.');
    } catch (e) {
      Alert.alert(e.message);
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCleaner(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      Alert.alert(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const openReset = useCallback((cleaner) => {
    setResetTarget(cleaner);
    setNewPassword('');
  }, []);

  const openDelete = useCallback((cleaner) => setDeleteTarget(cleaner), []);

  const handleSwitchTeam = useCallback((cleaner) => {
    teamSwitch.request(cleaner);
  }, [teamSwitch]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.countLine}>
          {cleaners.length === 0
            ? (t('addfirstCleaner') || 'Add your first cleaner to get started.')
            : `${cleaners.length} ${cleaners.length === 1 ? t('cleaner') : t('cleaners') || 'cleaners'}`}
        </Text>

        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          style={styles.addBtn}
          activeOpacity={0.85}
        >
          <Icon name="person_add" size={21} color={COLORS.accent} />
          <Text style={styles.addBtnText}>{t('addCleaner')}</Text>
        </TouchableOpacity>

        {cleaners.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>👤</Text>
            <Text style={styles.emptyTitle}>{t('noCleaners')}</Text>
            <Text style={styles.emptySub}>
              {t('teamEmptyHint')
                || 'Cleaners sign in with your hostel code, their username and password.'}
            </Text>
          </View>
        ) : (
          cleaners.map(c => {
            const s = statsById[c.id] || { done: 0, total: 0 };
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <CleanerCard
                key={c.id}
                cleaner={c}
                color={colors[c.id]}
                done={s.done}
                total={s.total}
                pct={pct}
                t={t}
                canManage={canManageTeam}
                showTeam={maintenanceOn}
                onSwitchTeam={handleSwitchTeam}
                onReset={openReset}
                onDelete={openDelete}
              />
            );
          })
        )}
      </ScrollView>

      {/* ── Add cleaner ── */}
      <BottomSheet
        visible={showAdd}
        onClose={() => { setShowAdd(false); setName(''); setPassword(''); }}
        maxHeightRatio={0.7}
      >
        <Text style={styles.sheetTitle}>{t('addCleaner')}</Text>
        <Text style={styles.sheetSub}>
          {t('addCleanerHint')
            || 'They sign in with your hostel code, this username and this password.'}
        </Text>

        <View style={{ gap: SPACING.sm }}>
          <Field
            label={t('cleanerName')}
            value={name}
            onChangeText={setName}
            placeholder={t('cleanerName')}
            autoCapitalize="words"
          />
          <Field
            label={t('cleanerPassword')}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secure
          />
          <Text style={styles.hint}>
            {t('passwordHint') || `At least ${MIN_PASSWORD} characters.`}
          </Text>

          {maintenanceOn && (
          <View style={{ gap: 8 }}>
            <Text style={styles.fieldLabel}>{t('teamLabel', 'Team')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['housekeeping', 'maintenance'].map(k => (
                <TouchableOpacity
                  key={k}
                  onPress={() => setTeam(k)}
                  activeOpacity={0.8}
                  style={[styles.teamChip, team === k && styles.teamChipOn]}
                >
                  <Icon
                    name={k === 'maintenance' ? 'build' : 'cleaning_services'}
                    size={16}
                    color={team === k ? '#FFFFFF' : COLORS.primary}
                  />
                  <Text style={[styles.teamChipText, team === k && { color: '#FFFFFF' }]}>
                    {k === 'maintenance'
                      ? t('maint.teamMaintenance', 'Maintenance')
                      : t('maint.teamHousekeeping', 'Housekeeping')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              {team === 'maintenance'
                ? t('teamMaintenanceHint', 'They will see the maintenance screen instead of the room list.')
                : t('teamHousekeepingHint', 'They will see the room list and can be assigned rooms.')}
            </Text>
          </View>
          )}
        </View>

        <TouchableOpacity
          onPress={handleAdd}
          disabled={saving || !name.trim() || !password.trim()}
          style={[
            styles.primaryBtn,
            (saving || !name.trim() || !password.trim()) && styles.primaryBtnDisabled,
          ]}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={COLORS.onPrimary} />
            : (
              <>
                <Icon name="person_add" size={22} color={COLORS.onPrimary} />
                <Text style={styles.primaryBtnText}>{t('save')}</Text>
              </>
            )}
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Reset password ── */}
      <BottomSheet
        visible={!!resetTarget}
        onClose={() => { setResetTarget(null); setNewPassword(''); }}
        maxHeightRatio={0.65}
      >
        <Text style={styles.sheetTitle}>{t('resetPassword')}</Text>
        <Text style={styles.sheetSub}>
          {resetTarget?.username}
          {' — '}
          {t('resetPasswordHint')
            || 'Their old password stops working immediately. Tell them the new one.'}
        </Text>

        <Field
          label={t('newPassword')}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          secure
        />
        <Text style={styles.hint}>
          {t('passwordHint') || `At least ${MIN_PASSWORD} characters.`}
        </Text>

        <TouchableOpacity
          onPress={handleReset}
          disabled={resetting || newPassword.length < MIN_PASSWORD}
          style={[
            styles.primaryBtn,
            (resetting || newPassword.length < MIN_PASSWORD) && styles.primaryBtnDisabled,
          ]}
          activeOpacity={0.85}
        >
          {resetting
            ? <ActivityIndicator color={COLORS.onPrimary} />
            : (
              <>
                <Icon name="key" size={22} color={COLORS.onPrimary} />
                <Text style={styles.primaryBtnText}>{t('reset')}</Text>
              </>
            )}
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Delete cleaner ── */}
      <BottomSheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxHeightRatio={0.5}
      >
        <Text style={styles.sheetTitle}>{t('deleteCleaner')}</Text>
        <Text style={styles.sheetSub}>
          {deleteTarget?.username}
          {' — '}
          {t('deleteCleanerMsg')
            || 'This removes their account and unassigns their rooms. It cannot be undone.'}
        </Text>

        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
          <TouchableOpacity
            onPress={() => setDeleteTarget(null)}
            style={[styles.halfBtn, styles.halfBtnGhost]}
            activeOpacity={0.8}
          >
            <Text style={styles.halfBtnGhostText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleting}
            style={[styles.halfBtn, { backgroundColor: COLORS.danger }]}
            activeOpacity={0.8}
          >
            {deleting
              ? <ActivityIndicator color={COLORS.onPrimary} />
              : <Text style={styles.halfBtnText}>{t('delete')}</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {teamSwitch.dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },
  countLine: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textTertiary,
    marginBottom: SPACING.md,
  },

  addBtn: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  addBtnText: { fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.onPrimary },

  card: {
        backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, padding: 15, gap: 11,
    marginBottom: 11,
    ...SHADOW.card,          // 0 2px 6px rgba(11,31,58,0.06)
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: DISPLAY.semiBold, fontSize: 17, color: '#FFFFFF' },
  name: { fontFamily: DISPLAY.semiBold, fontSize: 20, color: COLORS.primary },
  roomsLabel: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textTertiary, fontVariant: ['tabular-nums'] },
  iconBtn: {
    width: 44, height: 44, borderRadius: 13,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnDanger: { borderColor: COLORS.dangerBorder },

  teamChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  teamChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  teamChipText: {
    fontFamily: FONTS.semiBold, fontSize: 12.5, color: COLORS.primary,
  },

  track: {
    height: 8,
    borderRadius: 6,
    backgroundColor: COLORS.slate,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: 6 },

  /* Sheet contents */
  sheetTitle: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.xxl, color: COLORS.primary },
  sheetSub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    lineHeight: 21,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  fieldLabel: { fontFamily: FONTS.medium, fontSize: FONT_SIZE.md, color: '#334155' },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
  },
  eyeBtn: {
    position: 'absolute',
    right: 6,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontFamily: FONTS.regular, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  primaryBtn: {
    height: 56,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    ...SHADOW.md,
  },
  primaryBtnDisabled: { backgroundColor: COLORS.border, shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { fontFamily: DISPLAY.semiBold, fontSize: 18, color: COLORS.onPrimary },

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

  emptyWrap: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 6 },
  emptyIcon: { fontSize: 46 },
  emptyTitle: { fontFamily: DISPLAY.semiBold, fontSize: FONT_SIZE.xxl, color: COLORS.primary },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});