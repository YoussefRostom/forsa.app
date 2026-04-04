import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { auth } from '../../lib/firebase';
import i18n from '../../locales/i18n';
import { isAdmin } from '../../services/ModerationService';
import { updateMediaCaption, deleteAdminMedia, type MediaDoc } from '../../services/MediaService';

export default function AdminMyMediaScreen() {
  const router = useRouter();
  const [mediaList, setMediaList] = useState<MediaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMedia, setEditingMedia] = useState<{ id: string; content: string; postId: string | null } | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);

  useEffect(() => {
    // Verify admin access
    const checkAccess = async () => {
      const admin = await isAdmin();
      if (!admin) {
        Alert.alert('Access Denied', 'You must be an admin to access this screen.');
        router.back();
        return;
      }
    };
    checkAccess();

    // Fetch admin's media
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const mediaRef = collection(db, 'media');
    
    // Query media where ownerId matches current user (admin)
    // Query without orderBy to avoid composite index requirement
    // Sort client-side instead
    const q = query(
      mediaRef,
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const media: MediaDoc[] = [];
        snapshot.forEach((doc) => {
          media.push({
            id: doc.id,
            ...doc.data(),
          } as MediaDoc);
        });

        // Sort by createdAt client-side (descending - newest first)
        media.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                       (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                       (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return bTime - aTime;
        });

        // Also fetch associated posts to get captions
        const postsRef = collection(db, 'posts');
        const postsWithMedia = await Promise.all(
          media.map(async (m) => {
            const postQuery = query(
              postsRef,
              where('mediaId', '==', m.id),
              where('ownerId', '==', user.uid)
            );
            const postSnap = await getDocs(postQuery);
            const post = postSnap.docs[0];
            return {
              ...m,
              postId: post?.id || null,
              content: post?.data()?.content || '',
            };
          })
        );

        setMediaList(postsWithMedia as any);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching media:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleEdit = (media: any) => {
    setEditingMedia({ id: media.id, content: media.content || '', postId: media.postId });
    setEditCaption(media.content || '');
  };

  const handleSaveEdit = async () => {
    if (!editingMedia) return;

    setSaving(true);
    try {
      await updateMediaCaption(editingMedia.id, editingMedia.postId, editCaption);
      setEditingMedia(null);
      setEditCaption('');
      Alert.alert('Success', 'Media caption updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update caption');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (media: any) => {
    Alert.alert(
      'Delete Media',
      'Are you sure you want to delete this media? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(media.id);
            try {
              await deleteAdminMedia(media.id, media.postId);
              Alert.alert('Success', 'Media deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete media');
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading media...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Media</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {mediaList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>No media uploaded yet</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => router.push('/(admin)/upload-media')}
              >
                <Text style={styles.uploadButtonText}>Upload Media</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                Your Uploaded Media ({mediaList.length})
              </Text>
              {mediaList.map((media) => (
                <View key={media.id} style={styles.mediaCard}>
                  <TouchableOpacity
                    style={styles.mediaPreview}
                    onPress={() =>
                      setFullScreenMedia({
                        uri: media.secureUrl,
                        type: media.resourceType,
                      })
                    }
                  >
                    {media.resourceType === 'image' ? (
                      <Image
                        source={{ uri: media.secureUrl }}
                        style={styles.mediaThumbnail}
                      />
                    ) : (
                      <View style={styles.videoThumbnail}>
                        <Ionicons name="videocam" size={32} color="#fff" />
                        <Text style={styles.videoLabel}>Video</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.mediaInfo}>
                    <Text style={styles.mediaType}>
                      {media.resourceType === 'image' ? 'Image' : 'Video'}
                    </Text>
                    {media.content && (
                      <Text style={styles.mediaCaption} numberOfLines={2}>
                        {media.content}
                      </Text>
                    )}
                    <Text style={styles.mediaDate}>
                      {media.createdAt?.toDate
                        ? media.createdAt.toDate().toLocaleDateString()
                        : 'Unknown date'}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEdit(media)}
                      disabled={deleting === media.id}
                    >
                      <Ionicons name="create-outline" size={20} color="#4e73df" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(media)}
                      disabled={deleting === media.id}
                    >
                      {deleting === media.id ? (
                        <ActivityIndicator size="small" color="#e74a3b" />
                      ) : (
                        <Ionicons name="trash-outline" size={20} color="#e74a3b" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* Edit Modal */}
        <Modal
          visible={!!editingMedia}
          transparent
          animationType="slide"
          onRequestClose={() => setEditingMedia(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Caption</Text>
              <TextInput
                style={styles.captionInput}
                placeholder="Enter caption"
                placeholderTextColor="#999"
                value={editCaption}
                onChangeText={setEditCaption}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setEditingMedia(null);
                    setEditCaption('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Full Screen Media Viewer */}
        <Modal
          visible={!!fullScreenMedia}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setFullScreenMedia(null)}
          statusBarTranslucent={true}
        >
          <View style={styles.fullScreenContainer}>
            <TouchableOpacity
              style={styles.fullScreenCloseButton}
              onPress={() => setFullScreenMedia(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            {fullScreenMedia && (
              <View style={styles.fullScreenContent}>
                {fullScreenMedia.type === 'video' ? (
                  <Video
                    source={{ uri: fullScreenMedia.uri }}
                    style={styles.fullScreenVideo}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    isLooping={false}
                  />
                ) : (
                  <Image
                    source={{ uri: fullScreenMedia.uri }}
                    style={styles.fullScreenImage}
                    resizeMode="contain"
                  />
                )}
              </View>
            )}
          </View>
        </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#999',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  uploadButton: {
    backgroundColor: '#4e73df',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  mediaCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  mediaPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
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
  videoLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
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
    marginBottom: 4,
  },
  mediaDate: {
    fontSize: 12,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(78, 115, 223, 0.2)',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(231, 74, 59, 0.2)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  captionInput: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  saveButton: {
    backgroundColor: '#4e73df',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
  },
});

