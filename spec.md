# Sentry

## Current State
ChatPanel stores messages per (username, profileId, conversationId) triplet in localStorage. The save mechanism uses a `useEffect` on `[messages, convId]` with a `isMountedRef` guard to skip the first render. However several race conditions cause chats to be wiped:

1. If `getCurrentUser()` returns `""` at mount (user state not yet hydrated), the lazy `useState` inits load from key `sentry_chat__default` instead of the real key — returning `[]`. Then `isMountedRef` is set `true` on that render, and the next render saves `[]` to the wrong or correct key, wiping real data.
2. No listener for login/logout events — after login, `getCurrentUser()` changes but the component never reloads messages for the new user.
3. New conversation creation does not explicitly save the current conversation before calling `setMessages([])`.
4. The `reloadForProfile` handler saves before switching, but relies on `convIdRef.current` which may lag one render behind.

## Requested Changes (Diff)

### Add
- Login/logout event listener in ChatPanel: when `sentry_user_changed` fires (or localStorage `sentry_current_user` changes), reload all conversation state for the new user
- Explicit `saveConvMessages` call before `setMessages([])` in the new-conversation handler
- Guard in the save `useEffect`: only save if username is non-empty AND messages array is non-empty OR the key already has data (prevent wiping with [])

### Modify
- The save `useEffect` guard: replace `isMountedRef` approach with a smarter guard that checks `getCurrentUser()` returns a non-empty string before saving, and skips saving an empty array over an existing non-empty saved conversation
- The `useState` lazy inits for `convId`, `conversations`, `messages`: add a fallback — if `getCurrentUser()` is empty at init time, defer to empty defaults but then reload once user is available
- The `reloadForProfile` handler: synchronously save using `convIdRef.current` and `messagesRef.current` before any state update
- The new-conversation button onClick: call `saveConvMessages(u, convId, messages)` before `setMessages([])`
- All conversation-switch click handlers: already save before loading — verify they also update `convIdRef` and `messagesRef` synchronously

### Remove
- The `isMountedRef` pattern — replace with safer username-check guard

## Implementation Plan
1. Replace `isMountedRef` save guard with: skip save if `getCurrentUser()` is empty; skip save if `messages.length === 0` and there's already saved data for that key (avoid wiping)
2. Add `sentry_user_changed` custom event dispatch in `localAuth.ts` on login/logout
3. Listen for `sentry_user_changed` (and `storage` key `sentry_current_user`) in ChatPanel — call a `reloadForUser()` function that re-reads conversations and messages for the new user
4. In new-conversation onClick: add `saveConvMessages(u, convId, messages)` before `setConvId` and `setMessages([])`
5. Ensure `messagesRef` and `convIdRef` are updated synchronously via refs before any async operations
