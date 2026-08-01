import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';
import { RADIUS } from '../../theme/radius';
import { SHADOW } from '../../theme/shadows';
import { SPACING } from '../../theme/spacing';

export default function AppCard({ children, style, noPadding }) {
  return (
    <View
      style={[
        styles.card,
        !noPadding && { padding: SPACING.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
});