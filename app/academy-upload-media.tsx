import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState, useCallback } from 'react';
import { Alert, ActivityIndicator, Animated, Easing, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import i18n from '../locales/i18n';
import { uploadAndSaveMedia, ResourceType } from '../services/MediaService';
import { getCurrentUserRole } from '../services/UserRoleService';

export default function AcademyUploadMediaScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { openMenu } = useHamburgerMenu();
  const [media, setMedia] = useState<Array<{ uri: string; type: 'image' | 'video'; caption?: string }>>([]);
  const [captionDraft, setCaptionDraft] = useState('');
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: number]: boolean }>({});
  const [currentUploadIdx, setCurrentUploadIdx] = useState<number | null>(null);
  const [uploadPercentage, setUploadPercentage] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedSecondsLeft, setEstimatedSecondsLeft] = useState(0);
  const uploadStartTime = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  // Prevent back/exit during upload
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        if (uploading) {
          e.preventDefault();
          Alert.alert(
            'Upload in progress',
            'Please wait for your media to finish uploading before leaving.',
            [{ text: 'OK' }]
          );
        }
      });
      return unsubscribe;
    }, [uploading, navigation])
  );

  // Timer for elapsed time
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (uploading && currentUploadIdx !== null) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - uploadStartTime.current) / 1000);
        setElapsedSeconds(elapsed);
        if (uploadPercentage > 0) {
          const secondsPerPercent = elapsed / uploadPercentage;
          const estimated = Math.max(0, Math.floor((100 - uploadPercentage) * secondsPerPercent));
          setEstimatedSecondsLeft(estimated);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [uploading, uploadPercentage, currentUploadIdx]);

  const handleAddMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setPendingMedia({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
      });
      setShowCaptionInput(true);
    }
  };

  const handleSaveCaption = () => {
    if (pendingMedia) {
      setMedia((prev) => [
        ...prev,
        { ...pendingMedia, caption: captionDraft },
      ]);
      setCaptionDraft('');
      setPendingMedia(null);
      setShowCaptionInput(false);
    }
  };

  const handleSubmit = async () => {
    if (media.length === 0) {
      Alert.alert(i18n.t('error') || 'Error', i18n.t('pleaseAddMedia') || 'Please add at least one media item');
      return;
    }

    setUploading(true);
    setUploadPercentage(0);
    setElapsedSeconds(0);
    setEstimatedSecondsLeft(0);
    uploadStartTime.current = Date.now();
    const uploadResults: Array<{ success: boolean; error?: string }> = [];

    try {
      // Upload each media item sequentially
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        setCurrentUploadIdx(i);
        setUploadProgress((prev) => ({ ...prev, [i]: true }));
        uploadStartTime.current = Date.now();
        setUploadPercentage(0);
        setElapsedSeconds(0);
        setEstimatedSecondsLeft(0);

        try {
          // Simulate progress updates (in real scenario, would come from upload event listeners)
          const uploadPromise = uploadAndSaveMedia(
            item.uri, 
            item.type as ResourceType, 
            'public',
            item.caption || '' // Pass the caption text
          );

          // Simulate linear progress while uploading
          const progressInterval = setInterval(() => {
            setUploadPercentage((prev) => {
              if (prev >= 95) {
                clearInterval(progressInterval);
                return 95; // Cap at 95% until complete
              }
              return prev + Math.random() * 15; // Random increments
            });
          }, 200);

          await uploadPromise;
          clearInterval(progressInterval);
          setUploadPercentage(100);
          uploadResults.push({ success: true });
        } catch (error: any) {
          console.error(`Upload failed for item ${i}:`, error);
          uploadResults.push({ 
            success: false, 
            error: error.message || 'Upload failed' 
          });
        } finally {
          setUploadProgress((prev) => ({ ...prev, [i]: false }));
        }
      }

      const successCount = uploadResults.filter(r => r.success).length;
      const failCount = uploadResults.filter(r => !r.success).length;

      if (successCount > 0) {
        Alert.alert(
          i18n.t('success') || 'Success',
          `${successCount} media item(s) uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ''}`,
          [
            {
              text: 'OK',
              onPress: async () => {
                setMedia([]);
                try {
                  const role = await getCurrentUserRole();
                  const feedRoute = `/${role}-feed`;
                  router.replace(feedRoute as any);
                } catch (error) {
                  console.error('Error getting user role, redirecting to academy feed:', error);
                  router.replace('/academy-feed' as any);
                }
              },
            },
          ]
        );
      } else {
        const firstError = uploadResults.find((r) => !r.success)?.error;
        Alert.alert(
          i18n.t('error') || 'Error',
          firstError
            ? `All uploads failed. ${firstError}`
            : 'All uploads failed. Please try again.'
        );
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert(
        i18n.t('error') || 'Error',
        error.message || 'Failed to upload media. Please try again.'
      );
    } finally {
      setUploading(false);
      setCurrentUploadIdx(null);
      setUploadProgress({});
      setUploadPercentage(0);
    }
  };

  const handleRemoveMedia = (index: number) => {
    Alert.alert(
      i18n.t('removeMedia') || 'Remove Media',
      i18n.t('removeMediaConfirm') || 'Are you sure you want to remove this media?',
      [
        { text: i18n.t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: i18n.t('remove') || 'Remove',
          style: 'destructive',
          onPress: () => {
            setMedia(media.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{i18n.t('academyUploadMedia') || 'Upload Media'}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('shareYourContent') || 'Share your content with players and parents'}</Text>
            </View>
          </View>

          <HamburgerMenu />

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.mediaCard}>
              <Text style={styles.sectionTitle}>{i18n.t('mediaSection') || 'Media'}</Text>
              <View style={styles.mediaGrid}>
                {media.length === 0 ? (
                  <View style={styles.emptyMedia}>
                    <Ionicons name="images-outline" size={48} color="#999" />
                    <Text style={styles.placeholder}>{i18n.t('noMedia') || 'No media uploaded yet.'}</Text>
                  </View>
                ) : (
                  media.map((item, idx) => (
                    <View key={idx} style={styles.mediaThumb}>
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={() => handleRemoveMedia(idx)}
                      >
                        <Ionicons name="close-circle" size={24} color="#ff3b30" />
                      </TouchableOpacity>
                      {item.type === 'image' ? (
                        <Image source={{ uri: item.uri }} style={styles.mediaImg} />
                      ) : (
                        <View style={styles.videoThumb}>
                          <Ionicons name="play-circle" size={32} color="#fff" />
                        </View>
                      )}
                      {item.caption && (
                        <Text style={styles.captionText} numberOfLines={2}>{item.caption}</Text>
                      )}
                    </View>
                  ))
                )}
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={handleAddMedia} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addBtnText}> {i18n.t('add') || 'Add'}</Text>
              </TouchableOpacity>
            </View>

            {showCaptionInput && pendingMedia && (
              <View style={styles.captionCard}>
                <Text style={styles.captionLabel}>{i18n.t('caption') || 'Caption'}</Text>
                <View style={styles.previewContainer}>
                  {pendingMedia.type === 'image' ? (
                    <Image source={{ uri: pendingMedia.uri }} style={styles.previewImage} />
                  ) : (
                    <View style={styles.previewVideo}>
                      <Ionicons name="videocam" size={40} color="#fff" />
                    </View>
                  )}
                </View>
                <TextInput
                  style={styles.captionInput}
                  placeholder={i18n.t('caption') || 'Caption'}
                  value={captionDraft}
                  onChangeText={setCaptionDraft}
                  maxLength={100}
                  placeholderTextColor="#999"
                  multiline
                />
                <View style={styles.captionActions}>
                  <TouchableOpacity 
                    style={styles.cancelBtn} 
                    onPress={() => {
                      setShowCaptionInput(false);
                      setPendingMedia(null);
                      setCaptionDraft('');
                    }}
                  >
                    <Text style={styles.cancelBtnText}>{i18n.t('cancel') || 'Cancel'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCaption}>
                    <Text style={styles.saveBtnText}>{i18n.t('save') || 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {uploading && currentUploadIdx !== null && (
              <View style={styles.uploadStatusCard}>
                <Text style={styles.uploadStatusTitle}>Uploading {currentUploadIdx + 1} of {media.length}</Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${uploadPercentage}%` }]} />
                </View>
                <View style={styles.uploadStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Progress</Text>
                    <Text style={styles.statValue}>{Math.round(uploadPercentage)}%</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Elapsed</Text>
                    <Text style={styles.statValue}>{elapsedSeconds}s</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Estimated</Text>
                    <Text style={styles.statValue}>{estimatedSecondsLeft}s</Text>
                  </View>
                </View>
                <Text style={styles.uploadMessage}>Please do not close the app or go back during upload</Text>
              </View>
            )}

            {media.length > 0 && (
              <TouchableOpacity 
                style={[styles.submitBtn, uploading && styles.submitBtnDisabled]} 
                onPress={handleSubmit} 
                activeOpacity={0.8}
                disabled={uploading}
              >
                {uploading ? (
                  <View style={styles.uploadingContainer}>
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>{i18n.t('uploading') || 'Uploading...'}</Text>
                  </View>
                ) : (
                  <Text style={styles.submitBtnText}>{i18n.t('submit') || 'Submit'}</Text>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginLeft: -44, // Negative margin to center title while keeping menu button on left
    paddingHorizontal: 44, // Add padding to ensure title doesn't overlap with menu button
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  mediaCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  emptyMedia: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 40,
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  mediaThumb: {
    width: 100,
    marginBottom: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  mediaImg: {
    width: 100,
    height: 100,
    borderRadius: 12,
    resizeMode: 'cover',
    backgroundColor: '#f0f0f0',
  },
  videoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  captionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  captionLabel: {
    fontSize: 18,
    color: '#000',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: 150,
    height: 150,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  previewVideo: {
    width: 150,
    height: 150,
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f5f5f5',
    color: '#000',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  captionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
