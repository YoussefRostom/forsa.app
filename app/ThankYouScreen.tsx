import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import i18n from '../locales/i18n';

const ThankYouScreen = () => {
  return (
    <View style={styles.container}>
      <Image source={require('../assets/forsa-logo.png')} style={styles.logo} />
      <Text style={styles.title}>{i18n.t('thankYouTitle')}</Text>
      <Text style={styles.message}>{i18n.t('thankYouMessage')}</Text>
    </View>
  );
};

export default ThankYouScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f7f7f7', // reverted from black
  },
  logo: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
  },
});