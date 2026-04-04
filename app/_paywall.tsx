import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';

export default function PaywallScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{i18n.t('paywallTitle') || 'Message Limit Reached'}</Text>
      <Text style={styles.desc}>{i18n.t('paywallMsg') || 'You have used your free messages for this agent. Please pay to continue.'}</Text>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeBtnText}>{i18n.t('close') || 'Close'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 18, textAlign: 'center' },
  desc: { color: '#fff', fontSize: 18, marginBottom: 32, textAlign: 'center' },
  closeBtn: { backgroundColor: '#fff', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 40 },
  closeBtnText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
});
