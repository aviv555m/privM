import { useState } from 'react';
import { Button, TextInput, View } from 'react-native';
import { useAuth } from '../context/auth';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { register } = useAuth();

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 8 }}>
      <TextInput placeholder="Display name" value={displayName} onChangeText={setDisplayName} style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <Button title="Create account" onPress={() => register(email, password, displayName)} />
    </View>
  );
}
