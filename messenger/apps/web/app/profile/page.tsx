'use client';

import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { getFirebaseClients, updateUserProfile, updatePresence, type UserProfile } from '@messenger/shared';
import { initWebFirebase } from '../../lib/firebaseClient';

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [about, setAbout] = useState('');
  const [photoURL, setPhotoURL] = useState<string>('');
  const [bannerURL, setBannerURL] = useState<string>('');
  const [status, setStatus] = useState<string>('');

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
    });
  }, []);

  async function saveProfile() {
    if (!uid || !displayName.trim()) return;
    await updateUserProfile(uid, {
      displayName: displayName.trim(),
      username: username.trim(),
      about: about.trim(),
      photoURL: photoURL || null,
      bannerURL: bannerURL || null
    });
    setStatus('Saved');
    setTimeout(() => setStatus(''), 1600);
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
            Profile photo upload
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPhotoURL(await fileToDataUrl(file));
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
                setBannerURL(await fileToDataUrl(file));
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
