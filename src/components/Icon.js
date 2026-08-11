import React from 'react';
import { Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Map every Ionicons name you use to a simple Unicode character (or short text)
const WEB_SYMBOLS = {
  // Navigation / tabs
  'grid-outline':              '⊞',
  'grid':                      '⊞',
  'construct-outline':         '⚙',
  'construct':                 '⚙',
  'people-outline':            '👥',
  'people':                    '👥',
  'swap-horizontal-outline':   '⇄',
  'swap-horizontal':           '⇄',

  // Common actions
  'search-outline':            '🔍',
  'close-circle':              'ⓧ',
  'close-circle-outline':      'ⓧ',
  'refresh':                   '↻',
  'refresh-circle':            '↻',
  'pencil':                    '✎',
  'key-outline':               '🔑',
  'globe-outline':             '🌐',
  'log-out-outline':           '⤼',
  'chevron-up':                '▲',
  'chevron-down':              '▼',
  'checkmark':                 '✓',
  'checkmark-circle':          '◉',
  'add-circle-outline':        '⊕',
  'layers-outline':            '▦',
  'options-outline':           '⚙',
  'download-outline':          '⬇',
  'ellipsis-vertical':         '⋮',
  'create-outline':            '✎',
  'trash-outline':             '🗑',
  'hourglass-outline':         '⏳',
  'send-outline':              '➤',
  'alarm-outline':             '⏰',
  'time-outline':              '🕐',
  'bed-outline':               '🛏',
  'home-outline':              '⌂',
  'person-remove-outline':     '🚫',
  'ellipse-outline':           '○',
  'flash-outline':             '⚡',
  'eye-outline':               '👁',
  'eye-off-outline':           '👁̵',
  'alert-circle':              '⚠',
  'checkmark-done-outline':    '✓✓',
  'print-outline': '🖨',   
};

export default function Icon({ name, size = 20, color, style }) {
  if (Platform.OS === 'web') {
    const symbol = WEB_SYMBOLS[name] || '●';   // fallback bullet
    return (
      <Text
        style={{
          fontSize: size,
          color: color || '#000',
          lineHeight: size + 2,
          textAlign: 'center',
          ...(typeof style === 'object' ? style : {}),
        }}
      >
        {symbol}
      </Text>
    );
  }

  // Native (iOS/Android) – use Ionicons
  return <Ionicons name={name} size={size} color={color} style={style} />;
}