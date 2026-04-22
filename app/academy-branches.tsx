import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';
import { auth, db } from '../lib/firebase';
import FootballLoader from '../components/FootballLoader';

type BranchRecord = {
  id: string;
  name?: string;
  city?: string;
  district?: string;
  address?: string;
  phone?: string;
  mapUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export default function AcademyBranchesScreen() {
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error(i18n.t('error') || 'Not authenticated');
      const academySnap = await getDoc(doc(db, 'academies', uid));
      const data = academySnap.exists() ? academySnap.data() : {};
      const locations = Array.isArray(data.locations) ? data.locations : [];
      const normalized = locations.map((location: any, index: number) => ({
        id: String(location.id || `branch-${index}`),
        name: String(location.name || (index === 0 ? i18n.t('mainLocationLabel') || 'Main branch' : `${i18n.t('locationLabel') || 'Branch'} ${index + 1}`)),
        city: String(location.city || ''),
        district: String(location.district || ''),
        address: String(location.address || ''),
        phone: String(location.phone || data.phone || ''),
        mapUrl: location.mapUrl || null,
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null,
      }));
      setBranches(normalized);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBranches();
    }, [fetchBranches])
  );

  const getName = (branch: BranchRecord) => branch.name || (i18n.t('branchName') || 'Branch');
  const getLocationLine = (branch: BranchRecord) =>
    [branch.city, branch.district, branch.address].filter(Boolean).join(' - ');
  const renderBranchField = (label: string, value?: string | number | null) => {
    if (value === null || value === undefined || String(value).trim().length === 0) return null;
    return (
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{String(value)}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <FootballLoader size="large" color="#111" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/academy-edit-profile' as any))}>
          <Ionicons name="chevron-back" size={20} color="#111827" />
          <Text style={styles.backButtonText}>{i18n.t('back') || 'Back'}</Text>
        </TouchableOpacity>
        <View style={styles.heroCard}>
          <Text style={styles.title}>{i18n.t('academyBranches') || 'Academy Branches'}</Text>
          <Text style={styles.subtitle}>{i18n.t('academyBranchesHint') || 'Manage all academy branches in one place.'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {branches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="business-outline" size={28} color="#9ca3af" />
            <Text style={styles.emptyText}>{i18n.t('noBranchesFound') || 'No branches found.'}</Text>
          </View>
        ) : (
          branches.map((branch) => (
            <View key={branch.id} style={styles.branchCard}>
              <View style={styles.branchHeader}>
                <Text style={styles.branchName}>{getName(branch)}</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => router.push({ pathname: '/academy-edit-branch', params: { branchId: branch.id } })}
                  >
                    <Ionicons name="create-outline" size={18} color="#111827" />
                  </TouchableOpacity>
                </View>
              </View>

              {renderBranchField(i18n.t('city') || 'City/Area', getLocationLine(branch))}
              {renderBranchField(i18n.t('phone') || 'Phone', branch.phone)}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/academy-edit-branch')}>
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.addButtonText}>{i18n.t('addNewBranch') || 'Add New Branch'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  backButtonText: { color: '#111827', fontSize: 14, fontWeight: '700' },
  heroCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 6, fontSize: 14, color: '#6b7280' },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 12 },
  branchCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  branchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  branchName: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, paddingRight: 10 },
  actionRow: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  fieldRow: { marginTop: 6 },
  fieldLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2, fontWeight: '600' },
  fieldValue: { fontSize: 14, color: '#111827', lineHeight: 20 },
  emptyCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  emptyText: { marginTop: 10, color: '#6b7280' },
  addButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    backgroundColor: '#111827',
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
