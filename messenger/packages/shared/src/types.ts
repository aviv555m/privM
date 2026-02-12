import type { Timestamp } from 'firebase/firestore';

export type ThemeMode = 'light' | 'dark';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  createdAt: Timestamp;
  lastOnlineAt: Timestamp;
}

export interface Chat {
  id: string;
  participants: [string, string];
  createdAt: Timestamp;
  lastMessage: string;
  lastMessageAt: Timestamp;
  lastSenderId: string;
  unreadCountMap?: Record<string, number>;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
}
