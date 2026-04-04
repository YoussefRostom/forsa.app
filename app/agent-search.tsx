// Agent type
type Agent = {
  id: string;
  name: string;
  city: string;
  description: string;
  profilePic?: string;
  phone?: string;
};
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import i18n from '../locales/i18n';
import * as CommonStyles from '../styles/CommonStyles';

// Backend fetch for agents
// const AGENT_API_URL = 'http://192.168.1.31:4000/api/agents';
// Use the same city list as academy search
const cityLabels = i18n.t('cities', { returnObjects: true }) as Record<string, string>;
const cities = [
  { key: '', label: i18n.t('cityPlaceholder') || 'City' },
  ...Object.entries(cityLabels).map(([key, label]) => ({ key, label }))
];

// Skeleton loader for agent card
function AgentCardSkeleton() {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.card, { opacity: pulseAnim, flexDirection: 'row', alignItems: 'center' }]}> 
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ddd', marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <View style={{ width: 120, height: 18, backgroundColor: '#e0e0e0', borderRadius: 8, marginBottom: 8 }} />
        <View style={{ width: 80, height: 14, backgroundColor: '#e0e0e0', borderRadius: 8, marginBottom: 6 }} />
        <View style={{ width: '80%', height: 14, backgroundColor: '#e0e0e0', borderRadius: 8 }} />
      </View>
    </Animated.View>
  );
}

