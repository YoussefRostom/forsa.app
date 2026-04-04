import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, getFirestore, query, where, doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import SimpleSelect from '../components/SimpleSelect';
import i18n from '../locales/i18n';
import { startConversationWithUser } from '../services/BookingMessagingService';
import { db } from '../lib/firebase';

// Define the Player type for type safety
interface Player {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  position?: string;
  city?: string;
  dob?: string; // keep for age calculation
  [key: string]: any;
}

const positions = ['GK', 'RB', 'LB', 'CB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
const cityKeys = [
  'cairo', 'alexandria', 'giza', 'shubraElKheima', 'portSaid', 'suez', 'luxor', 'asyut', 'ismailia', 'faiyum', 'zagazig', 'aswan', 'damietta', 'damanhur', 'minya', 'beniSuef', 'qena', 'sohag', 'hurghada', 'sixthOfOctober', 'newCairo'
];

function getAge(dob?: string): number | null {
  if (!dob) return null;
  // dob format: dd-mm-yyyy
  const parts = dob.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[2], 10);
  if (isNaN(year)) return null;
  const now = new Date();
  return now.getFullYear() - year;
}

const requiredFields = [
  { key: 'firstName', label: i18n.t('firstName') || 'First Name' },
  { key: 'lastName', label: i18n.t('lastName') || 'Last Name' },
  { key: 'position', label: i18n.t('position') || 'Position' },
  { key: 'city', label: i18n.t('city') || 'City' },
  { key: 'age', label: i18n.t('age') || 'Age' }, // changed from dob to age
];

const getPositionLabel = (pos: string) => i18n.locale === 'ar' && i18n.t(`positions.${pos}`) ? i18n.t(`positions.${pos}`) : pos;
const getCityLabel = (cityKey: string) => cityKey ? (i18n.t(`cities.${cityKey}`) || cityKey) : '';

