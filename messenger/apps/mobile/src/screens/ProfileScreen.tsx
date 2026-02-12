import { useState } from 'react';
import { Button, TextInput, View } from 'react-native';
import { updateUserProfile } from '@messenger/shared';
import { useAuth } from '../context/auth';
import { useThemeMode } from '../context/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [photoURL, setPhotoURL] = useState('');

  return (
    <View style={{ flex: 1, padding: 12, gap: 8 }}>
      <TextInput placeholder="Display name" value={displayName ?? ''} onChangeText={setDisplayName} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="Photo URL" value={photoURL} onChangeText={setPhotoURL} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <Button title="Save profile" onPress={() => user && updateUserProfile(user.uid, { displayName, photoURL })} />
      <Button title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} onPress={toggle} />
      <Button title="Sign out" onPress={logout} />
    </View>
  );
}
