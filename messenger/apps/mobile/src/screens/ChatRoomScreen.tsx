import { useEffect, useState } from 'react';
import { Button, FlatList, Text, TextInput, View } from 'react-native';
import { listenToMessages, MAX_MESSAGE_LENGTH, sanitizeMessage, sendMessage, type Message } from '@messenger/shared';
import { useAuth } from '../context/auth';

export default function ChatRoomScreen({ route }: any) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const chatId = route.params.chatId as string;

  useEffect(() => {
    if (!user) return;
    const unsub = listenToMessages(chatId, setMessages);
    return () => unsub();
  }, [chatId, user]);

  async function handleSend() {
    if (!user) return;
    const cleaned = sanitizeMessage(text);
    if (!cleaned || cleaned.length > MAX_MESSAGE_LENGTH) return;
    await sendMessage(chatId, user.uid, cleaned);
    setText('');
  }

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <FlatList
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.uid;
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? '#2563eb' : '#4b5563', borderRadius: 10, padding: 8, marginVertical: 4 }}>
              <Text style={{ color: '#fff' }}>{item.text}</Text>
            </View>
          );
        }}
      />
      <TextInput value={text} onChangeText={setText} placeholder={`Message (max ${MAX_MESSAGE_LENGTH})`} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <Button title="Send" onPress={handleSend} />
    </View>
  );
}
