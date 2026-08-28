// src/components/brand/Pickers.js
//
// AvatarPickerSheet — the camera/gallery/remove chooser, driven by
//   useAvatarPicker(). Used by all three avatars.
// LanguageSheet — extracted so ManagerApp, CleanerScreen and LoginScreen all
//   show the same thing. In the redesign the profile menu's Language row opens
//   THIS, rather than listing languages inline.
import React from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import Icon from '../Icon';
import { BRAND, NEUTRAL, RADII } from '../../theme/tokens';
import { type } from '../../theme/typography';

export function AvatarPickerSheet({ controller, title = 'Profile photo', labels = {} }) {
  const { visible, canRemove, busy, close, fromCamera, fromGallery, remove } = controller;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.scrim} onPress={close}>
        <Pressable onPress={() => {}} style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{title}</Text>

          {busy ? (
            <View style={s.busy}><ActivityIndicator color={BRAND.navy} /></View>
          ) : (
            <>
              <TouchableOpacity style={s.row} onPress={fromCamera} activeOpacity={0.8}>
                <View style={s.rowIcon}>
                  <Icon name="photo_camera" size={22} color={BRAND.navy} />
                </View>
                <Text style={s.rowText}>{labels.camera || 'Take a photo'}</Text>
                <Icon name="chevron_right" size={20} color={NEUTRAL.text4} />
              </TouchableOpacity>

              <TouchableOpacity style={s.row} onPress={fromGallery} activeOpacity={0.8}>
                <View style={s.rowIcon}>
                  <Icon name="photo_library" size={22} color={BRAND.navy} />
                </View>
                <Text style={s.rowText}>{labels.gallery || 'Choose from gallery'}</Text>
                <Icon name="chevron_right" size={20} color={NEUTRAL.text4} />
              </TouchableOpacity>

              {canRemove && (
                <TouchableOpacity style={s.rowDanger} onPress={remove} activeOpacity={0.8}>
                  <Icon name="delete" size={22} color="#B91C1C" />
                  <Text style={s.rowDangerText}>{labels.remove || 'Remove photo'}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity style={s.close} onPress={close} activeOpacity={0.85}>
            <Text style={s.closeText}>{labels.close || 'Close'}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function LanguageSheet({ visible, onClose, languages, current, onSelect, title = 'Language' }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable onPress={() => {}} style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{title}</Text>

          {languages.map(lang => {
            const active = current === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[s.langRow, active && s.langRowActive]}
                onPress={() => { onSelect(lang.code); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={[s.langBadge, active && s.langBadgeActive]}>
                  <Text style={[s.langBadgeText, active && { color: '#B45309' }]}>
                    {lang.code.toUpperCase()}
                  </Text>
                </View>
                <Text style={[s.langText, active && s.langTextActive]}>{lang.label}</Text>
                {active && <Icon name="check_circle" size={22} color={BRAND.yellow} filled />}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={s.close} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.closeText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(11,31,58,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADII.sheet, borderTopRightRadius: RADII.sheet,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24, gap: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: NEUTRAL.border, alignSelf: 'center', marginBottom: 6,
  },
  title: { ...type('screenTitle', { fontSize: 24, color: BRAND.navy, marginBottom: 4 }) },
  busy:  { minHeight: 120, alignItems: 'center', justifyContent: 'center' },

  row: {
    minHeight: 66, borderRadius: 18,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16,
  },
  rowIcon: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: NEUTRAL.slateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { ...type('label', { fontSize: 16, color: NEUTRAL.text, flex: 1 }) },
  rowDanger: {
    minHeight: 56, borderRadius: 16, backgroundColor: '#FEE2E2',
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
  },
  rowDangerText: { ...type('label', { fontSize: 16, color: '#B91C1C' }) },

  langRow: {
    minHeight: 52, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8,
  },
  langRowActive: { backgroundColor: '#FEF6E3' },
  langBadge: {
    width: 34, height: 34, borderRadius: 12,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.slateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  langBadgeActive: { borderColor: BRAND.yellow, backgroundColor: '#FFFFFF' },
  langBadgeText: { ...type('label', { fontSize: 12, color: NEUTRAL.text3 }) },
  langText: { ...type('label', { fontSize: 16, color: NEUTRAL.text, flex: 1 }) },
  langTextActive: { color: BRAND.navy },

  close: {
    minHeight: 50, borderRadius: 16,
    borderWidth: 1.5, borderColor: NEUTRAL.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  closeText: { ...type('label', { fontSize: 16, color: NEUTRAL.text }) },
});