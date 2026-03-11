# Sentry v3 — Local Auth, Enhanced AI, Emoji/GIF, Media Interpretation

## Current State
- App uses Internet Identity (ICP) for authentication, which opens external browser popups
- Chat uses explicit command prefixes (TEACH:, IF...THEN..., REMEMBER:, HISTORY:, WHY) only
- Avatar images appear to the right (user bubbles) and left (sentry bubbles) but layout needs polish
- No emoji picker — users can paste emojis but no picker UI
- No link/media content interpretation feedback from AI
- No chat history clear button currently, but the feature should be explicitly removed
- Memory Explorer has search + delete in a side panel
- 3D Brain visualization exists
- Personality system, Timeline, Import/Export all exist

## Requested Changes (Diff)

### Add
- **Local Username/Password Auth System**: Replace Internet Identity entirely. Hardcode two initial accounts: Unity/Bacon and Syndelious/Leviathan. Store credentials in localStorage. Login form replaces the CONNECT button flow.
- **User Management Panel**: Both authenticated users can add/remove usernames+passwords. Search by username to find and remove accounts.
- **localStorage-based Data Layer**: Since no ICP actor will be authenticated, rewrite all data hooks (memories, rules, personality, timeline, knowledge edges) to use localStorage directly. Keep actor calls as no-op stubs.
- **Natural Language Concept Detection**: AI auto-detects in any message: teaching facts, if/then rules, date/time references (today, yesterday, specific dates), self-identity statements ("I am", "I like", "you are"), and stores them automatically without requiring command prefixes. Show a subtle badge when a concept was auto-extracted.
- **Emoji Picker**: A button next to the input that opens an emoji picker grid (basic set, no external library needed — render emoji characters directly). Also support GIF display when a .gif URL is pasted or gif file is uploaded.
- **Media/Link Interpretation**: When a user uploads an image, video, audio, or file, or pastes a link, Sentry generates an interpretive AI response describing what it "perceives" from the attachment (simulated analysis). For links: fetch page title if possible via a simple heuristic, then describe the URL. For images: describe type and context. For audio/video: acknowledge and prompt for context.
- **Avatar display left of messages**: All messages (user and sentry) show avatar on the LEFT side, with name above. Remove right-aligned user messages — use left-aligned layout for all with color distinction instead.

### Modify
- **Header**: Remove Internet Identity connect/disconnect button. Show logged-in username in header. Add logout button. Add user management button (gear/admin icon).
- **App.tsx**: Replace `isAuthenticated` check (based on ICP identity) with local auth state from localStorage.
- **ChatPanel**: 
  - Remove any clear chat history button or ability
  - Add emoji picker toggle button
  - Add link paste detection with AI interpretation
  - Enhanced `handleSend` with natural language NLP detection before explicit command checks
- **aiEngine.ts**: Add `detectConceptsFromNaturalLanguage()` function that scans for: dates, "I am/like", "you are/like", teaching statements, if/then patterns regardless of capitalization/order
- **MemoryExplorer**: Memory tab remains, but no conversation search — memories only. Edit support: click memory text to inline-edit before saving.
- **useQueries.ts**: Rewrite to use localStorage-backed store instead of ICP actor calls

### Remove
- Internet Identity (`useInternetIdentity`) from auth flow — replaced by local auth
- ICP CONNECT/DISCONNECT button in Header
- ProfileSetup dialog (replaced by login form)
- Any clear chat history functionality

## Implementation Plan
1. Create `src/utils/localDB.ts` — full localStorage CRUD for memories, rules, personality, timeline, edges, users, settings
2. Create `src/utils/localAuth.ts` — credential management, login/logout, user CRUD
3. Create `src/components/LoginScreen.tsx` — username/password login form
4. Create `src/components/UserManagement.tsx` — search/add/remove accounts panel
5. Rewrite `src/hooks/useQueries.ts` — use localDB instead of actor
6. Update `src/utils/aiEngine.ts` — add natural language concept extractor
7. Update `src/components/ChatPanel.tsx` — emoji picker, media interpretation, NLP detection, left-aligned layout
8. Update `src/components/Header.tsx` — remove ICP auth, show username/logout
9. Update `src/App.tsx` — use localAuth for auth gate
10. Update `src/components/MemoryExplorer.tsx` — add inline edit
