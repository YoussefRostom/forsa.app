import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { writeEmailIndex } from '../lib/emailIndex';
import { writePhoneIndex } from '../lib/phoneIndex';
import { normalizePhoneForAuth } from '../lib/validations';
import React, { useRef, useState } from 'react';
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
  View
} from 'react-native';
import { uploadMedia } from '../services/MediaService';
// import { db } from '../lib/firebase'; // Already imported above
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
// import OtpModal from '../components/OtpModal'; // Removed
import { getBackendUrl } from '../lib/config';

function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time); // Matches HH:mm from 00:00 to 23:59
}

interface Errors {
  clinicName?: string;
  email?: string;
  password?: string;
  city?: string;
  address?: string;
  phone?: string;
  services?: string;
  workingHours?: string;
  doctors?: string;
}

const SignupClinic = () => {
  const router = useRouter();
  const [clinicName, setClinicName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState('');
  const [showCityModal, setShowCityModal] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [missing, setMissing] = useState<{ [key: string]: boolean }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const cityOptions = Object.entries(i18n.t('cities', { returnObjects: true }) as Record<string, string>).map(([key, label]) => ({ key, label }));

  // Only store selected service keys (keep this one, remove duplicate below)
  const allServices = [
    { key: 'spa', label: i18n.t('spa') || 'Spa' },
    { key: 'sauna', label: i18n.t('sauna') || 'Sauna' },
    { key: 'physio', label: i18n.t('physio') || 'Physiotherapy' },
    { key: 'ice_bath', label: i18n.t('ice_bath') || 'Ice Bath' },
    { key: 'massage', label: i18n.t('massage') || 'Massage' },
    { key: 'full_recovery', label: i18n.t('full_recovery') || 'Full Recovery' },
    { key: 'nutrition', label: i18n.t('nutrition') || 'Nutrition' },
    { key: 'rehab', label: i18n.t('rehab') || 'Rehabilitation' },
    { key: 'stretching', label: i18n.t('stretching') || 'Stretching' },
    { key: 'other', label: i18n.t('other') || 'Other' },
  ];

  const [services, setServices] = useState(() =>
    Object.fromEntries(allServices.map(({ key }) => [key, { selected: false, fee: '' }]))
  );
  // Store prices for each service
  const [customServices, setCustomServices] = useState<{ name: string; price: string }[]>([]);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [workingHours, setWorkingHours] = useState<Record<string, { from: string; to: string; doctors: string; off?: boolean }>>({});
  // Doctors list: array of { name: string, major?: string }
  const [doctors, setDoctors] = useState<{ name: string; major?: string; description?: string; photoUri?: string }[]>([]);
  const [timePicker, setTimePicker] = useState<{ visible: boolean, mode: 'from' | 'to', day: string | null }>({ visible: false, mode: 'from', day: null });
  const [tempTime, setTempTime] = useState(new Date());

  const [description, setDescription] = useState('');
  const cities = Object.entries(i18n.t('cities', { returnObjects: true }) as Record<string, string>);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  const validate = () => {
    const newErrors: Errors = {};
    const newMissing: { [key: string]: boolean } = {};

    const clinicNameError = validateRequired(clinicName, i18n.t('clinic_name') || 'Clinic name');
    if (clinicNameError) {
      newErrors.clinicName = clinicNameError;
      newMissing.clinicName = true;
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

    const hasSelectedService = Object.values(services).some(s => s.selected);
    if (!hasSelectedService) {
      newErrors.services = i18n.t('atLeastOneServiceRequired') || 'At least one service must be selected';
      newMissing.services = true;
    }

    // Validate that all selected services have fees
    const selectedServicesWithoutFees = Object.entries(services)
      .filter(([key, service]) => service.selected && (!service.fee || service.fee.trim() === ''))
      .map(([key]) => key);

    if (selectedServicesWithoutFees.length > 0) {
      newErrors.services = i18n.t('feeRequiredForSelectedServices') || 'Fee is required for all selected services';
      newMissing.services = true;
    }

    // Validate working hours - at least one day must be active with valid times
    const daysOfWeekList = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const activeDays = daysOfWeekList.filter(day => {
      const dayConfig = workingHours[day];
      return dayConfig && !dayConfig.off && dayConfig.from && dayConfig.to &&
        isValidTimeFormat(dayConfig.from) && isValidTimeFormat(dayConfig.to);
    });

    if (activeDays.length === 0) {
      newErrors.workingHours = i18n.t('workingHoursRequired') || 'At least one day with working hours is required';
      newMissing.workingHours = true;
    }

    // At least one doctor required, each with name filled
    if (!doctors.length) {
      newErrors.doctors = i18n.t('atLeastOneDoctorRequired') || 'At least one doctor is required';
      newMissing.doctors = true;
    } else {
      const invalidDoctor = doctors.findIndex(d => !d.name || !d.name.trim());
      if (invalidDoctor >= 0) {
        newErrors.doctors = i18n.t('doctorNameRequired') || 'Doctor name is required for all doctors';
        newMissing.doctors = true;
      }
    }

    setErrors(newErrors);
    setMissing(newMissing);
    return Object.keys(newErrors).length === 0;
  };

  const normalizedHours: Record<string, { from: string; to: string; doctors: string; off?: boolean }> = { ...workingHours };
  for (const day of Object.keys(normalizedHours)) {
    const config = normalizedHours[day];
    if (!config.off) {
      if (!config.from) config.from = '09:00';
      if (!config.to) config.to = '17:00';
    }
  }

  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleSignup = async () => {
    if (!validate()) {
      Alert.alert(i18n.t('missingFields'), i18n.t('fillAllRequiredFields'));
      return;
    }
    try {
      setLoading(true);
      setFormError('');

      // Step 1: Create Firebase Auth user
      const normalizedPhone = normalizePhoneForTwilio(phone);
      const phoneForAuth = normalizePhoneForAuth(normalizedPhone);
      const authEmail = `user_${phoneForAuth}@forsa.app`;

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

      // Step 3: Prepare and save data
      const servicesData: { [key: string]: { selected: boolean; fee: string } } = {};
      Object.entries(services).forEach(([key, val]) => {
        servicesData[key] = { selected: val.selected, fee: val.fee || '' };
      });

      const userData = {
        uid,
        role: 'clinic',
        email: email && email.trim().length > 0 ? email.trim() : null,
        phone,
        clinicName,
        city,
        address,
        description,
        workingHours: normalizedHours,
        doctors,
        services: servicesData,
        customServices,
        profilePhoto: profilePhotoUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', uid), userData, { merge: true });
      await setDoc(doc(db, 'clinics', uid), userData);

      // Save email → authEmail mapping
      if (email && email.trim().length > 0) {
        await writeEmailIndex(email.trim(), authEmail);
      }
      await writePhoneIndex(phoneForAuth, authEmail);

      router.replace('/clinic-feed');
    } catch (err: any) {
      console.log('[Signup] Error:', err.message);
      let errorMsg = i18n.t('signupFailedMessage');
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = i18n.t('emailAlreadyRegistered') || 'This phone number is already registered';
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

  const handleServiceToggle = (key: string) => {
    setServices((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        selected: !prev[key].selected,
        fee: !prev[key].selected ? prev[key].fee : '',
      },
    }));
  };
  const handleAddCustomService = () => {
    setCustomServices((prev) => [...prev, { name: '', price: '' }]);
  };
  const handleCustomServiceChange = (idx: number, field: 'name' | 'price', value: string) => {
    setCustomServices((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(i18n.t('permissionDenied') || 'Permission denied', i18n.t('mediaLibraryPermissionRequired') || 'Media library permission is required.');
      return;
    }
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
              <Text style={styles.headerTitle}>{i18n.t('signup_clinic')}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('createYourClinicAccount') || 'Create your clinic account'}</Text>
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
                  {i18n.t('clinic_name')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={[styles.inputWrapper, missing.clinicName && styles.inputWrapperError]}>
                  <Ionicons name="business-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={clinicName}
                    onChangeText={t => { setClinicName(t); if (missing.clinicName) setMissing(m => ({ ...m, clinicName: false })); }}
                    autoCapitalize="words"
                    placeholder={i18n.t('clinic_name_ph') || i18n.t('clinic_name')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.clinicName && <Text style={styles.errorText}>{errors.clinicName}</Text>}
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
                    placeholder={i18n.t('phone_ph')}
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
                    placeholder={i18n.t('password_ph')}
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
                    placeholder={i18n.t('address_ph')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('description')}
                </Text>
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
                  {i18n.t('services_offered')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={{ flexDirection: 'column', marginBottom: 8, width: '100%' }}>
                  {allServices.map(({ key, label }) => {
                    const selected = services[key]?.selected;
                    return (
                      <View key={key} style={styles.serviceRow}>
                        <TouchableOpacity
                          onPress={() => {
                            handleServiceToggle(key);
                            if (missing.services) setMissing(m => ({ ...m, services: false }));
                          }}
                          style={[styles.checkbox, selected && styles.checkboxSelected]}
                        >
                          {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                        </TouchableOpacity>
                        <Text style={styles.serviceLabel}>{label}</Text>
                        <TextInput
                          placeholder={i18n.t('feePlaceholder') || 'Fee'}
                          placeholderTextColor="#999"
                          keyboardType="numeric"
                          value={services[key]?.fee || ''}
                          onChangeText={(val) => {
                            setServices((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], fee: val },
                            }));
                            // Clear fee error when user starts typing
                            if (missing.services) setMissing(m => ({ ...m, services: false }));
                          }}
                          style={[
                            styles.feeInput,
                            selected && (!services[key]?.fee || services[key]?.fee.trim() === '') && missing.services && styles.feeInputError
                          ]}
                          editable={!!selected}
                        />
                      </View>
                    );
                  })}
                </View>
                {errors.services && <Text style={styles.errorText}>{errors.services}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('working_hours')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <WorkingHoursInput value={workingHours} onChange={(v) => {
                  setWorkingHours(v);
                  if (missing.workingHours) setMissing(m => ({ ...m, workingHours: false }));
                }} />
                {errors.workingHours && <Text style={styles.errorText}>{errors.workingHours}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('doctors')} <Text style={{ color: '#e00', fontSize: 13 }}>*</Text>
                </Text>
                <View style={{ width: '100%', marginBottom: 16 }}>
                  {doctors.length > 0 && (
                    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                      <Text style={{ flex: 2, fontWeight: '600', color: '#111', fontSize: 14, marginRight: 8 }}>{i18n.t('doctor_name') || 'Name'}</Text>
                      <Text style={{ flex: 2, fontWeight: '600', color: '#111', fontSize: 14, marginRight: 8 }}>{i18n.t('doctor_major') || 'Speciality'}</Text>
                      <View style={{ width: 24 }} />
                    </View>
                  )}
                  {doctors.map((doc, idx) => (
                    <View key={idx} style={{ marginBottom: 14, backgroundColor: '#fafbfc', borderRadius: 10, borderWidth: 1, borderColor: '#eee', padding: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <TextInput
                          style={{ flex: 2, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, fontSize: 15, marginRight: 8, backgroundColor: '#fff' }}
                          placeholder={i18n.t('doctor_name') || 'Doctor Name'}
                          value={doc.name}
                          onChangeText={v => setDoctors(prev => prev.map((d, i) => i === idx ? { ...d, name: v } : d))}
                        />
                        <TextInput
                          style={{ flex: 2, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, fontSize: 15, marginRight: 8, backgroundColor: '#fff' }}
                          placeholder={i18n.t('doctor_major') || 'Speciality'}
                          value={doc.major || ''}
                          onChangeText={v => setDoctors(prev => prev.map((d, i) => i === idx ? { ...d, major: v } : d))}
                        />
                        <TouchableOpacity onPress={() => setDoctors(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 6, backgroundColor: '#eee', borderRadius: 6 }}>
                          <Text style={{ color: '#e00', fontWeight: 'bold', fontSize: 18 }}>×</Text>
                        </TouchableOpacity>
                      </View>
                      {/* Doctor Photo Picker */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        {doc.photoUri ? (
                          <Image source={{ uri: doc.photoUri }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: '#bbb', marginRight: 10 }} />
                        ) : (
                          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#bbb', marginRight: 10 }}>
                            <Text style={{ color: '#888', fontSize: 24 }}>+</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={async () => {
                            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                            if (status !== 'granted') {
                              Alert.alert(i18n.t('permissionDenied') || 'Permission denied', i18n.t('mediaLibraryPermissionRequired') || 'Media library permission is required.');
                              return;
                            }
                            const result = await ImagePicker.launchImageLibraryAsync({
                              mediaTypes: ImagePicker.MediaTypeOptions.Images,
                              allowsEditing: true,
                              aspect: [1, 1],
                              quality: 0.7,
                            });
                            if (!result.canceled && result.assets && result.assets.length > 0) {
                              setDoctors(prev => prev.map((d, i) => i === idx ? { ...d, photoUri: result.assets[0].uri } : d));
                            }
                          }}
                          style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#f4f4f4', borderRadius: 8 }}
                        >
                          <Text style={{ color: '#111', fontWeight: 'bold', fontSize: 14 }}>{i18n.t('add_profile_picture') || 'Add Photo'}</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontWeight: '600', color: '#111', fontSize: 14, marginBottom: 4 }}>
                        {i18n.t('doctor_description_title') || 'Doctor Description (optional)'}
                      </Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, fontSize: 15, backgroundColor: '#fff', minHeight: 40, textAlignVertical: 'top' }}
                        placeholder={i18n.t('doctor_description') || 'Doctor Description (optional)'}
                        value={doc.description || ''}
                        multiline
                        onChangeText={v => setDoctors(prev => prev.map((d, i) => i === idx ? { ...d, description: v } : d))}
                      />
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => setDoctors(prev => [...prev, { name: '', major: '' }])} style={{ padding: 10, backgroundColor: '#f4f4f4', borderRadius: 8, alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: '#111', fontWeight: 'bold', fontSize: 15 }}>+ {i18n.t('add_doctor') || 'Add Doctor'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.doctors && <Text style={styles.errorText}>{errors.doctors}</Text>}
              </View>

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
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000',
    marginRight: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  serviceLabel: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    marginRight: 10,
  },
  feeInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  feeInputError: {
    borderColor: '#ff3b30',
    backgroundColor: '#fff5f5',
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
});

// Simple WorkingHoursInput component implementation
type WorkingHoursInputProps = {
  value: Record<string, { from: string; to: string; doctors: string; off?: boolean }>;
  onChange: (v: Record<string, { from: string; to: string; doctors: string; off?: boolean }>) => void;
};

const daysOfWeek = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

const WorkingHoursInput: React.FC<WorkingHoursInputProps> = ({ value, onChange }) => {
  const [dropdown, setDropdown] = React.useState<{ day: string; mode: 'from' | 'to' } | null>(null);
  // Generate time options in 15-min increments
  const timeOptions: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  // Helper function to format time in 12-hour format with AM/PM
  const formatTime12Hour = (time24: string): string => {
    if (!time24 || !isValidTimeFormat(time24)) return time24;
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Function to get display time (formatted or default text)
  const getDisplayTime = (day: string, mode: 'from' | 'to'): string => {
    const time24 = value[day]?.[mode] || ''; // Ensure time24 is a string
    return time24 ? formatTime12Hour(time24) : (i18n.t(mode) || (mode === 'from' ? 'From' : 'To'));
  };

  return (
    <View style={{ width: '100%', marginBottom: 16 }}>
      {daysOfWeek.map((day) => (
        <View key={day} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, position: 'relative', zIndex: dropdown && dropdown.day === day ? 10 : 1 }}>
          <Text style={{ width: 80, fontWeight: '600', color: '#111', fontSize: 14 }}>{i18n.t(day) || day}</Text>
          <TouchableOpacity
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 6,
              padding: 6,
              marginRight: 4,
              backgroundColor: '#fff',
              justifyContent: 'center',
              opacity: value[day]?.off ? 0.4 : 1,
            }}
            onPress={() => !value[day]?.off && setDropdown({ day, mode: 'from' })}
            activeOpacity={0.7}
            disabled={!!value[day]?.off}
          >
            <Text style={{ color: '#111', fontSize: 14 }}>{getDisplayTime(day, 'from')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 6,
              padding: 6,
              marginRight: 4,
              backgroundColor: '#fff',
              justifyContent: 'center',
              opacity: value[day]?.off ? 0.4 : 1,
            }}
            onPress={() => !value[day]?.off && setDropdown({ day, mode: 'to' })}
            activeOpacity={0.7}
            disabled={!!value[day]?.off}
          >
            <Text style={{ color: '#111', fontSize: 14 }}>{getDisplayTime(day, 'to')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onChange({ ...value, [day]: { ...value[day], off: !value[day]?.off } })}
            style={{ padding: 6, backgroundColor: value[day]?.off ? '#e00' : '#eee', borderRadius: 6, marginLeft: 4 }}
          >
            <Text style={{ color: value[day]?.off ? '#fff' : '#111', fontWeight: 'bold', fontSize: 13 }}>
              {i18n.t('off') || 'Off'}
            </Text>
          </TouchableOpacity>
          {/* Dropdown overlay for time selection */}
          {dropdown && dropdown.day === day && (
            <View style={{ position: 'absolute', top: 38, left: 80, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#aaa', borderRadius: 8, zIndex: 100, maxHeight: 220, elevation: 8 }}>
              <ScrollView style={{ maxHeight: 220 }}>
                {timeOptions.map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      onChange({
                        ...value,
                        [day]: {
                          ...value[day],
                          [dropdown.mode]: t,
                        },
                      });
                      setDropdown(null);
                    }}
                    style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: (value[day]?.[dropdown.mode] === t) ? '#f0f0f0' : '#fff' }}
                  >
                    <Text style={{ color: '#111', fontSize: 15 }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={() => setDropdown(null)} style={{ padding: 10, alignItems: 'center' }}>
                <Text style={{ color: '#e00', fontWeight: 'bold' }}>{i18n.t('cancel') || 'Cancel'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

export default SignupClinic;
