import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HamburgerMenu from './HamburgerMenu';

interface CurvedHeaderProps {
  title: string;
  menuVisible: boolean;
  setMenuVisible: (v: boolean) => void;
}

export default function CurvedHeader({ title, menuVisible, setMenuVisible }: CurvedHeaderProps) {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.curvedBar}>
        <Text style={styles.titleText}>{title}</Text>
        <TouchableOpacity style={styles.hamburger} onPress={() => setMenuVisible(true)}>
          <View style={styles.hamburgerBox}>
            <View style={styles.line} />
            <View style={styles.line} />
            <View style={styles.line} />
          </View>
        </TouchableOpacity>
        <HamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    width: '100%',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  curvedBar: {
    width: '100%',
    backgroundColor: '#000',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    // Lower the title bar by increasing top padding
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'relative',
  },
  titleText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
    flex: 1,
    zIndex: 1,
  },
  hamburger: {
    position: 'absolute',
    left: 18,
    top: Platform.OS === 'ios' ? 90 : 72,
    zIndex: 2,
  },
  hamburgerBox: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  line: {
    width: 28,
    height: 4,
    backgroundColor: '#000',
    marginVertical: 3,
    borderRadius: 2,
  },
});
