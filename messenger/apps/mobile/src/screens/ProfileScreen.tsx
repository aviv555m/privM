import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { updateUserProfile, type UIPreset } from '@messenger/shared';
import { useAuth } from '../context/auth';
import { useThemeMode } from '../context/theme';

const presets: UIPreset[] = ['whatsapp', 'telegram', 'discord'];

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [photoURL, setPhotoURL] = useState('');
  const [preset, setPreset] = useState<UIPreset>('whatsapp');

  async function save() {
    if (!user) return;
    await updateUserProfile(user.uid, { displayName, photoURL, uiPrefs: { preset } });
  }

  return (
    <View style={{ flex: 1, padding: 12, gap: 8 }}>
      <TextInput placeholder="Display name" value={displayName ?? ''} onChangeText={setDisplayName} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="Photo URL" value={photoURL} onChangeText={setPhotoURL} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <Text>UI preset</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {presets.map((p) => <Button key={p} title={p} onPress={() => setPreset(p)} />)}
      </View>
      <Button title="Save profile" onPress={save} />
      <Button title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} onPress={toggle} />
      <Button title="Sign out" onPress={logout} />
    </View>
  );
}
