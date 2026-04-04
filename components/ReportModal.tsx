import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../locales/i18n';
import { createReport, ReportReason, ReportTargetType, ReportSnapshot } from '../services/ReportService';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  snapshot?: ReportSnapshot;
  reportedUserName?: string;
}

function getReasonLabel(value: ReportReason): string {
  const key = {
    spam: 'reportReasonSpam',
    harassment: 'reportReasonHarassment',
    nudity: 'reportReasonNudity',
    violence: 'reportReasonViolence',
    fake: 'reportReasonFake',
    other: 'reportReasonOther',
  }[value];
  return i18n.t(key) || value;
}

const REPORT_REASONS: ReportReason[] = ['spam', 'harassment', 'nudity', 'violence', 'fake', 'other'];

export default function ReportModal({
  visible,
  onClose,
  targetType,
  targetId,
  snapshot,
  reportedUserName,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert(i18n.t('error') || 'Error', i18n.t('reportErrorSelectReason') || 'Please select a reason for reporting');
      return;
    }

    setLoading(true);
    try {
      await createReport({
        targetType,
        targetId,
        reason: selectedReason,
        details: details.trim() || undefined,
        snapshot,
      });

      Alert.alert(i18n.t('success') || 'Success', i18n.t('reportSuccess') || 'Your report has been submitted.', [
        { text: 'OK', onPress: handleClose },
      ]);
    } catch (error: any) {
      Alert.alert(i18n.t('error') || 'Error', error.message || i18n.t('reportErrorSubmit') || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {targetType === 'post' ? i18n.t('reportTitlePost') : i18n.t('reportTitleUser')}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {reportedUserName && (
              <Text style={styles.subtitle}>{i18n.t('reportingUser')} {reportedUserName}</Text>
            )}

            <Text style={styles.label}>{i18n.t('reasonForReporting')}</Text>
            {REPORT_REASONS.map((reasonValue) => (
              <TouchableOpacity
                key={reasonValue}
                style={[
                  styles.reasonOption,
                  selectedReason === reasonValue && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reasonValue)}
              >
                <View style={styles.reasonRow}>
                  <View
                    style={[
                      styles.radioButton,
                      selectedReason === reasonValue && styles.radioButtonSelected,
                    ]}
                  >
                    {selectedReason === reasonValue && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.reasonLabel}>{getReasonLabel(reasonValue)}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>{i18n.t('additionalDetailsOptional')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={i18n.t('reportDetailsPlaceholder')}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, !selectedReason && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading || !selectedReason}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{i18n.t('submitReport')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    maxHeight: 400,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 12,
  },
  reasonOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  reasonOptionSelected: {
    backgroundColor: '#e3f2fd',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#999',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#007AFF',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  reasonLabel: {
    fontSize: 16,
    color: '#000',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

