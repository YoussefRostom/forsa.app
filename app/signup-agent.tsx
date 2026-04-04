import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';

const SignupAgent = () => {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [agency, setAgency] = useState('');
  const [license, setLicense] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleSignup = async () => {
    if (!firstName || !lastName || !email || !phone || !agency || !license || !password || !profilePhoto) {
      Alert.alert(i18n.t('missingFields'), i18n.t('fillAllRequiredFields'));
      return;
    }
    setLoading(true);
    // Simulate signup without backend
    setTimeout(() => {
      setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setAgency(''); setLicense(''); setPassword(''); setProfilePhoto(null);
      setLoading(false);
      router.replace('/agent-feed');
    }, 1000);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Curved Black Bar with Back Arrow and Title */}
      <View style={{ backgroundColor: '#111', height: 120, borderBottomLeftRadius: 400, borderBottomRightRadius: 400, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24, position: 'relative' }}>
        <Pressable onPress={() => router.back()} style={{ position: 'absolute', left: 24, top: 60, zIndex: 2 }}>
          <Text style={{ color: '#fff', fontSize: 28 }}>{'←'}</Text>
        </Pressable>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: 'bold' }}>{i18n.t('signup_agent')}</Text>
      </View>
      <ScrollView 
        contentContainerStyle={styles.container} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Photo Preview */}
        <Pressable onPress={pickImage} style={{ alignItems: 'center', marginBottom: 18 }}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={{ width: 90, height: 90, borderRadius: 45, marginBottom: 6 }} />
          ) : (
            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Text style={{ color: '#888', fontSize: 32 }}>+</Text>
            </View>
          )}
          <Text style={{ color: '#111', fontSize: 14 }}>{i18n.t('profilePicture')}</Text>
        </Pressable>
        <Text style={styles.fieldLabel}>{i18n.t('first_name')}</Text>
        <TextInput style={styles.input} placeholder={i18n.t('first_name')} value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <Text style={styles.fieldLabel}>{i18n.t('last_name')}</Text>
        <TextInput style={styles.input} placeholder={i18n.t('last_name')} value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        <Text style={styles.fieldLabel}>{i18n.t('email')}</Text>
        <TextInput style={styles.input} placeholder={i18n.t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.fieldLabel}>{i18n.t('phone')}</Text>
        <TextInput style={styles.input} placeholder={i18n.t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Text style={styles.fieldLabel}>{i18n.t('agencyName')}</Text>
        <TextInput style={styles.input} placeholder={i18n.t('agencyName')} value={agency} onChangeText={setAgency} autoCapitalize="words" />
        <Text style={styles.fieldLabel}>{i18n.t('licenseNumber')}</Text>
        <TextInput style={styles.input} placeholder={i18n.t('licenseNumber')} value={license} onChangeText={setLicense} autoCapitalize="none" />
        {/* City Dropdown */}
        <Text style={styles.fieldLabel}>{i18n.t('city')}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 18 }}>
          <View style={{ flex: 1, marginHorizontal: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#111', borderRadius: 8, minWidth: 140, maxWidth: 220 }}>
            <Picker
              selectedValue={city}
              onValueChange={setCity}
              style={{ color: '#111', backgroundColor: '#fff', width: '100%' }}
              itemStyle={{ color: '#111', textAlign: 'center' }}
              mode="dropdown"
            >
              <Picker.Item label={i18n.t('selectCity')} value="" color="#888" />
              {Object.entries(i18n.t('cities', { returnObjects: true }) as Record<string, string>).map(([key, label]) => (
                <Picker.Item key={key} label={label} value={key} color="#111" />
              ))}
            </Picker>
          </View>
        </View>
        <Text style={styles.fieldLabel}>{i18n.t('password')}</Text>
        <TextInput style={styles.input} placeholder={i18n.t('password')} value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? i18n.t('loading') : i18n.t('signup')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff', paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#111', padding: 16, borderRadius: 8, alignItems: 'center', width: '100%' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  fieldLabel: { alignSelf: 'flex-start', color: '#111', fontWeight: '600', marginBottom: 2, fontSize: 15 },
});

export default SignupAgent;