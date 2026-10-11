// src/components/maintenance/MaintenanceUpsell.js
//
// What a hostel without HostelKeep Pro+ sees where Maintenance would be.
//   variant="manager"  → what Pro+ adds. On the WEB it also offers the upgrade
//                        (onContact → PaywallScreen's ContactDialog).
//                        In STORE builds (SALES_ALLOWED false) it only says
//                        the feature isn't included — no price, no button, no
//                        email: Google Play Payments policy / App Store 3.1.1
//                        forbid steering users to buy outside the store.
//   variant="locked"   → short note for a maintenance worker whose hostel
//                        isn't on Pro+ (or whose plan lapsed)

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import { FONTS, DISPLAY } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { SALES_ALLOWED } from '../../utils/subscription';

export default function MaintenanceUpsell({ variant = 'manager', onContact }) {
  const { t } = useTranslation();

  if (variant === 'locked') {
    return (
      <View style={styles.lockedWrap}>
        <Icon name="lock" size={34} color={NEUTRAL.text4} />
        <Text style={styles.lockedTitle}>{t('maint.lockedTitle', 'Maintenance is not active')}</Text>
        <Text style={styles.lockedBody}>
          {t('maint.lockedBody', 'Your hostel needs HostelKeep Pro+ for maintenance tasks. Ask your manager.')}
        </Text>
      </View>
    );
  }

  const points = [
    { icon: 'flag', text: t('maint.upsell1', 'Housekeepers report problems with a photo, in seconds') },
    { icon: 'person_add', text: t('maint.upsell2', 'Assign repairs, set priority and due dates') },
    { icon: 'notifications', text: t('maint.upsell3', 'Your maintenance team gets notified and works from their phone') },
    { icon: 'task_alt', text: t('maint.upsell4', 'Track what is open, in progress and fixed') },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Icon name="workspace_premium" size={16} color={BRAND.navy} />
          <Text style={styles.badgeText}>PRO+</Text>
        </View>
        <Text style={styles.title}>{t('maint.upsellTitle', 'Maintenance comes with HostelKeep Pro+')}</Text>
        <Text style={styles.sub}>
          {t('maint.upsellSub', 'Everything in Pro, plus a full maintenance workflow for your team.')}
        </Text>
        <View style={{ gap: 12, marginTop: 6 }}>
          {points.map(p => (
            <View key={p.icon} style={styles.point}>
              <View style={styles.pointIcon}><Icon name={p.icon} size={18} color={BRAND.yellow} /></View>
              <Text style={styles.pointText}>{p.text}</Text>
            </View>
          ))}
        </View>
        {SALES_ALLOWED && onContact ? (
          <TouchableOpacity onPress={onContact} style={styles.cta} activeOpacity={0.9}>
            <Icon name="workspace_premium" size={20} color={BRAND.yellow} />
            <Text style={styles.ctaText}>{t('maint.upsellCta', 'Upgrade to Pro+')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.contact}>
            {t('maint.upsellNotIncluded', 'Maintenance is not included in your current plan.')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%', maxWidth: 520, gap: 10, padding: 24, borderRadius: 22,
    backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.border,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: BRAND.yellow,
  },
  badgeText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 12.5, letterSpacing: 0.6, color: BRAND.navy },
  title: { fontFamily: DISPLAY.semiBold, fontSize: 24, color: BRAND.navy },
  sub: { fontFamily: FONTS.regular, fontSize: 15, color: NEUTRAL.text2 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: BRAND.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  pointText: { flex: 1, fontFamily: FONTS.medium, fontWeight: '500', fontSize: 14.5, color: NEUTRAL.text },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 26, backgroundColor: BRAND.navy, marginTop: 12,
  },
  ctaText: { fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 16, color: '#FFFFFF' },
  contact: { fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3, textAlign: 'center', marginTop: 10 },

  lockedWrap: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  lockedTitle: { fontFamily: DISPLAY.semiBold, fontSize: 22, color: NEUTRAL.text, textAlign: 'center' },
  lockedBody: { fontFamily: FONTS.regular, fontSize: 15, color: NEUTRAL.text3, textAlign: 'center' },
});