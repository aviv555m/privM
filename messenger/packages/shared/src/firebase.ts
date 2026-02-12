import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  collection,
  doc,
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
  addDoc,
  type Firestore,
  type QueryConstraint
} from 'firebase/firestore';
import { isValidMessage, sanitizeMessage } from './validation';
import type { Chat, Message, UserProfile } from './types';

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
  photoURL?: string | null;
}) {
  const { db } = getFirebaseClients();
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL ?? null,
      displayNameLower: user.displayName.toLowerCase(),
      emailLower: user.email.toLowerCase(),
      createdAt: serverTimestamp(),
      lastOnlineAt: serverTimestamp()
    });
    return;
  }

  await updateDoc(userRef, {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL ?? null,
    displayNameLower: user.displayName.toLowerCase(),
    emailLower: user.email.toLowerCase(),
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
  const snapshot = await getDoc(chatRef);

  if (!snapshot.exists()) {
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

export async function updateUserProfile(uid: string, payload: { displayName: string; photoURL?: string | null }) {
  const { db } = getFirebaseClients();
  await updateDoc(doc(db, 'users', uid), {
    displayName: payload.displayName,
    displayNameLower: payload.displayName.toLowerCase(),
    photoURL: payload.photoURL ?? null,
    lastOnlineAt: serverTimestamp()
  });
}

export async function resetUnreadCount(chatId: string, uid: string) {
  const { db } = getFirebaseClients();
  await updateDoc(doc(db, 'chats', chatId), {
    [`unreadCountMap.${uid}`]: 0
  });
}
