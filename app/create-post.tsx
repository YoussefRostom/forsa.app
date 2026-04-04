import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';
import { auth } from '../lib/firebase';
import { getCurrentUserRole, getVisibleToRoles } from '../services/UserRoleService';

export default function CreatePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ feedType?: string }>();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const feedType = (params?.feedType as 'player' | 'agent' | 'academy') || 'player';

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert(i18n.t('missingFields') || 'Missing fields', i18n.t('fillAllRequiredFields') || 'Fill all required fields');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(i18n.t('error') || 'Error', i18n.t('loginRequired') || 'You must be logged in');
      return;
    }
    setLoading(true);
    try {
      const { isUserSuspended } = await import('../services/ModerationService');
      const suspended = await isUserSuspended();
      if (suspended) {
        Alert.alert('Account Suspended', 'Your account has been suspended. You cannot create new posts.');
        setLoading(false);
        return;
      }

      const ownerRole = await getCurrentUserRole();
      const visibleToRoles = getVisibleToRoles(ownerRole);

      let author = user.displayName || 'User';
      try {
        const userDoc = await getDoc(doc(getFirestore(), 'users', user.uid));
        if (userDoc.exists()) {
          const d = userDoc.data();
          if (ownerRole === 'admin') {
            author = d?.name || d?.adminName || 'Admin';
          } else {
            author = d?.academyName || d?.agentName || d?.clinicName || d?.parentName || d?.name ||
              (d?.firstName && d?.lastName ? `${d.firstName} ${d.lastName}`.trim() : author);
          }
        }
      } catch {
        // use default author
      }

      const db = getFirestore();
      const postData = {
        ownerId: user.uid,
        ownerRole,
        visibleToRoles,
        author,
        content: content.trim(),
        contentText: content.trim(),
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        status: 'active',
        visibilityScope: 'role_based',
      };

      await addDoc(collection(db, 'posts'), postData);
      setContent('');
      Alert.alert(i18n.t('success') || 'Success', i18n.t('postCreated') || 'Post created', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      if (e.message?.includes?.('suspended')) {
        Alert.alert('Account Suspended', e.message);
      } else {
        Alert.alert(i18n.t('error') || 'Error', i18n.t('submissionError') || 'Submission failed');
      }
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/forsa-logo.png')} style={styles.logo} />
      <Text style={styles.header}>{i18n.t('createPost') || 'Create Post'}</Text>
      <TextInput
        style={styles.input}
        placeholder={i18n.t('postPlaceholder') || 'Write your post...'}
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={5}
      />
      <TouchableOpacity style={styles.button} onPress={handlePost} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? (i18n.t('loading') || 'Loading...') : (i18n.t('post') || 'Post')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  logo: { width: 60, height: 60, resizeMode: 'contain', alignSelf: 'center', marginTop: 18, marginBottom: 6, opacity: 0.22, tintColor: '#000' },
  header: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#000' },
  input: { borderWidth: 1, borderColor: '#000', borderRadius: 10, padding: 16, fontSize: 17, color: '#000', backgroundColor: '#fff', marginBottom: 20 },
  button: { backgroundColor: '#000', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});
