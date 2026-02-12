import { useState } from 'react';
import { Button, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { getOrCreateDirectChat, searchUsers, type UserProfile } from '@messenger/shared';
import { useAuth } from '../context/auth';

export default function SearchScreen({ navigation }: any) {
  const { user } = useAuth();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);

  async function runSearch() {
    if (!user || term.trim().length < 2) return;
    const list = await searchUsers(term, user.uid);
    setResults(list);
  }

  async function startChat(target: UserProfile) {
    if (!user) return;
    const chatId = await getOrCreateDirectChat(user.uid, target.uid);
    navigation.navigate('ChatRoom', { chatId });
  }

  return (
    <View style={{ flex: 1, padding: 12, gap: 8 }}>
      <TextInput placeholder="Search users" value={term} onChangeText={setTerm} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <Button title="Search" onPress={runSearch} />
      <FlatList
        data={results}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <Pressable style={{ paddingVertical: 8 }} onPress={() => startChat(item)}>
            <Text style={{ fontWeight: '700' }}>{item.displayName}</Text>
            <Text>{item.email}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
