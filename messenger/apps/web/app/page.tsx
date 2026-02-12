'use client';

import Link from 'next/link';
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
  getUserProfilesByIds,
  listenToChats,
  listenToMessages,
  markMessagesSeen,
  MAX_MESSAGE_LENGTH,
  resetUnreadCount,
  sanitizeMessage,
  searchUsers,
  sendMessage,
  updatePresence,
  upsertUserProfile,
  type Chat,
  type Message,
  type UserProfile,
  type UserUIPreferences
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
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string | null; displayName: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, UserProfile>>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const lastMessageIds = useRef<Record<string, string>>({});
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initWebFirebase();
    document.body.dataset.theme = mode;
  }, [mode]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotificationEnabled(Notification.permission === 'granted');
    }
  }, []);

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
    if (!currentUser || chats.length === 0) return;

    const allUids = chats.flatMap((chat) => chat.participants);
    getUserProfilesByIds(allUids)
      .then(setProfilesById)
      .catch(() => undefined);
  }, [chats, currentUser]);

  useEffect(() => {
    if (!selectedChatId || !currentUser) return;
    const stop = listenToMessages(selectedChatId, (next) => {
      setMessages(next);
      markMessagesSeen(selectedChatId, currentUser.uid).catch(() => undefined);
    });
    resetUnreadCount(selectedChatId, currentUser.uid).catch(() => undefined);
    return () => stop();
  }, [selectedChatId, currentUser]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!currentUser || !notificationEnabled) return;

    chats.forEach((chat) => {
      const latestKey = `${chat.id}:${chat.lastMessageAt?.toDate?.()?.getTime?.() ?? 0}`;
      if (lastMessageIds.current[chat.id] === latestKey) return;
      lastMessageIds.current[chat.id] = latestKey;
      if (!chat.lastMessage || chat.lastSenderId === currentUser.uid) return;

      const sender = profilesById[chat.lastSenderId]?.displayName ?? 'New message';
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(sender, { body: chat.lastMessage });
      }
    });
  }, [chats, profilesById, currentUser, notificationEnabled]);

  const selectedChat = useMemo(() => chats.find((item) => item.id === selectedChatId) ?? null, [chats, selectedChatId]);
  const otherParticipant = useMemo(
    () => selectedChat?.participants.find((participant) => participant !== currentUser?.uid) ?? null,
    [selectedChat, currentUser]
  );
  const otherProfile = otherParticipant ? profilesById[otherParticipant] : null;

  const activePrefs = useMemo<UserUIPreferences>(() => {
    const me = currentUser ? profilesById[currentUser.uid] : null;
    return me?.uiPrefs ?? { layoutMode: 'full', bubbleStyle: 'rounded', accentColor: '#00a884', bubbleOutColor: '#005c4b', bubbleInColor: '#202c33' };
  }, [currentUser, profilesById]);

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

  async function handleSearch() {
    if (!currentUser || searchTerm.trim().length < 2) return;
    const results = await searchUsers(searchTerm, currentUser.uid);
    setSearchResults(results);
  }

  async function openChat(user: UserProfile) {
    if (!currentUser) return;
    try {
      setErrorMessage(null);
      const chatId = await getOrCreateDirectChat(currentUser.uid, user.uid);
      setSelectedChatId(chatId);
      setSearchResults([]);
      setSearchTerm('');
    } catch (error) {
      console.error('Unable to open chat', error);
      setErrorMessage('Could not open this chat due to Firebase permissions.');
    }
  }

  async function handleSend() {
    if (!currentUser || !selectedChatId) return;
    const cleaned = sanitizeMessage(draft);
    if (!cleaned || cleaned.length > MAX_MESSAGE_LENGTH) return;
    await sendMessage(selectedChatId, currentUser.uid, cleaned);
    setDraft('');
  }

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationEnabled(permission === 'granted');
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
    <main
      className={`container ${activePrefs.layoutMode === 'centered' ? 'container-centered' : ''}`}
      style={{
        ['--accent' as string]: activePrefs.accentColor ?? '#00a884',
        ['--accent-strong' as string]: activePrefs.accentColor ?? '#00a884',
        ['--bubble-out' as string]: activePrefs.bubbleOutColor ?? '#005c4b',
        ['--bubble-in' as string]: activePrefs.bubbleInColor ?? '#202c33'
      }}
    >
      <header className="app-toolbar">
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Messenger</h1>
        <div className="toolbar-actions">
          <button className="pill-btn" onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>{mode === 'light' ? 'Dark' : 'Light'}</button>
          <button className="pill-btn" onClick={enableNotifications}>Notifications</button>
          <Link className="pill-btn" href="/profile">Profile</Link>
          <button className="pill-btn" onClick={() => signOut(getFirebaseClients().auth)}>Sign out</button>
        </div>
      </header>

      <section className="app-layout">
        <aside className="sidebar">
          {errorMessage ? (
            <p style={{ margin: '0.75rem 0.75rem 0', color: '#ef4444', fontSize: 13 }}>{errorMessage}</p>
          ) : null}
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
              const peerUid = chat.participants.find((value) => value !== currentUser.uid) ?? 'Unknown';
              const peer = profilesById[peerUid];
              return (
                <button key={chat.id} className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`} onClick={() => setSelectedChatId(chat.id)}>
                  <span className="avatar">{initials(peer?.displayName ?? peer?.email ?? peerUid)}</span>
                  <div>
                    <div className="chat-main-line">
                      <span className="chat-name">{peer?.displayName ?? peer?.username ?? peerUid}</span>
                      <span className="meta-time">{formatTime(chat.lastMessageAt)}</span>
                    </div>
                    <div className="chat-preview">{chat.lastMessage || 'No messages yet'}</div>
                  </div>
                  {unread > 0 ? <span className="badge">{unread}</span> : null}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="chat-pane">
          <header className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="avatar">{initials(otherProfile?.displayName ?? otherProfile?.email ?? otherParticipant)}</span>
              <div>
                <strong>{otherProfile?.displayName ?? otherProfile?.username ?? otherParticipant ?? 'Select a chat'}</strong>
                <div className="chat-preview">{otherProfile ? `@${otherProfile.username || otherProfile.uid}` : 'online status unavailable'}</div>
              </div>
            </div>
          </header>

          <div className="messages">
            {messages.map((message) => {
              const mine = message.senderId === currentUser.uid;
              const seenByOther = Boolean(otherParticipant && message.seenBy?.includes(otherParticipant));
              const bubbleClass = activePrefs.bubbleStyle === 'compact' ? 'bubble compact' : activePrefs.bubbleStyle === 'square' ? 'bubble square' : 'bubble';
              return (
                <article key={message.id} className={`bubble-wrap ${mine ? 'mine' : 'other'}`}>
                  <div className={bubbleClass}>{message.text}</div>
                  <div className="bubble-meta">
                    <span>{formatTime(message.createdAt)}</span>
                    {mine ? <span>{seenByOther ? '✓✓ Seen' : '✓ Sent'}</span> : null}
                  </div>
                </article>
              );
            })}
            <div ref={messageEndRef} />
          </div>

          <footer className="composer">
            <input
              className="message-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={`Type a message (${MAX_MESSAGE_LENGTH} max)`}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <button className="search-btn" onClick={handleSend}>Send</button>
          </footer>
        </section>
      </section>
    </main>
  );
}
