import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LanguageSelector({ style }: { style?: any }) {
  // Dummy language switcher for now
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity style={styles.langButton}>
        <Text style={styles.langText}>EN</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.langButton}>
        <Text style={styles.langText}>AR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  langButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#222',
    marginHorizontal: 8,
  },
  langText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
