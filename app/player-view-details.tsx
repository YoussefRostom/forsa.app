import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Animated, Dimensions, Easing, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const mockPlayer = {
  name: 'John Doe',
  age: 24,
  team: 'Dream FC',
  bio: 'A talented midfielder with a passion for the game.',
  avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
  posts: [
    { id: 1, type: 'image', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', caption: 'Training hard!' },
    { id: 2, type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', caption: 'Match highlights' },
    { id: 3, type: 'image', url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b', caption: 'Victory!' },
  ],
};

const PlayerViewDetails = ({ player = mockPlayer }) => {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
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
        <Image source={{ uri: player.avatarUrl }} style={styles.avatar} />
              <View style={styles.playerInfo}>
          <Text style={styles.name}>{player.name}</Text>
          <Text style={styles.team}>{player.team}</Text>
                <View style={styles.ageContainer}>
                  <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.7)" />
          <Text style={styles.age}>Age: {player.age}</Text>
        </View>
      </View>
            </View>
          </View>

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Bio Card */}
            <View style={styles.formCard}>
              <View style={styles.bioSection}>
                <Ionicons name="document-text-outline" size={24} color="#000" />
                <Text style={styles.bioTitle}>About</Text>
              </View>
      <Text style={styles.bio}>{player.bio}</Text>
            </View>

            {/* Posts Section */}
            <View style={styles.postsHeader}>
      <Text style={styles.sectionTitle}>Posts</Text>
            </View>

            {player.posts.map((item) => (
              <View key={item.id} style={styles.postCard}>
            {item.type === 'image' ? (
              <Image source={{ uri: item.url }} style={styles.postMedia} />
            ) : (
                  <View style={styles.videoContainer}>
                    <Ionicons name="play-circle" size={64} color="rgba(0,0,0,0.3)" />
                    <Text style={styles.videoLabel}>Video</Text>
                  </View>
            )}
            <Text style={styles.caption}>{item.caption}</Text>
          </View>
            ))}
    </ScrollView>
        </Animated.View>
      </LinearGradient>
  </View>
);
};

export default PlayerViewDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginRight: 18,
    borderWidth: 4,
    borderColor: '#fff',
  },
  playerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  team: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  ageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  age: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  bioSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  bioTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  bio: {
    fontSize: 16,
    color: '#222',
    lineHeight: 24,
  },
  postsHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  postMedia: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  videoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  videoLabel: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  caption: {
    fontSize: 16,
    color: '#222',
    lineHeight: 22,
  },
});
