import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';
import { auth, db } from '../lib/firebase';
import FootballLoader from '../components/FootballLoader';

const CURRENCY = 'EGP';
const AGE_OPTIONS = Array.from({ length: 16 }, (_, i) => String(i + 5));

const normalizeAgeValue = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (AGE_OPTIONS.includes(trimmed)) return trimmed;
  const match = trimmed.match(/\d+/);
  if (match && AGE_OPTIONS.includes(match[0])) return match[0];
  return '';
};

export default function AcademyEditPricesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ageGroups, setAgeGroups] = useState<{ age: string; price: string }[]>([]);
  const [newAge, setNewAge] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agePickerTarget, setAgePickerTarget] = useState<number | 'new' | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true);
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error(i18n.t('error') || 'Not signed in');
        const academyRef = doc(db, 'academies', uid);
        const academySnap = await getDoc(academyRef);
        if (!academySnap.exists()) {
          setAgeGroups([]);
          return;
        }
        const data = academySnap.data();
        const fees = data.fees || data.prices || {};
        const rows = Object.entries(fees).map(([age, price]) => ({
          age: normalizeAgeValue(String(age)),
          price: String(price),
        }));
        setAgeGroups(rows.filter((row) => row.age));
      } catch (e: any) {
        Alert.alert(i18n.t('error') || 'Error', e?.message || 'Failed to load prices');
        setAgeGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, []);

  const normalizedAges = useMemo(
    () => ageGroups.map((row) => row.age.trim().toLowerCase()).filter(Boolean),
    [ageGroups]
  );

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    ageGroups.forEach((row, index) => {
      const age = row.age.trim();
      const price = row.price.trim();
      if (!age) {
        nextErrors[`age-${index}`] = i18n.t('requiredField') || 'Required';
      } else if (!AGE_OPTIONS.includes(age)) {
        nextErrors[`age-${index}`] = i18n.t('selectAge') || 'Select age';
      }
      if (!price) {
        nextErrors[`price-${index}`] = i18n.t('requiredField') || 'Required';
      } else if (Number.isNaN(Number(price)) || Number(price) <= 0) {
        nextErrors[`price-${index}`] = i18n.t('priceInvalid') || 'Enter a valid price';
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      Alert.alert(i18n.t('error') || 'Error', i18n.t('fillAllRequiredFields') || 'Please fill in all required fields.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert(i18n.t('error') || 'Error', 'Not signed in');
      return;
    }

    setSaving(true);
    try {
      const safeUpdate = async (target: 'academies' | 'users', data: Record<string, any>) => {
        const ref = doc(db, target, uid);
        try {
          await updateDoc(ref, data);
        } catch {
          await setDoc(ref, data, { merge: true });
        }
      };
      const feesPayload: Record<string, number> = {};
      ageGroups.forEach((row) => {
        feesPayload[row.age.trim()] = Number(row.price);
      });

      const payload = {
        fees: feesPayload,
        prices: feesPayload,
        updatedAt: new Date().toISOString(),
      };
      await safeUpdate('academies', payload);
      await safeUpdate('users', payload);

      Alert.alert(i18n.t('success') || 'Success', i18n.t('profileUpdated') || 'Profile updated!');
      router.back();
    } catch (e: any) {
      Alert.alert(i18n.t('error') || 'Error', e?.message || (i18n.t('saveFailed') as string) || 'Failed to save prices.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAgeGroup = () => {
    const age = newAge.trim();
    if (!age) {
      setErrors((prev) => ({ ...prev, newAge: i18n.t('selectAge') || 'Select age' }));
      return;
    }
    if (normalizedAges.includes(age.toLowerCase())) {
      setErrors((prev) => ({ ...prev, newAge: i18n.t('ageGroupExists') || 'Age group already exists' }));
      return;
    }
    setAgeGroups((prev) => [...prev, { age, price: '' }]);
    setNewAge('');
    setErrors((prev) => ({ ...prev, newAge: '' }));
  };

  const handleRowChange = (index: number, field: 'age' | 'price', value: string) => {
    setAgeGroups((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)));
    setErrors((prev) => ({ ...prev, [`${field}-${index}`]: '' }));
  };
  const handleAgeSelect = (age: string) => {
    if (agePickerTarget === null) return;
    if (agePickerTarget === 'new') {
      setNewAge(age);
      setErrors((prev) => ({ ...prev, newAge: '' }));
    } else {
      setAgeGroups((prev) => prev.map((row, idx) => (idx === agePickerTarget ? { ...row, age } : row)));
      setErrors((prev) => ({ ...prev, [`age-${agePickerTarget}`]: '' }));
    }
    setAgePickerTarget(null);
  };

  const handleRemove = (index: number) => {
    setAgeGroups((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f3f4f6' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/academy-edit-profile' as any))}>
          <Ionicons name="chevron-back" size={20} color="#111827" />
          <Text style={styles.backButtonText}>{i18n.t('back') || 'Back'}</Text>
        </TouchableOpacity>
        <View style={styles.heroCard}>
          <Text style={styles.title}>{i18n.t('editPrices') || 'Edit Prices'}</Text>
          <Text style={styles.subtitle}>{i18n.t('setPricesForEachAgeGroup') || 'Set the price for each age group below.'}</Text>
          <Text style={styles.helperTag}>{i18n.t('monthlyFeeCaption') || 'EGP / month'}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <FootballLoader color="#111827" />
            <Text style={styles.loadingText}>{i18n.t('loading') || 'Loading...'}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>{i18n.t('feesPerAgeGroup') || 'Fees per age group'}</Text>
            {ageGroups.map((row, idx) => (
              <View key={`${row.age}-${idx}`} style={styles.card}>
                <View style={styles.rowTop}>
                  <TouchableOpacity style={[styles.input, styles.ageInput, styles.selectInput, errors[`age-${idx}`] ? styles.inputError : null]} onPress={() => setAgePickerTarget(idx)}>
                    <Text style={row.age ? styles.selectText : styles.selectPlaceholder}>{row.age || (i18n.t('selectAge') || 'Select Age')}</Text>
                    <Ionicons name="chevron-down" size={16} color="#6b7280" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemove(idx)} style={styles.removeBtn}>
                    <Ionicons name="trash-outline" size={18} color="#b91c1c" />
                  </TouchableOpacity>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.priceInput, errors[`price-${idx}`] ? styles.inputError : null]}
                    value={row.price}
                    onChangeText={(value) => handleRowChange(idx, 'price', value.replace(/[^0-9.]/g, ''))}
                    placeholder={i18n.t('feePlaceholder') || 'Fee'}
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                  />
                  <Text style={styles.currency}>{CURRENCY}</Text>
                </View>
                {(errors[`age-${idx}`] || errors[`price-${idx}`]) ? <Text style={styles.errorText}>{errors[`age-${idx}`] || errors[`price-${idx}`]}</Text> : null}
              </View>
            ))}

            <View style={styles.addCard}>
              <Text style={styles.sectionLabel}>{i18n.t('addAgeGroup') || 'Add Age Group'}</Text>
              <Text style={styles.addTitle}>{i18n.t('addAgeGroup') || 'Add Age Group'}</Text>
              <View style={styles.rowTop}>
                <TouchableOpacity style={[styles.input, styles.ageInput, styles.selectInput, errors.newAge ? styles.inputError : null]} onPress={() => setAgePickerTarget('new')}>
                  <Text style={newAge ? styles.selectText : styles.selectPlaceholder}>{newAge || (i18n.t('selectAge') || 'Select Age')}</Text>
                  <Ionicons name="chevron-down" size={16} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAddAgeGroup} style={styles.addBtn}>
                  <Ionicons name="add-circle" size={28} color="#2563eb" />
                </TouchableOpacity>
              </View>
              {errors.newAge ? <Text style={styles.errorText}>{errors.newAge}</Text> : null}
            </View>

            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <FootballLoader color="#fff" /> : <Text style={styles.saveButtonText}>{i18n.t('save') || 'Save'}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      <Modal visible={agePickerTarget !== null} transparent animationType="fade" onRequestClose={() => setAgePickerTarget(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAgePickerTarget(null)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{i18n.t('selectAge') || 'Select Age'}</Text>
            <ScrollView style={styles.modalScroll}>
              {AGE_OPTIONS.map((age) => (
                <TouchableOpacity key={age} style={styles.modalItem} onPress={() => handleAgeSelect(age)}>
                  <Text style={styles.modalItemText}>{age}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 36, paddingBottom: 40, minHeight: '100%', backgroundColor: '#f3f4f6' },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
  },
  backButtonText: { color: '#111827', fontSize: 14, fontWeight: '700' },
  heroCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280' },
  helperTag: { marginTop: 10, alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: '#374151', backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 2 },
  loadingWrap: { marginTop: 40, alignItems: 'center', gap: 10 },
  loadingText: { color: '#6b7280' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    color: '#111827',
  },
  selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: '#111827' },
  selectPlaceholder: { color: '#9ca3af' },
  ageInput: { flex: 1 },
  priceInput: { flex: 1 },
  currency: { marginLeft: 8, fontWeight: '700', color: '#374151' },
  inputError: { borderColor: '#dc2626' },
  errorText: { marginTop: 6, color: '#dc2626', fontSize: 12, fontWeight: '600' },
  addCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 4, marginBottom: 12 },
  addTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  addBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  removeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  saveButton: { backgroundColor: '#111827', borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '86%',
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modalScroll: { paddingHorizontal: 8 },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemText: { color: '#111827', fontSize: 15 },
});