export default function AgentPlayersScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [showPosition, setShowPosition] = useState(false);
  const [showCity, setShowCity] = useState(false);
  const [showAge, setShowAge] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const { openMenu } = useHamburgerMenu();
  const router = require('expo-router').useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        // Fetch from 'users' collection where role is 'player'
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('role', '==', 'player')
        );

        const querySnapshot = await getDocs(q);
        
        // Fetch detailed data from 'players' collection for each user
        const playersDataPromises = querySnapshot.docs.map(async (userDoc) => {
          const userData = userDoc.data();
          const userId = userDoc.id;
          
          // Try to get detailed data from 'players' collection
          try {
            const playerDocRef = doc(db, 'players', userId);
            const playerDocSnap = await getDoc(playerDocRef);
            
            if (playerDocSnap.exists()) {
              const playerData = playerDocSnap.data();
              return {
                id: userId,
                firstName: playerData.firstName || userData.firstName || '',
                lastName: playerData.lastName || userData.lastName || '',
                email: playerData.email || userData.email || '',
                position: playerData.position || userData.position || '',
                city: playerData.city || userData.city || '',
                dob: playerData.dob || userData.dob || '',
                profilePhoto: playerData.profilePhoto || userData.profilePhoto || null,
                pinnedVideo: playerData.pinnedVideo || playerData.highlightVideo || null,
                createdAt: playerData.createdAt || userData.createdAt || null,
              } as Player;
            }
          } catch (error) {
            console.error(`Error fetching player details for ${userId}:`, error);
          }
          
          // Fallback to user data if player doc doesn't exist
          return {
            id: userId,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: userData.email || '',
            position: userData.position || '',
            city: userData.city || '',
            dob: userData.dob || '',
            profilePhoto: userData.profilePhoto || null,
            pinnedVideo: userData.pinnedVideo || userData.highlightVideo || null,
            createdAt: userData.createdAt || null,
          } as Player;
        });

        const playersData = await Promise.all(playersDataPromises);

        // Sort in memory to avoid needing a composite index
        const sortedPlayers = playersData.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        setPlayers(sortedPlayers);
      } catch (e: any) {
        console.error('Error fetching players:', e);
        setPlayers([]);
      }
      setLoading(false);
    };
    fetchPlayers();
  }, []);

  // Filter logic - no dummy player
  const filteredPlayers = players.filter(p => {
    if (filters.firstName && !(`${p.firstName}`.toLowerCase().includes(filters.firstName.toLowerCase()))) return false;
    if (filters.lastName && !(`${p.lastName}`.toLowerCase().includes(filters.lastName.toLowerCase()))) return false;
    if (filters.position && p.position !== filters.position) return false;
    if (filters.city && p.city !== filters.city) return false;
    if (filters.age && getAge(p.dob) !== Number(filters.age)) return false;
    return true;
  });

  // Age options (10-30)
  const ageOptions = Array.from({ length: 21 }, (_, i) => (i + 10).toString());

  // Card press handler
  const handleCardPress = (player: Player) => {
    setSelectedPlayer(player);
    setShowProfile(true);
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
              <Text style={styles.headerTitle}>{i18n.t('agentPlayers') || 'Players'}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('findPlayers') || 'Find and connect with players'}</Text>
            </View>
          </View>

          <HamburgerMenu />
          {/* Player List */}
          <FlatList
            data={filteredPlayers}
            keyExtractor={item => item.id}
            ListHeaderComponent={
              <View style={styles.filterBox}>
                <Text style={styles.filterTitle}>{i18n.t('filterPlayers') || 'Filter Players'}</Text>
                <View style={styles.filterRow}>
                  <View style={styles.filterInputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#999" style={styles.filterIcon} />
                    <TextInput
                      style={styles.filterInput}
                      placeholder={i18n.t('firstName') || 'First Name'}
                      value={filters.firstName || ''}
                      onChangeText={val => setFilters(f => ({ ...f, firstName: val }))}
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
                <View style={styles.filterRow}>
                  <View style={styles.filterInputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#999" style={styles.filterIcon} />
                    <TextInput
                      style={styles.filterInput}
                      placeholder={i18n.t('lastName') || 'Last Name'}
                      value={filters.lastName || ''}
                      onChangeText={val => setFilters(f => ({ ...f, lastName: val }))}
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
                <View style={styles.filterRow}>
                  <TouchableOpacity style={styles.filterInputWrapper} onPress={() => setShowPosition(true)}>
                    <Ionicons name="football-outline" size={20} color="#999" style={styles.filterIcon} />
                    <Text style={[styles.filterText, !filters.position && styles.filterPlaceholder]}>
                      {filters.position ? getPositionLabel(filters.position) : i18n.t('position') || 'Position'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
                <View style={styles.filterRow}>
                  <TouchableOpacity style={styles.filterInputWrapper} onPress={() => setShowCity(true)}>
                    <Ionicons name="location-outline" size={20} color="#999" style={styles.filterIcon} />
                    <Text style={[styles.filterText, !filters.city && styles.filterPlaceholder]}>
                      {filters.city ? getCityLabel(filters.city) : i18n.t('city') || 'City'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
                <View style={styles.filterRow}>
                  <TouchableOpacity style={styles.filterInputWrapper} onPress={() => setShowAge(true)}>
                    <Ionicons name="calendar-outline" size={20} color="#999" style={styles.filterIcon} />
                    <Text style={[styles.filterText, !filters.age && styles.filterPlaceholder]}>
                      {filters.age || i18n.t('age') || 'Age'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
                <SimpleSelect
                  visible={showPosition}
                  options={positions}
                  selected={filters.position || ''}
                  onSelect={val => setFilters(f => ({ ...f, position: val }))}
                  onClose={() => setShowPosition(false)}
                  label={i18n.t('position') || 'Position'}
                  getLabel={getPositionLabel}
                />
                <SimpleSelect
                  visible={showCity}
                  options={cityKeys}
                  selected={filters.city || ''}
                  onSelect={val => setFilters(f => ({ ...f, city: val }))}
                  onClose={() => setShowCity(false)}
                  label={i18n.t('city') || 'City'}
                  getLabel={getCityLabel}
                />
                <SimpleSelect
                  visible={showAge}
                  options={ageOptions}
                  selected={filters.age || ''}
                  onSelect={val => setFilters(f => ({ ...f, age: val }))}
                  onClose={() => setShowAge(false)}
                  label={i18n.t('age') || 'Age'}
                />
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleCardPress(item)} activeOpacity={0.8}>
                <View style={styles.playerCard}>
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={() => { }}
                  >
                    <Ionicons name="star" size={24} color="#FFD700" />
                  </TouchableOpacity>
                  <View style={styles.playerHeader}>
                    {item.profilePhoto ? (
                      <Image source={{ uri: item.profilePhoto }} style={styles.playerPhoto} />
                    ) : (
                      <View style={styles.playerIcon}>
                        <Ionicons name="person" size={24} color="#000" />
                      </View>
                    )}
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{item.firstName} {item.lastName}</Text>
                      <View style={styles.playerDetails}>
                        <Text style={styles.playerDetail}>{i18n.t('age')}: {getAge(item.dob) || '-'}</Text>
                        <Text style={styles.playerDetail}> • </Text>
                        <Text style={styles.playerDetail}>{getPositionLabel(item.position || '-')}</Text>
                      </View>
                      <View style={styles.playerLocation}>
                        <Ionicons name="location" size={14} color="#666" />
                        <Text style={styles.playerCity}>{getCityLabel(item.city || '-')}</Text>
                      </View>
                    </View>
                  </View>
                  {item.pinnedVideo && (
                    <View style={styles.videoSection}>
                      <Text style={styles.videoLabel}>{i18n.t('pinnedVideo') || 'Video'}</Text>
                      <VideoWithNaturalSize uri={item.pinnedVideo} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.emptyText}>{i18n.t('loading') || 'Loading...'}</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={64} color="#666" />
                  <Text style={styles.emptyText}>{i18n.t('noPlayersFound') || 'No players found.'}</Text>
                </View>
              )
            }
            contentContainerStyle={styles.listContent}
          />
          {/* Modal for player profile */}
          {showProfile && selectedPlayer && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{selectedPlayer.firstName} {selectedPlayer.lastName}</Text>
                <View style={styles.modalInfo}>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalLabel}>{i18n.t('age') || 'Age'}</Text>
                    <Text style={styles.modalValue}>{getAge(selectedPlayer.dob) || '-'}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalLabel}>{i18n.t('position') || 'Position'}</Text>
                    <Text style={styles.modalValue}>{getPositionLabel(selectedPlayer.position || '-')}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalLabel}>{i18n.t('city') || 'City'}</Text>
                    <Text style={styles.modalValue}>{getCityLabel(selectedPlayer.city || '-')}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.modalButton} onPress={() => { 
                  setShowProfile(false); 
                  const playerName = `${selectedPlayer.firstName || ''} ${selectedPlayer.lastName || ''}`.trim() || 'Player';
                  router.push({ 
                    pathname: '/agent-user-posts', 
                    params: { 
                      ownerId: selectedPlayer.id,
                      ownerRole: 'player',
                      userName: playerName
                    } 
                  }); 
                }}>
                  <Text style={styles.modalButtonText}>{i18n.t('viewProfile') || 'View Profile'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={async () => {
                    try {
                      setShowProfile(false);
                      const conversationId = await startConversationWithUser(selectedPlayer.id);
                      router.push({
                        pathname: '/agent-messages',
                        params: {
                          conversationId,
                          otherUserId: selectedPlayer.id,
                          name: `${selectedPlayer.firstName} ${selectedPlayer.lastName}`.trim() || 'Player'
                        }
                      });
                    } catch (error: any) {
                      Alert.alert(i18n.t('error') || 'Error', error.message || 'Failed to start conversation');
                    }
                  }}
                >
                  <Text style={styles.modalButtonText}>{i18n.t('message') || 'Message'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]} onPress={() => setShowProfile(false)}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>{i18n.t('close') || 'Close'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// Helper component for natural video size
function VideoWithNaturalSize({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = React.useState(16 / 9);
  const { ResizeMode, Video } = require('expo-av');
  return (
    <Video
      source={{ uri }}
      style={{ width: 320, maxWidth: 400, aspectRatio, borderRadius: 10, backgroundColor: '#222' }}
      resizeMode={ResizeMode.CONTAIN}
      useNativeControls={true}
      shouldPlay={false}
      isLooping={false}
      onLoad={(status: any) => {
        if (status.isLoaded && status.naturalSize?.width && status.naturalSize?.height) {
          const ns = status.naturalSize;
          setAspectRatio(ns.width / ns.height);
        }
      }}
    />
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
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  filterBox: {
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
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f5f5f5',
    paddingHorizontal: 16,
    minHeight: 56,
  },
  filterIcon: {
    marginRight: 12,
  },
  filterInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 16,
  },
  filterText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 16,
  },
  filterPlaceholder: {
    color: '#999',
  },
  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    position: 'relative',
  },
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  playerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerDetail: {
    fontSize: 14,
    color: '#666',
  },
  playerLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerCity: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  videoSection: {
    marginTop: 12,
    alignItems: 'center',
  },
  videoLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInfo: {
    marginBottom: 20,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 15,
    color: '#666',
  },
  modalValue: {
    fontSize: 17,
    color: '#000',
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonSecondary: {
    backgroundColor: '#f5f5f5',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonTextSecondary: {
    color: '#666',
  },
});
