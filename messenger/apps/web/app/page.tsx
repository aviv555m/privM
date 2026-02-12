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
  createGroupChat,
  deleteMessage,
  editMessage,
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
  type UIPreset,
  type UserProfile,
  type UserUIPreferences
} from '@messenger/shared';
import { initWebFirebase } from '../lib/firebaseClient';

const PRESET_MAP: Record<UIPreset, { accentColor: string; bubbleOutColor: string; bubbleInColor: string; layoutMode: 'full' | 'centered'; bubbleStyle: 'rounded' | 'compact' | 'square' }> = {
  whatsapp: { accentColor: '#00a884', bubbleOutColor: '#005c4b', bubbleInColor: '#202c33', layoutMode: 'full', bubbleStyle: 'rounded' },
  telegram: { accentColor: '#2aabee', bubbleOutColor: '#2b5278', bubbleInColor: '#1d2733', layoutMode: 'centered', bubbleStyle: 'compact' },
  discord: { accentColor: '#5865f2', bubbleOutColor: '#3b428f', bubbleInColor: '#2b2d31', layoutMode: 'centered', bubbleStyle: 'square' }
};

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
  const [selectedUsersForGroup, setSelectedUsersForGroup] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [detailsUser, setDetailsUser] = useState<UserProfile | null>(null);
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
    getUserProfilesByIds(allUids).then(setProfilesById).catch(() => undefined);
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
        try {
          new Notification(sender, { body: chat.lastMessage, tag: chat.id });
        } catch {
          // ignore browser restrictions
        }
      }
    });
  }, [chats, profilesById, currentUser, notificationEnabled]);

  const selectedChat = useMemo(() => chats.find((item) => item.id === selectedChatId) ?? null, [chats, selectedChatId]);
  const chatUsers = useMemo(() => (selectedChat?.participants ?? []).map((uid) => profilesById[uid]).filter(Boolean) as UserProfile[], [selectedChat, profilesById]);

  const activePrefs = useMemo<UserUIPreferences>(() => {
    const me = currentUser ? profilesById[currentUser.uid] : null;
    const raw = me?.uiPrefs;
    if (!raw) return PRESET_MAP.whatsapp;
    const preset = raw.preset ? PRESET_MAP[raw.preset] : PRESET_MAP.whatsapp;
    return { ...preset, ...raw };
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

  async function handleCreateGroup() {
    if (!currentUser || selectedUsersForGroup.length < 2) return;
    const chatId = await createGroupChat(currentUser.uid, selectedUsersForGroup, groupName || 'New Group');
    setSelectedChatId(chatId);
    setGroupName('');
    setSelectedUsersForGroup([]);
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

  async function handleEdit(messageId: string) {
    if (!currentUser || !selectedChatId) return;
    const cleaned = sanitizeMessage(editingText);
    if (!cleaned) return;
    await editMessage(selectedChatId, messageId, currentUser.uid, cleaned);
    setEditingMessageId(null);
    setEditingText('');
  }

  async function handleDelete(messageId: string) {
    if (!currentUser || !selectedChatId) return;
    await deleteMessage(selectedChatId, messageId, currentUser.uid);
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
          <button className="pill-btn" onClick={enableNotifications}>{notificationEnabled ? 'Notifications on' : 'Enable notifications'}</button>
          <Link className="pill-btn" href="/profile">Profile</Link>
          <button className="pill-btn" onClick={() => signOut(getFirebaseClients().auth)}>Sign out</button>
        </div>
      </header>

      <section className="app-layout">
        <aside className="sidebar">
          {errorMessage ? <p style={{ margin: '0.75rem 0.75rem 0', color: '#ef4444', fontSize: 13 }}>{errorMessage}</p> : null}
          <div className="search-box">
            <p className="section-title">New chat / group</p>
            <div className="search-row">
              <input className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name or email" />
              <button className="search-btn" onClick={handleSearch}>Go</button>
            </div>
            <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" style={{ marginTop: 8 }} />
            {searchResults.map((user) => {
              const selected = selectedUsersForGroup.includes(user.uid);
              return (
                <div key={user.uid} className="chat-item" style={{ alignItems: 'center' }}>
                  <button style={{ all: 'unset', cursor: 'pointer', flex: 1 }} onClick={() => openChat(user)}>
                    <span className="avatar" style={{ marginRight: 8 }}>{initials(user.displayName)}</span>
                    <span>{user.displayName}</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => setSelectedUsersForGroup((prev) => selected ? prev.filter((id) => id !== user.uid) : [...prev, user.uid])}
                  />
                </div>
              );
            })}
            <button className="primary-btn" style={{ marginTop: 8 }} onClick={handleCreateGroup}>Create Group</button>
          </div>

          <div className="list-scroll">
            {chats.map((chat) => {
              const unread = chat.unreadCountMap?.[currentUser.uid] ?? 0;
              const isGroup = Boolean(chat.isGroup || chat.participants.length > 2);
              const peerUid = chat.participants.find((value) => value !== currentUser.uid) ?? 'Unknown';
              const title = isGroup ? (chat.groupName || 'Group chat') : (profilesById[peerUid]?.displayName ?? peerUid);
              return (
                <button key={chat.id} className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`} onClick={() => setSelectedChatId(chat.id)}>
                  <span className="avatar">{initials(title)}</span>
                  <div>
                    <div className="chat-main-line">
                      <span className="chat-name">{title}</span>
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
              <span className="avatar">{initials(selectedChat?.groupName || chatUsers[0]?.displayName || 'Chat')}</span>
              <div>
                <strong>{selectedChat?.isGroup ? selectedChat.groupName : chatUsers.find((u) => u.uid !== currentUser.uid)?.displayName || 'Select a chat'}</strong>
                <div className="chat-preview">{selectedChat?.isGroup ? `${chatUsers.length} members` : 'online status unavailable'}</div>
              </div>
            </div>
            <button className="pill-btn" onClick={() => setDetailsUser(chatUsers.find((u) => u.uid !== currentUser.uid) ?? chatUsers[0] ?? null)}>User details</button>
          </header>

          <div className="messages">
            {messages.map((message) => {
              const mine = message.senderId === currentUser.uid;
              const seenByNames = (message.seenBy ?? []).filter((uid) => uid !== currentUser.uid).map((uid) => profilesById[uid]?.displayName || uid);
              const bubbleClass = activePrefs.bubbleStyle === 'compact' ? 'bubble compact' : activePrefs.bubbleStyle === 'square' ? 'bubble square' : 'bubble';
              return (
                <article key={message.id} className={`bubble-wrap ${mine ? 'mine' : 'other'}`}>
                  <div className={bubbleClass}>
                    {editingMessageId === message.id ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <input className="input" value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="search-btn" onClick={() => handleEdit(message.id)}>Save</button>
                          <button className="pill-btn" onClick={() => setEditingMessageId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div>{message.text}</div>
                    )}
                  </div>
                  <div className="bubble-meta">
                    <span>{formatTime(message.createdAt)}</span>
                    {message.editedAt ? <span>edited</span> : null}
                    {mine ? <span>{seenByNames.length ? `✓✓ Seen by ${seenByNames.join(', ')}` : '✓ Sent'}</span> : null}
                    {mine && editingMessageId !== message.id ? (
                      <>
                        <button className="meta-btn" onClick={() => { setEditingMessageId(message.id); setEditingText(message.text); }}>Edit</button>
                        <button className="meta-btn" onClick={() => handleDelete(message.id)}>Delete</button>
                      </>
                    ) : null}
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

      {detailsUser ? (
        <div className="modal-backdrop" onClick={() => setDetailsUser(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="banner-preview" style={{ height: 120, backgroundImage: detailsUser.bannerURL ? `url(${detailsUser.bannerURL})` : undefined }} />
            <div style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {detailsUser.photoURL ? <img src={detailsUser.photoURL} className="profile-photo" alt="profile" /> : <span className="avatar">{initials(detailsUser.displayName)}</span>}
                <div>
                  <strong>{detailsUser.displayName}</strong>
                  <div className="chat-preview">@{detailsUser.username || detailsUser.uid}</div>
                </div>
              </div>
              <p style={{ marginTop: 12 }}>{detailsUser.about || 'No bio provided.'}</p>
              <button className="primary-btn" onClick={() => setDetailsUser(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
