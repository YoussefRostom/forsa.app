import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { auth } from '../lib/firebase';
import i18n from '../locales/i18n';
import {
  subscribeMyNotifications,
  markAsRead,
  Notification,
  NotificationType,
} from '../services/NotificationService';
import { getOrCreateConversation } from '../services/MessagingService';
import { getCurrentUserRole } from '../services/UserRoleService';
import { formatTimestamp } from '../lib/dateUtils';

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

export default function NotificationsScreen() {
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
    // Navigate based on notification type and current user role (stay in own profile)
    const role = await getCurrentUserRole().catch(() => null);
    if (item.type === 'booking' && item.data?.bookingId) {
      const bookingRoute =
        role === 'parent' ? '/parent-bookings' :
        role === 'clinic' ? '/clinic-bookings' :
        role === 'academy' ? '/academy-bookings' :
        role === 'agent' ? '/agent-feed' :
        '/player-bookings';
      router.push(bookingRoute as any);
    } else if (item.type === 'checkin' && role === 'clinic') {
      router.push('/clinic-bookings' as any);
    } else if (item.type === 'checkin' && role === 'academy') {
      router.push('/academy-bookings' as any);
    } else if (item.type === 'report' && role === 'admin') {
      router.push('/(admin)/reports' as any);
    } else if ((item.data?.senderId || item.data?.conversationId) && role === 'admin') {
      try {
        const senderId = item.data?.senderId;
        if (senderId) {
          const senderIdStr = String(senderId);
          const convId = await getOrCreateConversation(senderIdStr);
          router.push({ pathname: '/(admin)/user-chat', params: { otherUserId: senderIdStr, name: item.title || 'User' } } as any);
        } else if (item.data?.conversationId) {
          const parts = (item.data.conversationId as string).split('_');
          const current = auth.currentUser?.uid;
          const other = parts[0] === current ? parts[1] : parts[0];
          if (other) router.push({ pathname: '/(admin)/user-chat', params: { otherUserId: other, name: item.title || 'User' } } as any);
        }
      } catch (e) {
        console.error('Failed to open chat from notification', e);
      }
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
