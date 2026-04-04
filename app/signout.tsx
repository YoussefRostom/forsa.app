import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function SignOutScreen() {
  const router = useRouter();

  React.useEffect(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              // Sign out from Firebase Auth first
              await signOut(auth);
              
              // Clear all user session data from AsyncStorage
              await AsyncStorage.removeItem('userSession');
              await AsyncStorage.removeItem('playerUser');
              await AsyncStorage.removeItem('agentUser');
              await AsyncStorage.removeItem('academyUser');
              await AsyncStorage.removeItem('clinicUser');
              await AsyncStorage.removeItem('parentUser');
              
              // Clear any additional session-related data
              await AsyncStorage.multiRemove([
                'appLang',
                'playerFavorites',
                'agentFavorites',
                'clinicFavorites',
                'academyFavorites',
              ]);
              
              // Navigate to splash screen (which will redirect to welcome since user is signed out)
              router.replace('/splash');
            } catch (error) {
              console.error('Error signing out:', error);
              // Still try to clear AsyncStorage and navigate even if Firebase sign out fails
              try {
                await AsyncStorage.removeItem('userSession');
                await AsyncStorage.removeItem('playerUser');
                await AsyncStorage.removeItem('agentUser');
                await AsyncStorage.removeItem('academyUser');
                await AsyncStorage.removeItem('clinicUser');
                await AsyncStorage.removeItem('parentUser');
              } catch (e) {
                console.error('Error clearing AsyncStorage:', e);
              }
              router.replace('/splash');
            }
          },
        },
      ]
    );
  }, [router]);

  return <View />;
}
