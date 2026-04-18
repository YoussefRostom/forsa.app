// app/WelcomeScreen.tsx

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import i18n from '../locales/i18n';
import { switchLanguage } from '../lib/languageUtils';

const WelcomeScreen = () => {
  const router = useRouter();
  const [lang, setLang] = React.useState(i18n.locale);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem('appLang');
      if (lang) {
        i18n.locale = lang;
        setLang(lang);
      } else {
        setLang('en');
      }
    };

    loadLang();

    // Animate on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const setLanguage = async (newLang: string) => {
    setLang(newLang);
    // Use utility function to switch language
    // Note: On Android, RTL changes may require app restart
    await switchLanguage(newLang as 'en' | 'ar', false); // Don't force reload in dev
    // Reload the screen
    setTimeout(() => {
      router.replace('/welcome');
    }, 100);
  };

  return (
    <LinearGradient
      colors={['#000000', '#1a1a1a', '#2d2d2d']}
      style={styles.gradient}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={require('../assets/forsa-logo.png')} style={styles.logo} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{i18n.t('welcome')}</Text>
          <Text style={styles.subtitle}>
            {lang === "ar" ? "انضم إلى مجتمع الرياضة" : "Join the sports community"}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/role')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>{i18n.t('signUp')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/signin')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>{i18n.t('signIn')}</Text>
            </TouchableOpacity>
          </View>

          {/* Language Switcher */}
          <View style={styles.languageContainer}>
            <Text style={styles.languageLabel}>
            {lang === "ar" ? "اختر اللغة" : "Select Language"}
            </Text>
            <View style={styles.langSwitchRow}>
              <TouchableOpacity
                onPress={() => setLanguage('en')}
                style={[
                  styles.langButton,
                  lang === 'en' && styles.langButtonActive,
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={lang === 'en' ? '#fff' : '#666'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.langButtonText,
                    lang === 'en' && styles.langButtonTextActive,
                  ]}
                >
                  English
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLanguage('ar')}
                style={[
                  styles.langButton,
                  lang === 'ar' && styles.langButtonActive,
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={lang === 'ar' ? '#fff' : '#666'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.langButtonText,
                    lang === 'ar' && styles.langButtonTextActive,
                  ]}
                >
                  العربية
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    tintColor: '#fff',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 48,
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 360,
    marginBottom: 60,
  },
  primaryButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 16,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  languageContainer: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    marginTop: 'auto',
  },
  languageLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  langSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  langButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  langButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  langButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  langButtonTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },
});
