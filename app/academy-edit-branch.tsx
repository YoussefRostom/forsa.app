import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';
import { auth, db } from '../lib/firebase';
import FootballLoader from '../components/FootballLoader';

type BranchDraft = {
  name: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  mapUrl: string;
  latitude: string;
  longitude: string;
};

const initialDraft: BranchDraft = {
  name: '',
  city: '',
  district: '',
  address: '',
  phone: '',
  mapUrl: '',
  latitude: '',
  longitude: '',
};
const BRANCH_LOCATION_PICKER_RESULT_KEY = 'academyEditBranchLocationPickerResult';
const BRANCH_DRAFT_KEY = 'academyEditBranchDraft';
const districtsByCity: Record<string, { key: string; label: string }[]> = {
  cairo: [
    { key: 'Maadi', label: 'Maadi' },
    { key: 'Nasr City', label: 'Nasr City' },
    { key: 'Heliopolis', label: 'Heliopolis' },
    { key: 'Mokattam', label: 'Mokattam' },
    { key: 'New Cairo', label: 'New Cairo' },
    { key: 'Rehab', label: 'Rehab' },
    { key: 'Madinaty', label: 'Madinaty' },
    { key: 'Shorouk', label: 'Shorouk' },
    { key: '6 October', label: '6 October' },
    { key: 'Sheikh Zayed', label: 'Sheikh Zayed' },
  ],
  alexandria: [
    { key: 'Roushdy', label: 'Roushdy' },
    { key: 'Smouha', label: 'Smouha' },
    { key: 'Sporting', label: 'Sporting' },
    { key: 'Kafr Abdo', label: 'Kafr Abdo' },
    { key: 'Gleem', label: 'Gleem' },
    { key: 'Sidi Bishr', label: 'Sidi Bishr' },
  ],
};

const normalizePickedLocation = (picked: any) => {
  const latitudeRaw = picked?.latitude ?? picked?.lat ?? picked?.coords?.latitude ?? null;
  const longitudeRaw = picked?.longitude ?? picked?.lng ?? picked?.coords?.longitude ?? null;
  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);
  return {
    hasCoordinates,
    latitude: hasCoordinates ? String(latitude) : '',
    longitude: hasCoordinates ? String(longitude) : '',
    mapUrl: picked?.mapUrl ? String(picked.mapUrl) : '',
    address: picked?.address ? String(picked.address) : '',
    city: picked?.city ? String(picked.city) : '',
    district: picked?.district ? String(picked.district) : '',
  };
};

