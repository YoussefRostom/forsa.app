import { useRouter } from 'expo-router';
import React from 'react';
import { I18nManager, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../locales/i18n';

interface ParentHamburgerMenuProps {
  visible: boolean;
  onClose: () => void;
}

const ParentHamburgerMenu: React.FC<ParentHamburgerMenuProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const options = [
    { label: i18n.t('parentFeed') || 'Parent Feed', route: '/parent-feed' },
    { label: i18n.t('parentEditProfile') || 'Edit Profile', route: '/parent-edit-profile' },
    { label: i18n.t('searchAcademies') || 'Search Academies', route: '/parent-search-academies' },
    { label: i18n.t('searchClinics') || 'Search Clinics', route: '/parent-search-clinics' },
    { label: i18n.t('myBookings') || 'My Bookings', route: '/parent-bookings' },
    { label: i18n.t('parentMessages') || 'Messages', route: '/parent-messages' },
    { label: i18n.t('signOut') || 'Sign Out', route: '/signout' },
  ];
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuBox}>
          {options.map(item => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuItem}
              onPress={() => {
                onClose();
                if (item.route === '/parent-feed') {
                  router.replace(item.route as any);
                } else {
                  router.push(item.route as any);
                }
              }}
            >
              <Text style={styles.menuText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: '#eee', marginTop: 10, paddingTop: 16 }]}
          onPress={() => {
            const newLang = i18n.locale === 'en' ? 'ar' : 'en';
            const isRTL = newLang === 'ar';
            i18n.locale = newLang;
            I18nManager.forceRTL(isRTL);
            I18nManager.swapLeftAndRightInRTL(isRTL);
            onClose();
          }}
        >
          <Text style={styles.menuText}>
            {i18n.locale === 'en' ? 'العربية' : 'English'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  menuBox: {
    marginTop: 80,
    marginLeft: 18,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    minWidth: 210,
    alignItems: 'flex-start',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 0,
    width: '100%',
  },
  menuText: {
    fontSize: 17,
    color: '#111',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
export default ParentHamburgerMenu;
