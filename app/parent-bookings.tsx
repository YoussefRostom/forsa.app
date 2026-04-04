import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import { Animated, Easing, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import i18n from '../locales/i18n';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { startConversationWithUser } from '../services/BookingMessagingService';
import { findAdminUserId } from '../services/MessagingService';

export default function ParentBookingsScreen() {
  const { openMenu } = useHamburgerMenu();
  const [filter, setFilter] = useState<'all' | 'clinic' | 'academy'>('all');
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();

    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      // Try the optimized query (requires index)
      const q = query(
        collection(db, 'bookings'),
        where('parentId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const bookingsList: any[] = [];
      querySnapshot.forEach((doc) => {
        bookingsList.push({ id: doc.id, ...doc.data() });
      });

      setBookings(bookingsList);
    } catch (error: any) {
      // Handle the missing index error gracefully
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.warn('Firestore index required for orderBy. Falling back to client-side sorting.');
        try {
          const user = auth.currentUser;
          if (user) {
            // Fallback query without orderBy (no index required)
            const qFallback = query(
              collection(db, 'bookings'),
              where('parentId', '==', user.uid)
            );
            const querySnapshot = await getDocs(qFallback);
            const bookingsList: any[] = [];
            querySnapshot.forEach((doc) => {
              bookingsList.push({ id: doc.id, ...doc.data() });
            });

            // Client-side sort by createdAt descending
            bookingsList.sort((a, b) => {
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return timeB - timeA;
            });

            setBookings(bookingsList);
          }
        } catch (fallbackError) {
          console.error("Fallback fetch also failed:", fallbackError);
          Alert.alert(i18n.t('error'), 'Failed to load bookings');
        }
      } else {
        console.error('Error fetching bookings:', error);
        Alert.alert(i18n.t('error'), 'Failed to load bookings');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      Alert.alert(
        i18n.t('cancelBooking') || 'Cancel Booking',
        i18n.t('cancelConfirmation') || 'Are you sure you want to cancel this booking?',
        [
          { text: i18n.t('no') || 'No', style: 'cancel' },
          {
            text: i18n.t('yes') || 'Yes',
            style: 'destructive',
            onPress: async () => {
              await updateDoc(doc(db, 'bookings', bookingId), {
                status: 'cancelled'
              });
              // Refresh local state
              setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
              Alert.alert(i18n.t('success'), i18n.t('bookingCancelled') || 'Booking cancelled successfully');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error cancelling booking:', error);
      Alert.alert(i18n.t('error'), 'Failed to cancel booking');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleAcceptTiming = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { status: 'player_accepted' });
      Alert.alert(i18n.t('success') || 'Success', 'Timing accepted successfully');
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'player_accepted' } : b));
    } catch (err: any) {
      Alert.alert('Error', 'Failed to accept timing');
    }
  };

  const handleRejectTiming = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { status: 'player_rejected' });
      Alert.alert(i18n.t('success') || 'Success', 'Timing rejected successfully');
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'player_rejected' } : b));
    } catch (err: any) {
      Alert.alert('Error', 'Failed to reject timing');
    }
  };

  const filteredBookings = filter === 'all'
    ? bookings
    : bookings.filter(b => b.type === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#10b981';
      case 'player_accepted':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'timing_proposed':
        return '#f59e0b';
      case 'cancelled':
        return '#ef4444';
      case 'player_rejected':
        return '#ef4444';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return i18n.t('confirmed') || 'Confirmed';
      case 'player_accepted':
        return i18n.t('accepted') || 'Accepted';
      case 'pending':
        return i18n.t('pending') || 'Pending';
      case 'timing_proposed':
        return i18n.t('timingProposed') || 'Timing Proposed';
      case 'cancelled':
        return i18n.t('cancelled') || 'Cancelled';
      case 'player_rejected':
        return i18n.t('rejected') || 'Rejected';
      default:
        return status;
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
            <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{i18n.t('myBookings') || 'My Bookings'}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('viewAllBookings') || 'View all your clinic and academy bookings'}</Text>
            </View>
          </View>

          <HamburgerMenu />

          {/* Filter Tabs */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                {i18n.t('all') || 'All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'clinic' && styles.filterTabActive]}
              onPress={() => setFilter('clinic')}
            >
              <Ionicons name="medical" size={16} color={filter === 'clinic' ? '#fff' : '#999'} style={styles.filterIcon} />
              <Text style={[styles.filterText, filter === 'clinic' && styles.filterTextActive]}>
                {i18n.t('clinics') || 'Clinics'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'academy' && styles.filterTabActive]}
              onPress={() => setFilter('academy')}
            >
              <Ionicons name="school" size={16} color={filter === 'academy' ? '#fff' : '#999'} style={styles.filterIcon} />
              <Text style={[styles.filterText, filter === 'academy' && styles.filterTextActive]}>
                {i18n.t('academies') || 'Academies'}
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : (
            <FlatList
              data={filteredBookings}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
              }
              renderItem={({ item }) => (
                <View style={styles.bookingCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.typeIcon, item.type === 'clinic' ? styles.clinicIcon : styles.academyIcon]}>
                      <Ionicons
                        name={item.type === 'clinic' ? 'medical' : 'school'}
                        size={24}
                        color="#fff"
                      />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                          {getStatusText(item.status)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    {item.type === 'clinic' ? (
                      <>
                        <View style={styles.infoRow}>
                          <Ionicons name="person" size={16} color="#666" />
                          <Text style={styles.infoText}>{i18n.t('doctor')}: {item.doctor}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Ionicons name="medical-outline" size={16} color="#666" />
                          <Text style={styles.infoText}>{i18n.t('service')}: {item.service || 'General'}</Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.infoRow}>
                        <Ionicons name="football" size={16} color="#666" />
                        <Text style={styles.infoText}>{i18n.t('program') || 'Program'}: {item.program}</Text>
                      </View>
                    )}

                    <View style={styles.infoRow}>
                      <Ionicons name="calendar" size={16} color="#666" />
                      <Text style={styles.infoText}>{item.date}</Text>
                    </View>
                    {item.time && (
                      <View style={styles.infoRow}>
                        <Ionicons name="time" size={16} color="#666" />
                        <Text style={styles.infoText}>{item.time} {item.shift ? `(${item.shift === 'Day' ? (i18n.t('dayShift') || 'Day') : (i18n.t('nightShift') || 'Night')})` : ''}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.priceText}>{item.price} EGP</Text>
                    {item.status !== 'cancelled' && item.status !== 'player_rejected' && (
                      <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancelBooking(item.id)}>
                        <Text style={styles.cancelButtonText}>{i18n.t('cancel') || 'Cancel'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {item.status === 'timing_proposed' && item.proposedByAdmin && (
                    <View style={{flexDirection: 'row', gap: 12, marginTop: 12}}>
                      <TouchableOpacity
                        style={[styles.chatButton, {flex: 1, backgroundColor: '#10b981', marginTop: 0}]}
                        onPress={() => handleAcceptTiming(item.id)}
                      >
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={[styles.chatButtonText, {color: '#fff', marginLeft: 8}]}>{i18n.t('accept') || 'Accept'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chatButton, {flex: 1, backgroundColor: '#ef4444', marginTop: 0}]}
                        onPress={() => handleRejectTiming(item.id)}
                      >
                        <Ionicons name="close" size={18} color="#fff" />
                        <Text style={[styles.chatButtonText, {color: '#fff', marginLeft: 8}]}>{i18n.t('reject') || 'Reject'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {item.status === 'player_rejected' && (
                    <TouchableOpacity
                      style={styles.chatButton}
                      onPress={async () => {
                        try {
                          const adminId = await findAdminUserId();
                          if (!adminId) {
                            Alert.alert('Error', 'No admin found');
                            return;
                          }
                          const conversationId = await startConversationWithUser(adminId);
                          router.push({
                            pathname: '/academy-chat',
                            params: {
                              conversationId,
                              otherUserId: adminId,
                              contact: 'Admin'
                            }
                          });
                        } catch (error: any) {
                          Alert.alert('Error', error.message || 'Failed to start conversation');
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubbles" size={18} color="#fff" />
                      <Text style={[styles.chatButtonText, {color: '#fff', marginLeft: 8}]}>{i18n.t('chatToAdmin') || 'Chat to Admin'}</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={async () => {
                      try {
                        const adminId = await findAdminUserId();
                        if (!adminId) {
                          Alert.alert('Error', 'No admin found');
                          return;
                        }
                        const conversationId = await startConversationWithUser(adminId);
                        router.push({
                          pathname: '/academy-chat',
                          params: {
                            conversationId,
                            otherUserId: adminId,
                            contact: 'Admin'
                          }
                        });
                      } catch (error: any) {
                        Alert.alert('Error', error.message || 'Failed to start conversation');
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubbles" size={18} color="#fff" />
                    <Text style={[styles.chatButtonText, {color: '#fff', marginLeft: 8}]}>{i18n.t('chatToAdmin') || 'Chat to Admin'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={64} color="#666" />
                  <Text style={styles.emptyText}>{i18n.t('noBookingsFound') || 'No bookings found'}</Text>
                </View>
              }
            />
          )}
        </Animated.View>
      </LinearGradient>
    </KeyboardAvoidingView>
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterTabActive: {
    backgroundColor: '#000',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clinicIcon: {
    backgroundColor: '#ef4444',
  },
  academyIcon: {
    backgroundColor: '#3b82f6',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  chatButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
});

