import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { Alert, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import i18n from '../locales/i18n';

const ClinicServicesScreen = () => {
  const { openMenu } = useHamburgerMenu();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  const services = [
    {
      key: 'priorityListing',
      title: i18n.t('clinicPriorityListing'),
      description: (
        <>
          <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{i18n.t('clinicPriorityListingDesc')}</Text>
          {'\n'}
          <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{i18n.t('clinicPriorityListingOneTime')}</Text>
          <Text style={{ color: '#ffd700', fontWeight: 'bold' }}>: EGP 90</Text>
          {'\n'}
          <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{i18n.t('clinicPriorityListingMonthly')}</Text>
          <Text style={{ color: '#ffd700', fontWeight: 'bold' }}>: EGP 149</Text>
        </>
      ),
      price: '',
      icon: 'star-outline',
    },
    {
      key: 'videoTour',
      title: i18n.t('clinicVideoTour'),
      description: i18n.t('clinicVideoTourDesc') + ' ' + i18n.t('clinicVideoTourPricing'),
      price: 'EGP 2500',
      icon: 'videocam-outline',
    },
    {
      key: 'clinicBundle',
      title: i18n.t('clinicBundle'),
      description: null,
      price: 'EGP 250',
      special: true,
      payment: true,
      icon: 'gift-outline',
    },
  ];

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
              <Text style={styles.headerTitle}>{i18n.t('clinicAssistance') || 'Assistance & Extras'}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('boostYourClinic') || 'Boost your clinic with premium services'}</Text>
            </View>
          </View>

          <HamburgerMenu />

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
        <Text style={styles.intro}>{i18n.t('clinicServicesIntro') || 'Boost your clinic with our premium services:'}</Text>
        {services.map(service => (
              <View key={service.key} style={[styles.serviceCard, service.special && styles.specialCard]}>
                <View style={styles.serviceHeader}>
                  <View style={[styles.serviceIcon, service.special && styles.specialIcon]}>
                    <Ionicons name={service.icon as any} size={28} color={service.special ? '#000' : '#fff'} />
                  </View>
                  <View style={styles.serviceHeaderText}>
            <Text style={[styles.serviceTitle, service.special && styles.specialTitle]}>{service.title}</Text>
                    {service.price && (
                      <Text style={[styles.servicePrice, service.special && styles.specialPrice]}>{service.price}</Text>
                    )}
                  </View>
                </View>
                {service.special ? (
                  <View style={styles.bundleContent}>
                    <Text style={[styles.serviceDesc, styles.specialDesc]}>{i18n.t('clinicBundleIncludes')}</Text>
                    <View style={styles.bundleList}>
                      <Text style={[styles.serviceDesc, styles.specialDesc]}>• {i18n.t('clinicBundlePriority')} (4 {i18n.t('postsPerMonth')})</Text>
                      <Text style={[styles.serviceDesc, styles.specialDesc]}>• {i18n.t('clinicBundleNewsletter')}</Text>
                    </View>
                    <Text style={[styles.servicePrice, styles.specialPrice, { marginTop: 8 }]}>{service.price}</Text>
              </View>
            ) : (
                  <View>
              <Text style={[styles.serviceDesc, service.special && styles.specialDesc]}>{service.description}</Text>
                  </View>
            )}
            <TouchableOpacity
              style={[styles.buyBtn, service.special && styles.specialBuyBtn]}
              onPress={() => {
                if (service.payment) {
                      Alert.alert(i18n.t('paymentComingSoon') || 'Payment coming soon!');
                }
              }}
                  activeOpacity={0.8}
            >
                  <Text style={[styles.buyBtnText, service.special && styles.specialBuyBtnText]}>
                    {service.payment ? (i18n.t('subscribeNow') || 'Subscribe Now') : (i18n.t('buyNow') || 'Buy Now')}
                  </Text>
            </TouchableOpacity>
          </View>
        ))}
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
  intro: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
    opacity: 0.9,
  },
  serviceCard: {
    backgroundColor: '#000',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#222',
  },
  specialCard: {
    backgroundColor: '#ffd700',
    borderColor: '#fff',
    borderWidth: 2,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  specialIcon: {
    backgroundColor: '#000',
  },
  serviceHeaderText: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  specialTitle: {
    color: '#000',
  },
  servicePrice: {
    fontSize: 18,
    color: '#ffd700',
    fontWeight: 'bold',
  },
  specialPrice: {
    color: '#000',
  },
  serviceDesc: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
    lineHeight: 22,
  },
  specialDesc: {
    color: '#333',
  },
  bundleContent: {
    marginBottom: 16,
  },
  bundleList: {
    marginLeft: 12,
    marginTop: 8,
  },
  buyBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  specialBuyBtn: {
    backgroundColor: '#000',
  },
  buyBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  specialBuyBtnText: {
    color: '#ffd700',
  },
});

export default ClinicServicesScreen;
