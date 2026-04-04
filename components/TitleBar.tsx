import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HamburgerMenu from './HamburgerMenu';

interface TitleBarProps {
  title: string;
  menuVisible: boolean;
  setMenuVisible: (v: boolean) => void;
}

export default function TitleBar({ title, menuVisible, setMenuVisible }: TitleBarProps) {
  return (
    <View style={styles.titleBar}>
      <TouchableOpacity style={styles.hamburger} onPress={() => setMenuVisible(true)}>
        <View style={styles.hamburgerBox}>
          <View style={styles.line} />
          <View style={styles.line} />
          <View style={styles.line} />
        </View>
      </TouchableOpacity>
      <Text style={styles.titleText}>{title}</Text>
      <HamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  titleBar: {
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    zIndex: 2,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    // Add shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  titleText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  hamburger: {
    position: 'absolute',
    left: 18,
    top: Platform.OS === 'ios' ? 54 : 36,
    zIndex: 20,
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
