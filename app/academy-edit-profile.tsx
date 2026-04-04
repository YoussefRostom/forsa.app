import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import i18n from '../locales/i18n';
import { auth, db } from '../lib/firebase';
import { uploadMedia } from '../services/MediaService';
import * as ImagePicker from 'expo-image-picker';

const AGE_GROUPS = Array.from({ length: 11 }, (_, i) => (7 + i).toString());

function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
}

function formatTime12Hour(time24: string): string {
  if (!time24 || !isValidTimeFormat(time24)) return time24;
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export default function AcademyEditProfileScreen({ academyName: academyNameProp }: { academyName?: string }) {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [academyName, setAcademyName] = useState(academyNameProp || '');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [prices, setPrices] = useState<{ [key: string]: string }>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [newPrice, setNewPrice] = useState('');
  const [settingAge, setSettingAge] = useState<string | null>(null);
  const { openMenu } = useHamburgerMenu();
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [contactPerson, setContactPerson] = useState('');
  const [editingContactPerson, setEditingContactPerson] = useState(false);
  const [schedule, setSchedule] = useState<{ [age: string]: { day: string; time: string } }>({});
  const [scheduleDropdown, setScheduleDropdown] = useState<{ age: string; type: 'day' | 'time' } | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 380;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showCityModal, setShowCityModal] = useState(false);
  const cityOptions = Object.entries(i18n.t('cities', { returnObjects: true }) as Record<string, string>).map(([key, label]) => ({ key, label }));

  const [privateTrainings, setPrivateTrainings] = useState<any[]>([]);
  const [deletedTrainings, setDeletedTrainings] = useState<string[]>([]);

  const updateTraining = (index: number, field: string, value: string) => {
    setPrivateTrainings(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };
  const addTraining = () => {
    setPrivateTrainings(prev => [...prev, { coachName: '', privateTrainingPrice: '', coachBio: '', specializations: '', sessionDuration: '60', availability: '' }]);
  };
  const removeTraining = (index: number) => {
    const trainingToRemove = privateTrainings[index];
    if (trainingToRemove.id) {
      setDeletedTrainings(prev => [...prev, trainingToRemove.id]);
    }
    setPrivateTrainings(prev => prev.filter((_, i) => i !== index));
  };

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setFetchError(null);
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setFetchError(i18n.t('couldNotLoadData') || 'Not signed in.');
          return;
        }
        const docRef = doc(db, 'academies', uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setFetchError(i18n.t('couldNotLoadData') || 'Academy profile not found.');
          return;
        }
        const data = docSnap.data();
        const feesOrPrices = data.fees || data.prices || {};
        setPrices(feesOrPrices);
        setSelected(Object.keys(feesOrPrices).length ? Object.keys(feesOrPrices) : []);
        if (data.schedule) setSchedule(data.schedule);
        const photoUrl = data.profilePhoto || data.profilePic;
        if (photoUrl) {
          setProfilePic(photoUrl);
          setProfilePicUrl(photoUrl);
        }
        if (data.academyName) setAcademyName(data.academyName);
        if (data.address) setAddress(data.address);
        if (data.city) setCity(data.city);
        if (data.description) setDescription(data.description);
        if (data.contactPerson) setContactPerson(data.contactPerson);

        // Fetch private trainings
        const programsQuery = query(collection(db, 'academy_programs'), where('academyId', '==', uid), where('type', '==', 'private_training'), where('isActive', '==', true));
        const programsSnap = await getDocs(programsQuery);
        const pData = programsSnap.docs.map(d => {
          const pd = d.data();
          return {
            id: d.id,
            coachName: pd.coachName || '',
            privateTrainingPrice: pd.fee ? pd.fee.toString() : '',
            coachBio: pd.coachBio || '',
            specializations: pd.specializations ? pd.specializations.join(', ') : '',
            sessionDuration: pd.duration ? pd.duration.toString() : '60',
            availability: pd.availability && pd.availability.general ? pd.availability.general : ''
          };
        });
        if (pData.length > 0) {
          setPrivateTrainings(pData);
        } else {
          setPrivateTrainings([{ coachName: '', privateTrainingPrice: '', coachBio: '', specializations: '', sessionDuration: '60', availability: '' }]);
        }
      } catch (e: any) {
        setFetchError(e?.message || i18n.t('couldNotLoadData') || 'Could not load academy data.');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleSetAge = (age: string) => {
    setSettingAge(age);
    setNewPrice('');
  };
  const handleSaveAge = (age: string) => {
    if (newPrice.trim()) {
      setPrices({ ...prices, [age]: newPrice });
      if (!selected.includes(age)) {
        setSelected([...selected, age]);
      }
      setSettingAge(null);
      setNewPrice('');
    }
  };
  const handleEditPrice = (age: string, value: string) => {
    setPrices({ ...prices, [age]: value });
  };
  const handleRemoveAge = (age: string) => {
    const newPrices = { ...prices };
    delete newPrices[age];
    setPrices(newPrices);
    setSelected(prev => prev.filter(a => a !== age));
    const newSchedule = { ...schedule };
    delete newSchedule[age];
    setSchedule(newSchedule);
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfilePic(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert(i18n.t('error') || 'Error', 'User not authenticated');
      return;
    }
    setSaving(true);
    try {
  
      let finalProfilePicUrl = profilePicUrl;
  
      // Upload profile photo if it's a new local image
      if (
        profilePic &&
        profilePic !== profilePicUrl &&
        (profilePic.startsWith('file://') ||
          profilePic.startsWith('content://'))
      ) {
        try {
          const cloudinaryResponse = await uploadMedia(profilePic, 'image');
          finalProfilePicUrl = cloudinaryResponse.secure_url;
          setProfilePicUrl(finalProfilePicUrl);
        } catch (error) {
          console.error('Error uploading profile photo:', error);
          Alert.alert(i18n.t('error') || 'Error', 'Failed to upload profile photo');
          setSaving(false);
          return;
        }
      }
  
      const academyRef = doc(db, 'academies', uid);

      const feesObj: { [key: string]: string | number } = {};
      Object.entries(prices).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          feesObj[k] = isNaN(Number(v)) ? v : Number(v);
        }
      });

      const updateData: any = {
        fees: feesObj,
        schedule,
        address: address || null,
        contactPerson: contactPerson || null,
        academyName: academyName || null,
        city: city || null,
        description: description || null,
        updatedAt: new Date().toISOString(),
      };
      if (finalProfilePicUrl) {
        updateData.profilePhoto = finalProfilePicUrl;
        updateData.profilePic = finalProfilePicUrl;
      }

      await updateDoc(academyRef, updateData);

      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, updateData);

      // Handle private trainings update
      for (const training of privateTrainings) {
        if (training.coachName && training.privateTrainingPrice) {
          const programData: any = {
            academyId: uid,
            name: 'Private Training',
            type: 'private_training',
            fee: parseFloat(training.privateTrainingPrice) || 0,
            description: `Private training sessions with ${training.coachName}`,
            coachName: training.coachName,
            coachBio: training.coachBio || null,
            specializations: typeof training.specializations === 'string' ? training.specializations.split(',').map((s: string) => s.trim()) : (training.specializations || []),
            maxParticipants: 1,
            duration: parseInt(training.sessionDuration) || 60,
            availability: typeof training.availability === 'string' ? { general: training.availability } : (training.availability || null),
            isActive: true,
            updatedAt: new Date().toISOString(),
          };

          if (training.id) {
            await updateDoc(doc(db, 'academy_programs', training.id), programData);
          } else {
            programData.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'academy_programs'), programData);
          }
        }
      }

      // Handle deletions
      for (const tId of deletedTrainings) {
        await deleteDoc(doc(db, 'academy_programs', tId));
      }

      Alert.alert(
        i18n.t('success') || 'Success',
        i18n.t('profileUpdated') || 'Profile updated successfully'
      );
  
      if (router.canGoBack()) {
        router.back();
      }
    } catch (error) {
      console.error('Error updating academy profile:', error);
      Alert.alert(i18n.t('error') || 'Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  if (fetchError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <Text style={{ color: '#ff3b30' }}>{fetchError}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{i18n.t('editProfile') || 'Edit Profile'}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('updateYourInformation') || 'Update your academy information'}</Text>
              </View>
          </View>

          <HamburgerMenu />

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formCard}>
              {/* Profile Picture */}
              <View style={styles.profileSection}>
                <TouchableOpacity onPress={handlePickPhoto} style={styles.profileImageContainer}>
                  {profilePic ? (
                    <Image source={{ uri: profilePic }} style={styles.profileImage} />
                  ) : (
                    <View style={styles.profileImagePlaceholder}>
                      <Ionicons name="camera" size={32} color="#999" />
                    </View>
                  )}
                  <View style={styles.profileImageOverlay}>
                    <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        <TouchableOpacity onPress={handlePickPhoto}>
                  <Text style={styles.changeProfileText}>{i18n.t('changeProfilePicture')}</Text>
        </TouchableOpacity>
      </View>

              {/* Academy Name (editable) */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18n.t('academyNameLabel')}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="school-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={academyName}
                    onChangeText={setAcademyName}
                    placeholder={i18n.t('academy_name_placeholder') || 'Academy name'}
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              {/* City */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18n.t('city') || 'City'}</Text>
                <TouchableOpacity
                  style={[styles.inputWrapper, styles.cityPickerWrapper]}
                  onPress={() => setShowCityModal(true)}
                >
                  <Ionicons name="location-outline" size={20} color="#999" style={styles.inputIcon} />
                  <Text style={[styles.cityText, !city && styles.cityPlaceholder]}>
                    {city ? (cityOptions.find(c => c.key === city)?.label || city) : i18n.t('selectCity') || 'Select City'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#999" />
                </TouchableOpacity>
                <Modal visible={showCityModal} transparent animationType="fade" onRequestClose={() => setShowCityModal(false)}>
                  <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCityModal(false)}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{i18n.t('selectCity')}</Text>
                        <TouchableOpacity onPress={() => setShowCityModal(false)}>
                          <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.modalScrollView}>
                        {cityOptions.map(option => (
                          <TouchableOpacity
                            key={option.key}
                            style={[styles.cityOption, city === option.key && styles.cityOptionSelected]}
                            onPress={() => {
                              setCity(option.key);
                              setShowCityModal(false);
                            }}
                          >
                            <Text style={[styles.cityOptionText, city === option.key && styles.cityOptionTextSelected]}>
                              {option.label}
                            </Text>
                            {city === option.key && <Ionicons name="checkmark" size={20} color="#fff" />}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </TouchableOpacity>
                </Modal>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18n.t('description') || 'Description'}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="document-text-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { minHeight: 72 }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={i18n.t('description') || 'Description'}
                    placeholderTextColor="#999"
                    multiline
                  />
                </View>
              </View>

              {/* Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18n.t('address')}</Text>
        {editingAddress ? (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="map-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
                      style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder={i18n.t('addressPlaceholder')}
                      placeholderTextColor="#999"
              autoFocus
            />
                    <TouchableOpacity onPress={() => setEditingAddress(false)}>
                      <Ionicons name="checkmark-circle" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        ) : (
                  <TouchableOpacity 
                    style={styles.inputWrapper}
                    onPress={() => setEditingAddress(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="map-outline" size={20} color="#999" style={styles.inputIcon} />
                    <Text style={[styles.input, !address && styles.placeholderText]}>
                      {address || i18n.t('addressPlaceholder')}
                    </Text>
                    <Ionicons name="create-outline" size={20} color="#999" />
            </TouchableOpacity>
        )}
      </View>

              {/* Contact Person */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18n.t('contactPerson')}</Text>
        {editingContactPerson ? (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
                      style={styles.input}
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder={i18n.t('contactPersonPlaceholder')}
                      placeholderTextColor="#999"
              autoFocus
            />
                    <TouchableOpacity onPress={() => setEditingContactPerson(false)}>
                      <Ionicons name="checkmark-circle" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        ) : (
                  <TouchableOpacity 
                    style={styles.inputWrapper}
                    onPress={() => setEditingContactPerson(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                    <Text style={[styles.input, !contactPerson && styles.placeholderText]}>
                      {contactPerson || i18n.t('contactPersonPlaceholder')}
                    </Text>
                    <Ionicons name="create-outline" size={20} color="#999" />
            </TouchableOpacity>
        )}
      </View>

              {/* Fees per Age Group */}
              <View style={styles.inputGroup}>
      <Text style={styles.label}>{i18n.t('feesPerAgeGroup') || 'Fees per Age Group'}</Text>
      <View style={styles.bubbleRow}>
        {AGE_GROUPS.map(age => (
          <View key={age} style={[styles.bubble, selected.includes(age) && styles.bubbleSelected]}>
            <Text style={[styles.bubbleText, selected.includes(age) && styles.bubbleTextSelected]}>{age}</Text>
            {selected.includes(age) ? (
              <View style={styles.setRow}>
                <TextInput
                  style={[styles.priceInput, { marginTop: 0, flex: 1, minWidth: 40 }]}
                  value={prices[age] || ''}
                  onChangeText={v => handleEditPrice(age, v)}
                  keyboardType="numeric"
                  placeholder={i18n.t('feePlaceholder') || 'Fee'}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity onPress={() => handleRemoveAge(age)} style={{ marginLeft: 4 }}>
                  <Ionicons name="close-circle" size={24} color="#ff3b30" />
                </TouchableOpacity>
              </View>
            ) : settingAge === age ? (
              <View style={styles.setRow}>
                <TextInput
                  style={[styles.priceInput, { marginTop: 0, flex: 1, minWidth: 40 }]}
                  value={newPrice}
                  onChangeText={setNewPrice}
                  keyboardType="numeric"
                  placeholder={i18n.t('feePlaceholder') || 'Fee'}
                  placeholderTextColor="#999"
                  autoFocus
                />
                <TouchableOpacity style={styles.setBtn} onPress={() => handleSaveAge(age)}>
                  <Text style={styles.setBtnText}>{i18n.t('save') || 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.setBtn} onPress={() => { setSettingAge(null); setNewPrice(''); }}>
                  <Text style={styles.setBtnText}>{i18n.t('cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.setBtn} onPress={() => handleSetAge(age)}>
                <Text style={styles.setBtnText}>{i18n.t('set') || 'Set'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
              </View>

              {/* Private Trainings */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18n.t('privateTraining') || 'Private Training'}</Text>
                {privateTrainings.map((training, index) => (
                  <View key={index} style={styles.trainingCard}>
                    {privateTrainings.length > 1 && (
                      <View style={styles.trainingCardHeader}>
                        <Text style={styles.trainingCardTitle}>Training #{index + 1}</Text>
                        <TouchableOpacity onPress={() => removeTraining(index)} style={{ padding: 4 }}>
                          <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.labelSmall}>{i18n.t('coachName') || 'Coach Name'}</Text>
                      <TextInput style={styles.inputSmall} value={training.coachName} onChangeText={v => updateTraining(index, 'coachName', v)} placeholder="Coach Name" placeholderTextColor="#aaa" />
                    </View>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.labelSmall}>{i18n.t('privateTrainingPrice') || 'Price per Session'}</Text>
                      <TextInput style={styles.inputSmall} value={training.privateTrainingPrice} onChangeText={v => updateTraining(index, 'privateTrainingPrice', v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="Price" placeholderTextColor="#aaa" />
                    </View>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.labelSmall}>{i18n.t('coachBio') || 'Coach Bio'}</Text>
                      <TextInput style={[styles.inputSmall, { height: 60 }]} value={training.coachBio} onChangeText={v => updateTraining(index, 'coachBio', v)} multiline placeholder="Bio" placeholderTextColor="#aaa" />
                    </View>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.labelSmall}>{i18n.t('specializations') || 'Specializations'}</Text>
                      <TextInput style={styles.inputSmall} value={training.specializations} onChangeText={v => updateTraining(index, 'specializations', v)} placeholder="Comma-separated" placeholderTextColor="#aaa" />
                    </View>
                    <View style={styles.inputGroupSmall}>
                      <Text style={styles.labelSmall}>{i18n.t('sessionDuration') || 'Duration (min)'}</Text>
                      <TextInput style={styles.inputSmall} value={training.sessionDuration} onChangeText={v => updateTraining(index, 'sessionDuration', v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="60" placeholderTextColor="#aaa" />
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={styles.addTrainingBtn} onPress={addTraining}>
                  <Ionicons name="add-circle-outline" size={20} color="#000" />
                  <Text style={styles.addTrainingBtnText}>{i18n.t('addAnotherTraining') || 'Add Private Training'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{i18n.t('save') || 'Save'}</Text>
                )}
              </TouchableOpacity>
            </View>
    </ScrollView>
        </Animated.View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  profileImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  changeProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f5f5f5',
    paddingHorizontal: 16,
    minHeight: 56,
  },
  readOnlyInput: {
    backgroundColor: '#f9f9f9',
    opacity: 0.7,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 16,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 16,
    color: '#666',
    paddingVertical: 16,
  },
  placeholderText: {
    color: '#999',
  },
  cityPickerWrapper: {
    paddingHorizontal: 16,
  },
  cityText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 16,
  },
  cityPlaceholder: {
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  cityOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cityOptionSelected: {
    backgroundColor: '#000',
  },
  cityOptionText: {
    fontSize: 16,
    color: '#000',
  },
  cityOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  bubbleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  bubble: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 60,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  bubbleSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  bubbleText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  bubbleTextSelected: {
    color: '#fff',
  },
  priceInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#000',
    minWidth: 60,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  setBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  setBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
    minHeight: 44,
  },
  scheduleRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
    marginBottom: 14,
  },
  scheduleAgeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    minWidth: 48,
    width: 48,
  },
  schedulePickersWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  schedulePickerControl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 0,
  },
  schedulePickerText: {
    fontSize: 14,
    color: '#000',
    flexShrink: 1,
  },
  schedulePickerPlaceholder: {
    color: '#999',
  },
  trainingCard: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  trainingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trainingCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  inputGroupSmall: {
    marginBottom: 12,
  },
  labelSmall: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '600',
  },
  inputSmall: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#000',
  },
  addTrainingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#000',
    borderStyle: 'dashed',
    borderRadius: 12,
    gap: 8,
  },
  addTrainingBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  schedulePickerBtn: {
    flex: 1,
    minWidth: 72,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  scheduleDropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    zIndex: 100,
    maxHeight: 220,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  scheduleDropdownScroll: {
    maxHeight: 180,
  },
  scheduleDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scheduleDropdownItemSelected: {
    backgroundColor: '#f0f0f0',
  },
  scheduleDropdownItemText: {
    color: '#000',
    fontSize: 15,
  },
  scheduleDropdownCancel: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  scheduleDropdownCancelText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  scheduleDropdownNarrow: {
    top: 76,
    left: 0,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
