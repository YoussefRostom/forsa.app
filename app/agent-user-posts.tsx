import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, onSnapshot, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import React, { useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import PostActionsMenu from '../components/PostActionsMenu';
import i18n from '../locales/i18n';
import { db, auth } from '../lib/firebase';

// Helper function to get user profile data
async function getUserProfileData(userId: string, role: string) {
  try {
    const roleCollectionMap: { [key: string]: string } = {
      'player': 'players',
      'parent': 'parents',
      'academy': 'academies',
      'clinic': 'clinics',
      'agent': 'agents'
    };

    const collectionName = roleCollectionMap[role] || 'users';
    
    // Try role-specific collection first
    if (collectionName !== 'users') {
      const roleDocRef = doc(db, collectionName, userId);
      const roleDocSnap = await getDoc(roleDocRef);
      
      if (roleDocSnap.exists()) {
        return roleDocSnap.data();
      }
    }

    // Fallback to users collection
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      return userDocSnap.data();
    }

    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

function getAge(dob?: string): number | null {
  if (!dob) return null;
  const parts = dob.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[2], 10);
  if (isNaN(year)) return null;
  const now = new Date();
  return now.getFullYear() - year;
}

const getPositionLabel = (pos: string) => i18n.locale === 'ar' && i18n.t(`positions.${pos}`) ? i18n.t(`positions.${pos}`) : pos;
const getCityLabel = (cityKey: string) => cityKey ? (i18n.t(`cities.${cityKey}`) || cityKey) : '';

export default function AgentUserPostsScreen() {
  const router = useRouter();
  const { openMenu } = useHamburgerMenu();
  const params = useLocalSearchParams<{ ownerId: string; ownerRole: string; userName: string }>();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [fullScreenMedia, setFullScreenMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!params.ownerId) {
      setLoading(false);
      setLoadingProfile(false);
      return;
    }

    // Check if user is authenticated before setting up listener
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setLoadingProfile(false);
      setPosts([]);
      setProfileData(null);
      return;
    }

    // Fetch user profile data
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        // Check authentication again before fetching
        if (!auth.currentUser) {
          setProfileData(null);
          return;
        }
        const data = await getUserProfileData(params.ownerId, params.ownerRole || 'player');
        setProfileData(data);
      } catch (error) {
        // Only log error if user is still authenticated
        if (auth.currentUser) {
          console.error('Error fetching profile:', error);
        }
        setProfileData(null);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();

    // Fetch posts
    setLoading(true);
    const postsRef = collection(db, 'posts');
    
    // Query posts by ownerId only (without status filter to avoid composite index requirement)
    // We'll filter by status client-side
    const q = query(
      postsRef,
      where('ownerId', '==', params.ownerId),
      orderBy('timestamp', 'desc')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        // Check authentication before processing
        if (!auth.currentUser) {
          setPosts([]);
          setLoading(false);
          return;
        }
        
        const userPosts = querySnapshot.docs
          .map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          }))
          // Filter out deleted/inactive posts client-side
          .filter((post: any) => !post.status || post.status === 'active');
        setPosts(userPosts);
        setLoading(false);
      },
      (error) => {
        // Check if error is due to permissions (user logged out)
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          // Silently handle permission errors (user likely logged out)
          setPosts([]);
          setLoading(false);
          return;
        }
        console.error('Error fetching user posts:', error);
        setPosts([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [params.ownerId, params.ownerRole]);

  const roleLabel = params.ownerRole ? `(${params.ownerRole})` : '';
  const displayName = `${params.userName || 'User'}${roleLabel}`;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{displayName}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('allPosts') || 'All Posts'}</Text>
            </View>
          </View>

          {/* Profile Info Card (for players) */}
          {params.ownerRole === 'player' && profileData && (
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                {profileData.profilePhoto ? (
                  <Image source={{ uri: profileData.profilePhoto }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.profilePhotoPlaceholder}>
                    <Ionicons name="person" size={32} color="#999" />
                  </View>
                )}
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>
                    {profileData.firstName || ''} {profileData.lastName || ''}
                  </Text>
                  <View style={styles.profileDetails}>
                    {getAge(profileData.dob) && (
                      <>
                        <Text style={styles.profileDetail}>{i18n.t('age')}: {getAge(profileData.dob)}</Text>
                        <Text style={styles.profileDetail}> • </Text>
                      </>
                    )}
                    {profileData.position && (
                      <Text style={styles.profileDetail}>{getPositionLabel(profileData.position)}</Text>
                    )}
                  </View>
                  {profileData.city && (
                    <View style={styles.profileLocation}>
                      <Ionicons name="location" size={14} color="#666" />
                      <Text style={styles.profileCity}>{getCityLabel(profileData.city)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          <HamburgerMenu />

          {(loading || loadingProfile) ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>{i18n.t('loading') || 'Loading...'}</Text>
            </View>
          ) : (
            <FlatList
              data={posts}
              renderItem={({ item }: any) => {
                const timestamp = item.timestamp?.seconds 
                  ? new Date(item.timestamp.seconds * 1000) 
                  : item.createdAt?.seconds 
                    ? new Date(item.createdAt.seconds * 1000)
                    : null;

                return (
                  <View style={styles.feedCard}>
                    <View style={styles.feedHeader}>
                      <View style={styles.feedAuthorContainer}>
                        <Ionicons name="person-circle-outline" size={24} color="#000" />
                        <Text style={styles.feedAuthor}>{displayName}</Text>
                      </View>
                      <View style={styles.feedHeaderRight}>
                        {timestamp && (
                          <Text style={styles.feedTime}>
                            {timestamp.toLocaleDateString()}
                          </Text>
                        )}
                        <PostActionsMenu
                          postId={item.id}
                          postOwnerId={item.ownerId}
                          postOwnerRole={item.ownerRole}
                          mediaUrl={item.mediaUrl}
                          mediaType={item.mediaType}
                          contentText={item.content}
                          postTimestamp={item.timestamp || item.createdAt}
                        />
                      </View>
                    </View>
                    
                    {/* Media display */}
                    {item.mediaUrl && (
                      <View style={styles.mediaContainer}>
                        {item.mediaType === 'video' ? (
                          <Video
                            source={{ uri: item.mediaUrl }}
                            style={styles.mediaVideo}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            isLooping={false}
                          />
                        ) : (
                          <Image 
                            source={{ uri: item.mediaUrl }} 
                            style={styles.mediaImage}
                            resizeMode="cover"
                          />
                        )}
                        <TouchableOpacity
                          style={styles.fullScreenButton}
                          onPress={() => setFullScreenMedia({ uri: item.mediaUrl, type: item.mediaType === 'video' ? 'video' : 'image' })}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="expand" size={24} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    <Text style={styles.feedContent}>{item.content || ''}</Text>
                  </View>
                );
              }}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="newspaper-outline" size={64} color="#666" />
                  <Text style={styles.emptyText}>{i18n.t('noPosts') || 'No posts yet'}</Text>
                  <Text style={styles.emptySubtext}>{i18n.t('userHasNoPosts') || 'This user has not posted anything yet'}</Text>
                </View>
              }
            />
          )}
        </Animated.View>
      </LinearGradient>

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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
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
    marginLeft: -44,
    paddingHorizontal: 44,
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
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  feedCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  feedHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  feedAuthor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  feedContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginTop: 12,
  },
  feedTime: {
    fontSize: 12,
    color: '#999',
  },
  mediaContainer: {
    width: '100%',
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  mediaImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  mediaVideo: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    backgroundColor: '#f0f0f0',
  },
  profilePhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  profileDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileDetail: {
    fontSize: 14,
    color: '#666',
  },
  profileLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCity: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  fullScreenButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
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
    width: '100%',
    height: '100%',
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

