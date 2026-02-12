import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type QueryConstraint
} from 'firebase/firestore';
import { isValidMessage, sanitizeMessage } from './validation';
import type { Chat, Message, UserProfile, UserUIPreferences } from './types';

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

export function initFirebase(config: FirebaseEnvConfig) {
  if (!appInstance) {
    appInstance = getApps().length ? getApp() : initializeApp(config);
    dbInstance = getFirestore(appInstance);
    authInstance = getAuth(appInstance);
  }

  return {
    app: appInstance,
    db: dbInstance,
    auth: authInstance
  };
}

export function getFirebaseClients() {
  if (!appInstance || !dbInstance || !authInstance) {
    throw new Error('Firebase not initialized. Call initFirebase first.');
  }

  return { app: appInstance, db: dbInstance, auth: authInstance };
}

export async function upsertUserProfile(user: {
  uid: string;
  displayName: string;
  email: string;
  username?: string;
  photoURL?: string | null;
  bannerURL?: string | null;
  about?: string;
  uiPrefs?: UserUIPreferences;
}) {
  const { db } = getFirebaseClients();
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  const username = user.username?.trim();
  const about = user.about?.trim();
  const uiPrefs = user.uiPrefs ?? {};

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName,
      displayNameLower: user.displayName.toLowerCase(),
      username: username || null,
      usernameLower: username ? username.toLowerCase() : null,
      email: user.email,
      emailLower: user.email.toLowerCase(),
      photoURL: user.photoURL ?? null,
      bannerURL: user.bannerURL ?? null,
      about: about || '',
      uiPrefs: {
        layoutMode: uiPrefs.layoutMode ?? 'full',
        bubbleStyle: uiPrefs.bubbleStyle ?? 'rounded',
        accentColor: uiPrefs.accentColor ?? '#00a884',
        bubbleOutColor: uiPrefs.bubbleOutColor ?? '#005c4b',
        bubbleInColor: uiPrefs.bubbleInColor ?? '#202c33'
      },
      createdAt: serverTimestamp(),
      lastOnlineAt: serverTimestamp()
    });
    return;
  }

  await updateDoc(userRef, {
    displayName: user.displayName,
    displayNameLower: user.displayName.toLowerCase(),
    username: username || null,
    usernameLower: username ? username.toLowerCase() : null,
    email: user.email,
    emailLower: user.email.toLowerCase(),
    photoURL: user.photoURL ?? null,
    bannerURL: user.bannerURL ?? null,
    about: about || '',
    uiPrefs: {
      layoutMode: uiPrefs.layoutMode ?? 'full',
      bubbleStyle: uiPrefs.bubbleStyle ?? 'rounded',
      accentColor: uiPrefs.accentColor ?? '#00a884',
      bubbleOutColor: uiPrefs.bubbleOutColor ?? '#005c4b',
      bubbleInColor: uiPrefs.bubbleInColor ?? '#202c33'
    },
    lastOnlineAt: serverTimestamp()
  });
}

export async function updatePresence(uid: string) {
  const { db } = getFirebaseClients();
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { lastOnlineAt: serverTimestamp() });
}

function getDirectChatId(uidA: string, uidB: string) {
  return [uidA, uidB].sort().join('__');
}

export async function getOrCreateDirectChat(uidA: string, uidB: string): Promise<string> {
  if (uidA === uidB) throw new Error('Cannot create chat with yourself');

  const { db } = getFirebaseClients();
  const chatId = getDirectChatId(uidA, uidB);
  const chatRef = doc(db, 'chats', chatId);
  let exists = false;

  try {
    const snapshot = await getDoc(chatRef);
    exists = snapshot.exists();
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== 'permission-denied') {
      throw error;
    }
  }

  if (!exists) {
    await setDoc(chatRef, {
      participants: [uidA, uidB].sort(),
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      lastSenderId: '',
      unreadCountMap: {
        [uidA]: 0,
        [uidB]: 0
      }
    });
  }

  return chatId;
}

export async function sendMessage(chatId: string, senderId: string, text: string) {
  if (!isValidMessage(text)) {
    throw new Error('Invalid message text');
  }

  const { db } = getFirebaseClients();
  const normalized = sanitizeMessage(text);
  const chatRef = doc(db, 'chats', chatId);
  const chatSnapshot = await getDoc(chatRef);

  if (!chatSnapshot.exists()) {
    throw new Error('Chat not found');
  }

  const chat = chatSnapshot.data() as Omit<Chat, 'id'>;
  if (!chat.participants.includes(senderId)) {
    throw new Error('Sender not in this chat');
  }

  const recipientId = chat.participants.find((participant) => participant !== senderId);

  const messageRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
    chatId,
    senderId,
    text: normalized,
    seenBy: [senderId],
    createdAt: serverTimestamp()
  });

  const updates: Record<string, unknown> = {
    lastMessage: normalized,
    lastMessageAt: serverTimestamp(),
    lastSenderId: senderId
  };

  if (recipientId) {
    const unread = chat.unreadCountMap?.[recipientId] ?? 0;
    updates[`unreadCountMap.${senderId}`] = 0;
    updates[`unreadCountMap.${recipientId}`] = unread + 1;
  }

  await updateDoc(chatRef, updates);
  return messageRef.id;
}

