import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { doc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { notifyProviderAndAdmins, createNotification } from '../services/NotificationService';
import { db, auth } from '../lib/firebase';
import i18n from '../locales/i18n';
import { LinearGradient } from 'expo-linear-gradient';

type Academy = {
  id: string;
  name: string;
  city: string;
  description: string;
  fees: Record<string, number>;
  schedule?: Record<string, { day: string; time: string }>;
  images?: any[];
  address?: string;
  phone?: string;
  profilePhoto?: string;
};

function formatTimeForDisplay(time24: string): string {
  if (!time24 || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time24)) return time24;
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

type RouteParams = {
  params: {
    academy: Academy;
  };
};

export default function AcademyDetailsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [offerings, setOfferings] = useState<string[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedAge, setSelectedAge] = useState<string>('');
  const [ageModalVisible, setAgeModalVisible] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    let parsed: Academy | null = null;
    try {
      parsed = params.academy ? JSON.parse(params.academy as string) : null;
    } catch {
      parsed = null;
    }
    if (!parsed || !parsed.id) {
      setAcademy(null);
      setLoading(false);
      return;
    }
    // Fetch full details from Firestore
    const fetchAcademy = async () => {
      try {
        const academyDoc = await getDoc(doc(db, 'academies', parsed!.id));
        if (academyDoc.exists()) {
          const data = academyDoc.data();
          setAcademy({
            id: academyDoc.id,
            name: data.academyName || '',
            city: data.city || '',
            description: data.description || '',
            fees: data.fees || {},
            schedule: data.schedule || {},
            address: data.address || '',
            phone: data.phone || '',
            images: data.images || [],
            profilePhoto: data.profilePhoto || '',
          });
          setOfferings(data.offerings || []);
          setPosts(data.posts || []);
          setImages(data.images || []);

          // Fetch academy programs
          try {
            const programsQuery = query(
              collection(db, 'academy_programs'),
              where('academyId', '==', academyDoc.id)
            );
            const programsSnapshot = await getDocs(programsQuery);
            const programsData = programsSnapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data(),
              }))
              .filter((prog: any) => prog.isActive !== false); // Filter active programs in code
            setPrograms(programsData);
          } catch (programError) {
            console.error('Error fetching programs:', programError);
            setPrograms([]);
          }
        } else {
          setAcademy({ ...parsed, schedule: (parsed as any).schedule || {} });
          setOfferings([]);
          setPosts([]);
          setImages(parsed.images || []);
        }
      } catch (err) {
        console.error('Error fetching academy:', err);
        setAcademy(parsed ? { ...parsed, schedule: (parsed as any).schedule || {} } : null);
        setOfferings([]);
        setPosts([]);
        setImages(parsed?.images || []);
      } finally {
        setLoading(false);
      }
    };
    fetchAcademy();
  }, [params.academy]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>{i18n.t('loading') || 'Loading...'}</Text>
      </View>
    );
  }
  if (!academy) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#999" />
        <Text style={styles.errorText}>{i18n.t('noDetails') || 'Academy details not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{i18n.t('back') || 'Back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Helper to sort age keys numerically
  const availableAges = academy && academy.fees ? Object.keys(academy.fees).sort((a, b) => parseInt(a) - parseInt(b)) : [];
  const selectedPrice = selectedAge && academy && academy.fees ? (academy.fees[selectedAge] || 0) : 0;

  const handleReserve = async () => {
    if (!selectedAge) {
      Alert.alert(
        i18n.t('error') || 'Error',
        i18n.t('pleaseSelectAge') || 'Please select an age group for booking'
      );
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert(i18n.t('error'), i18n.t('loginRequired') || 'You must be logged in to book');
      return;
    }

    const price = academy?.fees[selectedAge] || 0;

    try {
      setBookingLoading(true);

      // Fetch user name from Firestore
      let playerName = user.displayName || 'Player';
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          playerName = userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || playerName;
        }
      } catch (err) {
      }

      const slot = academy.schedule?.[selectedAge];
      const bookingData = {
        playerId: user.uid,
        parentId: user.uid,
        playerName: playerName,
        customerName: playerName,
        providerId: academy.id,
        providerName: academy.name,
        type: 'academy',
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        name: academy.name,
        city: academy.city,
        ageGroup: selectedAge,
        program: `${selectedAge} years`,
        price: Number(price),
        day: slot?.day || null,
        time: slot?.time || null,
      };

      const bookingRef = await addDoc(collection(db, 'bookings'), bookingData);
      const providerId = academy.id;
      try {
        await notifyProviderAndAdmins(
          providerId,
          i18n.t('newBookingRequest') || 'New booking request',
          `${playerName} ${i18n.t('requestedBooking') || 'requested a booking'}: ${selectedAge} ${i18n.t('years') || 'years'}`,
          'booking',
          { bookingId: bookingRef.id },
          user.uid
        );
        await createNotification({
          userId: user.uid,
          title: i18n.t('bookingRequestSent') || 'Booking request sent',
          body: `${academy.name} – ${selectedAge} ${i18n.t('years') || 'years'}`,
          type: 'booking',
          data: { bookingId: bookingRef.id },
        });
      } catch (e) {
        console.warn('Notification create failed:', e);
      }

      Alert.alert(
        i18n.t('reservation') || 'Reservation',
        `${i18n.t('reservationSuccess') || 'Reservation request sent!'}\n${i18n.t('ageGroup') || 'Age Group'}: ${selectedAge} ${i18n.t('years') || 'years'}\n${i18n.t('price') || 'Price'}: ${price} EGP`,
        [{ text: i18n.t('ok') || 'OK', onPress: () => router.push('/player-bookings') }]
      );
    } catch (error) {
      console.error('Error creating academy booking:', error);
      Alert.alert(i18n.t('error'), i18n.t('bookingFailed') || 'Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleBookPrivateTraining = async (program: any) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(i18n.t('error'), i18n.t('loginRequired') || 'You must be logged in to book');
      return;
    }

    try {
      setBookingLoading(true);

      // Fetch user name from Firestore
      let playerName = user.displayName || 'Player';
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          playerName = userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || playerName;
        }
      } catch (err) {
      }

      const bookingData = {
        playerId: user.uid,
        parentId: user.uid,
        playerName: playerName,
        customerName: playerName,
        providerId: academy!.id,
        providerName: academy!.name,
        type: 'academy',
        programId: program.id,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        name: academy!.name,
        city: academy!.city,
        program: program.name,
        coachName: program.coachName,
        sessionType: 'private',
        price: Number(program.fee),
        duration: program.duration,
      };

      const bookingRef = await addDoc(collection(db, 'bookings'), bookingData);
      const providerId = academy!.id;
      try {
        await notifyProviderAndAdmins(
          providerId,
          i18n.t('newBookingRequest') || 'New booking request',
          `${playerName} ${i18n.t('requestedPrivateTraining') || 'requested private training'}: ${program.name}`,
          'booking',
          { bookingId: bookingRef.id },
          user.uid
        );
        await createNotification({
          userId: user.uid,
          title: i18n.t('bookingRequestSent') || 'Booking request sent',
          body: `${academy!.name} – ${program.name} with ${program.coachName}`,
          type: 'booking',
          data: { bookingId: bookingRef.id },
        });
      } catch (e) {
        console.warn('Notification create failed:', e);
      }

      Alert.alert(
        i18n.t('bookingRequestSent') || 'Booking Request Sent',
        i18n.t('privateTrainingBookingDesc') || 'Your private training booking request has been sent. You will be notified once the academy responds.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Private training booking error:', error);
      Alert.alert(i18n.t('error'), i18n.t('bookingFailed') || 'Failed to send booking request. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#2d2d2d']}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section with Academy Logo & Name */}
          <View style={styles.headerSection}>
            <TouchableOpacity style={styles.backIconButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              {academy.profilePhoto ? (
                <Image source={{ uri: academy.profilePhoto }} style={styles.logo} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="school" size={48} color="#666" />
                </View>
              )}
            </View>
            <Text style={styles.academyName}>{academy.name}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={styles.locationText}>{academy.city}</Text>
            </View>
            {academy.phone && (
              <TouchableOpacity
                style={styles.contactButton}
                onPress={() => setShowPhone(!showPhone)}
              >
                <Ionicons name="call-outline" size={20} color="#000" />
                <Text style={styles.contactButtonText}>
                  {showPhone ? academy.phone : (i18n.t('showPhone') || 'Show Phone')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Main Content Card */}
          <View style={styles.contentCard}>
            {/* About Section */}
            {academy.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{i18n.t('about') || 'About'}</Text>
                <Text style={styles.descriptionText}>{academy.description}</Text>
              </View>
            )}

            {/* Address Section */}
            {academy.address && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="map-outline" size={20} color="#000" />
                  <Text style={styles.sectionTitle}>{i18n.t('address') || 'Address'}</Text>
                </View>
                <Text style={styles.addressText}>{academy.address}</Text>
              </View>
            )}

            {/* Gallery Section */}
            {images && images.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{i18n.t('gallery') || 'Gallery'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
                  {images.map((img: any, idx: number) => (
                    <Image
                      key={idx}
                      source={typeof img === 'string' ? { uri: img } : img}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Monthly Fees Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cash-outline" size={20} color="#000" />
                <Text style={styles.sectionTitle}>{i18n.t('monthlyFees') || 'Monthly Fees'}</Text>
              </View>
              <View style={styles.feesContainer}>
                {Object.entries(academy.fees).map(([age, fee]) => (
                  <View key={age} style={styles.feeItem}>
                    <View style={styles.feeInfo}>
                      <Text style={styles.feeAgeLabel}>{i18n.t('age') || 'Age'}</Text>
                      <Text style={styles.feeAge}>{age} {i18n.t('years') || 'years'}</Text>
                    </View>
                    <Text style={styles.feeValue}>{String(fee)} EGP</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Offerings/Services Section */}
            {offerings.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="star-outline" size={20} color="#000" />
                  <Text style={styles.sectionTitle}>{i18n.t('offerings') || 'Services & Offerings'}</Text>
                </View>
                <View style={styles.offeringsContainer}>
                  {offerings.map((off, idx) => (
                    <View key={idx} style={styles.offeringItem}>
                      <Ionicons name="checkmark-circle" size={20} color="#000" />
                      <Text style={styles.offeringText}>{off}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Posts Section */}
            {posts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{i18n.t('posts') || 'Latest Posts'}</Text>
                {posts.map((post, idx) => (
                  <View key={idx} style={styles.postCard}>
                    {post.image && (
                      <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
                    )}
                    <Text style={styles.postTitle}>{post.title}</Text>
                    <Text style={styles.postBody}>{post.body}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Private Training Programs Section */}
            {programs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="fitness-outline" size={20} color="#000" />
                  <Text style={styles.sectionTitle}>{i18n.t('privateTraining') || 'Private Training'}</Text>
                </View>
                <View style={styles.programsContainer}>
                  {programs.filter(p => p.type === 'private_training').map((program) => (
                    <View key={program.id} style={styles.programCard}>
                      <View style={styles.programHeader}>
                        <Text style={styles.programName}>{program.name}</Text>
                        <Text style={styles.programPrice}>{program.fee} EGP</Text>
                      </View>
                      {program.coachName && (
                        <Text style={styles.programCoach}>Coach: {program.coachName}</Text>
                      )}
                      {program.description && (
                        <Text style={styles.programDescription}>{program.description}</Text>
                      )}
                      {program.specializations && program.specializations.length > 0 && (
                        <View style={styles.specializationsContainer}>
                          <Text style={styles.specializationsLabel}>{i18n.t('specializations') || 'Specializations'}:</Text>
                          <Text style={styles.specializationsText}>{program.specializations.join(', ')}</Text>
                        </View>
                      )}
                      <View style={styles.programDetails}>
                        <Text style={styles.programDetail}>
                          <Ionicons name="time-outline" size={14} color="#666" /> {program.duration} min
                        </Text>
                        <Text style={styles.programDetail}>
                          <Ionicons name="people-outline" size={14} color="#666" /> Max {program.maxParticipants}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.bookProgramButton}
                        onPress={() => handleBookPrivateTraining(program)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.bookProgramButtonText}>{i18n.t('bookNow') || 'Book Now'}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ====== BOOKING OPTIONS SECTION ====== */}
            <View style={styles.bookingSection}>
              <Text style={styles.bookingSectionTitle}>{i18n.t('bookNow') || 'Book Now'}</Text>
              <Text style={styles.bookingSectionSubtitle}>{i18n.t('chooseBookingOption') || 'Choose your preferred booking option'}</Text>

              {/* Booking Options Grid */}
              <View style={styles.bookingOptionsContainer}>
                {/* Option 1: Group Session by Age */}
                <View style={styles.bookingOptionCard}>
                  <View style={styles.bookingOptionHeader}>
                    <Ionicons name="people-outline" size={24} color="#000" />
                    <Text style={styles.bookingOptionTitle}>{i18n.t('groupSession') || 'Group Session'}</Text>
                  </View>
                  <Text style={styles.bookingOptionDescription}>
                    {i18n.t('selectAgeForGroup') || 'Select your age group for regular group training sessions'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.ageSelectButton, selectedAge && styles.ageSelectButtonActive]}
                    onPress={() => setAgeModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={20} color={selectedAge ? "#000" : "#999"} />
                    <Text style={[styles.ageSelectText, !selectedAge && styles.ageSelectPlaceholder]}>
                      {selectedAge
                        ? `${selectedAge} ${i18n.t('years') || 'years'} - ${selectedPrice} EGP`
                        : i18n.t('selectAgeGroup') || 'Select Age Group'
                      }
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                  {selectedAge && (
                    <View style={styles.selectedAgeInfo}>
                      <Text style={styles.selectedAgeText}>
                        {i18n.t('selectedAge') || 'Selected'}: {selectedAge} {i18n.t('years') || 'years'}
                      </Text>
                      <Text style={styles.selectedPriceText}>
                        {i18n.t('price') || 'Price'}: {selectedPrice} EGP/{i18n.t('month') || 'month'}
                      </Text>
                      {academy.schedule?.[selectedAge]?.day && (
                        <Text style={styles.selectedScheduleText}>
                          {i18n.t('day') || 'Day'}: {i18n.t(academy.schedule[selectedAge].day) || academy.schedule[selectedAge].day}
                        </Text>
                      )}
                      {academy.schedule?.[selectedAge]?.time && (
                        <Text style={styles.selectedScheduleText}>
                          {i18n.t('time') || 'Time'}: {formatTimeForDisplay(academy.schedule[selectedAge].time)}
                        </Text>
                      )}
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.reserveButton, (!selectedAge || bookingLoading) && styles.reserveButtonDisabled]}
                    onPress={handleReserve}
                    disabled={!selectedAge || bookingLoading}
                  >
                    {bookingLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.reserveButtonText}>
                        {selectedAge
                          ? `${i18n.t('reserveNow') || 'Reserve Now'} - ${selectedPrice} EGP`
                          : i18n.t('selectAgeToBook') || 'Select Age to Book'
                        }
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>


              </View>
            </View>
            </View>

            {/* Age Selection Modal */}
          <Modal
            visible={ageModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setAgeModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setAgeModalVisible(false)}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{i18n.t('selectAgeGroup') || 'Select Age Group'}</Text>
                  <TouchableOpacity onPress={() => setAgeModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScrollView}>
                  {availableAges.map((age) => {
                    const slot = academy.schedule?.[age];
                    return (
                      <TouchableOpacity
                        key={age}
                        style={[styles.modalOption, selectedAge === age && styles.modalOptionSelected]}
                        onPress={() => {
                          setSelectedAge(age);
                          setAgeModalVisible(false);
                        }}
                      >
                        <View style={styles.modalOptionContent}>
                          <View style={styles.modalOptionLeft}>
                            <Text style={[styles.modalOptionText, selectedAge === age && styles.modalOptionTextSelected]}>
                              {age} {i18n.t('years') || 'years'}
                            </Text>
                            {(slot?.day || slot?.time) && (
                              <Text style={[styles.modalOptionSchedule, selectedAge === age && styles.modalOptionScheduleSelected]}>
                                {slot?.day ? (i18n.t(slot.day) || slot.day) : ''}{slot?.day && slot?.time ? ' • ' : ''}{slot?.time ? formatTimeForDisplay(slot.time) : ''}
                              </Text>
                            )}
                          </View>
                          <Text style={[styles.modalOptionPrice, selectedAge === age && styles.modalOptionPriceSelected]}>
                            {academy.fees[age]} EGP
                          </Text>
                        </View>
                        {selectedAge === age && <Ionicons name="checkmark" size={20} color="#fff" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    position: 'relative',
  },
  backIconButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  academyName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 6,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  contentCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    marginTop: 0,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  addressText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  gallery: {
    marginTop: 8,
  },
  galleryImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
    marginRight: 12,
  },
  feesContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  feeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  feeInfo: {
    flex: 1,
  },
  feeAgeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  feeAge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  feeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 16,
    minWidth: 80,
    textAlign: 'right',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  counterButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginHorizontal: 12,
    minWidth: 30,
    textAlign: 'center',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#000',
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  offeringsContainer: {
    gap: 12,
  },
  offeringItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  offeringText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  postCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  postBody: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  programsContainer: {
    gap: 16,
  },
  programCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  programHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  programName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  programPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  programCoach: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  programDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  specializationsContainer: {
    marginBottom: 12,
  },
  specializationsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  specializationsText: {
    fontSize: 14,
    color: '#666',
  },
  programDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  programDetail: {
    fontSize: 14,
    color: '#666',
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookProgramButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  bookProgramButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reserveButton: {
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  reserveButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  reserveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bookingSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bookingSectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  bookingSectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  bookingOptionsContainer: {
    gap: 16,
  },
  bookingOptionCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bookingOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  bookingOptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  bookingOptionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  ageSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    gap: 12,
  },
  ageSelectButtonActive: {
    borderColor: '#000',
  },
  ageSelectText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  ageSelectPlaceholder: {
    color: '#999',
    fontWeight: 'normal',
  },
  selectedAgeInfo: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  selectedAgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  selectedPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  selectedScheduleText: {
    fontSize: 15,
    color: '#333',
    marginTop: 4,
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
    width: '85%',
    maxHeight: '70%',
    overflow: 'hidden',
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
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionSelected: {
    backgroundColor: '#000',
  },
  modalOptionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#000',
  },
  modalOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOptionPrice: {
    fontSize: 16,
    color: '#666',
    marginLeft: 16,
  },
  modalOptionPriceSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOptionSchedule: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  modalOptionScheduleSelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  modalOptionLeft: {
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 24,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