export default function AcademyEditBranchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ branchId?: string }>();
  const branchId = typeof params.branchId === 'string' ? params.branchId : undefined;
  const isEditMode = Boolean(branchId);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<BranchDraft>(initialDraft);
  const [locations, setLocations] = useState<any[]>([]);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [mapJustUpdated, setMapJustUpdated] = useState(false);

  useEffect(() => {
    const fetchBranch = async () => {
      setLoading(true);
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated');
        const snap = await getDoc(doc(db, 'academies', uid));
        const data = snap.exists() ? snap.data() : {};
        const currentLocations = Array.isArray(data.locations) ? data.locations : [];
        setLocations(currentLocations);

        const targetIndex = currentLocations.findIndex((location: any, idx: number) => String(location.id || `branch-${idx}`) === branchId);
        const safeIndex = targetIndex >= 0 ? targetIndex : -1;
        setEditingIndex(safeIndex);
        const source = safeIndex >= 0 ? currentLocations[safeIndex] : {};

        const [pendingDraftRaw, pickedRaw] = await Promise.all([
          AsyncStorage.getItem(BRANCH_DRAFT_KEY),
          AsyncStorage.getItem(BRANCH_LOCATION_PICKER_RESULT_KEY),
        ]);

        if (!isEditMode && !pendingDraftRaw && !pickedRaw) {
          setDraft((prev) => ({
            ...prev,
            phone: prev.phone || String(data.phone || ''),
          }));
          return;
        }

        let nextDraft: BranchDraft = {
          name: String(source.name || ''),
          city: String(source.city || ''),
          district: String(source.district || ''),
          address: String(source.address || ''),
          phone: String(source.phone || data.phone || ''),
          mapUrl: String(source.mapUrl || ''),
          latitude: source.latitude !== undefined && source.latitude !== null ? String(source.latitude) : '',
          longitude: source.longitude !== undefined && source.longitude !== null ? String(source.longitude) : '',
        };

        if (pendingDraftRaw) {
          try {
            const parsed = JSON.parse(pendingDraftRaw);
            nextDraft = {
              ...nextDraft,
              name: String(parsed?.name || nextDraft.name),
              city: String(parsed?.city || nextDraft.city),
              district: String(parsed?.district || nextDraft.district),
              address: String(parsed?.address || nextDraft.address),
              phone: String(parsed?.phone || nextDraft.phone),
              mapUrl: String(parsed?.mapUrl || nextDraft.mapUrl),
              latitude: String(parsed?.latitude || nextDraft.latitude),
              longitude: String(parsed?.longitude || nextDraft.longitude),
            };
          } catch {
            await AsyncStorage.removeItem(BRANCH_DRAFT_KEY);
          }
        }

        if (pickedRaw) {
          const picked = normalizePickedLocation(JSON.parse(pickedRaw));
          nextDraft = {
            ...nextDraft,
            latitude: picked.hasCoordinates ? picked.latitude : nextDraft.latitude,
            longitude: picked.hasCoordinates ? picked.longitude : nextDraft.longitude,
            mapUrl: picked.mapUrl || nextDraft.mapUrl,
            address: picked.address || nextDraft.address,
            city: picked.city || nextDraft.city,
            district: picked.district || nextDraft.district,
          };
          setMapJustUpdated(true);
          await AsyncStorage.removeItem(BRANCH_LOCATION_PICKER_RESULT_KEY);
          await AsyncStorage.removeItem(BRANCH_DRAFT_KEY);
        }

        setDraft(nextDraft);
      } catch (e: any) {
        Alert.alert(i18n.t('error') || 'Error', e?.message || 'Failed to load branch');
      } finally {
        setLoading(false);
      }
    };

    fetchBranch();
  }, [branchId, isEditMode]);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      const consumePickedLocation = async () => {
        try {
          const [storedDraft, storedPicked] = await Promise.all([
            AsyncStorage.getItem(BRANCH_DRAFT_KEY),
            AsyncStorage.getItem(BRANCH_LOCATION_PICKER_RESULT_KEY),
          ]);

          if (!active) return;

          if (storedDraft && !isEditMode) {
            const parsed = JSON.parse(storedDraft);
            setDraft((prev) => ({
              ...prev,
              name: String(parsed?.name || prev.name),
              city: String(parsed?.city || prev.city),
              district: String(parsed?.district || prev.district),
              address: String(parsed?.address || prev.address),
              phone: String(parsed?.phone || prev.phone),
              mapUrl: String(parsed?.mapUrl || prev.mapUrl),
              latitude: String(parsed?.latitude || prev.latitude),
              longitude: String(parsed?.longitude || prev.longitude),
            }));
          }

          if (storedPicked) {
            const parsedPicked = JSON.parse(storedPicked);
            const picked = normalizePickedLocation(parsedPicked);
            setDraft((prev) => ({
              ...prev,
              latitude: picked.hasCoordinates ? picked.latitude : prev.latitude,
              longitude: picked.hasCoordinates ? picked.longitude : prev.longitude,
              mapUrl: picked.mapUrl || prev.mapUrl,
              address: picked.address || prev.address,
              city: picked.city || prev.city,
              district: picked.district || prev.district,
            }));
            setMapJustUpdated(true);
            await AsyncStorage.removeItem(BRANCH_LOCATION_PICKER_RESULT_KEY);
            await AsyncStorage.removeItem(BRANCH_DRAFT_KEY);
          }
        } catch (error) {
          console.warn('Failed to restore branch picked location', error);
          await AsyncStorage.removeItem(BRANCH_LOCATION_PICKER_RESULT_KEY);
          await AsyncStorage.removeItem(BRANCH_DRAFT_KEY);
        }
      };
      consumePickedLocation();
      return () => {
        active = false;
      };
    }, [isEditMode])
  );

  const openMapPicker = async () => {
    await AsyncStorage.setItem(BRANCH_DRAFT_KEY, JSON.stringify(draft));
    await AsyncStorage.removeItem(BRANCH_LOCATION_PICKER_RESULT_KEY);
    router.push({
      pathname: '/academy-location-picker',
      params: {
        storageKey: BRANCH_LOCATION_PICKER_RESULT_KEY,
        title: draft.name || (i18n.t('branchName') || 'Branch'),
        latitude: draft.latitude,
        longitude: draft.longitude,
        city: draft.city,
        district: draft.district,
        address: draft.address,
      },
    });
  };


  const setField = (key: keyof BranchDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };
  const cityOptions = Object.entries(i18n.t('cities', { returnObjects: true }) as Record<string, string>);
  const availableDistricts = draft.city ? districtsByCity[draft.city] || [] : [];
  const isDistrictEnabled = Boolean(draft.city && availableDistricts.length > 0);
  const hasMapSelection = Boolean((draft.latitude && draft.longitude) || draft.mapUrl.trim());
  const missingRequired = useMemo(() => {
    const required: Array<keyof BranchDraft> = ['city', 'address'];
    if (availableDistricts.length > 0) {
      required.push('district');
    }
    return required.filter((key) => draft[key].trim().length === 0);
  }, [availableDistricts.length, draft]);

  const safeUpdate = async (target: 'academies' | 'users', uid: string, data: Record<string, any>) => {
    const ref = doc(db, target, uid);
    try {
      await updateDoc(ref, data);
    } catch {
      await setDoc(ref, data, { merge: true });
    }
  };

  const handleSave = async () => {
    if (missingRequired.length > 0) {
      Alert.alert(i18n.t('error') || 'Error', i18n.t('fillAllRequiredFields') || 'Please fill in all required fields.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert(i18n.t('error') || 'Error', 'User not authenticated');
      return;
    }

    setSaving(true);
    try {
      const nextLocations = [...locations];
      const payload = {
        id: editingIndex >= 0 ? (nextLocations[editingIndex]?.id || branchId) : `branch-${Date.now()}`,
        name: draft.name.trim(),
        city: draft.city.trim(),
        district: draft.district.trim(),
        address: draft.address.trim(),
        phone: draft.phone.trim() || null,
        mapUrl: draft.mapUrl.trim() || null,
        latitude: draft.latitude.trim() ? Number(draft.latitude) : null,
        longitude: draft.longitude.trim() ? Number(draft.longitude) : null,
      };

      if (editingIndex >= 0) {
        nextLocations[editingIndex] = payload;
      } else {
        nextLocations.push(payload);
      }
      await safeUpdate('academies', uid, { locations: nextLocations, updatedAt: new Date().toISOString() });
      await safeUpdate('users', uid, { locations: nextLocations, updatedAt: new Date().toISOString() });
      await AsyncStorage.removeItem(BRANCH_DRAFT_KEY);
      await AsyncStorage.removeItem(BRANCH_LOCATION_PICKER_RESULT_KEY);

      Alert.alert(i18n.t('success') || 'Success', i18n.t('branchSaved') || 'Branch saved!');
      router.back();
    } catch (e: any) {
      Alert.alert(i18n.t('error') || 'Error', e?.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <FootballLoader size="large" color="#111827" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/academy-branches' as any))}>
          <Ionicons name="chevron-back" size={20} color="#111827" />
          <Text style={styles.backButtonText}>{i18n.t('back') || 'Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditMode ? (i18n.t('editBranch') || 'Edit Branch') : (i18n.t('addBranch') || 'Add Branch')}</Text>
        <Text style={styles.subtitle}>{i18n.t('editBranchHint') || 'Update branch details shown to families and players.'}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{i18n.t('basicInformation') || 'Basic information'}</Text>
          <Field label={i18n.t('branchName') || 'Branch Name'} value={draft.name} onChangeText={(v) => setField('name', v)} />
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{i18n.t('city') || 'City'} *</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowCityModal(true)}>
              <Text style={!draft.city ? styles.placeholder : undefined}>
                {draft.city ? ((i18n.t('cities', { returnObjects: true }) as Record<string, string>)[draft.city] || draft.city) : (i18n.t('selectCity') || 'Select City')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{i18n.t('district') || 'District'}{availableDistricts.length > 0 ? ' *' : ''}</Text>
            <TouchableOpacity
              style={[styles.input, !isDistrictEnabled && styles.disabledInput]}
              onPress={() => {
                if (!draft.city) {
                  Alert.alert(i18n.t('selectCityFirst') || 'Select city first');
                  return;
                }
                if (!isDistrictEnabled) {
                  Alert.alert(i18n.t('noDistrictsAvailable') || 'No districts available');
                  return;
                }
                setShowDistrictModal(true);
              }}
            >
              <Text style={!draft.district ? styles.placeholder : undefined}>
                {draft.district || (!draft.city
                  ? (i18n.t('selectCityFirst') || 'Select city first')
                  : (isDistrictEnabled ? (i18n.t('selectDistrict') || 'Select District') : (i18n.t('noDistrictsAvailable') || 'No districts available')))}
              </Text>
            </TouchableOpacity>
          </View>
          <Field label={i18n.t('address') || 'Address'} value={draft.address} onChangeText={(v) => setField('address', v)} required multiline />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{i18n.t('contact') || 'Contact'}</Text>
          <Field label={i18n.t('phone') || 'Phone'} value={draft.phone} onChangeText={(v) => setField('phone', v)} keyboardType="phone-pad" />
          <Field label={i18n.t('map_url') || 'Map URL'} value={draft.mapUrl} onChangeText={(v) => setField('mapUrl', v)} />
          <TouchableOpacity style={styles.mapPickerButton} onPress={openMapPicker} activeOpacity={0.9}>
            <Ionicons name="map-outline" size={18} color="#111827" />
            <Text style={styles.mapPickerText}>{i18n.t('chooseOnMap') || 'Set on map'}</Text>
          </TouchableOpacity>
          <View style={styles.mapStateRow}>
            <Ionicons name={hasMapSelection ? 'checkmark-circle' : 'pin-outline'} size={16} color={hasMapSelection ? '#15803d' : '#6b7280'} />
            <Text style={styles.mapStateText}>
              {hasMapSelection
                ? (mapJustUpdated ? (i18n.t('mapLocationUpdated') || 'Map location updated') : (i18n.t('mapPinSelected') || 'Map pin selected successfully'))
                : (i18n.t('mapPinNotSelected') || 'No map pin selected yet')}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <FootballLoader color="#fff" /> : <Text style={styles.saveButtonText}>{i18n.t('save') || 'Save'}</Text>}
        </TouchableOpacity>

        <Modal visible={showCityModal} transparent animationType="fade" onRequestClose={() => setShowCityModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCityModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{i18n.t('selectCity') || 'Select City'}</Text>
              <ScrollView style={styles.modalScroll}>
                {cityOptions.map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.modalItem}
                    onPress={() => {
                      setField('city', key);
                      if (!((districtsByCity[key] || []).some((d) => d.key === draft.district))) {
                        setField('district', '');
                      }
                      setShowCityModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showDistrictModal} transparent animationType="fade" onRequestClose={() => setShowDistrictModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDistrictModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{i18n.t('selectDistrict') || 'Select District'}</Text>
              <ScrollView style={styles.modalScroll}>
                {availableDistricts.map((option) => (
                  <TouchableOpacity key={option.key} style={styles.modalItem} onPress={() => { setField('district', option.key); setShowDistrictModal(false); }}>
                    <Text style={styles.modalItemText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  required,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        placeholder={label}
        placeholderTextColor="#9ca3af"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
  content: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  backButtonText: { color: '#111827', fontSize: 14, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: -4, marginBottom: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  fieldGroup: { marginTop: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 15,
  },
  placeholder: { color: '#9ca3af' },
  disabledInput: { opacity: 0.65 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
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
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  mapPickerButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    paddingVertical: 11,
    gap: 8,
  },
  mapPickerText: { color: '#111827', fontWeight: '700', fontSize: 14 },
  mapStateRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapStateText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  saveButton: {
    backgroundColor: '#111827',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
