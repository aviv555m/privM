# Firestore Troubleshooting

## "Missing or insufficient permissions" when opening a chat

If this appears right after creating/opening a direct chat, redeploy Firestore rules from this repo.
Older rules may block unread-counter updates before first message.

```bash
firebase deploy --only firestore:rules --project <your-project-id>
```
