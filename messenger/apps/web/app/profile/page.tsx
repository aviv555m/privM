'use client';

import Link from 'next/link';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  getFirebaseClients,
  updateUserProfile,
  updatePresence,
  uploadProfileBanner,
  uploadProfilePhoto,
  type UserProfile,
  type UIPreset
} from '@messenger/shared';
import { initWebFirebase } from '../../lib/firebaseClient';

const PRESET_MAP: Record<UIPreset, { accentColor: string; bubbleOutColor: string; bubbleInColor: string; layoutMode: 'full' | 'centered'; bubbleStyle: 'rounded' | 'compact' | 'square' }> = {
  whatsapp: { accentColor: '#00a884', bubbleOutColor: '#005c4b', bubbleInColor: '#202c33', layoutMode: 'full', bubbleStyle: 'rounded' },
  telegram: { accentColor: '#2aabee', bubbleOutColor: '#2b5278', bubbleInColor: '#1d2733', layoutMode: 'centered', bubbleStyle: 'compact' },
  discord: { accentColor: '#5865f2', bubbleOutColor: '#3b428f', bubbleInColor: '#2b2d31', layoutMode: 'centered', bubbleStyle: 'square' }
};

async function fileToBlob(file: File, maxSize = 1200): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.82));
  return blob ?? file;
}

export default function ProfilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [about, setAbout] = useState('');
  const [photoURL, setPhotoURL] = useState<string>('');
  const [bannerURL, setBannerURL] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<UIPreset>('whatsapp');
  const [layoutMode, setLayoutMode] = useState<'full' | 'centered'>('full');
  const [bubbleStyle, setBubbleStyle] = useState<'rounded' | 'compact' | 'square'>('rounded');
  const [accentColor, setAccentColor] = useState('#00a884');
  const [bubbleOutColor, setBubbleOutColor] = useState('#005c4b');
  const [bubbleInColor, setBubbleInColor] = useState('#202c33');

  useEffect(() => {
    initWebFirebase();
    document.body.dataset.theme = 'dark';

    const { auth, db } = getFirebaseClients();
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUid(user.uid);
      await updatePresence(user.uid);
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) return;
      const profile = snap.data() as UserProfile;
      setDisplayName(profile.displayName ?? '');
      setUsername(profile.username ?? '');
      setAbout(profile.about ?? '');
      setPhotoURL(profile.photoURL ?? '');
      setBannerURL(profile.bannerURL ?? '');
      setPreset(profile.uiPrefs?.preset ?? 'whatsapp');
      setLayoutMode(profile.uiPrefs?.layoutMode ?? 'full');
      setBubbleStyle(profile.uiPrefs?.bubbleStyle ?? 'rounded');
      setAccentColor(profile.uiPrefs?.accentColor ?? '#00a884');
      setBubbleOutColor(profile.uiPrefs?.bubbleOutColor ?? '#005c4b');
      setBubbleInColor(profile.uiPrefs?.bubbleInColor ?? '#202c33');
    });
  }, []);

  function applyPreset(nextPreset: UIPreset) {
    setPreset(nextPreset);
    const p = PRESET_MAP[nextPreset];
    setLayoutMode(p.layoutMode);
    setBubbleStyle(p.bubbleStyle);
    setAccentColor(p.accentColor);
    setBubbleOutColor(p.bubbleOutColor);
    setBubbleInColor(p.bubbleInColor);
  }

  async function saveProfile() {
    if (!uid || !displayName.trim()) return;
    try {
      let nextPhotoURL = photoURL || null;
      let nextBannerURL = bannerURL || null;
      if (photoFile) {
        const blob = await fileToBlob(photoFile, 512);
        nextPhotoURL = await uploadProfilePhoto(uid, blob);
      }
      if (bannerFile) {
        const blob = await fileToBlob(bannerFile, 1400);
        nextBannerURL = await uploadProfileBanner(uid, blob);
      }
      await updateUserProfile(uid, {
        displayName: displayName.trim(),
        username: username.trim(),
        about: about.trim(),
        photoURL: nextPhotoURL,
        bannerURL: nextBannerURL,
        uiPrefs: {
          preset,
          layoutMode,
          bubbleStyle,
          accentColor,
          bubbleOutColor,
          bubbleInColor
        }
      });
      const { auth } = getFirebaseClients();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: displayName.trim(), photoURL: nextPhotoURL });
      }
      setPhotoURL(nextPhotoURL ?? '');
      setBannerURL(nextBannerURL ?? '');
      setPhotoFile(null);
      setBannerFile(null);
      setStatus('Saved');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save profile');
    }
    setTimeout(() => setStatus(''), 1800);
  }

  return (
    <main className="container">
      <header className="app-toolbar">
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Customize Profile</h1>
        <Link className="pill-btn" href="/">Back to chats</Link>
      </header>

      <section className="profile-page">
        <div className="banner-preview" style={{ backgroundImage: bannerURL ? `url(${bannerURL})` : undefined }} />
        <div className="profile-grid">
          <label>
            Display name
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label>
            Username
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="telegram-style username" />
          </label>
          <label>
            About
            <input className="input" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="status / bio" />
          </label>

          <label>
            UI Preset
            <select className="input" value={preset} onChange={(e) => applyPreset(e.target.value as UIPreset)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
              <option value="discord">Discord</option>
            </select>
          </label>

          <label>
            Layout alignment
            <select className="input" value={layoutMode} onChange={(e) => setLayoutMode(e.target.value as 'full' | 'centered')}>
              <option value="full">Full width</option>
              <option value="centered">Centered</option>
            </select>
          </label>

          <label>
            Bubble style
            <select className="input" value={bubbleStyle} onChange={(e) => setBubbleStyle(e.target.value as 'rounded' | 'compact' | 'square')}>
              <option value="rounded">Rounded</option>
              <option value="compact">Compact</option>
              <option value="square">Square</option>
            </select>
          </label>

          <div className="color-grid">
            <label>
              Accent color
              <input className="input" type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
            </label>
            <label>
              My bubble color
              <input className="input" type="color" value={bubbleOutColor} onChange={(e) => setBubbleOutColor(e.target.value)} />
            </label>
            <label>
              Other bubble color
              <input className="input" type="color" value={bubbleInColor} onChange={(e) => setBubbleInColor(e.target.value)} />
            </label>
          </div>

          <label>
            Profile photo upload
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPhotoFile(file);
                setPhotoURL(URL.createObjectURL(file));
              }}
            />
          </label>

          <label>
            Banner upload
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBannerFile(file);
                setBannerURL(URL.createObjectURL(file));
              }}
            />
          </label>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {photoURL ? <img src={photoURL} alt="profile" className="profile-photo" /> : <div className="profile-photo" />}
            <button className="primary-btn" onClick={saveProfile}>Save profile</button>
            <span>{status}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
