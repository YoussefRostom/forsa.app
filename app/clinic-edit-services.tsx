import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import i18n from '../locales/i18n';

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

const ClinicEditServicesScreen = () => {
  const [services, setServices] = useState<{ key: string; price: string }[]>([]);
  const [customServices, setCustomServices] = useState<{ name: string; price: string }[]>([]);
  const { openMenu } = useHamburgerMenu();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'clinics', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedServices: { key: string; price: string }[] = [];
          
          if (data.services) {
            Object.keys(data.services).forEach(key => {
              if (data.services[key].selected) {
                 loadedServices.push({ key, price: data.services[key].fee || '' });
              }
            });
          }
          setServices(loadedServices);
          
          if (data.customServices) {
            setCustomServices(data.customServices);
          }
        }
      } catch (err) {
        console.error("Error fetching services", err);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const handleServiceToggle = (key: string) => {
    setServices((prev) =>
      prev.some((s) => s.key === key)
        ? prev.filter((s) => s.key !== key)
        : [...prev, { key, price: '' }]
    );
  };
  const handleServicePriceChange = (key: string, price: string) => {
    setServices((prev) => prev.map((s) => s.key === key ? { ...s, price } : s));
  };
  const handleAddCustomService = () => {
    setCustomServices((prev) => [...prev, { name: '', price: '' }]);
  };
  const handleCustomServiceChange = (idx: number, field: 'name' | 'price', value: string) => {
    setCustomServices((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };
  
  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      const servicesData: any = {};
      allServices.forEach(s => {
        servicesData[s.key] = { selected: false, fee: '' };
      });
      services.forEach(s => {
        servicesData[s.key] = { selected: true, fee: s.price };
      });

      const updateData = {
        services: servicesData,
        customServices
      };

      await setDoc(doc(db, 'clinics', auth.currentUser.uid), updateData, { merge: true });
      await setDoc(doc(db, 'users', auth.currentUser.uid), updateData, { merge: true });

      Alert.alert(i18n.t('success') || 'Success', 'service edit successfully');
    } catch (err) {
      console.error("Error saving services", err);
      Alert.alert(i18n.t('error') || 'Error', 'Failed to update services');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{i18n.t('editServices') || 'Edit Services'}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('manageYourServices') || 'Manage your clinic services'}</Text>
            </View>
          </View>

          <HamburgerMenu />

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>{i18n.t('services_offered') || 'Services Offered'}</Text>
              <View style={styles.servicesGrid}>
                {allServices.map((service) => {
            const selected = services.some((s) => s.key === service.key);
            const isOther = service.key === 'other';
            return (
                    <View key={service.key} style={styles.serviceItem}>
                <TouchableOpacity
                        style={[styles.serviceButton, selected && styles.serviceButtonSelected]}
                  onPress={() => handleServiceToggle(service.key)}
                        activeOpacity={0.8}
                >
                        <Ionicons 
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'} 
                          size={20} 
                          color={selected ? '#fff' : '#999'} 
                          style={styles.serviceIcon}
                        />
                        <Text style={[styles.serviceLabel, selected && styles.serviceLabelSelected]}>
                          {service.label}
                        </Text>
                </TouchableOpacity>
                {selected && !isOther && (
                        <View style={styles.feeContainer}>
                    <TextInput
                            style={styles.feeInput}
                      placeholder={i18n.t('feePlaceholder') || 'Fee'}
                      value={services.find(s => s.key === service.key)?.price || ''}
                      onChangeText={(v) => handleServicePriceChange(service.key, v)}
                      keyboardType="numeric"
                            placeholderTextColor="#999"
                    />
                          <Text style={styles.feeLabel}>EGP</Text>
                  </View>
                )}
                {selected && isOther && (
                        <View style={styles.customServicesContainer}>
                    {customServices.map((cs, idx) => (
                            <View key={idx} style={styles.customServiceRow}>
                        <TextInput
                                style={styles.customServiceName}
                          placeholder={i18n.t('service_name_placeholder') || 'Service name'}
                          value={cs.name}
                          onChangeText={(v) => handleCustomServiceChange(idx, 'name', v)}
                                placeholderTextColor="#999"
                        />
                              <View style={styles.feeContainer}>
                        <TextInput
                                  style={styles.feeInput}
                          placeholder={i18n.t('feePlaceholder') || 'Fee'}
                          value={cs.price}
                          onChangeText={(v) => handleCustomServiceChange(idx, 'price', v)}
                          keyboardType="numeric"
                                  placeholderTextColor="#999"
                        />
                                <Text style={styles.feeLabel}>EGP</Text>
                              </View>
                      </View>
                    ))}
                          <TouchableOpacity 
                            style={styles.addServiceButton} 
                            onPress={handleAddCustomService}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="add-circle-outline" size={20} color="#000" />
                            <Text style={styles.addServiceText}> {i18n.t('add_service') || 'Add Service'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.7 }]}
                activeOpacity={0.8}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{i18n.t('save') || 'Save'}</Text>
                )}
        </TouchableOpacity>
            </View>
      </ScrollView>
        </View>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  servicesGrid: {
    marginBottom: 20,
  },
  serviceItem: {
    marginBottom: 16,
  },
  serviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#f5f5f5',
  },
  serviceButtonSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  serviceIcon: {
    marginRight: 12,
  },
  serviceLabel: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  serviceLabelSelected: {
    color: '#fff',
  },
  feeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  feeInput: {
    minWidth: 80,
    borderBottomWidth: 1,
    borderColor: '#000',
    fontSize: 14,
    padding: 4,
    color: '#000',
    textAlign: 'center',
  },
  feeLabel: {
    color: '#666',
    fontSize: 13,
    marginLeft: 4,
  },
  customServicesContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  customServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customServiceName: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    fontSize: 14,
    padding: 4,
    marginRight: 8,
    color: '#000',
  },
  addServiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
  },
  addServiceText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
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
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default ClinicEditServicesScreen;
