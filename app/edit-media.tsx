import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';

// Simple filter effect (for demo)
const FILTERS = [
  { key: 'none', label: i18n.t('none') || 'None', style: {} },
  { key: 'grayscale', label: i18n.t('grayscale') || 'Grayscale', style: { tintColor: '#888', opacity: 0.7 } },
  { key: 'sepia', label: i18n.t('sepia') || 'Sepia', style: { tintColor: '#a67c52', opacity: 0.7 } },
  { key: 'bright', label: i18n.t('bright') || 'Bright', style: { opacity: 1.2 } },
]; 
const EditMediaScreen = () => {
  const router = useRouter();
  const { uri: rawUri } = useLocalSearchParams();
  const uri = Array.isArray(rawUri) ? rawUri[0] : rawUri;
  const [selectedFilter, setSelectedFilter] = useState('none');

  const handleDone = () => {
    // TODO: To pass data back, use a global state, context, or event emitter. router.back() does not accept arguments.
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{i18n.t('editPhoto') || 'Edit Photo'}</Text>
      <View style={styles.imageBox}>
        <Image source={uri ? { uri } : undefined} style={[styles.image, selectedFilter !== 'none' ? FILTERS.find(f => f.key === selectedFilter)?.style : null]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} style={[styles.filterBtn, selectedFilter === f.key && styles.filterBtnActive]} onPress={() => setSelectedFilter(f.key)}>
            <Text style={{ color: selectedFilter === f.key ? '#fff' : '#111' }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{i18n.t('saveChanges') || 'Save Changes'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={{ color: '#111', fontWeight: 'bold', fontSize: 16 }}>{i18n.t('cancel') || 'Cancel'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 18, color: '#111' },
  imageBox: { width: 260, height: 260, borderRadius: 18, overflow: 'hidden', backgroundColor: '#eee', marginBottom: 18, alignItems: 'center', justifyContent: 'center' },
  image: { width: 260, height: 260, resizeMode: 'cover' },
  filtersRow: { flexDirection: 'row', marginBottom: 18 },
  filterBtn: { backgroundColor: '#eee', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18, marginRight: 10 },
  filterBtnActive: { backgroundColor: '#111' },
  doneBtn: { backgroundColor: '#111', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center', marginBottom: 10 },
  cancelBtn: { backgroundColor: '#eee', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 40, alignItems: 'center' },
});
export default EditMediaScreen;