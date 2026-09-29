import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '../Icon';
import { COLORS } from '../../theme/colors';
import { SPACING } from '../../theme/spacing';
import { RADIUS } from '../../theme/radius';
import { FONT_SIZE, FONTS } from '../../theme/typography';  
import { useTranslation } from 'react-i18next';

export default function SearchBar({ value, onChangeText, onClear }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Icon name="search-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('searchRoomsPlaceholder')}
        placeholderTextColor={COLORS.textSecondary}
        style={styles.input}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear}>
          <Icon name="close-circle" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.regular,        // now works
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
});