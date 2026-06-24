import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Platform,
  StyleSheet,
} from 'react-native';
import Icon from './Icon';
import { COLORS, RADIUS, SHADOW, FONTS, FONT_SIZE, SPACING } from '../theme';

// ── Chip ────────────────────────────────────────────────────────
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
  const paddingV = Math.max(fontSize * 0.55, 8);
  const paddingH = Math.max(fontSize * 1.0, 12);
  const gap = fontSize * 0.45;
  const iconSize = fontSize * 1.2;

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
          borderRadius: RADIUS.full,
          borderWidth: 1.5,
          borderColor: borderC,
          minHeight: 36,
        },
        selected && SHADOW.sm,
        style,
      ]}
    >
      {icon && <Icon name={icon} size={iconSize} color={textC} />}
      <Text
        style={{
          fontFamily: FONTS.semiBold,
          fontSize,
          color: textC,
          letterSpacing: 0.1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// ── Button ───────────────────────────────────────────────────────
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
      Animated.timing(scale, { toValue: 0.97, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 70, useNativeDriver: true }),
    ]).start();
    if (onPress) onPress();
  };

  const bg =
    variant === 'primary' ? COLORS.primary :
    variant === 'secondary' ? COLORS.surface :
    variant === 'danger' ? COLORS.danger :
    COLORS.primary;

  const color = variant === 'secondary' ? COLORS.primary : COLORS.white;
  const borderColor = variant === 'secondary' ? COLORS.border : 'transparent';

  const paddingV = size === 'lg' ? SPACING[4] : size === 'sm' ? SPACING[2] : SPACING[3];
  const paddingH = size === 'lg' ? SPACING[6] : size === 'sm' ? SPACING[4] : SPACING[5];
  const fontSize = size === 'sm' ? FONT_SIZE.sm : FONT_SIZE.md;
  const iconSize = size === 'sm' ? 15 : 18;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={animatePress}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACING[2],
            backgroundColor: disabled ? COLORS.border : bg,
            paddingVertical: paddingV,
            paddingHorizontal: paddingH,
            borderRadius: RADIUS.md,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: disabled ? COLORS.border : borderColor,
            minHeight: 44,
          },
          glow && !disabled && SHADOW.glow,
          !glow && SHADOW.sm,
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

// ── Card ─────────────────────────────────────────────────────────
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
          ...SHADOW.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Input ────────────────────────────────────────────────────────
export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  multiline,
  numberOfLines,
  style,
  editable,
  keyboardType,
}) {
  const [focused, setFocused] = useState(false);

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
      editable={editable}
      keyboardType={keyboardType}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          fontFamily: FONTS.regular,
          backgroundColor: editable === false ? COLORS.background : COLORS.white,
          borderRadius: RADIUS.md,
          borderWidth: 1.5,
          borderColor: focused ? COLORS.borderFocus : COLORS.border,
          paddingHorizontal: SPACING[3],
          paddingVertical: Platform.OS === 'ios' ? SPACING[3] : SPACING[2],
          fontSize: FONT_SIZE.md,
          color: COLORS.text,
          minHeight: 44,
        },
        style,
      ]}
    />
  );
}

// ── Label ────────────────────────────────────────────────────────
export function Label({ children, style }) {
  return (
    <Text
      style={[
        {
          fontFamily: FONTS.semiBold,
          fontSize: FONT_SIZE.sm,
          color: COLORS.textSecondary,
          marginBottom: SPACING[2],
          letterSpacing: 0.3,
          // textTransform: 'uppercase',   // ← remove or keep as you like
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ── Badge ────────────────────────────────────────────────────────
export function Badge({ label, type = 'default' }) {
  const colors = {
    priv:    { bg: COLORS.primaryLight, text: COLORS.primary },
    dorm:    { bg: COLORS.accentLight,  text: COLORS.amber },
    clean:   { bg: COLORS.successLight, text: COLORS.success },
    extra:   { bg: COLORS.dangerLight,  text: COLORS.danger },
    pending: { bg: '#F1F5F9',           text: COLORS.textSecondary },
  };
  const c = colors[type] || { bg: COLORS.surface, text: COLORS.textSecondary };

  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingHorizontal: SPACING[2],
        paddingVertical: 3,
        borderRadius: RADIUS.sm,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.bold,
          fontSize: FONT_SIZE.xs,
          color: c.text,
          letterSpacing: 0.4,
          // textTransform: 'uppercase',   // ← remove or keep as you like
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Avatar ───────────────────────────────────────────────────────
export function Avatar({ name, size = 40, color = COLORS.white, bg = COLORS.primary }) {
  const parts = name?.trim().split(' ') || [''];
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0]?.[0]?.toUpperCase() || '?';
  const fontSize = size * 0.36;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
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

// ── SectionTitle ─────────────────────────────────────────────────
export function SectionTitle({ title, subtitle, style }) {
  return (
    <View style={[{ marginBottom: SPACING[3] }, style]}>
      <Text
        style={{
          fontFamily: FONTS.bold,
          fontSize: FONT_SIZE.xl,
          color: COLORS.text,
          letterSpacing: -0.3,
          marginBottom: subtitle ? 2 : 0,
        }}
      >
        {title}
      </Text>
      {!!subtitle && (
        <Text
          style={{
            fontFamily: FONTS.regular,
            fontSize: FONT_SIZE.sm,
            color: COLORS.textMuted,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────
export function ProgressBar({ pct = 0, color = COLORS.primary, height = 8 }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const barColor = clamped === 100 ? COLORS.success : color;

  return (
    <View
      style={{
        height,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.border,
        overflow: 'hidden',
        marginTop: SPACING[2],
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          backgroundColor: barColor,
          borderRadius: RADIUS.full,
        }}
      />
    </View>
  );
}

// ── EmptyState ───────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle }) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING[12],
        paddingHorizontal: SPACING[6],
        gap: SPACING[3],
      }}
    >
      <Text style={{ fontSize: 52 }}>{icon}</Text>
      <Text
        style={{
          fontFamily: FONTS.bold,
          fontSize: FONT_SIZE.xl,
          color: COLORS.text,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {!!subtitle && (
        <Text
          style={{
            fontFamily: FONTS.regular,
            fontSize: FONT_SIZE.md,
            color: COLORS.textMuted,
            textAlign: 'center',
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

// ── FloorHeader ──────────────────────────────────────────────────
// Original style with accent bar – you can replace with the new separator
// version if you prefer.
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

// ── ToggleGroup ──────────────────────────────────────────────────
export function ToggleGroup({ options, value, onChange }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
      }}
    >
      {options.map((opt, i) => {
        const isActive = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              paddingVertical: SPACING[3],
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isActive ? COLORS.primary : 'transparent',
              borderRightWidth: i < options.length - 1 ? 1 : 0,
              borderRightColor: COLORS.border,
              minHeight: 44,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.semiBold,
                fontSize: FONT_SIZE.sm,
                color: isActive ? COLORS.white : COLORS.textSecondary,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}