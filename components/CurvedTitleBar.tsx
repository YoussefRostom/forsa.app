import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CurvedTitleBarProps {
  title: string;
  onHamburgerPress?: () => void;
  showHamburger?: boolean;
}

export default function CurvedTitleBar({ title, onHamburgerPress, showHamburger = false }: CurvedTitleBarProps) {
  return (
    <View style={styles.curvedBar}>
      {showHamburger && (
        <TouchableOpacity style={styles.hamburger} onPress={onHamburgerPress} accessibilityLabel="Open menu">
          <View style={styles.hamburgerBox}>
            <View style={styles.line} />
            <View style={styles.line} />
            <View style={styles.line} />
          </View>
        </TouchableOpacity>
      )}
      <Text style={styles.titleText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  curvedBar: {
    width: '100%',
    backgroundColor: '#000',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingTop: 36,
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
    top: 44,
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
