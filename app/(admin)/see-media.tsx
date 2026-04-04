import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, getDocs, where, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isAdmin } from '../../services/ModerationService';

interface MediaItem {
  id: string;
  secureUrl: string;
  resourceType: 'image' | 'video';
  createdAt: any;
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  content?: string;
}

export default function AdminAllMediaScreen() {
  const router = useRouter();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullScreenMedia, setFullScreenMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);

  const handleDeleteMedia = (mediaId: string) => {
    Alert.alert(
      "Delete Media",
      "Are you sure you want to delete this media? It will be permanently removed from all feeds.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Delete from media collection
              await deleteDoc(doc(db, 'media', mediaId));

              // 2. Find and delete associated posts from feeds
              const postsRef = collection(db, 'posts');
              const postQuery = query(postsRef, where('mediaId', '==', mediaId));
              const postSnap = await getDocs(postQuery);

              if (!postSnap.empty) {
                const batch = writeBatch(db);
                postSnap.forEach((docSnap) => {
                  batch.delete(docSnap.ref);
                });
                await batch.commit();
              }

              Alert.alert("Success", "Media and associated posts deleted successfully.");
            } catch (error) {
              console.error("Error deleting media:", error);
              Alert.alert("Error", "Failed to delete media.");
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    // Verify admin access
    const checkAccess = async () => {
      const admin = await isAdmin();
      if (!admin) {
        Alert.alert('Access Denied', 'You must be an admin to access this screen.');
        router.back();
      }
    };
    checkAccess();

    // Query media across the entire platform
    const mediaRef = collection(db, 'media');
    const q = query(mediaRef);

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const rawMedia: any[] = [];
        snapshot.forEach((docSnap) => {
          rawMedia.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });

        // Sort by createdAt client-side (descending - newest first)
        rawMedia.sort((a, b) => {
          const aTime = a.createdAt?.toDate
            ? a.createdAt.toDate().getTime()
            : a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : 0;
          const bTime = b.createdAt?.toDate
            ? b.createdAt.toDate().getTime()
            : b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : 0;
          return bTime - aTime;
        });

        // Collect unique owner IDs
        const uniqueOwnerIds = Array.from(new Set(rawMedia.map((m) => m.ownerId).filter(Boolean)));
        const userMap: Record<string, any> = {};

        // Fetch user data for these owner IDs in parallel
        await Promise.all(
          uniqueOwnerIds.map(async (uid) => {
            try {
              const uDoc = await getDoc(doc(db, 'users', uid));
              if (uDoc.exists()) {
                userMap[uid] = uDoc.data();
              }
            } catch (err) {
              console.warn(`Failed to fetch user ${uid}:`, err);
            }
          })
        );

        // Map the final displayed list and also try to fetch captions from posts if available
        const postsRef = collection(db, 'posts');
        const finalMedia = await Promise.all(
          rawMedia.map(async (m) => {
            let uName = 'Unknown User';
            let uRole = 'Guest';

            if (m.ownerId && userMap[m.ownerId]) {
              const uData = userMap[m.ownerId];
              uName = uData.name || `${uData.firstName || ''} ${uData.lastName || ''}`.trim() || 'Unknown User';
              uRole = uData.role ? uData.role.charAt(0).toUpperCase() + uData.role.slice(1).toLowerCase() : 'Guest';
            }

            // Try resolving post content if possible
            let postContent = '';
            try {
              if (m.ownerId) {
                const postQuery = query(postsRef, where('mediaId', '==', m.id), where('ownerId', '==', m.ownerId));
                const postSnap = await getDocs(postQuery);
                if (!postSnap.empty) {
                  postContent = postSnap.docs[0].data().content || '';
                }
              }
            } catch (err) {}

            return {
              ...m,
              ownerName: uName,
              ownerRole: uRole,
              content: postContent,
            } as MediaItem;
          })
        );

        setMediaList(finalMedia);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching all media:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading all user media...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#000000', '#1a1a1a', '#2d2d2d']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>All Platform Media</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {mediaList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>No media uploaded across the platform yet.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Total Uploaded Media ({mediaList.length})</Text>
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
                      <Image source={{ uri: media.secureUrl }} style={styles.mediaThumbnail} />
                    ) : (
                      <View style={styles.videoThumbnail}>
                        <Ionicons name="videocam" size={32} color="#fff" />
                        <Text style={styles.videoLabel}>Video</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.mediaInfo}>
                    <Text style={styles.uploaderText}>
                      {media.ownerName} <Text style={styles.roleText}>({media.ownerRole})</Text>
                    </Text>
                    {media.content ? (
                      <Text style={styles.mediaCaption} numberOfLines={2}>
                        {media.content}
                      </Text>
                    ) : null}
                    <Text style={styles.mediaDate}>
                      {media.createdAt?.toDate
                        ? media.createdAt.toDate().toLocaleDateString()
                        : 'Unknown date'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={{ marginRight: 16 }}
                      onPress={() =>
                        setFullScreenMedia({
                          uri: media.secureUrl,
                          type: media.resourceType,
                        })
                      }
                    >
                      <Ionicons name="eye-outline" size={24} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteMedia(media.id)}>
                      <Ionicons name="trash-outline" size={24} color="#ff3b30" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* Full Screen Media Viewer */}
        <Modal
          visible={!!fullScreenMedia}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setFullScreenMedia(null)}
          statusBarTranslucent={true}
        >
          <View style={styles.fullScreenContainer}>
            <TouchableOpacity style={styles.fullScreenCloseButton} onPress={() => setFullScreenMedia(null)} activeOpacity={0.7}>
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
                  <Image source={{ uri: fullScreenMedia.uri }} style={styles.fullScreenImage} resizeMode="contain" />
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
    fontSize: 22,
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
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
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
    width: 90,
    height: 90,
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
  uploaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  roleText: {
    fontWeight: 'normal',
    color: '#bbb',
    fontSize: 14,
  },
  mediaCaption: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 4,
  },
  mediaDate: {
    fontSize: 12,
    color: '#888',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
