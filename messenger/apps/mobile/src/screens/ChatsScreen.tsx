import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { listenToChats, type Chat } from '@messenger/shared';
import { useAuth } from '../context/auth';

export default function ChatsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    if (!user) return;
    return listenToChats(user.uid, setChats);
  }, [user]);

  return (
    <FlatList
      contentContainerStyle={{ padding: 12, gap: 8 }}
      data={chats}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const peer = item.participants.find((p) => p !== user?.uid) ?? 'Unknown';
        const unread = user ? item.unreadCountMap?.[user.uid] ?? 0 : 0;

        return (
          <Pressable
            style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12 }}
            onPress={() => navigation.navigate('ChatRoom', { chatId: item.id })}
          >
            <Text style={{ fontWeight: '700' }}>{peer}</Text>
            <Text>{item.lastMessage || 'No messages yet'}</Text>
            {unread > 0 && <Text style={{ color: '#2563eb' }}>Unread: {unread}</Text>}
          </Pressable>
        );
      }}
      ListEmptyComponent={<View><Text>No chats yet.</Text></View>}
    />
  );
}
