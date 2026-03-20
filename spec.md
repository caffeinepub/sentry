# Sentry

## Current State
Memories (global/user), rules, and timeline/history are stored in:
- Global memories & rules: ICP canister (shared across all AI profiles — no profile ID)
- User memories: localStorage key `sentry_user_memories_${username}` (per-user, not per-profile)
- Timeline: localStorage key `sentry_timeline_${username}` (per-user, not per-profile)

This means all AI profiles (Sentry and all clones) share the same knowledge, rules, and history — switching profiles does not change what's shown in the Memory Core.

Chat messages ARE already per-profile (keys: `sentry_chat_${user}_${profileId}`, `sentry_conv_${user}_${profileId}_${convId}`).

## Requested Changes (Diff)

### Add
- Profile-scoped storage functions in `localDB.ts`:
  - `getProfileGlobalMemories(profileId)`, `addProfileGlobalMemory(...)`, `deleteProfileGlobalMemory(...)`, `updateProfileGlobalMemory(...)`
  - `getProfileUserMemories(profileId, username)`, `addProfileUserMemory(...)`, `deleteProfileUserMemory(...)`, `updateProfileUserMemory(...)`
  - `getProfileRules(profileId)`, `addProfileRule(...)`, `deleteProfileRule(...)`, `updateProfileRule(...)`
  - `getProfileTimeline(profileId, username)`, `addProfileTimeline(...)`, `deleteProfileTimeline(...)`, `updateProfileTimeline(...)`
  - `seedProfileFromDefault(newProfileId)` — copies default/Sentry profile's memories, rules, timeline to the new profile's keys as the initial knowledge base
- Re-export a helper `getActiveProfileId()` from localDB.ts
- In `CloneAIDialog.tsx`: when creating a new AI profile, call `seedProfileFromDefault(newProfileId)` so it starts with Sentry's current knowledge

### Modify
- `useQueries.ts`: Update ALL memory/rule/timeline hooks to use profile-scoped localStorage keys:
  - `useGetMemories(isGlobal)` → read from `sentry_profile_global_${profileId}` if isGlobal, else `sentry_profile_user_${profileId}_${username}`
  - `useGetUserMemories()` → read from `sentry_profile_user_${profileId}_${username}`
  - `useGetRules()` → read from `sentry_profile_rules_${profileId}`
  - `useGetTimeline()` → read from `sentry_profile_timeline_${profileId}_${username}`
  - `useAddMemory`, `useDeleteMemory`, `useUpdateMemory`, `useAddRule`, `useDeleteRule`, `useAddTimelineEntry`, `useDeleteTimelineEntry`, `useUpdateTimelineEntry` → all write to profile-scoped keys and invalidate accordingly
  - All query keys must include `profileId` so React Query refetches when profile changes
  - For the default profile, migrate existing canister data on first load: read from canister once, seed into localStorage profile keys, then always use localStorage going forward
- `MemoryExplorer.tsx`: 
  - Add `activeProfileId` state that tracks `sentry_active_profile`
  - When `sentry_profile_changed` fires, update `activeProfileId` state to force React Query to refetch with the new profile ID
  - All sections (Personal, User Knowledge, Global Knowledge, History/Timeline, Rules, Concepts) must reload when profile changes
- `ChatPanel.tsx`: When extracting concepts and adding memories/rules/timeline (the knowledge extraction on AI responses), use the profile-scoped hooks so knowledge is written to the active profile's store

### Remove
- Nothing removed — maintain backward compatibility for the default Sentry profile

## Implementation Plan
1. Add profile-scoped CRUD functions to `localDB.ts` for global memories, user memories, rules, and timeline. Storage keys:
   - Global memories: `sentry_profile_global_${profileId}`
   - User memories: `sentry_profile_user_${profileId}_${username}`
   - Rules: `sentry_profile_rules_${profileId}`
   - Timeline: `sentry_profile_timeline_${profileId}_${username}`
   - Add `seedProfileFromDefault(newProfileId)` that copies all 4 categories from the `default` profile keys to the new profile keys
2. Update `useQueries.ts` hooks: pass `profileId` in the query key; on mount/profile-change, for the `default` profile try seeding from canister if local key is empty (one-time migration); all reads/writes use localStorage profile keys exclusively after that
3. Update `MemoryExplorer.tsx`: expose `activeProfileId` as a state variable, listen to `sentry_profile_changed`, pass it to all query hooks so they automatically refetch
4. Update `CloneAIDialog.tsx`: after generating a new profile ID, call `seedProfileFromDefault(newId)` before saving the profile list
5. Ensure `ChatPanel.tsx` concept/memory extraction uses the same profile-scoped hooks (they already call `useAddMemory`/`useAddRule`/`useAddTimelineEntry` which will now be profile-scoped after step 2)
