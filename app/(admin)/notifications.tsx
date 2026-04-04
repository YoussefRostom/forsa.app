import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../lib/firebase';
import {
  subscribeMyNotifications,
  markAsRead,
  Notification,
  NotificationType,
} from '../../services/NotificationService';
import { formatTimestamp } from '../../lib/dateUtils';
import i18n from '../../locales/i18n';

const typeToIcon: Record<NotificationType, string> = {
  booking: 'calendar',
  checkin: 'qr-code',
  report: 'flag',
  info: 'information-circle',
  system: 'notifications',
};

const typeToColor: Record<NotificationType, string> = {
  booking: '#1cc88a',
  checkin: '#4e73df',
  report: '#FF3B30',
  info: '#007AFF',
  system: '#8E8E93',
};

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeMyNotifications((notifications) => {
      setList(notifications);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handlePress = async (item: Notification) => {
    if (!item.read) {
      try {
        await markAsRead(item.id);
      } catch (e) {
        console.warn('Mark read failed:', e);
      }
    }
    if (item.type === 'report' && item.data?.reportId) {
      router.push('/(admin)/reports');
    }
    if (item.type === 'booking' && item.data?.bookingId) {
      router.push('/(admin)/bookings');
    }
    if (item.type === 'checkin') {
      router.push('/(admin)/checkins');
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const icon = typeToIcon[item.type] || 'notifications';
    const color = typeToColor[item.type] || '#666';
    const timeStr = formatTimestamp(item.createdAt, { fallback: '' });

    return (
      <TouchableOpacity
        style={[styles.item, !item.read && styles.itemUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: color + '22' }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.message} numberOfLines={2}>{item.body}</Text>
          {timeStr ? <Text style={styles.time}>{timeStr}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (!auth.currentUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{i18n.t('loginRequired') || 'Please log in'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{i18n.t('notifications') || 'Notifications'}</Text>
        <View style={styles.headerRight} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{i18n.t('loading') || 'Loading...'}</Text>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>{i18n.t('noNotifications') || 'No notifications yet'}</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    paddingTop: 48,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  headerRight: { width: 40 },
  list: { padding: 16 },
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemUnread: {
    backgroundColor: '#f0f8ff',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#333' },
  message: { fontSize: 14, color: '#666', marginTop: 2 },
  time: { fontSize: 12, color: '#999', marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  emptyText: { marginTop: 16, fontSize: 16, color: '#999' },
});
