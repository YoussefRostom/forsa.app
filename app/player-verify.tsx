import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import i18n from '../locales/i18n';

export default function PlayerVerifyScreen() {
  const router = useRouter();
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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
      <HamburgerMenu />
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
              <Ionicons name="menu" size={24} color="#fff" />
          </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{i18n.t('academyAssistance') || 'Assistance & Extras'}</Text>
              <Text style={styles.headerSubtitle}>
                {i18n.locale === 'ar'
                  ? 'اختر الخدمات التي تساعدك في رحلتك الرياضية'
                  : 'Choose services to help you in your sports journey'}
              </Text>
            </View>
        </View>

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          {i18n.locale === 'ar'
                  ? 'جميع الأسعار بالجنيه المصري.'
                  : 'All prices in EGP.'}
        </Text>
            </View>

        {/* Service: Make Your Video */}
            <View style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Ionicons name="videocam" size={32} color="#fff" />
                <Text style={styles.serviceTitle}>{i18n.locale === 'ar' ? 'اصنع فيديوك خلال 20 دقيقة' : 'Make Your Video in 20 mins'}</Text>
              </View>
              <Text style={styles.serviceDesc}>{i18n.locale === 'ar' ? 'سنقوم بإنتاج فيديو احترافي لك خلال 20 دقيقة.' : 'We will produce a professional video for you in 20 minutes.'}</Text>
              <Text style={styles.servicePrice}>700 {i18n.locale === 'ar' ? 'جنيه' : 'EGP'}</Text>
          <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>{i18n.locale === 'ar' ? 'معاينة الخدمة:' : 'Service Preview:'}</Text>
                <View style={styles.videoPreview}>
                  <Ionicons name="play-circle-outline" size={48} color="rgba(255,255,255,0.5)" />
                </View>
          </View>
              <TouchableOpacity style={styles.buyBtn} activeOpacity={0.8}>
                <Text style={styles.buyBtnText}>{i18n.locale === 'ar' ? 'شراء' : 'Buy'}</Text>
              </TouchableOpacity>
        </View>

        {/* Service: Prioritize Filtering */}
            <View style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Ionicons name="star" size={32} color="#fff" />
                <Text style={styles.serviceTitle}>{i18n.locale === 'ar' ? 'أولوية في التصفية' : 'Prioritize Filtering'}</Text>
              </View>
              <Text style={styles.serviceDesc}>{i18n.locale === 'ar' ? 'سيتم عرض ملفك أولاً عند البحث. (مرة واحدة)' : 'Your profile will be shown first in search results. (one time)'}</Text>
              <Text style={styles.servicePrice}>15 {i18n.locale === 'ar' ? 'جنيه' : 'EGP'}</Text>
          <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>{i18n.locale === 'ar' ? 'معاينة الخدمة:' : 'Service Preview:'}</Text>
                <View style={styles.videoPreview}>
                  <Ionicons name="search" size={48} color="rgba(255,255,255,0.5)" />
                </View>
          </View>
              <TouchableOpacity style={styles.buyBtn} activeOpacity={0.8}>
                <Text style={styles.buyBtnText}>{i18n.locale === 'ar' ? 'شراء' : 'Buy'}</Text>
              </TouchableOpacity>
        </View>

        {/* Service: Message an Agent */}
            <View style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Ionicons name="chatbubble-ellipses" size={32} color="#fff" />
                <Text style={styles.serviceTitle}>{i18n.locale === 'ar' ? 'مراسلة وكيل' : 'Message an Agent'}</Text>
              </View>
              <Text style={styles.serviceDesc}>{i18n.locale === 'ar' ? 'ارسل رسالة مباشرة لأي وكيل.' : 'Send a direct message to any agent.'}</Text>
              <Text style={styles.servicePrice}>20 {i18n.locale === 'ar' ? 'جنيه' : 'EGP'}</Text>
          <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>{i18n.locale === 'ar' ? 'معاينة الخدمة:' : 'Service Preview:'}</Text>
                <View style={styles.videoPreview}>
                  <Ionicons name="mail" size={48} color="rgba(255,255,255,0.5)" />
                </View>
          </View>
              <TouchableOpacity style={styles.buyBtn} activeOpacity={0.8}>
                <Text style={styles.buyBtnText}>{i18n.locale === 'ar' ? 'شراء' : 'Buy'}</Text>
              </TouchableOpacity>
        </View>

        {/* Service: Full Session Package */}
            <View style={[styles.serviceCard, styles.serviceCardGold]}>
              <View style={styles.serviceHeader}>
                <Ionicons name="trophy" size={32} color="#000" />
          <Text style={[styles.serviceTitle, styles.goldText]}>{i18n.locale === 'ar' ? 'باقة الجلسة الكاملة' : 'Full Session Package'}</Text>
              </View>
          <Text style={[styles.serviceDesc, styles.goldTextDark]}>{i18n.locale === 'ar' ? 'نرسل مصور محترف ونوفر ملعب وكور لتصوير مهاراتك في جلسة احترافية.' : 'We send a professional videographer, rent a field, and provide footballs for a pro filming session of your skills.'}</Text>
          <Text style={[styles.servicePrice, styles.goldTextDark, { fontWeight: 'bold' }]}>3000 {i18n.locale === 'ar' ? 'جنيه' : 'EGP'}</Text>
          <View style={styles.previewBox}>
            <Text style={[styles.previewLabel, styles.goldTextDark]}>{i18n.locale === 'ar' ? 'معاينة الخدمة:' : 'Service Preview:'}</Text>
                <View style={[styles.videoPreview, styles.videoPreviewGold]}>
                  <Ionicons name="play-circle-outline" size={48} color="rgba(0,0,0,0.5)" />
                </View>
          </View>
              <TouchableOpacity style={[styles.buyBtn, styles.buyBtnGold]} activeOpacity={0.8}>
                <Text style={[styles.buyBtnText, styles.whiteText]}>{i18n.locale === 'ar' ? 'احجز الآن' : 'Book Now'}</Text>
              </TouchableOpacity>
        </View>

        {/* Monthly Bundle (Gold) */}
            <View style={[styles.bundleCard, styles.bundleCardGold]}>
              <Ionicons name="diamond" size={40} color="#000" style={styles.bundleIcon} />
          <Text style={[styles.bundleTitle, styles.bundleTitleBlack]}>{i18n.locale === 'ar' ? 'باقة شهرية ذهبية' : 'Gold Monthly Bundle'}</Text>
          <Text style={[styles.bundleDesc, styles.bundleDescBlack]}>
            {i18n.locale === 'ar'
              ? 'أولوية التصفية (مرة كل أسبوع، 4 مرات بالشهر) + مراسلة 3 وكلاء في الشهر.'
              : 'Prioritize Filtering (once a week, 4 times/month) + Message 3 agents per month.'}
          </Text>
          <Text style={[styles.bundlePrice, styles.bundlePriceBlack]}>30 {i18n.locale === 'ar' ? 'جنيه/شهر' : 'EGP/month'}</Text>
              <TouchableOpacity style={[styles.bundleBtn, styles.bundleBtnBlack]} activeOpacity={0.8}>
                <Text style={[styles.bundleBtnText, styles.bundleBtnTextBlack]}>{i18n.locale === 'ar' ? 'اشترك الآن' : 'Subscribe Now'}</Text>
              </TouchableOpacity>
        </View>
      </ScrollView>
        </Animated.View>
      </LinearGradient>
    </View>
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
  },
  menuButton: {
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
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    fontWeight: '600',
  },
  serviceCard: {
    backgroundColor: '#000',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  serviceCardGold: {
    backgroundColor: '#FFD700',
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  serviceDesc: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
    lineHeight: 22,
  },
  servicePrice: {
    fontSize: 24,
    color: '#FFD700',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  previewBox: {
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  videoPreview: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewGold: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  buyBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buyBtnGold: {
    backgroundColor: '#000',
  },
  buyBtnText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  whiteText: {
    color: '#fff',
  },
  goldText: {
    color: '#000',
  },
  goldTextDark: {
    color: '#222',
  },
  bundleCard: {
    backgroundColor: '#000',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  bundleCardGold: {
    backgroundColor: '#FFD700',
  },
  bundleIcon: {
    marginBottom: 12,
  },
  bundleTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  bundleTitleBlack: {
    color: '#000',
  },
  bundleDesc: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  bundleDescBlack: {
    color: '#222',
  },
  bundlePrice: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  bundlePriceBlack: {
    color: '#000',
  },
  bundleBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  bundleBtnBlack: {
    backgroundColor: '#000',
  },
  bundleBtnText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bundleBtnTextBlack: {
    color: '#FFD700',
  },
});
