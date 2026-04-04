import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { writeEmailIndex } from '../lib/emailIndex';
import { writePhoneIndex } from '../lib/phoneIndex';
import { normalizePhoneForAuth } from '../lib/validations';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { uploadMedia } from '../services/MediaService';
import {
  validateAddress,
  validateCity,
  validateEmail,
  validatePassword,
  validatePhone,
  validateRequired,
  normalizePhoneForTwilio
} from '../lib/validations';
import i18n from '../locales/i18n';
import { getBackendUrl } from '../lib/config';

const SignupAcademy = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 380;

  // Initialize state from params
  const [academyName, setAcademyName] = useState(params.academyName as string || '');
  const [email, setEmail] = useState(params.email as string || '');
  const [phone, setPhone] = useState(params.phone as string || '');
  const [password, setPassword] = useState(params.password as string || '');
  const [city, setCity] = useState(params.city as string || '');
  const [showCityModal, setShowCityModal] = useState(false);
  const [address, setAddress] = useState(params.address as string || '');
  const [description, setDescription] = useState(params.description as string || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fees, setFees] = useState<{ [age: string]: string }>(() => {
    try {
      return params.fees ? JSON.parse(params.fees as string) : {};
    } catch {
      return {};
    }
  });
  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(params.profileImage as string || null);
  const [missing, setMissing] = useState<{ [key: string]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [privateTrainings, setPrivateTrainings] = useState<Array<{
    coachName: string; privateTrainingPrice: string; coachBio: string;
    specializations: string; sessionDuration: string; availability: string;
  }>>([{ coachName: '', privateTrainingPrice: '', coachBio: '', specializations: '', sessionDuration: '60', availability: '' }]);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem('draftPrivateTrainings');
        if (draft) {
          setPrivateTrainings(JSON.parse(draft));
          await AsyncStorage.removeItem('draftPrivateTrainings');
        }
      } catch (e) {
        console.error('Failed to load draft private trainings', e);
      }
    };
    loadDraft();
  }, []);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const updateTraining = (index: number, field: string, value: string) => {
    setPrivateTrainings(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };
  const addTraining = () => {
    setPrivateTrainings(prev => [...prev, { coachName: '', privateTrainingPrice: '', coachBio: '', specializations: '', sessionDuration: '60', availability: '' }]);
  };
  const removeTraining = (index: number) => {
    setPrivateTrainings(prev => prev.filter((_, i) => i !== index));
  };

  const cityOptions = Object.entries(i18n.t('cities', { returnObjects: true }) as Record<string, string>).map(([key, label]) => ({ key, label }));

  const ageGroups = Array.from({ length: 10 }, (_, i) => (7 + i).toString());
  const renderAgeRows = () => {
    const rows = [];
    for (let i = 0; i < ageGroups.length; i += 3) {
      rows.push(ageGroups.slice(i, i + 3));
    }
    return rows;
  };

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);


  // Image picker for profile photo
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleBack = () => router.back();

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    const newMissing: { [key: string]: boolean } = {};

    const academyNameError = validateRequired(academyName, i18n.t('academy_name') || 'Academy name');
    if (academyNameError) {
      newErrors.academyName = academyNameError;
      newMissing.academyName = true;
    }

    // Email is optional - only validate if provided
    if (email && email.trim().length > 0) {
      const emailError = validateEmail(email);
      if (emailError) {
        newErrors.email = emailError;
        newMissing.email = true;
      }
    }

    // Phone is now required
    const phoneError = validatePhone(phone);
    if (phoneError) {
      newErrors.phone = phoneError;
      newMissing.phone = true;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      newErrors.password = passwordError;
      newMissing.password = true;
    }

    const cityError = validateCity(city);
    if (cityError) {
      newErrors.city = cityError;
      newMissing.city = true;
    }

    const addressError = validateAddress(address);
    if (addressError) {
      newErrors.address = addressError;
      newMissing.address = true;
    }

    // Profile photo is optional

    // Check that at least one fee is entered
    if (!Object.values(fees).some((v) => v && v.trim() !== '')) {
      newErrors.fees = i18n.t('atLeastOneFeeRequired') || 'At least one fee must be entered';
      newMissing.fees = true;
    }

    setErrors(newErrors);
    setMissing(newMissing);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) {
      Alert.alert(i18n.t('missingFields'), i18n.t('fillAllRequiredFields'));
      return;
    }
    try {
      setLoading(true);
      setFormError('');

      // Step 1: Create Firebase Auth user — use real email when provided (unique per user), else phone-based
      const normalizedPhone = normalizePhoneForTwilio(phone);
      const phoneForAuth = normalizePhoneForAuth(normalizedPhone);
      const authEmail =
        email && email.trim().length > 0
          ? email.trim().toLowerCase()
          : `user_${phoneForAuth}@forsa.app`;

      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
      const uid = userCredential.user.uid;

      // Step 2: Upload profile photo to Cloudinary
      let profilePhotoUrl = '';
      if (profileImage) {
        try {
          const cloudinaryResponse = await uploadMedia(profileImage, 'image');
          profilePhotoUrl = cloudinaryResponse.secure_url;
        } catch (error: any) {
          console.error('Error uploading profile photo:', error);
          throw new Error('Failed to upload profile photo. Please try again.');
        }
      }

      // Step 3: Save extended profile to Firestore
      const userData = {
        uid,
        role: 'academy',
        email: email && email.trim().length > 0 ? email.trim() : null,
        phone,
        academyName,
        city,
        address,
        description,
        fees,
        profilePhoto: profilePhotoUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', uid), userData, { merge: true });
      await setDoc(doc(db, 'academies', uid), userData);

      // Save email → authEmail mapping for sign-in by email
      if (email && email.trim().length > 0) {
        await writeEmailIndex(email.trim(), authEmail);
      }
      // Save phone → authEmail mapping so sign-in by phone works (e.g. account created with email + phone)
      await writePhoneIndex(phoneForAuth, authEmail);

      // Step 4: Create private training programs for each valid entry
      for (const training of privateTrainings) {
        if (training.coachName && training.privateTrainingPrice) {
          try {
            const programData = {
              academyId: uid,
              name: 'Private Training',
              type: 'private_training',
              fee: parseFloat(training.privateTrainingPrice),
              description: `Private training sessions with ${training.coachName}`,
              coachName: training.coachName,
              coachBio: training.coachBio || null,
              specializations: training.specializations ? training.specializations.split(',').map((s: string) => s.trim()) : [],
              maxParticipants: 1,
              duration: parseInt(training.sessionDuration) || 60,
              availability: training.availability ? { general: training.availability } : null,
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await addDoc(collection(db, 'academy_programs'), programData);
          } catch (programError) {
            console.error('Error creating private training program:', programError);
          }
        }
      }

      router.replace('/academy-feed');
    } catch (err: any) {
      console.log('[Signup] Error:', err.message);
      let errorMsg = i18n.t('signupFailedMessage');
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = i18n.t('emailAlreadyRegistered') || 'This email or phone number is already registered. Use a different email or sign in.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = i18n.t('weakPassword') || 'Password is too weak';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setFormError(errorMsg);
      Alert.alert(i18n.t('signupFailed'), errorMsg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{i18n.t('signup_academy')}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('createYourAcademyAccount')}</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {formError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#ff3b30" />
                <Text style={styles.errorSubmitText}>{formError}</Text>
              </View>
            )}

            {/* Profile Picture Picker */}
            <View style={styles.profileSection}>
              <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Ionicons name="camera" size={32} color="#999" />
                  </View>
                )}
                <View style={styles.profileImageOverlay}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={styles.profileLabel}>
                {i18n.t('add_profile_picture')}
              </Text>
            </View>
            {/* Form Fields */}
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('academy_name')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={[styles.inputWrapper, missing.academyName && styles.inputWrapperError]}>
                  <Ionicons name="school-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={academyName}
                    onChangeText={t => { setAcademyName(t); if (missing.academyName) setMissing(m => ({ ...m, academyName: false })); }}
                    autoCapitalize="words"
                    placeholder={i18n.t('academy_name_placeholder')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.academyName && <Text style={styles.errorText}>{errors.academyName}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('phone')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={[styles.inputWrapper, missing.phone && styles.inputWrapperError]}>
                  <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={t => { setPhone(t); if (missing.phone) setMissing(m => ({ ...m, phone: false })); }}
                    keyboardType="phone-pad"
                    placeholder={i18n.t('phone_placeholder') || i18n.t('phone_ph')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('email_address') || 'Email Address'} <Text style={{ color: '#999', fontSize: 14 }}>(Optional)</Text>
                </Text>
                <View style={[styles.inputWrapper, missing.email && styles.inputWrapperError]}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={t => {
                      setEmail(t);
                      if (missing.email) setMissing(m => ({ ...m, email: false }));
                      // Clear error if field is empty (since it's optional)
                      if (!t || t.trim().length === 0) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.email;
                          return newErrors;
                        });
                        setMissing(prev => {
                          const newMissing = { ...prev };
                          delete newMissing.email;
                          return newMissing;
                        });
                      }
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder={i18n.t('email_address_ph') || 'Enter your email address (optional)'}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('password')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={[styles.inputWrapper, missing.password && styles.inputWrapperError]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={t => { setPassword(t); if (missing.password) setMissing(m => ({ ...m, password: false })); }}
                    secureTextEntry
                    placeholder={i18n.t('password_placeholder')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('city')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.inputWrapper, styles.cityPickerWrapper, missing.city && styles.inputWrapperError]}
                  onPress={() => setShowCityModal(true)}
                >
                  <Ionicons name="location-outline" size={20} color="#999" style={styles.inputIcon} />
                  <Text style={[styles.cityText, !city && styles.cityPlaceholder]}>
                    {city ? i18n.t(`cities.${city}`) : i18n.t('selectCity') || 'Select City'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#999" />
                </TouchableOpacity>
                {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
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
                              if (missing.city) setMissing(m => ({ ...m, city: false }));
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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('address')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={[styles.inputWrapper, missing.address && styles.inputWrapperError]}>
                  <Ionicons name="map-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={address}
                    onChangeText={t => { setAddress(t); if (missing.address) setMissing(m => ({ ...m, address: false })); }}
                    autoCapitalize="words"
                    placeholder={i18n.t('address_placeholder')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18n.t('description')}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="document-text-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    placeholder={i18n.t('description_placeholder')}
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('monthlyFeesPerAgeGroup')}
                  <Text style={styles.required}> *</Text>
                </Text>
                {renderAgeRows().map((row, rowIdx) => (
                  <View key={rowIdx} style={styles.feeBubblesRow}>
                    {row.map((age) => (
                      <View key={age} style={{ alignItems: 'center', flex: 1 }}>
                        <TouchableOpacity
                          style={[
                            styles.feeBubble,
                            selectedAge === age && styles.feeBubbleSelected,
                          ]}
                          onPress={() => setSelectedAge(selectedAge === age ? null : age)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.feeBubbleText,
                            selectedAge === age && styles.feeBubbleTextSelected,
                          ]}>{age}</Text>
                        </TouchableOpacity>
                        {selectedAge === age && (
                          <Animated.View style={[styles.feeBubbleInputBox, { opacity: fadeAnim, transform: [{ scale: fadeAnim }] }]}>
                            <Text style={styles.feeInputLabel}>{i18n.t('enterFeeForAge', { age })}</Text>
                            <TextInput
                              style={styles.feeBubbleInput}
                              value={fees[age] || ''}
                              onChangeText={(val) => setFees({ ...fees, [age]: val.replace(/[^0-9]/g, '') })}
                              keyboardType="numeric"
                              placeholder={i18n.t('feePlaceholder')}
                              placeholderTextColor="#aaa"
                              maxLength={6}
                            />
                          </Animated.View>
                        )}
                      </View>
                    ))}
                    {/* Fill empty columns if needed for last row */}
                    {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, idx) => (
                      <View key={`empty-${idx}`} style={{ flex: 1 }} />
                    ))}
                  </View>
                ))}
                {errors.fees && <Text style={styles.errorText}>{errors.fees}</Text>}
              </View>

              {/* Private Training Settings */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeading}>{i18n.t('privateTraining') || 'Private Training'}</Text>
                <Text style={styles.sectionSubheading}>{i18n.t('privateTrainingDesc') || 'Add coach & private session details.'}</Text>
              </View>

              {privateTrainings.map((training, index) => (
                <View key={index} style={styles.trainingBlock}>
                  {privateTrainings.length > 1 && (
                    <View style={styles.trainingBlockHeader}>
                      <Text style={styles.trainingBlockTitle}>Training #{index + 1}</Text>
                      <TouchableOpacity onPress={() => removeTraining(index)} style={styles.removeTrainingBtn}>
                        <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{i18n.t('coachName') || 'Coach Name'}</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={training.coachName}
                        onChangeText={(v) => updateTraining(index, 'coachName', v)}
                        placeholder={i18n.t('coachNamePlaceholder') || 'Coach name'}
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{i18n.t('privateTrainingPrice') || 'Price per Session'}</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="cash-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={training.privateTrainingPrice}
                        onChangeText={(v) => updateTraining(index, 'privateTrainingPrice', v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder={i18n.t('privateTrainingPricePlaceholder') || 'e.g., 500'}
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{i18n.t('coachBio') || 'Coach Bio'}</Text>
                    <View style={[styles.inputWrapper, { minHeight: 90 }]}>
                      <Ionicons name="document-text-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { height: 80 }]}
                        value={training.coachBio}
                        onChangeText={(v) => updateTraining(index, 'coachBio', v)}
                        multiline
                        numberOfLines={4}
                        placeholder={i18n.t('coachBioPlaceholder') || 'Brief coach biography'}
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{i18n.t('specializations') || 'Specializations'}</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="list-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={training.specializations}
                        onChangeText={(v) => updateTraining(index, 'specializations', v)}
                        placeholder={i18n.t('specializationsPlaceholder') || 'Comma-separated (e.g., Strength, Agility)'}
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{i18n.t('sessionDuration') || 'Session Duration (min)'}</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="time-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={training.sessionDuration}
                        onChangeText={(v) => updateTraining(index, 'sessionDuration', v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="60"
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{i18n.t('availability') || 'Availability'}</Text>
                    <View style={[styles.inputWrapper, { minHeight: 90 }]}>
                      <Ionicons name="calendar-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { height: 80 }]}
                        value={training.availability}
                        onChangeText={(v) => updateTraining(index, 'availability', v)}
                        multiline
                        numberOfLines={4}
                        placeholder={i18n.t('availabilityPlaceholder') || 'e.g., Mon-Fri 4-8 PM'}
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addTrainingButton} onPress={addTraining}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addTrainingButtonText}>Add Another Private Training</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.signupButton, loading && styles.signupButtonDisabled]}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.signupButtonText}>{i18n.t('signup')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

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
  backButton: {
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
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  profileImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  required: {
    color: '#ff3b30',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  sectionSubheading: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  trainingBlock: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  trainingBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trainingBlockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  removeTrainingBtn: {
    padding: 4,
  },
  addTrainingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 8,
  },
  addTrainingButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
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
  inputWrapperError: {
    borderColor: '#ff3b30',
    backgroundColor: '#fff5f5',
  },
  cityPickerWrapper: {
    paddingHorizontal: 16,
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
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
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorSubmitText: {
    color: '#ff3b30',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  signupButton: {
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
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  feeBubblesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    width: '100%',
    gap: 8,
  },
  feeBubble: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 2,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    minWidth: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  feeBubbleSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  feeBubbleText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 18,
  },
  feeBubbleTextSelected: {
    color: '#fff',
  },
  feeBubbleInputBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 140,
    zIndex: 10,
  },
  feeBubbleInput: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 16,
    color: '#000',
    minWidth: 80,
    marginTop: 4,
    textAlign: 'left',
    fontWeight: '600',
  },
  feeInputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
});

export default SignupAcademy;