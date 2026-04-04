import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import i18n from '../../locales/i18n';
import { uploadAndSaveMedia, ResourceType } from '../../services/MediaService';
import { isAdmin } from '../../services/ModerationService';

export default function AdminUploadMediaScreen() {
  const router = useRouter();
  const [media, setMedia] = useState<Array<{ uri: string; type: 'image' | 'video'; caption?: string }>>([]);
  const [captionDraft, setCaptionDraft] = useState('');
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: number]: boolean }>({});

  React.useEffect(() => {
    // Verify admin access
    const checkAccess = async () => {
      const admin = await isAdmin();
      if (!admin) {
        Alert.alert('Access Denied', 'You must be an admin to access this screen.');
        router.back();
      }
    };
    checkAccess();
  }, []);

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

  const handleRemoveMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (media.length === 0) {
      Alert.alert(i18n.t('error') || 'Error', i18n.t('pleaseAddMedia') || 'Please add at least one media item');
      return;
    }

    setUploading(true);
    const uploadResults: Array<{ success: boolean; error?: string }> = [];

    try {
      // Upload each media item sequentially
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        setUploadProgress((prev) => ({ ...prev, [i]: true }));

        try {
          // Pass the caption/content along with the upload
          await uploadAndSaveMedia(
            item.uri, 
            item.type as ResourceType, 
            'public',
            item.caption || '' // Pass the caption text
          );
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
              onPress: () => {
                setMedia([]);
                router.back();
              },
            },
          ]
        );
      } else {
        Alert.alert(i18n.t('error') || 'Error', 'Failed to upload media. Please try again.');
      }
    } catch (error: any) {
      Alert.alert(i18n.t('error') || 'Error', error.message || 'An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Upload Media</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Ionicons name="information-circle" size={24} color="#4e73df" />
            <Text style={styles.instructionsText}>
              Upload media that will be visible to all users (players, agents, academies, clinics, and parents).
            </Text>
          </View>

          {/* Add Media Button */}
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={handleAddMedia}
            disabled={uploading}
          >
            <Ionicons name="add-circle-outline" size={32} color="#fff" />
            <Text style={styles.addButtonText}>Add Media</Text>
          </TouchableOpacity>

          {/* Caption Input Modal */}
          {showCaptionInput && pendingMedia && (
            <View style={styles.captionModal}>
              <View style={styles.captionCard}>
                <Text style={styles.captionTitle}>Add Caption</Text>
                {pendingMedia.type === 'image' ? (
                  <Image source={{ uri: pendingMedia.uri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.previewVideo}>
                    <Ionicons name="videocam" size={48} color="#fff" />
                    <Text style={styles.previewText}>Video Selected</Text>
                  </View>
                )}
                <TextInput
                  style={styles.captionInput}
                  placeholder="Enter caption (optional)"
                  placeholderTextColor="#999"
                  value={captionDraft}
                  onChangeText={setCaptionDraft}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.captionButtons}>
                  <TouchableOpacity 
                    style={[styles.captionBtn, styles.cancelBtn]} 
                    onPress={() => {
                      setPendingMedia(null);
                      setCaptionDraft('');
                      setShowCaptionInput(false);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.captionBtn, styles.saveBtn]} 
                    onPress={handleSaveCaption}
                  >
                    <Text style={styles.saveBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Media List */}
          {media.length > 0 && (
            <View style={styles.mediaList}>
              <Text style={styles.mediaListTitle}>Media to Upload ({media.length})</Text>
              {media.map((item, index) => (
                <View key={index} style={styles.mediaItem}>
                  <View style={styles.mediaPreview}>
                    {item.type === 'image' ? (
                      <Image source={{ uri: item.uri }} style={styles.mediaThumbnail} />
                    ) : (
                      <View style={styles.videoThumbnail}>
                        <Ionicons name="videocam" size={32} color="#fff" />
                      </View>
                    )}
                    {uploadProgress[index] && (
                      <View style={styles.uploadOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.mediaInfo}>
                    <Text style={styles.mediaType}>{item.type === 'image' ? 'Image' : 'Video'}</Text>
                    {item.caption && (
                      <Text style={styles.mediaCaption} numberOfLines={2}>
                        {item.caption}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => handleRemoveMedia(index)}
                    disabled={uploading}
                  >
                    <Ionicons name="close-circle" size={24} color="#e74a3b" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Submit Button */}
          {media.length > 0 && (
            <TouchableOpacity 
              style={[styles.submitButton, uploading && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={24} color="#fff" />
                  <Text style={styles.submitButtonText}>Upload Media</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  instructionsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(78, 115, 223, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  instructionsText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4e73df',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  captionModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  captionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  captionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  previewVideo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#2d2d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    marginTop: 8,
    fontSize: 16,
    color: '#fff',
  },
  captionInput: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  captionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  captionBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#444',
  },
  saveBtn: {
    backgroundColor: '#4e73df',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mediaList: {
    marginBottom: 24,
  },
  mediaListTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  mediaItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  mediaPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    position: 'relative',
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2d2d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaInfo: {
    flex: 1,
  },
  mediaType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  mediaCaption: {
    fontSize: 14,
    color: '#ccc',
  },
  removeButton: {
    padding: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1cc88a',
    borderRadius: 12,
    padding: 18,
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

