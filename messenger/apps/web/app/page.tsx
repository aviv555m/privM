'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  getFirebaseClients,
  getOrCreateDirectChat,
  listenToChats,
  listenToMessages,
  MAX_MESSAGE_LENGTH,
  resetUnreadCount,
  sanitizeMessage,
  searchUsers,
  sendMessage,
  updatePresence,
  updateUserProfile,
  upsertUserProfile,
  type Chat,
  type Message,
  type UserProfile
} from '@messenger/shared';
import { initWebFirebase } from '../lib/firebaseClient';

function formatTime(value?: { toDate?: () => Date } | null) {
  if (!value?.toDate) return '';
  return value.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function HomePage() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string | null; displayName: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initWebFirebase();
    document.body.dataset.theme = mode;
  }, [mode]);

  useEffect(() => {
    const { auth } = getFirebaseClients();
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        return;
      }

      setCurrentUser({ uid: user.uid, email: user.email, displayName: user.displayName });
      await upsertUserProfile({
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
        photoURL: user.photoURL
      });
      await updatePresence(user.uid);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const stop = listenToChats(currentUser.uid, setChats);
    const id = window.setInterval(() => updatePresence(currentUser.uid), 60_000);

    return () => {
      stop();
      window.clearInterval(id);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!selectedChatId || !currentUser) return;
    const stop = listenToMessages(selectedChatId, setMessages);
    resetUnreadCount(selectedChatId, currentUser.uid);
    return () => stop();
  }, [selectedChatId, currentUser]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedChat = useMemo(() => chats.find((item) => item.id === selectedChatId) ?? null, [chats, selectedChatId]);
  const otherParticipant = useMemo(
    () => selectedChat?.participants.find((participant) => participant !== currentUser?.uid) ?? null,
    [selectedChat, currentUser]
  );

  async function handleSignIn(isRegister: boolean) {
    const { auth } = getFirebaseClients();

    if (isRegister) {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(credential.user, { displayName });
      }
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
  }

  async function handleProfileSave() {
    if (!currentUser) return;
    await updateUserProfile(currentUser.uid, { displayName, photoURL: photoURL || null });
    alert('Profile saved');
  }

  async function handleSearch() {
    if (!currentUser || searchTerm.trim().length < 2) return;
    const results = await searchUsers(searchTerm, currentUser.uid);
    setSearchResults(results);
  }

  async function openChat(user: UserProfile) {
    if (!currentUser) return;
    const chatId = await getOrCreateDirectChat(currentUser.uid, user.uid);
    setSelectedChatId(chatId);
    setSearchResults([]);
    setSearchTerm('');
  }

  async function handleSend() {
    if (!currentUser || !selectedChatId) return;
    const cleaned = sanitizeMessage(draft);
    if (!cleaned || cleaned.length > MAX_MESSAGE_LENGTH) return;
    await sendMessage(selectedChatId, currentUser.uid, cleaned);
    setDraft('');
  }

  if (!currentUser) {
    return (
      <main className="container">
        <section className="card" style={{ maxWidth: 460, margin: '5rem auto' }}>
          <h1>Messenger</h1>
          <p>Sign in with your email and password.</p>
          <input placeholder="Display name (for register)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleSignIn(false)}>Sign in</button>
            <button onClick={() => handleSignIn(true)}>Register</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Messenger</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>{mode === 'light' ? 'Dark' : 'Light'} mode</button>
          <button onClick={() => signOut(getFirebaseClients().auth)}>Sign out</button>
        </div>
      </header>
      <section className="layout">
        <aside className="card" style={{ overflowY: 'auto' }}>
          <h3>New chat</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name/email" style={{ width: '100%' }} />
            <button onClick={handleSearch}>Search</button>
          </div>
          {searchResults.map((user) => (
            <button key={user.uid} onClick={() => openChat(user)} style={{ width: '100%', marginTop: 8, textAlign: 'left' }}>
              {user.displayName} · {user.email}
            </button>
          ))}

          <h3>Chats</h3>
          {chats.map((chat) => {
            const unread = chat.unreadCountMap?.[currentUser.uid] ?? 0;
            const peer = chat.participants.find((value) => value !== currentUser.uid) ?? 'Unknown';
            return (
              <button key={chat.id} onClick={() => setSelectedChatId(chat.id)} style={{ width: '100%', marginBottom: 8, textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>{peer}</div>
                <div style={{ color: 'var(--muted)' }}>{chat.lastMessage || 'No messages yet'}</div>
                <small>{formatTime(chat.lastMessageAt)}</small>
                {unread > 0 && <span style={{ marginLeft: 8, background: 'var(--accent)', color: '#fff', borderRadius: 12, padding: '2px 8px' }}>{unread}</span>}
              </button>
            );
          })}

          <h3>Profile</h3>
          <input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <input placeholder="Photo URL" value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
          <button onClick={handleProfileSave}>Save profile</button>
        </aside>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 300 }}>
          <h3 style={{ marginTop: 0 }}>{otherParticipant ? `Chat with ${otherParticipant}` : 'Select a chat'}</h3>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {messages.map((message) => {
              const mine = message.senderId === currentUser.uid;
              return (
                <div key={message.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                  <div
                    style={{
                      background: mine ? 'var(--accent)' : '#374151',
                      color: '#fff',
                      borderRadius: 12,
                      padding: '8px 12px'
                    }}
                  >
                    {message.text}
                  </div>
                  <small style={{ color: 'var(--muted)' }}>{formatTime(message.createdAt)}</small>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Message (max ${MAX_MESSAGE_LENGTH})`}
              style={{ width: '100%' }}
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </section>
      </section>
    </main>
  );
}
