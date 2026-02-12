# Messenger Monorepo

Production-ready MVP messenger with three clients in one TypeScript monorepo:

- **Web**: Next.js (App Router)
- **Mobile**: React Native + Expo
- **Desktop**: Tauri v2 wrapping the same Next.js UI
- **Backend**: Firebase Auth + Firestore

## Repository Structure

```text
messenger/
  apps/
    web/        # Next.js web client
    mobile/     # Expo React Native client
    desktop/    # Tauri wrapper for web build
  packages/
    shared/     # shared types + Firebase client + chat helpers + validation
  firebase/
    firestore.rules
    firestore.indexes.json
  package.json
  pnpm-workspace.yaml
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Firebase project with Authentication + Firestore enabled
- For mobile native builds: Android Studio / Xcode
- For desktop: Rust toolchain + platform-specific Tauri prerequisites

## Firebase Setup

1. Create a Firebase project.
2. Enable **Authentication → Email/Password**.
3. Create **Firestore Database (production mode)**.
4. In Firebase Console, copy your web app config values.
5. Deploy rules/indexes from this repo:

```bash
firebase deploy --only firestore:rules --project <your-project-id>
firebase deploy --only firestore:indexes --project <your-project-id>
firebase deploy --only storage --project <your-project-id>
```

## Environment Variables

### Web (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Mobile (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

### Desktop

Desktop reuses the web client env vars. Put Firebase values in `apps/web/.env.local` before running `desktop` scripts.

## Install

```bash
cd messenger
pnpm install
```

`postinstall` auto-generates placeholder mobile/desktop icon assets locally so binary files are not stored in git.

## Run (Development)

### Web

```bash
pnpm dev:web
```

### Mobile

```bash
pnpm dev:mobile
```

### Desktop (Tauri + shared web UI)

```bash
pnpm dev:desktop
```

## Build

### Web

```bash
pnpm build:web
```

### Mobile (Expo export)

```bash
pnpm build:mobile
```

### Desktop (Tauri package)

```bash
pnpm build:desktop
```

## Lint / Typecheck

```bash
pnpm check:conflicts
pnpm lint
pnpm typecheck
```

## MVP Feature Coverage

- Email/password sign up, sign in, sign out
- User profile creation + update (displayName, photoURL)
- Presence via `lastOnlineAt` updates on app open and intervals
- 1:1 direct chat creation via user search
- Real-time chat list + room listeners
- Message send with validation (`MAX_MESSAGE_LENGTH = 1000`)
- Basic unread counter map shape in chat documents
- Theme toggle (light/dark)
- Responsive web layout + mobile tab navigation
- Tauri desktop shell with title **Messenger**
- Firestore security rules and required indexes

## Data Model

### `users/{uid}`

- `uid`
- `displayName`
- `displayNameLower`
- `email`
- `emailLower`
- `photoURL`
- `createdAt`
- `lastOnlineAt`

### `chats/{chatId}`

- `participants` (`string[2]`)
- `createdAt`
- `lastMessage`
- `lastMessageAt`
- `lastSenderId`
- `unreadCountMap` (`Record<uid, number>`)

### `chats/{chatId}/messages/{messageId}`

- `chatId`
- `senderId`
- `text`
- `createdAt`

## Shared APIs (`@messenger/shared`)

- `getOrCreateDirectChat(uidA, uidB)`
- `sendMessage(chatId, senderId, text)`
- `listenToChats(uid, callback)`
- `listenToMessages(chatId, callback)`
- `searchUsers(term, currentUid)`
- `updateUserProfile(uid, payload)`
- `updatePresence(uid)`

## Notes

- Search is powered by prefix-match on `displayNameLower` and `emailLower`.
- Chat IDs are deterministic (`sortedUidA__sortedUidB`) so users only get one direct thread.
- Desktop app uses `apps/web` in dev (`localhost:3000`) and static export (`apps/web/out`) for production bundles.
