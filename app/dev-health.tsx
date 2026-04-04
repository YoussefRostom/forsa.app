import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { auth, db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function DevHealthScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const push = (s: string) => setLogs(l => [s, ...l].slice(0, 50));

  const checkFirebase = async () => {
    push('Checking Firebase connection...');
    try {
      // Check auth
      const user = auth.currentUser;
      push(`Auth: ${user ? `Logged in as ${user.email}` : 'Not logged in'}`);
      
      // Check Firestore
      const testRef = collection(db, 'users');
      const snapshot = await getDocs(testRef);
      push(`Firestore: Connected (${snapshot.size} users found)`);
    } catch (err) {
      push(`Firebase ERROR - ${String(err)}`);
    }
  };

  useEffect(() => {
    checkFirebase();
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>Firebase Health Check</Text>
      <Button title="Check Firebase" onPress={checkFirebase} />
      <View style={{ height: 18 }} />
      {logs.map((l, idx) => (
        <Text key={idx} style={{ fontFamily: 'monospace', marginBottom: 8 }}>{l}</Text>
      ))}
    </ScrollView>
  );
}
