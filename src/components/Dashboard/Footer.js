import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { COLORS } from '../../theme/colors';
import { FONTS, FONT_SIZE } from '../../theme/typography';
import { SPACING } from '../../theme/spacing';

// Point this at your deployed hosting domain so the native build can open the
// same policy page.
const PRIVACY_URL_NATIVE = 'https://keepclean-hostel.web.app/privacy.html';

export default function Footer() {
  // FIXED: window.open is undefined outside the browser — this crashed native.
  const openPrivacy = () => {
    Linking.openURL(Platform.OS === 'web' ? '/privacy.html' : PRIVACY_URL_NATIVE);
  };

  return (
    <View style={styles.footer}>
      <Text style={styles.text}>© 2026 HostelKeep</Text>
      <View style={styles.links}>
        <TouchableOpacity onPress={openPrivacy}>
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