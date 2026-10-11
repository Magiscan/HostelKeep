// src/components/maintenance/CleanerMaintenanceSection.js
//
// Drop-in block for CleanerScreen. Gives a housekeeper:
//   • tasks assigned to them, if a manager handed them any (small hostels)
//   • the status of what they reported, so they see it get fixed
//   • the "Report a problem" sheet
//
// The report BUTTON lives in CleanerScreen as a floating icon opposite the
// Extra Fab, so the sheet is controlled from there:
//   <CleanerMaintenanceSection
//     reportOpen={showReport}
//     onReportClose={() => setShowReport(false)}
//     onToast={(msg) => toast.show(msg)}
//   />
// Leave reportOpen undefined to get the old inline "Report a problem" card.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import { FONTS } from '../../theme/typography';
import { BRAND, NEUTRAL } from '../../theme/tokens';
import { useApp } from '../../contexts/AppContext';
import { useMaintenance } from '../../hooks/useMaintenance';
import { TaskCard } from './MaintenanceParts';
import ReportIssueSheet from './ReportIssueSheet';
import TaskDetailSheet from './TaskDetailSheet';

export default function CleanerMaintenanceSection({ onToast, reportOpen, onReportClose }) {
  const { t } = useTranslation();
  const { rooms } = useApp();
  const m = useMaintenance();
  const [localReporting, setLocalReporting] = useState(false);
  const controlled = reportOpen !== undefined;
  const reporting = controlled ? reportOpen : localReporting;
  const closeReport = () => (controlled ? onReportClose?.() : setLocalReporting(false));
  const [openId, setOpenId] = useState(null);

  // Reports stay — fixed ones included — until the housekeeper removes them
  // with the ✕. (myReports already leaves out the ones they removed.)
  const reports = useMemo(
    () => m.myReports.filter(r => !(r.assignees || []).includes(r.reportedBy)),
    [m.myReports],
  );

  const assigned = m.myTasks;
  const remove = (task) => m.clearForMe(task)
    .catch(e => onToast?.(e.message));

  // Maintenance is Pro+: housekeepers simply don't see it otherwise.
  if (!m.enabled) return null;

  return (
    <View style={styles.wrap}>
      {!controlled && (
      <TouchableOpacity onPress={() => setLocalReporting(true)} style={styles.reportBtn} activeOpacity={0.85}>
        <View style={styles.reportIcon}>
          <Icon name="build" size={20} color={BRAND.yellow} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reportTitle}>{t('maint.reportTitle', 'Report a problem')}</Text>
          <Text style={styles.reportSub}>{t('maint.reportCta', 'Broken, leaking, not working? Tell your manager.')}</Text>
        </View>
        <Icon name="chevron_right" size={22} color={NEUTRAL.text4} />
      </TouchableOpacity>
      )}

      {assigned.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t('maint.assignedToYou', 'Maintenance for you')}</Text>
          {assigned.map(task => (
            <TaskCard key={task.id} task={task} rooms={rooms} onPress={() => setOpenId(task.id)} onRemove={remove} />
          ))}
        </View>
      )}

      {reports.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t('maint.yourReports', 'Your reports')}</Text>
          {reports.map(task => (
            <TaskCard key={task.id} task={task} rooms={rooms} onPress={() => setOpenId(task.id)} onRemove={remove} />
          ))}
        </View>
      )}

      <ReportIssueSheet
        visible={reporting}
        onClose={closeReport}
        rooms={rooms}
        onSubmit={m.reportIssue}
        onSent={() => onToast?.(t('maint.reportSent', 'Sent. Your manager has been notified.'))}
      />
      <TaskDetailSheet taskId={openId} onClose={() => setOpenId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, backgroundColor: NEUTRAL.surface,
    borderWidth: 1, borderColor: NEUTRAL.border,
  },
  reportIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: BRAND.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  reportTitle: { fontFamily: FONTS.semiBold, fontSize: 15.5, color: NEUTRAL.text },
  reportSub: { fontFamily: FONTS.regular, fontSize: 13, color: NEUTRAL.text3, marginTop: 2 },
  group: { gap: 8 },
  groupTitle: { fontFamily: FONTS.display, fontSize: 18, color: BRAND.navy },
});