export async function markMessagesSeen(chatId: string, uid: string) {
  const { db } = getFirebaseClients();
  const chatSnapshot = await getDoc(doc(db, 'chats', chatId));
  if (!chatSnapshot.exists()) return;

  const chat = chatSnapshot.data() as Omit<Chat, 'id'>;
  if (!chat.participants.includes(uid)) return;

  const messagesSnap = await getDocs(query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(50)));
  const batch = writeBatch(db);
  let changed = 0;

  messagesSnap.docs.forEach((entry) => {
    const message = entry.data() as Message;
    if (!message.seenBy?.includes(uid)) {
      batch.update(entry.ref, {
        seenBy: arrayUnion(uid),
        [`seenAtMap.${uid}`]: serverTimestamp()
      });
      changed += 1;
    }
  });

  if (changed > 0) {
    await batch.commit();
  }
}

export function listenToChats(uid: string, callback: (chats: Chat[]) => void) {
  const { db } = getFirebaseClients();
  const chatsQuery = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(chatsQuery, (snapshot) => {
    const chats = snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<Chat, 'id'>) }));
    callback(chats);
  });
}

export function listenToMessages(chatId: string, callback: (messages: Message[]) => void) {
  const { db } = getFirebaseClients();
  const messagesQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<Message, 'id'>) }));
    callback(messages);
  });
}

export function searchUsers(term: string, currentUid: string, maxResults = 20) {
  const { db } = getFirebaseClients();
  const constraints: QueryConstraint[] = [limit(maxResults)];
  const normalizedTerm = term.trim().toLowerCase();

  const displayNameQuery = query(
    collection(db, 'users'),
    where('displayNameLower', '>=', normalizedTerm),
    where('displayNameLower', '<=', `${normalizedTerm}\uf8ff`),
    ...constraints
  );

  const emailQuery = query(
    collection(db, 'users'),
    where('emailLower', '>=', normalizedTerm),
    where('emailLower', '<=', `${normalizedTerm}\uf8ff`),
    ...constraints
  );

  return Promise.all([getDocs(displayNameQuery), getDocs(emailQuery)]).then(([nameSnap, emailSnap]) => {
    const merged = new Map<string, UserProfile>();

    for (const docSnap of [...nameSnap.docs, ...emailSnap.docs]) {
      const data = docSnap.data() as UserProfile & { displayNameLower?: string; emailLower?: string };
      if (data.uid !== currentUid) {
        merged.set(data.uid, data);
      }
    }

    return Array.from(merged.values());
  });
}

export async function getUserProfilesByIds(uids: string[]) {
  const { db } = getFirebaseClients();
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const result: Record<string, UserProfile> = {};

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
    snap.docs.forEach((entry) => {
      result[entry.id] = entry.data() as UserProfile;
    });
  }

  return result;
}

export async function updateUserProfile(
  uid: string,
  payload: {
    displayName: string;
    username?: string;
    about?: string;
    photoURL?: string | null;
    bannerURL?: string | null;
    uiPrefs?: UserUIPreferences;
  }
) {
  const { db } = getFirebaseClients();
  const username = payload.username?.trim();
  const about = payload.about?.trim();
  const uiPrefs = payload.uiPrefs ?? {};
  if (payload.photoURL && payload.photoURL.length > 700_000) {
    throw new Error('Profile image too large. Please choose a smaller image.');
  }
  if (payload.bannerURL && payload.bannerURL.length > 900_000) {
    throw new Error('Banner image too large. Please choose a smaller image.');
  }
  await updateDoc(doc(db, 'users', uid), {
    displayName: payload.displayName,
    displayNameLower: payload.displayName.toLowerCase(),
    username: username || null,
    usernameLower: username ? username.toLowerCase() : null,
    about: about || '',
    photoURL: payload.photoURL ?? null,
    bannerURL: payload.bannerURL ?? null,
    uiPrefs: {
      layoutMode: uiPrefs.layoutMode ?? 'full',
      bubbleStyle: uiPrefs.bubbleStyle ?? 'rounded',
      accentColor: uiPrefs.accentColor ?? '#00a884',
      bubbleOutColor: uiPrefs.bubbleOutColor ?? '#005c4b',
      bubbleInColor: uiPrefs.bubbleInColor ?? '#202c33'
    },
    lastOnlineAt: serverTimestamp()
  });
}

export async function resetUnreadCount(chatId: string, uid: string) {
  const { db } = getFirebaseClients();
  const chatRef = doc(db, 'chats', chatId);
  const chatSnapshot = await getDoc(chatRef);

  if (!chatSnapshot.exists()) return;

  const chat = chatSnapshot.data() as Partial<Chat>;
  const hasMessages = Boolean(chat.lastSenderId) || Boolean(chat.lastMessage);

  if (!hasMessages) return;

  await updateDoc(chatRef, {
    [`unreadCountMap.${uid}`]: 0
  });
}