export default function AgentSearchScreen() {
  const router = useRouter();
  const { openMenu } = useHamburgerMenu();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [results, setResults] = useState<Agent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const favoriteAnims = useRef(new Map<string, Animated.Value>()).current;
  const [modalAgent, setModalAgent] = useState<Agent | null>(null);
  const [remainingTexts, setRemainingTexts] = useState(2);

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true);
      try {
        const agentsRef = collection(db, 'agents');
        const querySnapshot = await getDocs(agentsRef);
        const agents = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim(),
          city: doc.data().city || '',
          description: doc.data().description || '',
          profilePic: doc.data().profilePhoto || '',
          phone: doc.data().phone || '',
          ...doc.data()
        })) as Agent[];
        setAllAgents(agents);
        setResults(agents);
      } catch (err) {
        console.error('❌ Failed to fetch agents:', err);
        setAllAgents([]);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
    // Load favorites from local storage
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('agentFavorites');
        if (stored) setFavorites(JSON.parse(stored));
      } catch {}
    })();
    // Load remaining texts for this month
    (async () => {
      try {
        const now = new Date();
        const key = `remainingAgentTexts_${now.getFullYear()}_${now.getMonth()}`;
        const stored = await AsyncStorage.getItem(key);
        setRemainingTexts(stored !== null ? parseInt(stored, 10) : 2);
      } catch {}
    })();
  }, []);

  const handleSearch = () => {
    let filtered = allAgents.filter(a =>
      (!search || a.name.toLowerCase().includes(search.toLowerCase())) &&
      (!city || a.city === city)
    );
    if (showFavoritesOnly) {
      filtered = filtered.filter(a => favorites.includes(a.id));
    }
    setResults(filtered);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCity('');
    setShowFavoritesOnly(false);
    setResults(allAgents);
  };

  const getFavoriteAnimation = (agentId: string) => {
    if (!favoriteAnims.has(agentId)) {
      favoriteAnims.set(agentId, new Animated.Value(1));
    }
    return favoriteAnims.get(agentId)!;
  };

  const toggleFavorite = async (agentId: string) => {
    const newFavorites = favorites.includes(agentId)
      ? favorites.filter((id) => id !== agentId)
      : [...favorites, agentId];
    setFavorites(newFavorites);
    await AsyncStorage.setItem('agentFavorites', JSON.stringify(newFavorites));
    const anim = getFavoriteAnimation(agentId);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.5, duration: 150, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <HamburgerMenu />
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.menuButton} onPress={openMenu} activeOpacity={0.8}>
          <View style={styles.menuButtonInner}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </View>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>{i18n.t('agentSearchTitle')}</Text>
        </View>
      </View>
      {/* Remove outer ScrollView, use FlatList for scrolling */}
      <FlatList
        ListHeaderComponent={
          <View style={{ backgroundColor: '#000', paddingBottom: 16, paddingHorizontal: 0 }}>
            <View style={styles.filtersContainer}>
              <TouchableOpacity
                style={styles.filterHeader}
                onPress={() => setDropdownOpen((prev) => !prev)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="filter" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.filterHeaderText}>{i18n.t('filters') || 'Filters'}</Text>
                </View>
                <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#000" />
              </TouchableOpacity>
              {dropdownOpen && (
                <View style={styles.filterDropdown}>
                  {/* Name search */}
                  <View style={styles.filterSection}>
                    <Text style={styles.filterLabel}>{i18n.t('agentNamePlaceholder') || 'Agent Name'}</Text>
                    <View style={styles.searchInputWrap}>
                      <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.pillInput}
                        placeholder={i18n.t('agentNamePlaceholder')}
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#888"
                        returnKeyType="search"
                        onSubmitEditing={handleSearch}
                      />
                    </View>
                  </View>
                  {/* City filter */}
                  <View style={styles.filterSection}>
                    <Text style={styles.filterLabel}>{i18n.t('city') || 'City'}</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={city}
                        onValueChange={setCity}
                        style={{ color: '#000', fontSize: 16 }}
                        mode="dropdown"
                      >
                        {cities.map((c) => (
                          <Picker.Item key={c.key} label={c.label} value={c.key} color="#000" />
                        ))}
                      </Picker>
                    </View>
                  </View>
                  {/* Favourites toggle */}
                  <View style={styles.filterSection}>
                    <TouchableOpacity
                      style={styles.favoriteToggle}
                      onPress={() => setShowFavoritesOnly(prev => !prev)}
                      activeOpacity={0.7}
                    >
                      <Animated.Text style={{ fontSize: 28, color: showFavoritesOnly ? '#ffd700' : '#aaa', marginRight: 8, transform: [{ scale: showFavoritesOnly ? 1.2 : 1 }] }}>
                        ★
                      </Animated.Text>
                      <Text style={styles.favoriteToggleText}>{i18n.t('showFavoritesOnly') || 'Show Favourites Only'}</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Search/Clear buttons */}
                  <View style={styles.filterActions}>
                    <TouchableOpacity 
                      style={[styles.searchBtn, styles.searchBtnPrimary]} 
                      onPress={() => { setDropdownOpen(false); handleSearch(); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.searchBtnText}>{i18n.t('search')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.searchBtn, styles.searchBtnSecondary]}
                      onPress={() => { handleClearFilters(); setDropdownOpen(false); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.searchBtnText}>{i18n.t('clearFilters') || 'Clear Filters'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        }
        data={results}
        keyExtractor={item => item.id}
        renderItem={loading ? undefined : ({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => setModalAgent(item)}
          >
      {/* Agent Modal */}
      <Modal
        visible={!!modalAgent}
        animationType="slide"
        transparent
        onRequestClose={() => setModalAgent(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          {modalAgent && (
            <View style={{ backgroundColor: '#000', borderRadius: 24, padding: 24, width: '85%', alignItems: 'center', shadowColor: '#fff', shadowOpacity: 0.2, shadowRadius: 16 }}>
              {modalAgent.profilePic ? (
                <Image source={{ uri: modalAgent.profilePic }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12, backgroundColor: '#eee', borderWidth: 1, borderColor: '#fff' }} />
              ) : (
                <Ionicons name="person-circle-outline" size={80} color="#fff" style={{ marginBottom: 12 }} />
              )}
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 4 }}>{modalAgent.name}</Text>
              <Text style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>{cityLabels[modalAgent.city] || modalAgent.city}</Text>
              <Text style={{ fontSize: 16, color: '#fff', marginBottom: 16 }}>{modalAgent.description}</Text>
              <Text style={{ color: '#fff', fontSize: 15, marginBottom: 10 }}>
                {i18n.t('remainingTexts', { count: remainingTexts }) || `You have ${remainingTexts} texts left this month.`}
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#fff', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 32, marginBottom: 12 }}
                onPress={async () => {
                  // Only allow if remaining texts > 0
                  if (remainingTexts > 0) {
                    // Decrement and save for this month immediately
                    const newCount = remainingTexts - 1;
                    try {
                      const now = new Date();
                      const key = `remainingAgentTexts_${now.getFullYear()}_${now.getMonth()}`;
                      await AsyncStorage.setItem(key, String(newCount));
                    } catch {}
                    setRemainingTexts(newCount);
                    setModalAgent(null);
                    router.push({ pathname: '/player-chat', params: { agentId: modalAgent.id, maxFreeMessages: 3 } });
                  } else {
                    Alert.alert(
                      i18n.t('paywallTitle') || 'Out of texts',
                      i18n.t('paywallMsg') || 'You have used your free texts for this month. Please pay to contact more agents.'
                    );
                  }
                }}
              >
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 18 }}>{i18n.t('text') || 'Text'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: '#fff', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 32 }}
                onPress={() => setModalAgent(null)}
              >
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 18 }}>{i18n.t('cancel') || 'Close'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
            <TouchableOpacity
              style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, padding: 8 }}
              onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
            >
              <Animated.Text style={{ fontSize: 28, color: favorites.includes(item.id) ? '#ffd700' : '#aaa', transform: [{ scale: getFavoriteAnimation(item.id) }] }}>
                ★
              </Animated.Text>
            </TouchableOpacity>
            <View style={styles.cardHeader}>
              {item.profilePic ? (
                <Image source={{ uri: item.profilePic }} style={{ width: 54, height: 54, borderRadius: 27, marginRight: 14, backgroundColor: '#eee', borderWidth: 1, borderColor: '#fff' }} />
              ) : (
                <Ionicons name="person-circle-outline" size={54} color="#fff" style={{ marginRight: 14 }} />
              )}
              <View>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardCity}>{cityLabels[item.city] || item.city}</Text>
              </View>
            </View>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 20 }}>
              <AgentCardSkeleton />
              <AgentCardSkeleton />
              <AgentCardSkeleton />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="alert-circle-outline" size={48} color="#bbb" style={{ marginBottom: 8 }} />
              <Text style={styles.empty}>{i18n.t('noResults')}</Text>
            </View>
          )
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40, backgroundColor: '#000', paddingTop: 8, paddingHorizontal: 0 }}
        style={{ marginTop: 0 }}
      />
      {/* Fixed Forsa Logo */}
      <Image source={require('../assets/forsa-logo.png')} style={styles.forsaLogo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 0 },
  headerContainer: {
    backgroundColor: '#000',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    zIndex: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    zIndex: 100,
  },
  menuButtonInner: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#000',
  },
  menuLine: {
    width: 28,
    height: 4,
    backgroundColor: '#000',
    marginVertical: 3,
    borderRadius: 2,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -44,
    paddingHorizontal: 44,
  },
  titleText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
  },
  headerWrap: {
    backgroundColor: '#222',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 10,
    paddingHorizontal: 0,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10,
  },
  hamburgerBox: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 8,
    flexDirection: 'column', // ensure vertical stacking
  },
  line: {
    width: 28,
    height: 4,
    backgroundColor: '#000',
    marginVertical: 3,
    borderRadius: 2,
    alignSelf: 'center', // ensure lines are centered
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignSelf: 'stretch',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  filterHeaderText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#000',
  },
  filterDropdown: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    width: '100%',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontWeight: '600',
    fontSize: 15,
    color: '#333',
    marginBottom: 10,
  },
  pickerContainer: {
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  favoriteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  favoriteToggleText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  filterRowSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    borderRadius: 28,
    paddingHorizontal: 10,
    minHeight: 44,
    marginRight: 0,
    marginBottom: 8,
    width: '100%',
  },
  pillInput: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 16,
    color: '#000',
    borderWidth: 0,
    marginBottom: 0,
    marginTop: 0,
    marginHorizontal: 0,
    textAlign: 'left',
  },
  searchBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchBtnPrimary: {
    backgroundColor: '#000',
  },
  searchBtnSecondary: {
    backgroundColor: '#e74c3c',
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 40,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#000', // Changed from white to black
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#fff', // Changed shadow to white for contrast
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#fff', // Changed border to white
  },
  cardTitle: { fontWeight: 'bold', fontSize: 18, color: '#fff', marginBottom: 2 },
  cardCity: { color: '#fff', fontSize: 14, marginBottom: 2 },
  cardDesc: { color: '#fff', fontSize: 15, marginTop: 4 },
  empty: { color: '#888', textAlign: 'center', marginTop: 40 },
  forsaLogo: {
    position: 'absolute',
    bottom: 18,
    left: '50%',
    transform: [{ translateX: -24 }],
    width: 48,
    height: 48,
    opacity: 0.22,
    tintColor: '#000',
    zIndex: 1,
  },
});
