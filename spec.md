# Sentry

## Current State
Sentry is a full-featured AI chat platform with per-profile isolation, memory core, neural map, and localStorage-based persistence. Chat history is saved per (username, profileId, convId) combination using sentinel `local:` references for attachment data URLs, where the actual data URL is stored in a separate `sentry_attach_<msgId>_<idx>` key.

## Requested Changes (Diff)

### Add
- Nothing new to add

### Modify
- **Chat history persistence (root fix):** The current attachment sentinel system (`local:` prefix → separate localStorage key) is brittle because large GIFs can fail to save the attachment key silently. Fix: store the full data URL directly in the message object, but truncate only if the total JSON exceeds a safe threshold (strip attachments as last resort). Remove the `local:` sentinel indirection entirely.
- **Save guard:** Ensure `saveConvMessages` never wipes messages — only save if messages array is non-empty OR if we're explicitly clearing. The current guard checks `messages.length === 0` but the logic has a race where the guard runs with the new empty state before the old messages were saved.
- **Profile change save:** When switching profiles, always save the current messages before wiping state — use `messagesRef.current` and `convIdRef.current` with explicit profile ID passed in (not computed dynamically from localStorage).
- **convId/profile coupling:** Pass the profileId explicitly into `getConvMsgKey`, `getConvListKey`, `getActiveConvKey` so the key is stable and doesn't re-read localStorage mid-operation.

### Remove
- `local:` sentinel URL indirection for attachments
- `saveAttachmentData` / `loadAttachmentData` helpers that store data URLs in separate keys

## Implementation Plan
1. Refactor `getConvMsgKey`, `getConvListKey`, `getActiveConvKey` to accept an explicit `profileId` parameter instead of calling `getActiveProfileId()` internally
2. Thread the `profileId` through all callers: `loadConvMessages`, `saveConvMessages`, `clearConvMessages`, `loadConversations`, `saveConversations`, `getActiveConvId`, `setActiveConvId`
3. Store profile ID in a ref (`profileIdRef`) that updates when profile changes, so save operations always use the correct profile ID
4. Remove `local:` sentinel indirection — store data URLs inline in message attachments. Add a size guard: if total JSON > 4MB, strip attachment data before saving (fallback)
5. Remove `saveAttachmentData`, `loadAttachmentData`, `ATTACH_KEY_PREFIX`
6. In the save `useEffect`, remove the guard that returns early when `messages.length === 0` — instead always save when `messages` array changes (the guard was the bug: if messages reset to [] before save, it skips the save)
7. Actually invert the guard: only skip if messages is empty AND there's nothing saved yet (first mount)
