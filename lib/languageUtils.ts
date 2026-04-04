import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import i18n from '../locales/i18n';

/**
 * Switch app language and RTL/LTR direction
 * @param newLang - 'en' or 'ar'
 * @param forceReload - Whether to force app reload (default: true for RTL changes)
 */
export const switchLanguage = async (newLang: 'en' | 'ar', forceReload: boolean = true) => {
  try {
    const isRTL = newLang === 'ar';
    
    // Save language preference
    await AsyncStorage.setItem('appLang', newLang);
    
    // Update i18n locale
    i18n.locale = newLang;
    
    // Set RTL/LTR
    I18nManager.forceRTL(isRTL);
    I18nManager.swapLeftAndRightInRTL(isRTL);
    
    // On Android, RTL changes require app restart
    // On iOS, we can try to reload without restart
    if (forceReload) {
      if (Platform.OS === 'android') {
        // For Android, we need to restart the app
        // Try to use Updates.reloadAsync() if available
        try {
          if (__DEV__) {
            // In development, we can't use Updates.reloadAsync()
            // The user will need to manually restart
            console.warn('RTL changes require app restart. Please restart the app manually.');
          } else {
            // In production, reload the app
            await Updates.reloadAsync();
          }
        } catch (error) {
          console.error('Error reloading app:', error);
          // Fallback: just log a warning
          console.warn('RTL changes require app restart. Please restart the app manually.');
        }
      } else {
        // iOS - try to reload
        try {
          if (!__DEV__) {
            await Updates.reloadAsync();
          }
        } catch (error) {
          console.error('Error reloading app:', error);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error switching language:', error);
    return false;
  }
};

/**
 * Load saved language and set RTL state on app start
 */
export const initializeLanguage = async () => {
  try {
    const savedLang = await AsyncStorage.getItem('appLang');
    if (savedLang && (savedLang === 'en' || savedLang === 'ar')) {
      const isRTL = savedLang === 'ar';
      i18n.locale = savedLang;
      I18nManager.forceRTL(isRTL);
      I18nManager.swapLeftAndRightInRTL(isRTL);
      return savedLang;
    } else {
      // Default to English (LTR)
      i18n.locale = 'en';
      I18nManager.forceRTL(false);
      I18nManager.swapLeftAndRightInRTL(false);
      return 'en';
    }
  } catch (error) {
    console.error('Error initializing language:', error);
    // Default to English on error
    i18n.locale = 'en';
    I18nManager.forceRTL(false);
    I18nManager.swapLeftAndRightInRTL(false);
    return 'en';
  }
};

