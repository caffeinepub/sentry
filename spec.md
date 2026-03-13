# Sentry

## Current State
Sentry is a full-stack AI chat/teaching platform with black and gold theme, persistent memory, 3D brain visualization, per-AI profiles, multi-conversation support, GIF/media uploads, access control (Class 6 / trainers), real-time sync via ICP canister, and IndexedDB for large attachments.

## Requested Changes (Diff)

### Add
- Nothing new structurally

### Modify
- **Button backgrounds**: Strengthen CSS so ALL buttons (including those with bg-gold, bg-primary etc.) stay black at all states (default, hover, focus, active). Text stays gold. The `!important` rules must win over Tailwind utility classes.
- **CloneAIDialog - visible to all**: All logged-in members (not just Class 6) should see the AI profiles list and be able to activate (select) a profile. Only Class 6 can create/delete profiles. Trainers and Class 6 can upload avatar/change name. The tab/button to open this dialog should be accessible to all.
- **Per-AI profile isolation**: Each profile has its own chat history stored under a profile-specific key. When activating a profile, load its chat history. Trainers and Class 6 can upload avatar and change name for assigned AI profiles.
- **GIF display**: Fix blank GIF issue. On upload: store full data URL in IndexedDB immediately BEFORE adding message. Use synchronous cache access in `AttachmentDisplay` so the URL is available on first render. On initial load: warm IDB cache for all idb: keys before rendering messages.
- **Chat history persistence**: Persist across logout/refresh unless explicitly cleared. Already implemented; verify it survives logout cycle.
- **AI image description**: When image uploaded, use canvas pixel analysis to describe colors, brightness, composition. Do NOT say the filename. Already partially implemented; ensure it always runs for image/gif types.
- **Code file preview**: Already implemented; ensure HTML/JS/TS/CSS files show editable code panel with preview button.
- **PDF/doc summarization**: Already implemented; ensure text extraction and summarization runs.
- **Video/audio summarization**: Already implemented; ensure AI generates response from title/duration/type.
- **Link fetching**: Already implemented; ensure no silent hangs - always reply with result or error within timeout.
- **Access control in chat**: When sending a message that teaches global info (TEACH:, IF...THEN..., REMEMBER: global): only Class 6 and trainers for the active AI profile can do this. Non-authorized users get a polite error.

### Remove
- Nothing

## Implementation Plan
1. Strengthen CSS button override in `index.css` to use higher-specificity selectors and attribute selectors that beat Tailwind's bg-gold class.
2. In `CloneAIDialog`, remove the guard that hides the profiles list from non-Class6 users. Show profiles list to all. Show Activate button to all. Show Delete/Create only to Class 6. Show name/avatar edit to Class 6 and trainers.
3. In `ChatPanel`, ensure GIF data is in IDB cache synchronously before message is added (cache warming on upload). The `AttachmentDisplay` component should read from the in-memory cache synchronously on first render for gif type.
4. Verify chat history key is per-profile so switching profiles loads correct history.
5. Ensure access control check in message processing for teach commands.
