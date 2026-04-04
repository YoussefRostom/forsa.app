import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { subscribeReportsForAdmin, updateReportStatus, Report, ReportStatus } from '../../services/ReportService';
import { removePost, suspendUser, unsuspendUser, isAdmin } from '../../services/ModerationService';
import { auth, db } from '../../lib/firebase';
import { Video, ResizeMode } from 'expo-av';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { formatTimestamp } from '../../lib/dateUtils';
import i18n from '../../locales/i18n';

export default function AdminReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | null>('open');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [performingAction, setPerformingAction] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [reporterNames, setReporterNames] = useState<Record<string, string>>({});
  const [targetUserSuspended, setTargetUserSuspended] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is admin
    const checkAdmin = async () => {
      const admin = await isAdmin();
      setIsUserAdmin(admin);
      if (!admin) {
        Alert.alert(i18n.t('accessDenied'), i18n.t('accessDeniedMessage'));
        router.back();
        return;
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    if (!isUserAdmin) return;

    setLoading(true);
    const unsubscribe = subscribeReportsForAdmin(statusFilter, async (reportsData) => {
      setReports(reportsData);
      
      // Fetch reporter names for all unique reporter IDs
      const uniqueReporterIds = [...new Set(reportsData.map(r => r.reporterId))];
      const nameMap: Record<string, string> = {};
      
      await Promise.all(
        uniqueReporterIds.map(async (reporterId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', reporterId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              let name = '';
              
              // Try role-specific name fields first
              if (userData.agentName) {
                name = userData.agentName;
              } else if (userData.academyName) {
                name = userData.academyName;
              } else if (userData.clinicName) {
                name = userData.clinicName;
              } else if (userData.parentName) {
                name = userData.parentName;
              } else if (userData.playerName) {
                name = userData.playerName;
              }
              // Fallback to firstName/lastName
              else if (userData.firstName && userData.lastName) {
                name = `${userData.firstName} ${userData.lastName}`;
              } else if (userData.firstName || userData.lastName) {
                name = userData.firstName || userData.lastName;
              }
              // Fallback to email or phone
              else if (userData.email) {
                name = userData.email.split('@')[0];
              } else if (userData.phone) {
                name = userData.phone;
              } else {
                name = reporterId.substring(0, 8);
              }
              
              nameMap[reporterId] = name;
            } else {
              nameMap[reporterId] = reporterId.substring(0, 8);
            }
          } catch (error) {
            console.error('Error fetching reporter name:', error);
            nameMap[reporterId] = reporterId.substring(0, 8);
          }
        })
      );
      
      setReporterNames(nameMap);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [statusFilter, isUserAdmin]);

  const handleAction = async (action: string) => {
    if (!selectedReport || !auth.currentUser) return;

    setPerformingAction(true);
    try {
      const adminId = auth.currentUser.uid;
      let resolutionAction: 'none' | 'post_removed' | 'user_suspended' | 'user_unsuspended' | 'dismissed' = 'none';
      let targetUserId: string | null = null;

      switch (action) {
        case 'remove_post':
          if (selectedReport.targetType === 'post') {
            await removePost(selectedReport.targetId, adminId, actionNote);
            resolutionAction = 'post_removed';
            targetUserId = selectedReport.snapshot?.postOwnerId || null;
          }
          break;

        case 'suspend_user':
          targetUserId = selectedReport.targetType === 'user' 
            ? selectedReport.targetId 
            : selectedReport.snapshot?.postOwnerId || null;
          if (targetUserId) {
            await suspendUser(targetUserId, adminId, actionNote || 'Reported content');
            resolutionAction = 'user_suspended';
          }
          break;

        case 'unsuspend_user':
          targetUserId = selectedReport.targetType === 'user' 
            ? selectedReport.targetId 
            : selectedReport.snapshot?.postOwnerId || null;
          if (targetUserId) {
            await unsuspendUser(targetUserId, adminId, actionNote);
            resolutionAction = 'user_unsuspended';
          }
          break;

        case 'mark_reviewed':
          await updateReportStatus(selectedReport.id, {
            status: 'reviewed',
            assignedAdminId: adminId,
          });
          setShowActionModal(false);
          setSelectedReport(null);
          setActionNote('');
          Alert.alert(i18n.t('success') || 'Success', i18n.t('reportMarkedReviewed'));
          return;

        case 'dismiss':
          resolutionAction = 'dismissed';
          break;
      }

      // Update report with resolution
      await updateReportStatus(selectedReport.id, {
        status: 'resolved',
        assignedAdminId: adminId,
        resolution: {
          action: resolutionAction,
          note: actionNote || null,
          actedBy: adminId,
          actedAt: Timestamp.now(),
        },
      });

      setShowActionModal(false);
      setSelectedReport(null);
      setActionNote('');
      Alert.alert(i18n.t('success') || 'Success', i18n.t('actionSuccess'));
    } catch (error: any) {
      Alert.alert(i18n.t('error') || 'Error', error.message || i18n.t('actionError'));
    } finally {
      setPerformingAction(false);
    }
  };

  const getTargetUserId = (report: Report | null): string | null => {
    if (!report) return null;
    if (report.targetType === 'user') return report.targetId;
    return report.snapshot?.postOwnerId ?? null;
  };

  const openActionModal = async (report: Report) => {
    setSelectedReport(report);
    setActionNote('');
    setShowActionModal(true);
    setTargetUserSuspended(null);
    const targetUserId = getTargetUserId(report);
    if (targetUserId) {
      try {
        const userSnap = await getDoc(doc(db, 'users', targetUserId));
        setTargetUserSuspended(userSnap.exists() && userSnap.data()?.isSuspended === true);
      } catch {
        setTargetUserSuspended(false);
      }
    } else {
      setTargetUserSuspended(false);
    }
  };

  const formatDate = (timestamp: unknown) =>
    formatTimestamp(timestamp, { fallback: 'Unknown' });

  const renderReportItem = ({ item }: { item: Report }) => {
    const isPost = item.targetType === 'post';
    const snapshot = item.snapshot || {};

    return (
      <TouchableOpacity
        style={styles.reportCard}
        onPress={() => openActionModal(item)}
      >
        <View style={styles.reportHeader}>
          <View style={styles.reportHeaderLeft}>
            <Ionicons
              name={isPost ? 'document-text' : 'person'}
              size={20}
              color={item.status === 'open' ? '#FF3B30' : '#999'}
            />
            <Text style={styles.reportType}>
              {isPost ? i18n.t('postReport') : i18n.t('userReport')}
            </Text>
            <View style={[styles.statusBadge, styles[`status${item.status}`]]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.reportDate}>{formatDate(item.createdAt)}</Text>
        </View>

        <Text style={styles.reportReason}>
          <Text style={styles.label}>Reason: </Text>
          {item.reason}
        </Text>

        {item.details && (
          <Text style={styles.reportDetails} numberOfLines={2}>
            {item.details}
          </Text>
        )}

        {isPost && snapshot.mediaUrl && (
          <View style={styles.mediaPreview}>
            {snapshot.mediaType === 'video' ? (
              <Video
                source={{ uri: snapshot.mediaUrl }}
                style={styles.mediaThumbnail}
                useNativeControls={false}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
              />
            ) : (
              <Image
                source={{ uri: snapshot.mediaUrl }}
                style={styles.mediaThumbnail}
                resizeMode="cover"
              />
            )}
            {snapshot.contentText && (
              <Text style={styles.caption} numberOfLines={2}>
                {snapshot.contentText}
              </Text>
            )}
          </View>
        )}

        {!isPost && snapshot.reportedUserName && (
          <Text style={styles.reportedUser}>
            <Text style={styles.label}>User: </Text>
            {snapshot.reportedUserName}
          </Text>
        )}

        <View style={styles.reportFooter}>
          <View style={styles.reporterInfoContainer}>
            <Ionicons name="person-outline" size={14} color="#666" />
            <Text style={styles.reporterInfo}>
              {i18n.t('reportedBy')} {reporterNames[item.reporterId] || item.reporterId.substring(0, 8)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </View>
      </TouchableOpacity>
    );
  };

  if (!isUserAdmin) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{i18n.t('checkingPermissions')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, statusFilter === 'open' && styles.filterTabActive]}
          onPress={() => setStatusFilter('open')}
        >
          <Text style={[styles.filterText, statusFilter === 'open' && styles.filterTextActive]}>
            {i18n.t('filterOpen')} ({reports.filter(r => r.status === 'open').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, statusFilter === 'reviewed' && styles.filterTabActive]}
          onPress={() => setStatusFilter('reviewed')}
        >
          <Text style={[styles.filterText, statusFilter === 'reviewed' && styles.filterTextActive]}>
            {i18n.t('filterReviewed')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, statusFilter === 'resolved' && styles.filterTabActive]}
          onPress={() => setStatusFilter('resolved')}
        >
          <Text style={[styles.filterText, statusFilter === 'resolved' && styles.filterTextActive]}>
            {i18n.t('filterResolved')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, statusFilter === null && styles.filterTabActive]}
          onPress={() => setStatusFilter(null)}
        >
          <Text style={[styles.filterText, statusFilter === null && styles.filterTextActive]}>
            {i18n.t('filterAll')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reports List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{i18n.t('loadingReports')}</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>{i18n.t('noReportsFound')}</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReportItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.t('moderationActions')}</Text>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedReport && (
                <>
                  <Text style={styles.modalLabel}>{i18n.t('reportDetailsLabel')}</Text>
                  <Text style={styles.modalText}>
                    {i18n.t('reportType')} {selectedReport.targetType === 'post' ? i18n.t('postReport') : i18n.t('userReport')}
                  </Text>
                  <Text style={styles.modalText}>{i18n.t('reportReasonLabel')} {selectedReport.reason}</Text>
                  {selectedReport.details && (
                    <Text style={styles.modalText}>{i18n.t('reportDetailsLabel2')} {selectedReport.details}</Text>
                  )}

                  <Text style={styles.modalLabel}>{i18n.t('adminNoteOptional')}</Text>
                  <TextInput
                    style={styles.noteInput}
                    placeholder={i18n.t('adminNotePlaceholder')}
                    value={actionNote}
                    onChangeText={setActionNote}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </>
              )}

              <View style={styles.actionButtons}>
                {selectedReport?.targetType === 'post' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.removeButton]}
                    onPress={() => handleAction('remove_post')}
                    disabled={performingAction}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>{i18n.t('removePost')}</Text>
                  </TouchableOpacity>
                )}

                {selectedReport && targetUserSuspended !== true && getTargetUserId(selectedReport) && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.suspendButton]}
                    onPress={() => handleAction('suspend_user')}
                    disabled={performingAction}
                  >
                    <Ionicons name="ban-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>{i18n.t('suspendUser')}</Text>
                  </TouchableOpacity>
                )}

                {targetUserSuspended === true && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.unsuspendButton]}
                    onPress={() => handleAction('unsuspend_user')}
                    disabled={performingAction}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>{i18n.t('unsuspendUser')}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.reviewButton]}
                  onPress={() => handleAction('mark_reviewed')}
                  disabled={performingAction}
                >
                  <Ionicons name="eye-outline" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>{i18n.t('markReviewed')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.dismissButton]}
                  onPress={() => handleAction('dismiss')}
                  disabled={performingAction}
                >
                  <Ionicons name="close-circle-outline" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>{i18n.t('dismiss')}</Text>
                </TouchableOpacity>
              </View>

              {performingAction && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#007AFF" />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusopen: {
    backgroundColor: '#FFE5E5',
  },
  statusreviewed: {
    backgroundColor: '#FFF4E5',
  },
  statusresolved: {
    backgroundColor: '#E5F5E5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  reportDate: {
    fontSize: 12,
    color: '#999',
  },
  reportReason: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
  },
  reportDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  mediaPreview: {
    marginTop: 8,
    marginBottom: 12,
  },
  mediaThumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  caption: {
    fontSize: 14,
    color: '#666',
  },
  reportedUser: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  reporterInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reporterInfo: {
    fontSize: 12,
    color: '#666',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  modalContent: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 16,
  },
  actionButtons: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  removeButton: {
    backgroundColor: '#FF3B30',
  },
  suspendButton: {
    backgroundColor: '#FF9500',
  },
  unsuspendButton: {
    backgroundColor: '#34C759',
  },
  reviewButton: {
    backgroundColor: '#007AFF',
  },
  dismissButton: {
    backgroundColor: '#8E8E93',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

