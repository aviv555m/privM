import { useState } from 'react';
import { Button, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { createGroupChat, getOrCreateDirectChat, searchUsers, type UserProfile } from '@messenger/shared';
import { useAuth } from '../context/auth';

export default function SearchScreen({ navigation }: any) {
  const { user } = useAuth();
  const [term, setTerm] = useState('');
  const [groupName, setGroupName] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

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

  async function createGroup() {
    if (!user || selected.length < 2 || !groupName.trim()) return;
    const chatId = await createGroupChat(user.uid, selected, groupName.trim());
    setSelected([]);
    setGroupName('');
    navigation.navigate('ChatRoom', { chatId });
  }

  return (
    <View style={{ flex: 1, padding: 12, gap: 8 }}>
      <Text style={{ fontWeight: '700' }}>Step 1: Find people</Text>
      <TextInput placeholder="Search users" value={term} onChangeText={setTerm} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <Button title="Search" onPress={runSearch} />

      <Text style={{ fontWeight: '700', marginTop: 8 }}>Step 2: Build your group</Text>
      <TextInput placeholder="Group name" value={groupName} onChangeText={setGroupName} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {selected.map((uid) => (
          <Text key={uid} style={{ backgroundColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            {results.find((item) => item.uid === uid)?.displayName ?? uid}
          </Text>
        ))}
      </View>
      <Button title="Create WhatsApp-style group" onPress={createGroup} />

      <FlatList
        data={results}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => {
          const checked = selected.includes(item.uid);
          return (
            <View style={{ paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={() => startChat(item)} style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{item.displayName}</Text>
                <Text>{item.email}</Text>
              </Pressable>
              <Pressable onPress={() => setSelected((prev) => checked ? prev.filter((id) => id !== item.uid) : [...prev, item.uid])}>
                <Text>{checked ? '☑' : '☐'}</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}
