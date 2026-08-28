import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

/**
 * HostelKeep 2.0 icons.
 *
 * WHY THE WEB BRANCH IS GONE:
 * The previous version rendered the icon NAME as text on web and relied on the
 * "Material Symbols Rounded" font forming a ligature. That fails whenever the
 * font hasn't finished loading OR the browser doesn't apply `liga` — and the
 * failure mode is the worst possible one: the literal word "check_circle"
 * appears in your UI instead of an icon. That's the text you're seeing.
 *
 * @expo/vector-icons bundles its own font and injects the @font-face rule
 * itself, on web and native alike, so there's nothing to race. One code path,
 * no ligatures, no FOUT.
 *
 * TRADE-OFF: the variable-font `FILL` axis is gone, so `filled` is accepted but
 * ignored. MaterialIcons ships solid glyphs by default, which is what the
 * prototype uses for active states anyway. Call sites keep working untouched.
 *
 * You can leave the Material Symbols <link> in web/index.html — nothing uses it
 * now, but it's harmless. Removing it saves a request.
 */

// Old Ionicons name → Material Symbols name.
// Screens written before the redesign still pass these.
const LEGACY_MAP = {
  'grid-outline': 'grid_view',
  'grid': 'grid_view',
  'construct-outline': 'construction',
  'construct': 'construction',
  'people-outline': 'group',
  'people': 'group',
  'person-circle-outline': 'account_circle',
  'person-remove-outline': 'person_remove',
  'swap-horizontal-outline': 'swap_horiz',
  'swap-horizontal': 'swap_horiz',
  'search-outline': 'search',
  'close': 'close',
  'close-circle': 'cancel',
  'close-circle-outline': 'cancel',
  'refresh': 'refresh',
  'refresh-circle': 'refresh',
  'pencil': 'edit',
  'create-outline': 'edit',
  'key-outline': 'key',
  'globe-outline': 'language',
  'log-out-outline': 'logout',
  'chevron-up': 'expand_less',
  'chevron-down': 'expand_more',
  'chevron-left': 'chevron_left',
  'chevron-right': 'chevron_right',
  'arrow-back': 'arrow_back',
  'arrow-forward': 'arrow_forward',
  'checkmark': 'check',
  'checkmark-circle': 'check_circle',
  'checkmark-done-outline': 'done_all',
  'checkbox-outline': 'check_box',
  'add-circle-outline': 'add_circle',
  'layers-outline': 'layers',
  'options-outline': 'tune',
  'download-outline': 'download',
  'ellipsis-vertical': 'more_vert',
  'trash-outline': 'delete',
  'hourglass-outline': 'hourglass_empty',
  'send-outline': 'send',
  'alarm-outline': 'notifications',
  'notifications-outline': 'notifications',
  'time-outline': 'schedule',
  'bed-outline': 'bed',
  'home-outline': 'home',
  'ellipse-outline': 'radio_button_unchecked',
  'flash-outline': 'bolt',
  'eye-outline': 'visibility',
  'eye-off-outline': 'visibility_off',
  'alert-circle': 'error',
  'calendar-outline': 'calendar_today',
  'print-outline': 'print',
  'flag-outline': 'flag',
  'flag': 'flag',
  'document-text-outline': 'description',
  'settings-outline': 'settings',
  'camera-outline': 'photo_camera',
  'image-outline': 'image',
  'lock-closed-outline': 'lock',
  'information-circle-outline': 'info',
  'help-circle-outline': 'help',
  'star-outline': 'star',
  'star': 'star',
  'bar-chart-outline': 'bar_chart',
  'sparkles-outline': 'auto_awesome',
  'brush-outline': 'cleaning_services',
  'moon-outline': 'bedtime',
  'person-add-outline': 'person_add',
  'person-add': 'person_add',
};

/**
 * Material Symbols names with no MaterialIcons equivalent, mapped to the
 * closest glyph that does exist. Without these you get a blank square.
 */
const SYMBOL_FALLBACKS = {
  shield_person: 'admin-panel-settings',
  notifications_active: 'notifications-active',
  workspace_premium: 'workspace-premium',
  photo_library: 'photo-library',
  support_agent: 'support-agent',
  monitoring: 'insights',
  door_front: 'meeting-room',
  cleaning_services: 'cleaning-services',
  local_laundry_service: 'local-laundry-service',
  bunk_bed: 'bed',
};

function resolveName(name) {
  if (!name) return 'help';
  return LEGACY_MAP[name] || name;
}

export default function Icon({
  name,
  size = 22,
  color = COLORS.textStrong,
  filled = false,   // accepted for compatibility; MaterialIcons has no FILL axis
  style,
}) {
  const resolved = resolveName(name);
  const glyph = SYMBOL_FALLBACKS[resolved] || resolved.replace(/_/g, '-');
  return <MaterialIcons name={glyph} size={size} color={color} style={style} />;
}