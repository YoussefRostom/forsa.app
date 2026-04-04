import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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
import { auth, db } from '../lib/firebase';
import { writeEmailIndex } from '../lib/emailIndex';
import { writePhoneIndex } from '../lib/phoneIndex';
import {
  validateCity,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
  validateRequired,
  normalizePhoneForAuth,
  normalizePhoneForTwilio,
} from '../lib/validations';
import i18n from '../locales/i18n';
// OTP functionality commented out - direct Firebase signup enabled
// import OtpModal from '../components/OtpModal';
// import { getBackendUrl } from '../lib/config';

const POSITIONS = [
  'GK', 'LB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST'
];

interface Errors {
  firstName?: string;
  lastName?: string;
  dob?: string;
  position?: string;
  email?: string;
  phone?: string;
  password?: string;
  profilePhoto?: string;
  nationalIdPhoto?: string;
  city?: string;
}



const SignupPlayer = () => {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [position, setPosition] = useState('');
  const [altPositions, setAltPositions] = useState<string[]>([]);
  const [highlightVideo, setHighlightVideo] = useState('');
  const [preferredFoot, setPreferredFoot] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [showCityModal, setShowCityModal] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [nationalIdPhoto, setNationalIdPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ [key: string]: boolean }>({});
  // OTP functionality commented out - direct Firebase signup enabled
  // const [showOtpModal, setShowOtpModal] = useState(false);
  // const [otpPhone, setOtpPhone] = useState('');  // normalized E.164 phone

  // Animation for transitions
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Format date for database (YYYY-MM-DD)
  const formatDateForDB = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  // Real-time validation
  const validateField = (field: string, value: any) => {
    let error: string | null = null;

    switch (field) {
      case 'firstName':
        error = validateName(value, 'First name');
        break;
      case 'lastName':
        error = validateName(value, 'Last name');
        break;
      case 'email':
        // Email is now optional - only validate if provided
        if (value && value.trim().length > 0) {
          error = validateEmail(value);
        }
        break;
      case 'phone':
        // Phone is now required
        error = validatePhone(value);
        break;
      case 'password':
        error = validatePassword(value);
        break;
      case 'city':
        error = validateCity(value);
        break;
      case 'dob':
        if (!dob) {
          error = 'Date of birth is required';
        } else {
          const today = new Date();
          const age = today.getFullYear() - dob.getFullYear();
          if (age < 5 || age > 100) {
            error = 'Please enter a valid date of birth';
          }
        }
        break;
      case 'position':
        error = validateRequired(value, 'Position');
        break;
      case 'profilePhoto':
        // Profile photo is optional
        break;
      case 'nationalIdPhoto':
        // National ID photo is optional
        break;
    }

    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
      setMissing(prev => ({ ...prev, [field]: true }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof Errors];
        return newErrors;
      });
      setMissing(prev => {
        const newMissing = { ...prev };
        delete newMissing[field];
        return newMissing;
      });
    }
    return error === null;
  };

  const validate = () => {
    const newErrors: Errors = {};
    const newMissing: { [key: string]: boolean } = {};

    const firstNameError = validateName(firstName, 'First name');
    if (firstNameError) {
      newErrors.firstName = firstNameError;
      newMissing.firstName = true;
    }

    const lastNameError = validateName(lastName, 'Last name');
    if (lastNameError) {
      newErrors.lastName = lastNameError;
      newMissing.lastName = true;
    }

    if (!dob) {
      newErrors.dob = 'Date of birth is required';
      newMissing.dob = true;
    } else {
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (age < 5 || age > 100) {
        newErrors.dob = 'Please enter a valid date of birth';
        newMissing.dob = true;
      }
    }

    const positionError = validateRequired(position, 'Position');
    if (positionError) {
      newErrors.position = positionError;
      newMissing.position = true;
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

    // Profile photo is optional
    // National ID photo is optional

    setErrors(newErrors);
    setMissing(newMissing);
    return Object.keys(newErrors).length === 0;
  };


  // OTP functionality commented out - direct Firebase signup enabled
  // const handleSignup = async () => {
  //   ... OTP code commented out ...
  // };

  /** Direct Firebase signup - OTP functionality commented out */
  const handleSignup = async () => {
    if (!validate()) {
      Alert.alert(i18n.t('missingFields'), i18n.t('fillAllRequiredFields'));
      return;
    }

    try {
      setLoading(true);
      setFormError('');

      // Step 1: Create Firebase Auth user directly (no OTP)
      const normalizedPhone = normalizePhoneForTwilio(phone);
      const phoneForAuth = normalizePhoneForAuth(normalizedPhone);
      const authEmail = `user_${phoneForAuth}@forsa.app`;

      // console.log('[Signup] Creating Firebase user with email:', authEmail);
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
      const user = userCredential.user;
      const uid = user.uid;
      // console.log('[Signup] Firebase user created! UID:', uid);

      // Step 2: Upload images to Cloudinary
      const dobString = formatDateForDB(dob);
      let profilePhotoUrl = '';
      let nationalIdPhotoUrl = '';
      if (profilePhoto) {
        // console.log('[Signup] Uploading profile photo to Cloudinary...');
        try {
          const cloudinaryResponse = await uploadMedia(profilePhoto, 'image');
          profilePhotoUrl = cloudinaryResponse.secure_url;
        } catch (error: any) {
          console.error('Error uploading profile photo:', error);
          throw new Error('Failed to upload profile photo. Please try again.');
        }
      }
      if (nationalIdPhoto) {
        // console.log('[Signup] Uploading national ID photo to Cloudinary...');
        try {
          const cloudinaryResponse = await uploadMedia(nationalIdPhoto, 'image');
          nationalIdPhotoUrl = cloudinaryResponse.secure_url;
        } catch (error: any) {
          console.error('Error uploading national ID photo:', error);
          // Don't throw here, national ID photo is optional
        }
      }

      // Step 3: Save extended player profile to Firestore
      const userData = {
        uid,
        role: 'player',
        email: email && email.trim().length > 0 ? email.trim() : null,
        phone,
        firstName,
        lastName,
        dob: dobString,
        preferredFoot,
        position,
        altPositions,
        city,
        profilePhoto: profilePhotoUrl,
        nationalIdPhoto: nationalIdPhotoUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // console.log('[Signup] Saving to Firestore...');
      await setDoc(doc(db, 'users', uid), userData, { merge: true });
      await setDoc(doc(db, 'players', uid), { ...userData, highlightVideo: highlightVideo || '' });

      // Save email → authEmail mapping for email-based login
      if (email && email.trim().length > 0) {
        await writeEmailIndex(email.trim(), authEmail);
      }
      await writePhoneIndex(phoneForAuth, authEmail);
      // console.log('[Signup] Firestore saved! User is logged in and navigating to player-feed...');

      // Step 4: Generate check-in code (non-blocking)
      try {
        const { ensureCheckInCodeForCurrentUser } = await import('../services/CheckInCodeService');
        await ensureCheckInCodeForCurrentUser();
      } catch { }

      // Step 5: User is already signed in via createUserWithEmailAndPassword, redirect to dashboard
      router.replace('/player-feed');
    } catch (err: any) {
      // console.log('[Signup] Error in handleSignup:', err.message, err);
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

  // OTP functionality commented out - direct Firebase signup enabled
  // /** Called by OtpModal after OTP is successfully verified and Firebase user is created by backend */
  // const handleOtpVerified = async (uid: string, token: string, refreshToken: string) => {
  //   ... commented out ...
  // };



  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDob(selectedDate);
      validateField('dob', selectedDate);
    }
  };

  // Image picker for profile photo
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  // Image picker for national ID photo
  const pickNationalIdPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNationalIdPhoto(result.assets[0].uri);
    }
  };

  // Toggle alternate positions
  const handleAltPositionToggle = (pos: string) => {
    setAltPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

          {/* OTP Modal */}
          {/* OTP functionality commented out - direct Firebase signup enabled */}
          {/* <OtpModal
            visible={showOtpModal}
            phone={otpPhone}
            password={password}
            role="player"
            email={email && email.trim().length > 0 ? email.trim() : undefined}
            onClose={() => setShowOtpModal(false)}
            onVerified={handleOtpVerified}
          /> */}
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{i18n.t('signup_player')}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('createYourPlayerAccount')}</Text>
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
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.profileImage} />
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
                {i18n.t('profile_picture')}
              </Text>
            </View>
            {/* Form Fields */}
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('first_name')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={[styles.inputWrapper, missing.firstName && styles.inputWrapperError]}>
                  <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={t => { setFirstName(t); if (missing.firstName) setMissing(m => ({ ...m, firstName: false })); validateField('firstName', t); }}
                    autoCapitalize="words"
                    placeholder={i18n.t('first_name_ph')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('last_name')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={[styles.inputWrapper, missing.lastName && styles.inputWrapperError]}>
                  <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={t => { setLastName(t); if (missing.lastName) setMissing(m => ({ ...m, lastName: false })); validateField('lastName', t); }}
                    autoCapitalize="words"
                    placeholder={i18n.t('last_name_ph')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('dob')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.inputWrapper, styles.datePickerWrapper, missing.dob && styles.inputWrapperError]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#999" style={styles.inputIcon} />
                  <Text style={[styles.dateText, !dob && styles.datePlaceholder]}>
                    {dob ? formatDate(dob) : i18n.t('dob_ph') || 'Select date of birth'}
                  </Text>
                </TouchableOpacity>
                {errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}
                {showDatePicker && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={dob || new Date(2010, 0, 1)}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    maximumDate={new Date()}
                    minimumDate={new Date(1920, 0, 1)}
                  />
                )}
                {Platform.OS === 'ios' && showDatePicker && (
                  <Modal
                    visible={showDatePicker}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowDatePicker(false)}
                  >
                    <View style={styles.iosDatePickerModal}>
                      <View style={styles.iosDatePickerHeader}>
                        <TouchableOpacity
                          style={styles.datePickerButton}
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text style={styles.datePickerButtonText}>{i18n.t('done') || 'Done'}</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={dob || new Date(2010, 0, 1)}
                        mode="date"
                        display="spinner"
                        onChange={onDateChange}
                        maximumDate={new Date()}
                        minimumDate={new Date(1920, 0, 1)}
                        style={styles.iosDatePicker}
                        textColor="#000"
                      />
                    </View>
                  </Modal>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('position')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={styles.positionsRow}>
                  {POSITIONS.map(pos => (
                    <TouchableOpacity
                      key={pos}
                      style={[styles.positionBtn, position === pos && styles.positionBtnSelected]}
                      onPress={() => { setPosition(pos); if (missing.position) setMissing(m => ({ ...m, position: false })); validateField('position', pos); }}
                    >
                      <Text style={[styles.positionBtnText, position === pos && styles.positionBtnTextSelected]}>{i18n.t(pos)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.position && <Text style={styles.errorText}>{errors.position}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18n.t('alternate_positions')}</Text>
                <View style={styles.positionsRow}>
                  {POSITIONS.map(pos => (
                    <TouchableOpacity
                      key={pos}
                      style={[styles.positionBtn, altPositions.includes(pos) && styles.positionBtnSelected]}
                      onPress={() => handleAltPositionToggle(pos)}
                    >
                      <Text style={[styles.positionBtnText, altPositions.includes(pos) && styles.positionBtnTextSelected]}>{i18n.t(pos)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                    {city ? (i18n.t('cities', { returnObjects: true }) as Record<string, string>)[city] || city : i18n.t('selectCity')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#999" />
                </TouchableOpacity>
                {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}

                {/* City Selection Modal */}
                <Modal
                  visible={showCityModal}
                  transparent={true}
                  animationType="fade"
                  onRequestClose={() => setShowCityModal(false)}
                >
                  <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCityModal(false)}
                  >
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{i18n.t('selectCity')}</Text>
                        <TouchableOpacity onPress={() => setShowCityModal(false)}>
                          <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
                        {Object.entries(i18n.t('cities', { returnObjects: true }) as Record<string, string>).map(([key, label]) => (
                          <TouchableOpacity
                            key={key}
                            style={[styles.cityOption, city === key && styles.cityOptionSelected]}
                            onPress={() => {
                              setCity(key);
                              if (missing.city) setMissing(m => ({ ...m, city: false }));
                              validateField('city', key);
                              setShowCityModal(false);
                            }}
                          >
                            <Text style={[styles.cityOptionText, city === key && styles.cityOptionTextSelected]}>
                              {label}
                            </Text>
                            {city === key && (
                              <Ionicons name="checkmark" size={20} color="#fff" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </TouchableOpacity>
                </Modal>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{i18n.t('highlight_video')}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="videocam-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={highlightVideo}
                    onChangeText={setHighlightVideo}
                    autoCapitalize="none"
                    placeholder={i18n.t('highlight_video_ph')}
                    placeholderTextColor="#999"
                  />
                </View>
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
                    onChangeText={t => { setPhone(t); if (missing.phone) setMissing(m => ({ ...m, phone: false })); validateField('phone', t); }}
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
                      // Only validate if email is provided
                      if (t && t.trim().length > 0) {
                        validateField('email', t);
                      } else {
                        // Clear error if field is empty (since it's optional)
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
                    onChangeText={t => { setPassword(t); if (missing.password) setMissing(m => ({ ...m, password: false })); validateField('password', t); }}
                    secureTextEntry
                    placeholder={i18n.t('password_ph')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('national_id_photo')}
                </Text>
                <TouchableOpacity onPress={pickNationalIdPhoto} style={styles.nationalIdContainer}>
                  {nationalIdPhoto ? (
                    <Image source={{ uri: nationalIdPhoto }} style={styles.nationalIdImage} />
                  ) : (
                    <View style={styles.nationalIdPlaceholder}>
                      <Ionicons name="document-outline" size={32} color="#999" />
                      <Text style={styles.nationalIdText}>{i18n.t('upload_national_id') || 'Upload National ID'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
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
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
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
  pickerWrapper: {
    paddingHorizontal: 0,
  },
  cityPickerWrapper: {
    justifyContent: 'space-between',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 16,
  },
  datePickerWrapper: {
    justifyContent: 'space-between',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 16,
  },
  datePlaceholder: {
    color: '#999',
  },
  iosDatePickerModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  iosDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  iosDatePicker: {
    height: 200,
    backgroundColor: '#fff',
  },
  datePickerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  datePickerButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  picker: {
    flex: 1,
    color: '#000',
  },
  pickerItem: {
    color: '#000',
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
  positionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  positionBtn: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    margin: 2,
    backgroundColor: '#f5f5f5',
  },
  positionBtnSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  positionBtnText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  positionBtnTextSelected: {
    color: '#fff',
  },
  nationalIdContainer: {
    width: '100%',
    marginBottom: 8,
  },
  nationalIdImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  nationalIdPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nationalIdText: {
    marginTop: 8,
    color: '#999',
    fontSize: 14,
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

export default SignupPlayer;