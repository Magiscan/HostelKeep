import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';

export default function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.text}>© 2026 HostelKeep</Text>
      <View style={styles.links}>
        <TouchableOpacity onPress={() => window.open('/privacy.html', '_blank')}>
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
        <Text style={styles.text}>·</Text>
        {/* <TouchableOpacity>
          <Text style={styles.link}>Terms</Text>
        </TouchableOpacity> */}
        <Text style={styles.text}>·</Text>
        <Text style={styles.text}>v2.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  text: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  link: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
  },
  links: {
    flexDirection: 'row',
    gap: 8,
  },
});