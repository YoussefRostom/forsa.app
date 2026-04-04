import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import { Animated, Easing, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Image } from 'react-native';
import HamburgerMenu from '../components/HamburgerMenu';
import { useHamburgerMenu } from '../components/HamburgerMenuContext';
import i18n from '../locales/i18n';
import { subscribeToConversations, Conversation } from '../services/MessagingService';
import { getChattableUsers, startConversationWithUser } from '../services/BookingMessagingService';
import { Alert } from 'react-native';

export default function AgentContactsScreen() {
  const router = useRouter();
  const { openMenu } = useHamburgerMenu();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chattableUsers, setChattableUsers] = useState<Array<{userId: string; name: string; photo?: string; role: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChattable, setLoadingChattable] = useState(false);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToConversations((convs) => {
      setConversations(convs);
      setLoading(false);
    });

    loadChattableUsers();

    return () => {
      unsubscribe();
    };
  }, []);

  const loadChattableUsers = async () => {
    try {
      setLoadingChattable(true);
      const users = await getChattableUsers();
      setChattableUsers(users);
    } catch (error) {
      console.error('Error loading chattable users:', error);
    } finally {
      setLoadingChattable(false);
    }
  };

  const handleStartChat = async (userId: string, name: string) => {
    try {
      const conversationId = await startConversationWithUser(userId);
      router.push({
        pathname: '/agent-messages',
        params: {
          conversationId,
          otherUserId: userId,
          name
        }
      });
    } catch (error: any) {
      console.error('Error starting chat:', error);
      Alert.alert(i18n.t('error') || 'Error', error.message || 'Failed to start conversation');
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
              <Text style={styles.headerTitle}>{i18n.t('messages') || 'Messages'}</Text>
              <Text style={styles.headerSubtitle}>{i18n.t('yourConversations') || 'Your conversations'}</Text>
            </View>
        </View>

        <HamburgerMenu />

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.emptyText}>{i18n.t('loading') || 'Loading...'}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const displayName = item.otherParticipantName || 'Unknown';
            const lastMsg = item.lastMessage || '';
            const unreadCount = item.unreadCount || 0;
            
            return (
              <TouchableOpacity
                style={styles.contactCard}
                onPress={() => router.push({ 
                  pathname: '/agent-messages', 
                  params: { 
                    conversationId: item.id,
                    otherUserId: item.otherParticipantId || '',
                    name: displayName 
                  } 
                })}
                activeOpacity={0.8}
              >
                <View style={styles.avatar}>
                  {item.otherParticipantPhoto ? (
                    <Image source={{ uri: item.otherParticipantPhoto }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={24} color="#000" />
                  )}
                  {unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{displayName}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>{lastMsg || 'No messages yet'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={64} color="#666" />
                <Text style={styles.emptyText}>{i18n.t('noMessages') || 'No messages'}</Text>
                <Text style={styles.emptySubtext}>{i18n.t('startChatting') || 'Start chatting with your players!'}</Text>
                
                {loadingChattable ? (
                  <ActivityIndicator size="small" color="#fff" style={{ marginTop: 20 }} />
                ) : chattableUsers.length > 0 ? (
                  <View style={styles.chattableUsersContainer}>
                    <Text style={styles.chattableUsersTitle}>Start a conversation:</Text>
                    {chattableUsers.map((user) => (
                      <TouchableOpacity
                        key={user.userId}
                        style={styles.chattableUserCard}
                        onPress={() => handleStartChat(user.userId, user.name)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.chattableUserAvatar}>
                          {user.photo ? (
                            <Image source={{ uri: user.photo }} style={styles.chattableUserAvatarImage} />
                          ) : (
                            <Ionicons name="person-circle" size={32} color="#fff" />
                          )}
                        </View>
                        <Text style={styles.chattableUserName}>{user.name}</Text>
                        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.viewBookingsButton}
                    onPress={() => router.push('/agent-players')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewBookingsButtonText}>View My Players</Text>
                  </TouchableOpacity>
                )}
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
    marginLeft: -44, // Negative margin to center title while keeping menu button on left
    paddingHorizontal: 44, // Add padding to ensure title doesn't overlap with menu button
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
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
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
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
  },
  chattableUsersContainer: {
    marginTop: 24,
    width: '100%',
    paddingHorizontal: 20,
  },
  chattableUsersTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  chattableUserCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chattableUserAvatar: {
    marginRight: 12,
  },
  chattableUserAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  chattableUserName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  viewBookingsButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
  },
  viewBookingsButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
