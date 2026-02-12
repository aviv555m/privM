import { useState } from 'react';
import { Alert, Button, Image, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { updateUserProfile, uploadProfileBanner, uploadProfilePhoto, type UIPreset } from '@messenger/shared';
import { useAuth } from '../context/auth';
import { useThemeMode } from '../context/theme';

const presets: UIPreset[] = ['whatsapp', 'telegram', 'discord'];

async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  return response.blob();
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState('');
  const [about, setAbout] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [bannerURL, setBannerURL] = useState('');
  const [preset, setPreset] = useState<UIPreset>('whatsapp');
  const [saving, setSaving] = useState(false);

  async function choosePhoto() {
    const blob = await pickImage();
    if (!blob || !user) return;
    const url = await uploadProfilePhoto(user.uid, blob);
    setPhotoURL(url);
  }

  async function chooseBanner() {
    const blob = await pickImage();
    if (!blob || !user) return;
    const url = await uploadProfileBanner(user.uid, blob);
    setBannerURL(url);
  }

  async function save() {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        username: username.trim(),
        about: about.trim(),
        photoURL: photoURL || null,
        bannerURL: bannerURL || null,
        uiPrefs: { preset }
      });
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
      {bannerURL ? <Image source={{ uri: bannerURL }} style={{ height: 120, borderRadius: 12 }} /> : null}
      <Button title="Upload banner" onPress={chooseBanner} />
      {photoURL ? <Image source={{ uri: photoURL }} style={{ width: 80, height: 80, borderRadius: 40 }} /> : null}
      <Button title="Upload profile photo" onPress={choosePhoto} />
      <TextInput placeholder="Display name" value={displayName ?? ''} onChangeText={setDisplayName} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="Username" value={username} onChangeText={setUsername} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} autoCapitalize="none" />
      <TextInput placeholder="About" value={about} onChangeText={setAbout} style={{ borderWidth: 1, borderRadius: 8, padding: 10 }} />
      <Text>UI preset</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {presets.map((p) => <Button key={p} title={p} onPress={() => setPreset(p)} />)}
      </View>
      <Button title={saving ? 'Saving...' : 'Save profile'} onPress={save} disabled={saving} />
      <Button title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} onPress={toggle} />
      <Button title="Sign out" onPress={logout} />
    </ScrollView>
  );
}
