# Sentry

## Current State
Sentry is a full-stack AI chat/teaching platform with a three-panel layout (Memory Core, Chat, Brain Visualization). It has:
- Memory Explorer with collapsible sections (Personal, User Knowledge, Global Knowledge, History, Rules, Concepts) with role-based edit/delete controls
- Header showing active AI profile name and avatar, with all nav buttons including LogOut
- ChatPanel showing AI profile name/avatar in messages
- UserManagement panel where Class 6 (Unity/Syndelious) can upload login images for members
- Access control: Class 6 and assigned trainers can edit global data; others can only edit personal data
- Auto-save every 30s, localStorage persistence, IndexedDB for GIFs

## Requested Changes (Diff)

### Add
- Sign out button with visible text label "SIGN OUT" in the Header (currently icon-only and easy to miss)
- Memory Core AI profile header must clearly show: profile picture, AI name (editable by Class 6/trainers), and labeled sections for all knowledge types

### Modify
- Header: Make the logout/sign-out button more visible — add text "SIGN OUT" next to the icon, or use a distinct gold-bordered style so it's clearly findable
- Memory Core: Ensure the AI profile name and avatar at the top update correctly when switching profiles (listen to all three events: sentry_profile_changed, sentry_ai_name_changed, sentry_ai_avatar_changed)
- Memory Core: Ensure Categories section header only shows edit controls to Class 6 and trainers; everyone can see categories
- ChatPanel: Ensure AI profile name and avatar in message bubbles update immediately when profile is switched
- GIF uploads: Fix blank GIF issue — store to IndexedDB immediately before adding the message, use IDB key reference in message, resolve IDB key to data URL on render
- Chat history: Ensure Unity's chat history (and all users) persists after logout and page refresh via localStorage — save on every message add and on page unload
- UserManagement: Ensure Class 6 (Unity/Syndelious) can upload login images for any member using the camera icon. Non-Class 6 users cannot upload for others. Login image is separate from chat profile pic.
- Access control enforcement: Only Class 6 and assigned AI trainers for the active profile can edit/delete Categories, User Knowledge, Global Knowledge, History, Rules, Concepts. All users can edit/delete their own Personal memories.

### Remove
- Nothing removed

## Implementation Plan
1. **Header**: Add visible "SIGN OUT" text label to the logout button; ensure it's clearly distinguishable (gold border on hover or persistent label)
2. **Memory Core**: Verify profile header (avatar + name) listens to all profile change events and re-reads localStorage on each event; ensure name/avatar update immediately on profile switch
3. **Memory Core**: Ensure Categories button is visible to all but only Class 6/trainers see edit controls inside CategoryManager
4. **ChatPanel**: Ensure AI avatar/name shown in sentry message bubbles updates when profile changes (listen to sentry_profile_changed, sentry_ai_name_changed, sentry_ai_avatar_changed events)
5. **GIF Fix**: In the file upload handler, call `storeAttachment` and fully await it before calling `addMessage`. Use the IDB key in the attachment. In message rendering, resolve IDB keys to data URLs synchronously from a pre-loaded cache.
6. **Chat persistence**: In `saveChatMessages`, ensure the per-user-per-profile key is used. On login, load chat for the correct user+profile combo. Add `beforeunload` save.
7. **UserManagement**: Confirm login image upload button (camera icon) is visible for all members when the current user is Class 6. Display login image preview after upload.
