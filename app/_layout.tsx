import { Slot } from 'expo-router';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from 'react-native-toast-notifications';
import { HamburgerMenuProvider } from '../components/HamburgerMenuContext';
import { AuthProvider } from '../context/AuthContext';

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <HamburgerMenuProvider>
          <ToastProvider>
            <Slot />
          </ToastProvider>
        </HamburgerMenuProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
