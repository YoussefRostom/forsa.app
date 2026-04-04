import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOrCreateConversation, sendMessage, subscribeToMessages, markMessagesAsRead, Message } from '../../services/MessagingService';
import { getBackendUrl } from '../../lib/config';
import { auth } from '../../lib/firebase';

export default function AdminUserChat() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const otherUserId = params.otherUserId as string | undefined;
  const name = (params.name as string) || '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationIdState, setConversationIdState] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const init = async () => {
      try {
        setLoading(true);
        if (!otherUserId) {
          Alert.alert('Error', 'No user specified');
          setLoading(false);
          return;
        }
        const convId = await getOrCreateConversation(otherUserId);
        setConversationIdState(convId);
        await markMessagesAsRead(convId);
        unsubscribe = subscribeToMessages(convId, (msgs) => {
          setMessages(msgs);
          setLoading(false);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
        });
      } catch (err) {
        console.error('Init admin chat error:', err);
        setLoading(false);
      }
    };
    init();
    // no admin log UI anymore
    return () => { if (unsubscribe) unsubscribe(); };
  }, [otherUserId]);

  const handleSend = async () => {
    if (!input.trim() || !conversationIdState) return;
    try {
      await sendMessage(conversationIdState, input.trim());
      setInput('');
      if (conversationIdState) await markMessagesAsRead(conversationIdState);
    } catch (err) {
      console.error('Error sending admin message:', err);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={styles.title}>{name || 'Chat'}</Text>
        <View />
      </View>

      {loading ? (
        <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <View style={{ padding: 12 }}>
          {/* admin logs removed */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({item}) => {
            const currentUserId = auth.currentUser?.uid;
            const isSent = item.senderId === currentUserId;
            return (
              <View style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}>
                <Text style={isSent ? styles.textSent : styles.textReceived}>{item.content}</Text>
              </View>
            );
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        />
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput value={input} onChangeText={setInput} placeholder="Type a message" style={styles.input} multiline />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={!conversationIdState}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
      {/* admin log UI removed */}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { height: 80, backgroundColor: '#000', flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 12, justifyContent: 'space-between', paddingHorizontal: 12 },
  backBtn: { width:44, height:44, justifyContent:'center', alignItems:'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 18, marginBottom: 10 },
  bubbleSent: { backgroundColor: '#000', alignSelf: 'flex-end' },
  bubbleReceived: { backgroundColor: '#eee', alignSelf: 'flex-start' },
  textSent: { color: '#fff' },
  textReceived: { color: '#222' },
  inputRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, maxHeight: 120 },
  sendBtn: { backgroundColor: '#000', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '600' }
});
