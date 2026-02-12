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

function initials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
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

      const resolvedName = user.displayName ?? user.email?.split('@')[0] ?? 'User';
      setCurrentUser({ uid: user.uid, email: user.email, displayName: user.displayName });
      setDisplayName((value) => value || resolvedName);
      setPhotoURL((value) => value || user.photoURL || '');
      await upsertUserProfile({
        uid: user.uid,
        email: user.email ?? '',
        displayName: resolvedName,
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
    resetUnreadCount(selectedChatId, currentUser.uid).catch((error) => {
      console.warn('Unable to reset unread count', error);
    });
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
    if (!currentUser || !displayName.trim()) return;
    await updateUserProfile(currentUser.uid, { displayName: displayName.trim(), photoURL: photoURL || null });
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
        <section className="auth-card">
          <h1 style={{ marginTop: 0 }}>Messenger</h1>
          <p style={{ color: 'var(--muted)' }}>Sign in with your email and password.</p>
          <input className="input" placeholder="Display name (for register)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary-btn" onClick={() => handleSignIn(false)}>Sign in</button>
            <button className="primary-btn" onClick={() => handleSignIn(true)}>Register</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="app-toolbar">
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Messenger</h1>
        <div className="toolbar-actions">
          <button className="pill-btn" onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>{mode === 'light' ? 'Dark' : 'Light'}</button>
          <button className="pill-btn" onClick={() => signOut(getFirebaseClients().auth)}>Sign out</button>
        </div>
      </header>

      <section className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="avatar">{initials(currentUser.displayName ?? currentUser.email ?? undefined)}</span>
              <strong>{currentUser.displayName ?? currentUser.email}</strong>
            </div>
          </div>

          <div className="search-box">
            <p className="section-title">New Chat</p>
            <div className="search-row">
              <input className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name or email" />
              <button className="search-btn" onClick={handleSearch}>Go</button>
            </div>
            {searchResults.map((user) => (
              <button key={user.uid} className="chat-item" onClick={() => openChat(user)}>
                <span className="avatar">{initials(user.displayName)}</span>
                <div>
                  <div className="chat-name">{user.displayName}</div>
                  <div className="chat-preview">{user.email}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="list-scroll">
            {chats.map((chat) => {
              const unread = chat.unreadCountMap?.[currentUser.uid] ?? 0;
              const peer = chat.participants.find((value) => value !== currentUser.uid) ?? 'Unknown';
              return (
                <button key={chat.id} className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`} onClick={() => setSelectedChatId(chat.id)}>
                  <span className="avatar">{initials(peer)}</span>
                  <div>
                    <div className="chat-main-line">
                      <span className="chat-name">{peer}</span>
                      <span className="meta-time">{formatTime(chat.lastMessageAt)}</span>
                    </div>
                    <div className="chat-preview">{chat.lastMessage || 'No messages yet'}</div>
                  </div>
                  {unread > 0 ? <span className="badge">{unread}</span> : <span />}
                </button>
              );
            })}
          </div>

          <div className="profile-box">
            <p className="section-title">Profile</p>
            <input className="input" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <input className="input" placeholder="Photo URL" value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} />
            <button className="primary-btn" onClick={handleProfileSave}>Save profile</button>
          </div>
        </aside>

        <section className="chat-pane">
          <div className="chat-header">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="avatar">{initials(otherParticipant ?? undefined)}</span>
              <div>
                <div style={{ fontWeight: 700 }}>{otherParticipant ?? 'Select a chat'}</div>
                <small className="meta-time">online status unavailable</small>
              </div>
            </div>
          </div>

          <div className="messages">
            {messages.map((message) => {
              const mine = message.senderId === currentUser.uid;
              return (
                <div key={message.id} className={`bubble-wrap ${mine ? 'mine' : 'other'}`}>
                  <div className="bubble">{message.text}</div>
                  <small className="meta-time" style={{ alignSelf: 'flex-end', marginTop: 2 }}>{formatTime(message.createdAt)}</small>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>

          <div className="composer">
            <input
              className="message-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Type a message (${MAX_MESSAGE_LENGTH} max)`}
            />
            <button className="primary-btn" onClick={handleSend}>Send</button>
          </div>
        </section>
      </section>
    </main>
  );
}
