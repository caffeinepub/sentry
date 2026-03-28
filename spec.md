# Sentry

## Current State
- Wolpdragos and wolfi da furri are pre-seeded as DEFAULT_CREDS in localAuth.ts, which means they always get re-added even after deletion
- BrainVisualization does not re-mount or re-fetch when AI profile changes — it has no `key` prop tied to `activeProfileId`
- GIF attachments: stored with `local:` sentinel URL, but the `AttachmentDisplay` component resolves them from localStorage. Issue is that on message send, the data URL may not be saved before rendering.
- Chat conversation list: names are saved to localStorage but `saveConversations` uses `getConvListKey()` which calls `getActiveProfileId()` at call time, so renames should persist. However `onBlur` fires and clears draft without saving.

## Requested Changes (Diff)

### Add
- Nothing new to add

### Modify
- `localAuth.ts`: Remove Wolpdragos and wolfi da furri from DEFAULT_CREDS. Keep only Unity and Syndelious as defaults.
- `App.tsx`: Pass `key={activeProfileId}` to both BrainVisualization instances so they remount on profile switch
- `ChatPanel.tsx`: Fix GIF rendering — when a file is picked as GIF/image, ensure data URL is stored in the separate attachment key BEFORE calling setMessages so the sentinel URL resolves immediately
- `ChatPanel.tsx`: Fix inline rename `onBlur` — it currently discards the name. Fix so it saves on blur too.

### Remove
- Nothing

## Implementation Plan
1. Edit `localAuth.ts` — remove Wolpdragos/wolfi from DEFAULT_CREDS array
2. Edit `App.tsx` — add `key={activeProfileId}` to both BrainVisualization components
3. Edit `ChatPanel.tsx` — fix GIF blank issue: when reading file, save attachment data BEFORE adding message to state
4. Edit `ChatPanel.tsx` — fix rename onBlur to save the name (not just close edit mode)
