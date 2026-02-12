import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/auth';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 8 }}>
      <Text style={{ fontSize: 24, fontWeight: '700' }}>Messenger</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <Button title="Sign in" onPress={() => signIn(email, password)} />
      <Button title="Register" onPress={() => navigation.navigate('Register')} />
    </View>
  );
}
