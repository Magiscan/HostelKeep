// src/components/Dashboard/Footer.web.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';

const LINKS = [
  { label: 'Privacy policy', url: 'https://keepclean-hostel.web.app/privacy.html' },
  { label: 'Terms', url: 'https://…' },
  { label: 'Contact', url: 'mailto:hello@kohciao.com' },
];

export default function Footer({ compact }) {
  return (
    <View style={[styles.footer, compact && styles.footerCompact]}>
      <Text style={styles.copy}>
        © {new Date().getFullYear()} HostelKeep
      </Text>
      <View style={{ flex: 1 }} />
      <View style={styles.links}>
        {LINKS.map(l => (
          <TouchableOpacity
            key={l.label}
            onPress={() => Linking.openURL(l.url)}
            activeOpacity={0.7}
          >
            <Text style={styles.link}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* flexGrow 0 so it never competes with the screen for height — without it a
     short screen pushes the footer into the middle of the viewport. */
  footer: {
    flexGrow: 0, flexShrink: 0,
    flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    paddingVertical: 12, paddingHorizontal: 28,
    borderTopWidth: 1, borderTopColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
  },
  footerCompact: { paddingHorizontal: 16, justifyContent: 'center' },
  copy: { fontFamily: FONTS.regular, fontSize: 12.5, color: NEUTRAL.text4 },
  links: { flexDirection: 'row', gap: 18, flexWrap: 'wrap' },
  link: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 12.5, color: NEUTRAL.text3,
  },
});