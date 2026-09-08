// src/components/Dashboard/Drawer.web.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import Icon from '../../components/Icon';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';

/* ── Drawer ── */
export function Drawer({ visible, onClose, title, subtitle, width = 560, children, footer }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={drawerStyles.drawerScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[drawerStyles.drawerPanel, { width }]}>
          <View style={drawerStyles.drawerHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={drawerStyles.drawerTitle}>{title}</Text>
              {!!subtitle && <Text style={drawerStyles.drawerSub}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={drawerStyles.drawerClose} activeOpacity={0.7}>
              <Icon name="close" size={20} color={NEUTRAL.text3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={drawerStyles.drawerBody}>
            {children}
          </ScrollView>

          {!!footer && <View style={drawerStyles.drawerFooter}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

/* ── Overline label ── */
export function FieldLabel({ children }) {
  return <Text style={drawerStyles.overline}>{children}</Text>;
}

/* ── Centered confirm dialog ── */
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel, singleAction }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={drawerStyles.confirmScrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={drawerStyles.confirmCard}>
          <Text style={drawerStyles.confirmTitle}>{title}</Text>
          <Text style={drawerStyles.confirmMessage}>{message}</Text>
          <View style={drawerStyles.confirmActions}>
            {!singleAction && (
              <TouchableOpacity onPress={onCancel} style={[drawerStyles.btnGhost, { flex: 1 }]} activeOpacity={0.8}>
                <Text style={drawerStyles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onConfirm}
              style={[
                drawerStyles.btnPrimary,
                { flex: 1, justifyContent: 'center' },
                !singleAction && { backgroundColor: '#B91C1C' },
              ]}
              activeOpacity={0.9}
            >
              <Text style={drawerStyles.btnPrimaryText}>{confirmLabel || 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const drawerStyles = StyleSheet.create({
  drawerScrim: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11,31,58,0.55)',
  },
  drawerPanel: {
    maxWidth: '92vw',
    height: '100%',
    backgroundColor: NEUTRAL.surface,
    shadowColor: BRAND.navy,
    shadowOpacity: 0.28,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingTop: 24,
    paddingHorizontal: 26,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
  },
  drawerTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 23, color: NEUTRAL.text,
  },
  drawerSub: {
    marginTop: 4, fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text3,
  },
  drawerClose: {
    width: 40, height: 40, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  drawerBody: { paddingTop: 24, paddingHorizontal: 26, paddingBottom: 30, gap: 26 },
  drawerFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16, paddingHorizontal: 26,
    borderTopWidth: 1, borderTopColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
  },

  overline: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 11,
    letterSpacing: 0.88, textTransform: 'uppercase',
    color: NEUTRAL.text3, marginBottom: 10,
  },

  textInput: {
    height: 48, paddingHorizontal: 15, borderRadius: 14,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.inputFill,
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 16, color: NEUTRAL.text,
    outlineStyle: 'none',
  },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },

  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 60, paddingHorizontal: 14, borderRadius: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  listRowIcon: {
    width: 34, height: 34, borderRadius: 11, flexShrink: 0,
    backgroundColor: NEUTRAL.slateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  listRowLabel: {
    flex: 1, minWidth: 0,
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 15, color: NEUTRAL.text,
  },

  btnGhost: {
    height: 52, paddingHorizontal: 22, borderRadius: 16,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  btnGhostText: {
    fontFamily: FONTS.medium, fontWeight: '500', fontSize: 15, color: NEUTRAL.text2,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    height: 52, paddingHorizontal: 24, borderRadius: 16,
    backgroundColor: BRAND.navy, justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: FONTS.semiBold, fontWeight: '600', fontSize: 15, color: '#FFFFFF',
  },

  emptyHint: {
    fontFamily: FONTS.regular, fontSize: 14, color: NEUTRAL.text4,
    textAlign: 'center', paddingVertical: 18,
  },

  confirmScrim: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, backgroundColor: 'rgba(11,31,58,0.55)',
  },
  confirmCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: NEUTRAL.surface, borderRadius: 22, padding: 24,
    shadowColor: BRAND.navy, shadowOpacity: 0.28,
    shadowRadius: 40, shadowOffset: { width: 0, height: 18 },
  },
  confirmTitle: {
    fontFamily: FONTS.display, fontWeight: '600', fontSize: 23, color: NEUTRAL.text,
  },
  confirmMessage: {
    marginTop: 8, marginBottom: 22,
    fontFamily: FONTS.regular, fontSize: 14.5, lineHeight: 21, color: NEUTRAL.text2,
  },
  confirmActions: { flexDirection: 'row', gap: 10 },
});