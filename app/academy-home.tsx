import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';
import AcademyHamburgerMenu from '../components/AcademyHamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';

// Dummy feed data (should be replaced with real API data)
const dummyFeed = [
  { id: '1', type: 'player', name: 'Mohamed Salah', content: 'Looking for a new academy!', avatar: require('../assets/forsa-logo.png') },
  { id: '2', type: 'agent', name: 'Agent Y', content: 'I have talented players available.', avatar: require('../assets/forsa-logo.png') },
];

export default function AcademyHomeScreen({ navigation }: any) {
  const { visible, openMenu, closeMenu } = useHamburgerMenu();

  return (
    <View style={styles.container}>
      <AcademyHamburgerMenu visible={visible} onClose={closeMenu} />
      {/* Title Bar with Hamburger */}
      <View style={styles.titleBar}>
        <TouchableOpacity style={styles.hamburgerBox} onPress={openMenu}>
          <View style={styles.line} />
          <View style={styles.line} />
          <View style={styles.line} />
        </TouchableOpacity>
        <Text style={styles.title}>{i18n.t('academyHomeTitle') || 'Academy Home'}</Text>
      </View>
      {/* Feed */}
      <FlatList
        data={dummyFeed}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 18 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Image source={item.avatar} style={styles.avatar} />
              <View>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardType}>{item.type === 'player' ? i18n.t('playerProfile') : i18n.t('agentName')}</Text>
              </View>
            </View>
            <Text style={styles.cardContent}>{item.content}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{i18n.t('noPosts')}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }, // White background
  titleBar: {
    backgroundColor: '#000',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10,
    position: 'relative',
  },
  hamburgerBox: {
    position: 'absolute',
    left: 12,
    top: 80,
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
    marginLeft: 12,
    marginRight: 18,
    flexDirection: 'column',
  },
  line: {
    width: 28,
    height: 4,
    backgroundColor: '#000', // Hamburger lines black
    marginVertical: 3,
    borderRadius: 2,
    alignSelf: 'center',
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 26,
    textAlign: 'center',
    flex: 1,
    zIndex: 1,
  },
  card: {
    backgroundColor: '#000', // Card black
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#fff', // White shadow for contrast
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#fff', // White border
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  cardName: { fontWeight: 'bold', fontSize: 18, color: '#fff', marginBottom: 2 }, // White text
  cardType: { color: '#fff', fontSize: 14, marginBottom: 2 }, // White text
  cardContent: { color: '#fff', fontSize: 15, marginTop: 4 }, // White text
  empty: { color: '#888', textAlign: 'center', marginTop: 40 },
});
