import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function PageTitle({ title }: { title: string }) {
  return (
    <View style={styles.titleBar}>
      <Text style={styles.titleText}>{title}</Text>
      <Text style={styles.forsaText}>FORSA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleBar: {
    backgroundColor: '#000',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
    marginBottom: 18,
    zIndex: 10,
    position: 'relative',
  },
  titleText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  forsaText: {
    position: 'absolute',
    right: 28,
    top: 68,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.38,
    letterSpacing: 2,
  },
});
