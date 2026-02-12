import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { getUserProfilesByIds, listenToChats, type Chat, type UserProfile } from '@messenger/shared';
import { useAuth } from '../context/auth';

export default function ChatsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    if (!user) return;
    return listenToChats(user.uid, setChats);
  }, [user]);

  useEffect(() => {
    if (!user || chats.length === 0) return;
    const ids = chats.flatMap((chat) => chat.participants);
    getUserProfilesByIds(ids).then(setProfilesById).catch(() => undefined);
  }, [chats, user]);

  return (
    <FlatList
      contentContainerStyle={{ padding: 12, gap: 8 }}
      data={chats}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const peerUid = item.participants.find((p) => p !== user?.uid) ?? 'Unknown';
        const peer = profilesById[peerUid];
        const unread = user ? item.unreadCountMap?.[user.uid] ?? 0 : 0;
        const title = item.isGroup ? item.groupName || 'Group chat' : (peer?.displayName || peerUid);

        return (
          <Pressable
            style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12 }}
            onPress={() => navigation.navigate('ChatRoom', { chatId: item.id })}
          >
            <Text style={{ fontWeight: '700' }}>{title}</Text>
            <Text>{item.lastMessage || 'No messages yet'}</Text>
            {unread > 0 && <Text style={{ color: '#2563eb' }}>Unread: {unread}</Text>}
          </Pressable>
        );
      }}
      ListEmptyComponent={<View><Text>No chats yet.</Text></View>}
    />
  );
}
