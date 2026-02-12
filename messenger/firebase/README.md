# Firestore Deploy Notes

Use Firebase CLI from the monorepo root (`messenger/`):

```bash
firebase deploy --only firestore:rules --project <your-project-id>
firebase deploy --only firestore:indexes --project <your-project-id>
```

If your shell is inside `messenger/firebase/`, include the config path:

```bash
firebase deploy --config ../firebase.json --only firestore:rules --project <your-project-id>
firebase deploy --config ../firebase.json --only firestore:indexes --project <your-project-id>
```

See `firebase/TROUBLESHOOTING.md` for common Firestore auth/rules issues.
