import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import i18n from '../locales/i18n';
import { auth, db } from '../lib/firebase';

export default function AccountSuspendedScreen() {
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const loadReason = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data?.suspensionReason) setReason(data.suspensionReason);
        }
      } catch {
        // ignore
      }
    };
    loadReason();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // continue
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="ban" size={64} color="#FF3B30" />
        <Text style={styles.title}>{i18n.t('accountSuspended') || 'Account suspended'}</Text>
        <Text style={styles.message}>
          {i18n.t('accountSuspendedMessage') || 'Your account has been suspended due to a violation of our community guidelines.'}
        </Text>
        {reason && (
          <Text style={styles.reason}>
            {i18n.t('reason') || 'Reason'}: {reason}
          </Text>
        )}
        <Text style={styles.contact}>
          {i18n.t('accountSuspendedContact') || 'If you believe this is an error, please contact support.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>{i18n.t('logout') || 'Log out'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 20,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  reason: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  contact: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  button: {
    marginTop: 28,
    backgroundColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
