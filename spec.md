# Sentry

## Current State
Sentry is a full-featured AI chat app with black/gold theme, memory system, emoji/GIF picker, clone AI dialog, and user management. The emoji picker has no scroll limit. CloneAIDialog only shows a create form with no profile list/select/delete. GIF display on upload is broken (blank). Members image upload is gated to Unity/Syndelious only. Live content fetch hangs without user feedback. Chat history and auto-save are implemented.

## Requested Changes (Diff)

### Add
- Scrollable emoji picker container (max-height with overflow-y-auto wrapping all emoji sections)
- Profile list in CloneAIDialog: show existing AI profiles with ability to select (activate) and delete each one; display which profile is currently active
- Member image upload accessible to all users (each member can upload their own profile image), not just privileged users
- `interpretMediaAttachment` should actually read text file content (for .txt/.json/.csv files uploaded) and display inline; for image/GIF, show inline immediately without blank state
- Live content fetch: show a loading indicator "Fetching..." in the chat while fetching, with a timeout message if it takes too long or fails (never hang silently)

### Modify
- Emoji picker: wrap the entire picker div contents in a scrollable area with `max-h-80 overflow-y-auto`
- GIF rendering in AttachmentDisplay: for freshly uploaded GIFs (data: URLs), the image should render immediately; remove the `[GIF loading…]` blank state for data URLs that are already resolved; only show loading for `idb:` references still being resolved
- CloneAIDialog: restructure to show (1) list of existing profiles with select/activate and delete buttons, (2) create new clone form below
- UserManagement: allow any logged-in user to upload their own member image (not just Unity/Syndelious)
- handleLinkAttach in ChatPanel: show "Fetching link content..." sentry message immediately, then update it with real content or error within 10 seconds; never hang silently
- handleFileAttach: for text/json/csv files, read the file content and include it in the sentry response

### Remove
- Nothing removed

## Implementation Plan
1. ChatPanel.tsx: Add `max-h-80 overflow-y-auto` wrapper around emoji picker inner content sections
2. AttachmentDisplay: Fix GIF blank by only showing `[GIF loading…]` when URL starts with `idb:` AND resolvedUrl is empty; for data: URLs, resolvedUrl is already set in initial state, no loading needed
3. CloneAIDialog.tsx: Add profile list with activate/delete; show active profile name
4. UserManagement.tsx: Remove `canManageImages` gate from own-user image upload (each user can upload their own image)
5. ChatPanel.tsx handleLinkAttach: Add immediate "Fetching..." message + timeout/error fallback
6. ChatPanel.tsx handleFileAttach: For text files, read content via FileReader as text and include in sentry response
