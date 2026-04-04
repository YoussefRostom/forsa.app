import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
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
import { auth, db } from '../lib/firebase';
import { writeEmailIndex } from '../lib/emailIndex';
import { writePhoneIndex } from '../lib/phoneIndex';
import {
  validateCity,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
  normalizePhoneForAuth,
  normalizePhoneForTwilio,
} from '../lib/validations';
import i18n from '../locales/i18n';
// OTP functionality commented out - direct Firebase signup enabled
// import OtpModal from '../components/OtpModal';
// import { getBackendUrl } from '../lib/config';

const cities = Object.entries(i18n.t('cities', { returnObjects: true }) as Record<string, string>);

interface Errors {
  parentName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  city?: string;
  children?: string;
  childAges?: string;
}

const SignupParent = () => {
  const router = useRouter();
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [children, setChildren] = useState<string[]>(['']);
  const [childAges, setChildAges] = useState<string[]>(['']);
  const [showAgeModals, setShowAgeModals] = useState<boolean[]>([false]);
  const [showCityModal, setShowCityModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [missing, setMissing] = useState<{ [key: string]: boolean }>({});
  const [formError, setFormError] = useState<string | null>(null);
  // OTP functionality commented out - direct Firebase signup enabled
  // const [showOtpModal, setShowOtpModal] = useState(false);
  // const [otpPhone, setOtpPhone] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const validate = () => {
    const newErrors: Errors = {};
    const newMissing: { [key: string]: boolean } = {};

    const parentNameError = validateName(parentName, 'Parent name');
    if (parentNameError) {
      newErrors.parentName = parentNameError;
      newMissing.parentName = true;
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

    if (!children[0] || children.some((c) => !c.trim())) {
      newErrors.children = 'At least one child name is required';
      newMissing.children = true;
    }
    if (!childAges[0] || childAges.some((a) => !a)) {
      newErrors.childAges = 'At least one child age is required';
      newMissing.childAges = true;
    }

    setErrors(newErrors);
    setMissing(newMissing);
    return Object.keys(newErrors).length === 0;
  };

  // OTP functionality commented out - direct Firebase signup enabled
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
      const userEmailForIndex = email && email.trim().length > 0 ? email.trim() : null;

      // console.log('[Signup] Creating Firebase user with email:', authEmail);
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
      const user = userCredential.user;
      const uid = user.uid;
      // console.log('[Signup] Firebase user created! UID:', uid);

      // Step 2: Save user data to Firestore
      const childrenData = children
        .map((name, idx) => ({ name: name.trim(), age: childAges[idx] || '' }))
        .filter(c => c.name && c.age);
      const userData = {
        uid,
        role: 'parent',
        email: email && email.trim().length > 0 ? email.trim() : null,
        phone,
        parentName,
        city,
        children: childrenData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', uid), userData, { merge: true });
      await setDoc(doc(db, 'parents', uid), userData);

      // Save email → authEmail mapping for email-based login
      if (userEmailForIndex) {
        await writeEmailIndex(userEmailForIndex, authEmail);
      }
      await writePhoneIndex(phoneForAuth, authEmail);

      // Step 3: Generate check-in code (non-blocking)
      try {
        const { ensureCheckInCodeForCurrentUser } = await import('../services/CheckInCodeService');
        await ensureCheckInCodeForCurrentUser();
      } catch { }

      // Step 4: User is already signed in, redirect to dashboard
      // console.log('[Signup] User is logged in and navigating to parent-feed...');
      router.replace('/parent-feed');
    } catch (err: any) {
      // console.log('[Signup] Error:', err.message, err);
      let errorMsg = i18n.t('signupFailedMessage');
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'This phone number is already registered';
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
  // const handleOtpVerified = async (uid: string, _token: string, _refreshToken: string) => {
  //   ... commented out ...
  // };



  const handleChildChange = (idx: number, value: string) => {
    setChildren((prev) => prev.map((c, i) => (i === idx ? value : c)));
  };
  const handleChildAgeChange = (idx: number, value: string) => {
    setChildAges((prev) => prev.map((a, i) => (i === idx ? value : a)));
  };
  const handleAddChild = () => {
    setChildren((prev) => [...prev, '']);
    setChildAges((prev) => [...prev, '']);
    setShowAgeModals((prev) => [...prev, false]);
  };
  const handleRemoveChild = (idx: number) => {
    if (children.length === 1) return;
    setChildren((prev) => prev.filter((_, i) => i !== idx));
    setChildAges((prev) => prev.filter((_, i) => i !== idx));
    setShowAgeModals((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleShowAgeModal = (idx: number, show: boolean) => {
    setShowAgeModals((prev) => prev.map((v, i) => (i === idx ? show : v)));
  };

  // Curved bar dimensions
  const { width } = Dimensions.get('window');
  const curveHeight = 120;

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
            role="parent"
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
              <Text style={styles.headerTitle}>{i18n.t('signup_parent')}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('createYourParentAccount') || 'Create your parent account'}</Text>
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

            {/* Form Fields */}
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {i18n.t('parent_name')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <View style={[styles.inputWrapper, missing.parentName && styles.inputWrapperError]}>
                  <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={parentName}
                    onChangeText={t => { setParentName(t); if (missing.parentName) setMissing(m => ({ ...m, parentName: false })); }}
                    autoCapitalize="words"
                    placeholder={i18n.t('parent_name_ph')}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.parentName && <Text style={styles.errorText}>{errors.parentName}</Text>}
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
                    {city ? cities.find(([key]) => key === city)?.[1] || city : i18n.t('selectCity')}
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
                        {cities.map(([key, label]) => (
                          <TouchableOpacity
                            key={key}
                            style={[styles.cityOption, city === key && styles.cityOptionSelected]}
                            onPress={() => {
                              setCity(key);
                              if (missing.city) setMissing(m => ({ ...m, city: false }));
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
                <Text style={styles.label}>
                  {i18n.t('child_names')}
                  <Text style={styles.required}> *</Text>
                </Text>
                {children.map((child, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={[styles.inputWrapper, { flex: 1, marginBottom: 0, marginRight: 8 }, errors.children && !child.trim() && styles.inputWrapperError]}>
                      <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder={i18n.t('child_name_ph') + ` ${idx + 1}`}
                        value={child}
                        onChangeText={(v) => handleChildChange(idx, v)}
                        autoCapitalize="words"
                        placeholderTextColor="#999"
                      />
                    </View>
                    <View style={{ marginLeft: 0 }}>
                      <TouchableOpacity
                        onPress={() => handleShowAgeModal(idx, true)}
                        style={[styles.inputWrapper, { width: 110, marginBottom: 0 }]}
                      >
                        <Text style={{ color: childAges[idx] ? '#000' : '#999', fontSize: 16 }}>
                          {childAges[idx] ? childAges[idx] : (i18n.t('selectAge') || 'Age')}
                        </Text>
                      </TouchableOpacity>
                      {showAgeModals[idx] && (
                        <View style={styles.ageModal}>
                          <ScrollView style={{ maxHeight: 120 }}>
                            {Array.from({ length: 12 }, (_, i) => 4 + i).map((age) => (
                              <TouchableOpacity
                                key={age}
                                onPress={() => {
                                  handleChildAgeChange(idx, age.toString());
                                  handleShowAgeModal(idx, false);
                                }}
                                style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: childAges[idx] === age.toString() ? '#eee' : '#fff' }}
                              >
                                <Text style={{ fontSize: 16, color: '#111' }}>{age}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                    {children.length > 1 && (
                      <TouchableOpacity onPress={() => handleRemoveChild(idx)} style={{ marginLeft: 8, padding: 8 }}>
                        <Ionicons name="close-circle" size={24} color="#ff3b30" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity onPress={handleAddChild} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                  <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>+ {i18n.t('add_child')}</Text>
                </TouchableOpacity>
                {errors.children && <Text style={styles.errorText}>{errors.children}</Text>}
                {errors.childAges && <Text style={styles.errorText}>{errors.childAges}</Text>}
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 16,
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
  required: {
    color: '#ff3b30',
  },
  ageModal: {
    position: 'absolute',
    top: 60,
    left: 0,
    width: 110,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
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

export default SignupParent;