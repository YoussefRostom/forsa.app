import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import i18n from '../locales/i18n';

const ForgotPasswordScreen = () => {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backCircle}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Text style={styles.backArrow}>{'←'}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{i18n.t('forgotPassword')}</Text>
      <Text style={styles.subtitle}>Password reset instructions will go here.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backCircle: {
    position: 'absolute',
    top: 48,
    left: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    elevation: 3,
  },
  backArrow: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginLeft: -2,
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
    marginTop: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 18,
  },
});

export default ForgotPasswordScreen;
