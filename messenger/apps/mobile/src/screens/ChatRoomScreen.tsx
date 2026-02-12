import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import {
  deleteMessage,
  editMessage,
  getFirebaseClients,
  getUserProfilesByIds,
  listenToMessages,
  markMessagesSeen,
  MAX_MESSAGE_LENGTH,
  resetUnreadCount,
  sanitizeMessage,
  sendMessage,
  type Message,
  type UserProfile
} from '@messenger/shared';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/auth';

export default function ChatRoomScreen({ route }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [profilesById, setProfilesById] = useState<Record<string, UserProfile>>({});
  const [chatParticipants, setChatParticipants] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const chatId = route.params.chatId as string;

  useEffect(() => {
    if (!user) return;
    const unsub = listenToMessages(chatId, (next) => {
      setMessages(next);
      markMessagesSeen(chatId, user.uid).catch(() => undefined);
    });
    resetUnreadCount(chatId, user.uid).catch(() => undefined);
    return () => unsub();
  }, [chatId, user]);

  useEffect(() => {
    if (!user) return;
    const { db } = getFirebaseClients();
    getDoc(doc(db, 'chats', chatId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as { participants?: string[] };
      setChatParticipants(data.participants ?? []);
      return getUserProfilesByIds(data.participants ?? []).then(setProfilesById);
    }).catch(() => undefined);
  }, [chatId, user]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => !user || !(message.deletedFor ?? []).includes(user.uid)),
    [messages, user]
  );

  const seenByOtherText = useMemo(() => {
    if (!user) return '';
    const lastMine = [...visibleMessages].reverse().find((message) => message.senderId === user.uid);
    if (!lastMine) return '';
    const names = (lastMine.seenBy ?? []).filter((uid) => uid !== user.uid).map((uid) => profilesById[uid]?.displayName || uid);
    return names.length ? `Seen by ${names.join(', ')}` : 'Sent';
  }, [visibleMessages, user, profilesById]);

  async function handleSend() {
    if (!user) return;
    const cleaned = sanitizeMessage(text);
    if (!cleaned || cleaned.length > MAX_MESSAGE_LENGTH) return;
    await sendMessage(chatId, user.uid, cleaned);
    setText('');
  }

  async function handleEdit(messageId: string) {
    if (!user) return;
    const cleaned = sanitizeMessage(editingText);
    if (!cleaned) return;
    await editMessage(chatId, messageId, user.uid, cleaned);
    setEditingId(null);
    setEditingText('');
  }

  function openActions(item: Message) {
    if (!user) return;
    const mine = item.senderId === user.uid;
    const editable = mine && !item.deletedAt;
    Alert.alert('Message options', 'Choose action', [
      ...(editable ? [{ text: 'Edit', onPress: () => { setEditingId(item.id); setEditingText(item.text); } }] : []),
      { text: 'Delete for me', onPress: () => deleteMessage(chatId, item.id, user.uid, 'me') },
      ...(mine ? [{ text: 'Delete for everyone', style: 'destructive' as const, onPress: () => deleteMessage(chatId, item.id, user.uid, 'everyone') }] : []),
      { text: 'Cancel', style: 'cancel' }
    ]);
  }

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Pressable onPress={() => setShowDetails((v) => !v)} style={{ marginBottom: 8 }}><Text style={{ color: '#2563eb' }}>User details</Text></Pressable>
      {showDetails ? (
        <View style={{ padding: 8, borderWidth: 1, borderRadius: 8, marginBottom: 8 }}>
          {chatParticipants.map((uid) => (
            <Text key={uid}>{profilesById[uid]?.displayName || uid}</Text>
          ))}
        </View>
      ) : null}

      <FlatList
        style={{ flex: 1 }}
        data={visibleMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.uid;
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? '#2563eb' : '#4b5563', borderRadius: 10, padding: 8, marginVertical: 4, maxWidth: '80%' }}>
              {editingId === item.id ? (
                <>
                  <TextInput value={editingText} onChangeText={setEditingText} style={{ backgroundColor: '#fff', borderRadius: 6, padding: 6 }} />
                  <Button title="Save" onPress={() => handleEdit(item.id)} />
                </>
              ) : <Text style={{ color: '#fff', opacity: item.deletedAt ? 0.7 : 1 }}>{item.deletedAt ? 'This message was deleted.' : item.text}</Text>}
              <Pressable onPress={() => openActions(item)}><Text style={{ color: '#d1d5db', marginTop: 4 }}>▾</Text></Pressable>
            </View>
          );
        }}
      />
      <Text style={{ color: '#6b7280', marginVertical: 4 }}>{seenByOtherText}</Text>
      <TextInput value={text} onChangeText={setText} placeholder={`Message (max ${MAX_MESSAGE_LENGTH})`} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <Button title="Send" onPress={handleSend} />
    </View>
  );
}
