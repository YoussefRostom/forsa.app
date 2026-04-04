// app/WelcomeScreen.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  I18nManager,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import i18n from '../locales/i18n';

const WelcomeScreen = () => {
  const router = useRouter();
  const [showLangMenu, setShowLangMenu] = React.useState(false);
  const [lang, setLang] = React.useState(i18n.locale);

  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem('appLang');
      if (lang) {
        i18n.locale = lang;
        setLang(lang);
        // Set RTL state based on saved language
        const isRTL = lang === 'ar';
        I18nManager.forceRTL(isRTL);
        I18nManager.swapLeftAndRightInRTL(isRTL);
      } else {
        // Default to LTR
        I18nManager.forceRTL(false);
        I18nManager.swapLeftAndRightInRTL(false);
      }
    };
    loadLang();
  }, []);

  const setLanguage = async (newLang: string) => {
    const isRTL = newLang === 'ar';
    i18n.locale = newLang;
    await AsyncStorage.setItem('appLang', newLang);
    setLang(newLang);
    
    // Force RTL/LTR change
    I18nManager.forceRTL(isRTL);
    I18nManager.swapLeftAndRightInRTL(isRTL);
    
    // Force re-render to update translation
    setTimeout(() => {
      router.replace('/WelcomeScreen');
    }, 100);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Image source={require('../assets/forsa-logo.png')} style={styles.logo} />
        <Text style={styles.title}>{i18n.t('welcome')}</Text>
        {/* Centered Sign Up / Sign In Buttons */}
        <View style={styles.centeredButtons}>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/role')}>
            <Text style={styles.buttonText}>{i18n.t('signUp')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonOutline} onPress={() => router.push('/signin')}>
            <Text style={styles.buttonOutlineText}>{i18n.t('signIn')}</Text>
          </TouchableOpacity>
        </View>

        {/* Spacer to push language switcher to bottom */}
        <View style={{ flex: 1 }} />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Language Switcher as Simple Row */}
        <View style={styles.langSwitchRow}>
          <TouchableOpacity onPress={() => setLanguage('en')} style={[styles.langSimpleBtn, lang === 'en' && styles.langActiveBtn]}>
            <Text style={[styles.langSimpleText, lang === 'en' && styles.langActiveText]}>English</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLanguage('ar')} style={[styles.langSimpleBtn, lang === 'ar' && styles.langActiveBtn]}>
            <Text style={[styles.langSimpleText, lang === 'ar' && styles.langActiveText]}>العربية</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f7f7f7',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 0,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 18,
    alignSelf: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 36,
    color: '#111',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#000',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 36,
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
    letterSpacing: 1,
  },
  buttonOutline: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 36,
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    elevation: 2,
  },
  buttonOutlineText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 20,
    letterSpacing: 1,
  },
  centeredButtons: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    marginBottom: 24,
  },
  langSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 30,
    marginTop: 36,
  },
  langSimpleBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    marginHorizontal: 4,
  },
  langActiveBtn: {
    backgroundColor: '#000',
  },
  langSimpleText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  langActiveText: {
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    width: '100%',
    marginTop: 30,
    marginBottom: 10,
  },
  // Fix input fields: backgroundColor: '#fff', color: '#111', placeholderTextColor: '#888'
  // Fix all label and text styles: color: '#111' or '#222'
});
