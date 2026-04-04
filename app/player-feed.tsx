import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, getFirestore, orderBy, query, where, getDocs } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import PostActionsMenu from '../components/PostActionsMenu';
import i18n from '../locales/i18n';
import { auth } from '../lib/firebase';

export default function PlayerFeedScreen() {
  const router = useRouter();
  const { openMenu } = useHamburgerMenu();
  const [feed, setFeed] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fullScreenMedia, setFullScreenMedia] = React.useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  const [playerPosts, setPlayerPosts] = React.useState<any[]>([]);
  const [academyPosts, setAcademyPosts] = React.useState<any[]>([]);
  const [adminPosts, setAdminPosts] = React.useState<any[]>([]);

  // Merge and sort: player's posts + all academy posts + admin posts (deduplicate by post ID)
  React.useEffect(() => {
    const active = (p: any) => !p.status || p.status === 'active';
    const getTs = (p: any) => p.timestamp?.seconds ?? p.createdAt?.seconds ?? 0;
    
    // Combine all arrays and deduplicate by post ID
    const allPosts = [...playerPosts.filter(active), ...academyPosts.filter(active), ...adminPosts.filter(active)];
    const uniquePostsMap = new Map<string, any>();
    
    // Use Map to ensure unique posts by ID (later posts override earlier ones)
    allPosts.forEach(post => {
      if (post.id) {
        uniquePostsMap.set(post.id, post);
      }
    });
    
    // Convert back to array and sort by timestamp
    const merged = Array.from(uniquePostsMap.values())
      .sort((a, b) => getTs(b) - getTs(a));
    setFeed(merged);
  }, [playerPosts, academyPosts, adminPosts]);

  React.useEffect(() => {
    setLoading(true);
    const user = auth.currentUser;
    if (!user) {
      setPlayerPosts([]);
      setAcademyPosts([]);
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const postsRef = collection(db, 'posts');

    // 1) Player's own posts
    const qPlayer = query(
      postsRef,
      where('ownerId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    // 2) All academy posts (every academy's posts shown to players)
    const qAcademy = query(
      postsRef,
      where('ownerRole', '==', 'academy'),
      orderBy('timestamp', 'desc')
    );

    // 3) Admin posts (visible to all users)
    // Query only by ownerRole to avoid composite index requirement
    // Filter by status and sort client-side
    const qAdmin = query(
      postsRef,
      where('ownerRole', '==', 'admin')
    );

    const unsubPlayer = onSnapshot(
      qPlayer,
      (snap) => {
        const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPlayerPosts(posts);
      },
      (err: any) => {
        if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
          setPlayerPosts([]);
          return;
        }
        console.error('Player feed (own) error:', err);
        setPlayerPosts([]);
      }
    );

    const unsubAcademy = onSnapshot(
      qAcademy,
      (snap) => {
        const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAcademyPosts(posts);
      },
      async (err: any) => {
        console.warn('Player feed (academy) index may be missing, falling back:', err?.message);
        try {
          const fallback = query(postsRef, where('ownerRole', '==', 'academy'));
          const snap = await getDocs(fallback);
          const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const getTs = (p: any) => p.timestamp?.seconds ?? p.createdAt?.seconds ?? 0;
          posts.sort((a, b) => getTs(b) - getTs(a));
          setAcademyPosts(posts);
        } catch (e) {
          setAcademyPosts([]);
        }
      }
    );

    const unsubAdmin = onSnapshot(
      qAdmin,
      (snap) => {
        // Filter by status and sort client-side to avoid composite index
        const posts = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((post: any) => !post.status || post.status === 'active')
          .sort((a: any, b: any) => {
            const getTs = (p: any) => p.timestamp?.seconds ?? p.createdAt?.seconds ?? 0;
            return getTs(b) - getTs(a);
          });
        setAdminPosts(posts);
      },
      async (err: any) => {
        console.error('Player feed (admin) error:', err?.message);
        setAdminPosts([]);
      }
    );

    // Stop loading after all queries have run at least once (use a short delay or count)
    const t = setTimeout(() => setLoading(false), 800);

    return () => {
      unsubPlayer();
      unsubAcademy();
      unsubAdmin();
      clearTimeout(t);
    };
  }, []);

  const renderFeedItem = (item: any) => {
    const timestamp = item.timestamp?.seconds 
      ? new Date(item.timestamp.seconds * 1000) 
      : item.createdAt?.seconds 
        ? new Date(item.createdAt.seconds * 1000)
        : null;

    return (
      <View key={item.id} style={styles.feedItem}>
        <View style={styles.feedHeader}>
          <View style={styles.feedAuthorContainer}>
            <Ionicons name="person-circle-outline" size={24} color="#000" />
            <Text 
              style={styles.feedAuthor}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.author || 'Anonymous'}
            </Text>
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
        
        {/* Content text */}
        {item.content && (
          <Text style={styles.feedContent}>{item.content}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
      <HamburgerMenu />
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{i18n.t('feed') || 'Feed'}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('latestUpdates') || 'Latest updates from the community'}</Text>
        </View>
      </View>

          {/* Feed Content */}
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
      {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>{i18n.t('loading') || 'Loading...'}</Text>
              </View>
            ) : feed.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.emptyText}>{i18n.t('noPosts') || 'No posts yet.'}</Text>
                <Text style={styles.emptySubtext}>{i18n.t('beFirstToPost') || 'Be the first to share something!'}</Text>
              </View>
            ) : (
              feed.map((item) => renderFeedItem(item))
            )}
          </ScrollView>
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
    </View>
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
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  feedItem: {
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
    flexShrink: 0,
  },
  feedAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 8,
  },
  feedAuthor: {
    fontWeight: 'bold',
    color: '#000',
    fontSize: 16,
    flexShrink: 1,
  },
  feedTime: {
    color: '#999',
    fontSize: 12,
  },
  feedContent: {
    fontSize: 16,
    color: '#222',
    lineHeight: 24,
    marginTop: 12,
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
