import type { Timestamp } from 'firebase/firestore';

export type ThemeMode = 'light' | 'dark';

export interface UserUIPreferences {
  layoutMode?: 'full' | 'centered';
  bubbleStyle?: 'rounded' | 'compact' | 'square';
  accentColor?: string;
  bubbleOutColor?: string;
  bubbleInColor?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  photoURL?: string | null;
  bannerURL?: string | null;
  about?: string;
  uiPrefs?: UserUIPreferences;
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
  seenBy?: string[];
}
