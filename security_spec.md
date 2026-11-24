# SPARK Cloud Firestore Security Specification

## 1. Data Invariants
1. Default-deny catch-all (`match /{document=**} { allow read, write: if false; }`) blocks every unlisted collection.
2. Every read and write requires Firebase Authentication (`request.auth != null`), and all writes mandate verified accounts (`request.auth.token.email_verified == true`).
3. A board (`boards/{boardId}`) can only be created when `incoming().ownerId == request.auth.uid`, `createdAt == request.time`, and `updatedAt == request.time`.
4. `ownerId` and `createdAt` are immutable after board creation; only `ownerId` can delete a board or toggle `shareEnabled` / remove collaborators.
5. Reading (`get` or `list`) `boards/{boardId}` is strictly restricted to `ownerId` or UIDs listed in `collaborators`.
6. Collaborators (`request.auth.uid in existing().collaborators`) can update canvas content (`title`, `elements`, `camera`, `canvasThemeId`, `elementCount`, `lastNoteSnippet`, `updatedAt`) but cannot mutate `ownerId`, `createdAt`, `shareEnabled`, or `collaborators`.
7. Self-joining a shared board is permitted only when `existing().shareEnabled == true` and only appends the caller's own UID (`request.auth.uid`) to `collaborators` with `updatedAt == request.time`.
8. Every `boards/{boardId}/presence/{userId}` document validates parent membership via `get(/databases/$(database)/documents/boards/$(boardId))` and restricts create/update/delete strictly to `request.auth.uid == userId`.
9. Every string, list, and document ID is strictly bounded by `.size()` and regex (`^[a-zA-Z0-9_\\-]+$`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read/write**: `auth = null` attempting `getDoc` or `setDoc` on `/boards/b1`.
2. **Unverified email write**: `auth = { uid: "u1", token: { email_verified: false } }` creating `/boards/b1`.
3. **Owner ID spoofing on create**: `u1` creating `/boards/b1` with `ownerId: "u2"`.
4. **Ghost shadow field on create/update**: `u1` setting `{ ...validBoard, isAdmin: true }`.
5. **Immutable `ownerId` hijack on update**: collaborator `u2` updating `ownerId: "u2"`.
6. **Immutable `createdAt` tampering**: `u1` modifying `createdAt` on update.
7. **Client-forged `updatedAt` timestamp**: `u1` writing a backdated `Timestamp` instead of `request.time`.
8. **Collaborator privilege escalation**: collaborator `u2` toggling `shareEnabled` or adding `"u3"` to `collaborators`.
9. **Unauthorized self-join on private board**: stranger `u3` adding themselves to `collaborators` when `shareEnabled == false`.
10. **Non-owner delete**: collaborator `u2` calling `deleteDoc` on `/boards/b1`.
11. **Presence cursor spoofing**: `u2` writing `/boards/b1/presence/u1` (`userId != request.auth.uid`) or `peerId != userId`.
12. **Resource exhaustion / ID poisoning**: `u1` creating `/boards/bad.id$123` or `title` > 140 chars or `tags` > 12 items.
