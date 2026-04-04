import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, I18nManager, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';

export default function SignupPrivateTrainer() {
  const router = useRouter();
  const [language, setLanguage] = useState(i18n.locale);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [verificationImage, setVerificationImage] = useState(null);
  const [error, setError] = useState('');
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const cityList = [
    language === 'ar'
      ? ['القاهرة', 'الإسكندرية', 'الجيزة', 'المنصورة', 'أسيوط', 'طنطا', 'الزقازيق', 'دمياط', 'السويس', 'الأقصر', 'أسوان', 'بورسعيد', 'الإسماعيلية', 'العريش', 'شرم الشيخ', 'الغردقة']
      : ['Cairo', 'Alexandria', 'Giza', 'Mansoura', 'Assiut', 'Tanta', 'Zagazig', 'Damietta', 'Suez', 'Luxor', 'Aswan', 'Port Said', 'Ismailia', 'Arish', 'Sharm El-Sheikh', 'Hurghada']
  ][0];

  const pickImage = async (setter) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setter(result.assets[0].uri);
    }
  };

  const handleSignup = () => {
    setError('');
    if (!name || !email || !phone || !city || !password || !confirmPassword) {
      setError(i18n.t('all_fields_required'));
      return;
    }
    if (password !== confirmPassword) {
      setError(i18n.t('passwords_do_not_match'));
      return;
    }
    // TODO: Add further validation and backend integration
    router.replace('/player-home'); // Mock navigation after signup
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Curved Title Bar */}
      <View style={styles.curvedBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>{I18nManager.isRTL ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{language === 'ar' ? 'تسجيل مدرب خاص' : 'Private Trainer Signup'}</Text>
      </View>

      {/* Profile Image Upload */}
      <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setProfileImage)}>
        {profileImage ? (
          <Image source={{ uri: profileImage }} style={styles.profileImage} />
        ) : (
          <Text style={styles.imagePickerText}>{language === 'ar' ? 'تحميل صورة شخصية' : 'Upload Profile Photo'}</Text>
        )}
      </TouchableOpacity>

      {/* Form Fields */}
      <TextInput
        style={styles.input}
        placeholder={language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
        value={name}
        onChangeText={setName}
        placeholderTextColor="#888"
      />
      <TextInput
        style={styles.input}
        placeholder={language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#888"
      />
      <TextInput
        style={styles.input}
        placeholder={language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholderTextColor="#888"
      />
      {/* City Picker */}
      <TouchableOpacity
        style={styles.input}
        onPress={() => setCityModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={{ color: city ? '#111' : '#888', fontSize: 16 }}>
          {city ? city : language === 'ar' ? 'المدينة' : 'City'}
        </Text>
      </TouchableOpacity>
      <Modal
        visible={cityModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{language === 'ar' ? 'اختر المدينة' : 'Select City'}</Text>
            <FlatList
              data={cityList}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityItem}
                  onPress={() => {
                    setCity(item);
                    setCityModalVisible(false);
                  }}
                >
                  <Text style={styles.cityText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setCityModalVisible(false)} style={styles.closeModalBtn}>
              <Text style={styles.closeModalText}>{language === 'ar' ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <TextInput
        style={styles.input}
        placeholder={language === 'ar' ? 'كلمة المرور' : 'Password'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#888"
      />
      <TextInput
        style={styles.input}
        placeholder={language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        placeholderTextColor="#888"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.signupBtn} onPress={handleSignup}>
        <Text style={styles.signupBtnText}>{language === 'ar' ? 'تسجيل' : 'Sign Up'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 60 : 80,
    paddingBottom: 40,
    minHeight: '100%',
  },
  curvedBar: {
    width: '100%',
    backgroundColor: '#000',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingTop: 30,
    paddingBottom: 30,
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
    marginTop: -80
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    top: 38,
    zIndex: 10,
  },
  backArrow: {
    color: '#fff',
    fontSize: 28,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 50,
  },
  imagePicker: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  imagePickerText: {
    color: '#888',
    textAlign: 'center',
    fontSize: 14,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  verificationImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  input: {
    width: '85%',
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#111',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
    marginLeft: '8%',
  },
  signupBtn: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 16,
    width: '85%',
    alignItems: 'center',
    marginTop: 18,
  },
  signupBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    marginBottom: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxHeight: '70%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#111',
  },
  cityItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
    alignItems: 'center',
  },
  cityText: {
    fontSize: 16,
    color: '#111',
  },
  closeModalBtn: {
    marginTop: 16,
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeModalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
