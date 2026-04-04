import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Agent type definition (should match backend and agent-search)
type Agent = {
  id: string;
  name: string;
  city: string;
  description: string;
  profilePic?: string;
};


import i18n from '../locales/i18n';
// Get city labels for translation
const cityLabels = i18n.t('cities', { returnObjects: true }) as Record<string, string>;

export default function AgentDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchAgent = async () => {
    setLoading(true);
      try {
        const agentDoc = await getDoc(doc(db, 'agents', id as string));
        if (!agentDoc.exists()) {
          throw new Error('Agent not found');
        }
        const data = agentDoc.data();
        setAgent({
          id: agentDoc.id,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          city: data.city || '',
          description: data.description || '',
          profilePic: data.profilePhoto || '',
        });
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgent();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}><ActivityIndicator size="large" color="#007aff" /></View>
    );
  }
  if (error || !agent) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#bbb" />
        <Text style={{ color: '#888', marginTop: 8 }}>{i18n.t('noResults') || 'Agent not found.'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{i18n.t('goBack') || 'Go Back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color="#007aff" />
        <Text style={styles.backBtnText}>{i18n.t('back') || 'Back'}</Text>
      </TouchableOpacity>
      <View style={styles.header}>
        {agent.profilePic ? (
          <Image source={{ uri: agent.profilePic }} style={styles.profilePic} />
        ) : (
          <Ionicons name="person-circle-outline" size={80} color="#007aff" />
        )}
        <Text style={styles.name}>{agent.name}</Text>
        <Text style={styles.city}>{cityLabels[agent.city] || agent.city}</Text>
      </View>
      <Text style={styles.sectionTitle}>{i18n.t('description') || 'Description'}</Text>
      <Text style={styles.description}>{agent.description}</Text>
      {/* Add more agent details here as needed */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: { alignItems: 'center', marginBottom: 24 },
  profilePic: { width: 80, height: 80, borderRadius: 40, marginBottom: 12, backgroundColor: '#eee', borderWidth: 1, borderColor: '#fff' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#222', marginBottom: 4 },
  city: { fontSize: 16, color: '#666', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 6, color: '#222' },
  description: { fontSize: 16, color: '#444', marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backBtnText: { color: '#007aff', fontSize: 16, marginLeft: 6, fontWeight: 'bold' },
});
