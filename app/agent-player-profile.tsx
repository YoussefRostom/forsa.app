import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';

const getPositionLabel = (pos: string) => i18n.locale === 'ar' && i18n.t(`positions.${pos}`) ? i18n.t(`positions.${pos}`) : pos;
const getCityLabel = (cityKey: string) => cityKey ? (i18n.t(`cities.${cityKey}`) || cityKey) : '';
function getAge(dob?: string): number | null {
  if (!dob) return null;
  const parts = dob.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[2], 10);
  if (isNaN(year)) return null;
  const now = new Date();
  return now.getFullYear() - year;
}

export default function AgentPlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchPlayer = async () => {
      setLoading(true);
      try {
        if (id === 'dummy') {
          setPlayer({
            id: 'dummy',
            firstName: 'Ali',
            lastName: 'Hassan',
            dob: '15-04-2007',
            position: 'ST',
            city: 'cairo',
            pinnedVideo: 'https://www.w3schools.com/html/mov_bbb.mp4',
            videos: ['https://www.w3schools.com/html/mov_bbb.mp4'],
          });
          setVideos(['https://www.w3schools.com/html/mov_bbb.mp4']);
        } else {
          const db = getFirestore();
          // Try 'players' first, then fallback to 'users'
          let docSnap = await getDoc(doc(db, 'players', id));
          if (!docSnap.exists()) {
            docSnap = await getDoc(doc(db, 'users', id));
          }

          if (docSnap.exists()) {
            const data = docSnap.data();
            setPlayer({ id, ...data });
            // Assume videos are in a 'videos' array or fallback to pinnedVideo or highlightVideo
            setVideos(data.videos ||
              (data.pinnedVideo ? [data.pinnedVideo] :
                (data.highlightVideo ? [data.highlightVideo] : [])));
          } else {
            setPlayer(null);
            setVideos([]);
          }
        }
      } catch (e) {
        setPlayer(null);
        setVideos([]);
      }
      setLoading(false);
    };
    fetchPlayer();
  }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007aff" /></View>;
  if (!player) return <View style={styles.center}><Text>{i18n.t('playerNotFound') || 'Player not found'}</Text></View>;

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{i18n.t('playerProfile') || 'Player Profile'}</Text>
        </View>
      </View>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.name}>{player.firstName} {player.lastName}</Text>
        <Text style={styles.label}>{i18n.t('age') || 'Age'}: <Text style={styles.value}>{getAge(player.dob) || '-'}</Text></Text>
        <Text style={styles.label}>{i18n.t('position') || 'Position'}: <Text style={styles.value}>{getPositionLabel(player.position || '-')}</Text></Text>
        <Text style={styles.label}>{i18n.t('city') || 'City'}: <Text style={styles.value}>{getCityLabel(player.city || '-')}</Text></Text>
        <Text style={[styles.label, { marginTop: 18, marginBottom: 8 }]}>{i18n.t('videos') || 'Videos'}</Text>
        {videos.length === 0 && <Text style={{ color: '#888', marginBottom: 20 }}>{i18n.t('noVideos') || 'No videos available.'}</Text>}
        {videos.map((vid, idx) => (
          <View key={vid + idx} style={{ width: '100%', maxWidth: 400, marginBottom: 18 }}>
            <VideoWithNaturalSize uri={vid} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function VideoWithNaturalSize({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = React.useState(16 / 9);
  return (
    <Video
      source={{ uri }}
      style={{ width: '100%', maxWidth: 400, aspectRatio, borderRadius: 10, backgroundColor: '#222' }}
      resizeMode={ResizeMode.CONTAIN}
      useNativeControls={true}
      shouldPlay={false}
      isLooping={false}
      onLoad={status => {
        if (status.isLoaded && (status as any).naturalSize?.width && (status as any).naturalSize?.height) {
          const ns = (status as any).naturalSize;
          setAspectRatio(ns.width / ns.height);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginLeft: -44, // Negative margin to center title while keeping back button on left
    paddingHorizontal: 44, // Add padding to ensure title doesn't overlap with back button
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#181c2f',
    marginBottom: 10,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#555',
    marginBottom: 2,
    textAlign: 'center',
  },
  value: {
    color: '#111',
    fontWeight: 'bold',
  },
});
