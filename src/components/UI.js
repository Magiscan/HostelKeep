import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import Icon from './Icon';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING } from '../theme';

// ---------- Chip (responsive pill) ----------
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  colorBg = COLORS.surface,
  colorBorder = COLORS.border,
  colorText = COLORS.textSecondary,
  activeColorBg = COLORS.primary,
  activeColorBorder = COLORS.primary,
  activeColorText = COLORS.white,
  fontSize = FONT_SIZE.sm,
  style,
}) {
  const paddingV = fontSize * 0.65;
  const paddingH = fontSize * 1.1;
  const gap = fontSize * 0.45;
  const iconSize = fontSize * 1.3;

  const bg = selected ? activeColorBg : colorBg;
  const borderC = selected ? activeColorBorder : colorBorder;
  const textC = selected ? activeColorText : colorText;

  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          backgroundColor: bg,
          borderRadius: 9999,
          borderWidth: 1.5,
          borderColor: borderC,
        },
        selected && SHADOW.md,
        style,
      ]}
    >
      {icon && <Icon name={icon} size={iconSize} color={textC} />}
      <Text
        style={{
          fontFamily: FONTS.semiBold,
          fontSize,
          color: textC,
          letterSpacing: 0.2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// ---------- Button ----------
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
  icon,
  iconPosition = 'left',
  glow = false,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    if (onPress) onPress();
  };

  const bg =
    variant === 'primary'
      ? COLORS.primary
      : variant === 'secondary'
      ? COLORS.surface
      : variant === 'danger'
      ? COLORS.danger
      : COLORS.primary;
  const color = variant === 'secondary' ? COLORS.primary : COLORS.white;
  const borderColor = variant === 'secondary' ? COLORS.border : 'transparent';

  const paddingV = size === 'lg' ? SPACING[4] : size === 'sm' ? SPACING[2] : SPACING[3];
  const paddingH = size === 'lg' ? SPACING[6] : size === 'sm' ? SPACING[3] : SPACING[4];
  const fontSize = size === 'sm' ? FONT_SIZE.sm : FONT_SIZE.md;
  const iconSize = size === 'sm' ? 16 : 20;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={animatePress}
        disabled={disabled}
        activeOpacity={0.9}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACING[2],
            backgroundColor: disabled ? '#E2E8F0' : bg,
            paddingVertical: paddingV,
            paddingHorizontal: paddingH,
            borderRadius: RADIUS.sm,    // subtle rectangle
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: disabled ? COLORS.border : borderColor,
          },
          glow && !disabled && SHADOW.glow,
          SHADOW.sm,
          style,
        ]}
      >
        {icon && iconPosition === 'left' && (
          <Icon name={icon} size={iconSize} color={disabled ? COLORS.textMuted : color} />
        )}
        <Text
          style={{
            fontFamily: FONTS.bold,
            fontSize,
            color: disabled ? COLORS.textMuted : color,
            letterSpacing: 0.2,
          }}
        >
          {title}
        </Text>
        {icon && iconPosition === 'right' && (
          <Icon name={icon} size={iconSize} color={disabled ? COLORS.textMuted : color} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------- Card ----------
export function Card({ children, style, noPadding }) {
  return (
    <View
      style={[
        {
          backgroundColor: COLORS.surface,
          borderRadius: RADIUS.lg,
          padding: noPadding ? 0 : SPACING[4],
          borderWidth: 1,
          borderColor: COLORS.border,
          ...SHADOW.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------- Input ----------
export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  multiline,
  numberOfLines,
  style,
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: FONTS.regular,
          backgroundColor: COLORS.white,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: COLORS.border,
          paddingHorizontal: SPACING[3],
          paddingVertical: Platform.OS === 'ios' ? SPACING[3] : SPACING[2],
          fontSize: FONT_SIZE.md,
          color: COLORS.text,
        },
        style,
      ]}
    />
  );
}

// ---------- Label ----------
export function Label({ children, style }) {
  return (
    <Text
      style={[
        {
          fontFamily: FONTS.semiBold,
          fontSize: FONT_SIZE.sm,
          color: COLORS.textSecondary,
          marginBottom: SPACING[2],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------- Badge ----------
export function Badge({ label, type = 'default' }) {
  const colors = {
    priv: { bg: COLORS.primaryLight, text: COLORS.primary },
    dorm: { bg: COLORS.accentLight, text: COLORS.accent },
    clean: { bg: COLORS.successLight, text: COLORS.success },
    extra: { bg: COLORS.dangerLight, text: COLORS.danger },
  };
  const c = colors[type] || { bg: COLORS.surface, text: COLORS.textSecondary };

  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingHorizontal: SPACING[3],
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.bold,
          fontSize: FONT_SIZE.xs,
          color: c.text,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ---------- Avatar ----------
export function Avatar({ name, size = 40, color = COLORS.primary, bg = COLORS.primaryLight }) {
  const parts = name?.trim().split(' ') || [''];
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0]?.[0]?.toUpperCase() || '?';
  const avatarSize = size;
  const fontSize = avatarSize * 0.35;

  return (
    <View
      style={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: avatarSize / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: FONTS.bold, fontSize, color }}>
        {initials}
      </Text>
    </View>
  );
}

// ---------- SectionTitle ----------
export function SectionTitle({ title, subtitle }) {
  return (
    <View style={{ marginBottom: SPACING[2] }}>
      <Text style={{
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZE.xxl,
        color: COLORS.text,
        letterSpacing: -0.3,
      }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{
          fontFamily: FONTS.regular,
          fontSize: FONT_SIZE.md,
          color: COLORS.textSecondary,
          marginTop: SPACING[1],
        }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- FloorHeader ----------
export function FloorHeader({ label }) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING[3],
      marginTop: SPACING[6],
    }}>
      <View style={{
        width: 5,
        height: 24,
        backgroundColor: COLORS.primary,
        borderRadius: 3,
        marginRight: SPACING[3],
      }} />
      <Text style={{ fontFamily: FONTS.bold, fontSize: FONT_SIZE.lg, color: COLORS.text }}>
        {label}
      </Text>
    </View>
  );
}

// ---------- EmptyState ----------
export function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: SPACING[10] }}>
      <Text style={{ fontSize: 52, marginBottom: SPACING[4] }}>{icon}</Text>
      <Text style={{
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZE.xl,
        color: COLORS.text,
        marginBottom: SPACING[2],
      }}>
        {title}
      </Text>
      <Text style={{
        fontFamily: FONTS.regular,
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: FONT_SIZE.md * 1.5,
        paddingHorizontal: SPACING[4],
      }}>
        {subtitle}
      </Text>
    </View>
  );
}

// ---------- ToggleGroup ----------
export function ToggleGroup({ options, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: SPACING[2], marginVertical: SPACING[2] }}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
          style={{
            paddingVertical: SPACING[2],
            paddingHorizontal: SPACING[4],
            borderRadius: RADIUS.sm,
            backgroundColor: value === opt.value ? COLORS.primary : COLORS.surface,
            borderWidth: 1,
            borderColor: value === opt.value ? COLORS.primary : COLORS.border,
          }}
        >
          <Text style={{
            fontFamily: FONTS.semiBold,
            fontSize: FONT_SIZE.md,
            color: value === opt.value ? COLORS.white : COLORS.textSecondary,
          }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---------- ProgressBar ----------
export function ProgressBar({ pct, height = 10 }) {
  return (
    <View style={{
      height,
      backgroundColor: COLORS.border,
      borderRadius: height / 2,
      overflow: 'hidden',
    }}>
      <View style={{
        width: `${Math.min(pct, 100)}%`,
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: height / 2,
      }} />
    </View>
  );
}