/**
 * localDB — user-specific data only (keyed by username).
 * Global data (memories, rules, knowledge edges, sentry avatar) lives on the ICP canister.
 */
import type { Memory, PersonalityProfile, TimelineEntry } from "../backend.d";
import type { ChatMessage } from "../types/sentry";

// ── helpers ──────────────────────────────────────────────────────────────────

function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch {
    return def;
  }
}

function save(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function nextId(): bigint {
  return BigInt(Date.now());
}

function serialize(data: unknown): string {
  return JSON.stringify(data, (_k, v) =>
    typeof v === "bigint" ? `__bigint__${v}` : v,
  );
}

function deserialize<T>(raw: string): T {
  return JSON.parse(raw, (_k, v) => {
    if (typeof v === "string" && v.startsWith("__bigint__"))
      return BigInt(v.slice(10));
    return v;
  }) as T;
}

function loadBig<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? deserialize<T>(raw) : def;
  } catch {
    return def;
  }
}

export function saveBig(key: string, value: unknown): void {
  localStorage.setItem(key, serialize(value));
}

// ── USER MEMORIES (non-global, per-user) ──────────────────────────────────────

function userMemKey(username: string): string {
  return `sentry_user_memories_${username}`;
}

export function getUserMemories(username: string): Memory[] {
  return loadBig<Memory[]>(userMemKey(username), []);
}

export function addUserMemory(
  username: string,
  text: string,
  memoryType: string,
  concepts: string[],
): bigint {
  const all = loadBig<Memory[]>(userMemKey(username), []);
  const id = nextId();
  all.push({
    id,
    isGlobal: false,
    text,
    concepts,
    timestamp: BigInt(Date.now()) * 1_000_000n,
    principalId: username,
    memoryType,
  });
  saveBig(userMemKey(username), all);
  return id;
}

export function deleteUserMemory(username: string, id: bigint): void {
  const all = loadBig<Memory[]>(userMemKey(username), []);
  saveBig(
    userMemKey(username),
    all.filter((m) => m.id !== id),
  );
}

export function updateUserMemory(
  username: string,
  id: bigint,
  text: string,
): void {
  const all = loadBig<Memory[]>(userMemKey(username), []);
  const idx = all.findIndex((m) => m.id === id);
  if (idx !== -1) {
    all[idx].text = text;
    saveBig(userMemKey(username), all);
  }
}

// ── PERSONALITY (per-user) ─────────────────────────────────────────────────────

export function getPersonality(username: string): PersonalityProfile {
  return load<PersonalityProfile>(`sentry_personality_${username}`, {
    curiosity: 0.5,
    friendliness: 0.5,
    analytical: 0.5,
  });
}

export function updatePersonality(
  username: string,
  p: PersonalityProfile,
): void {
  save(`sentry_personality_${username}`, p);
}

// ── TIMELINE (per-user) ────────────────────────────────────────────────────────

export function getTimeline(username: string): TimelineEntry[] {
  return loadBig<TimelineEntry[]>(`sentry_timeline_${username}`, []);
}

export function addTimelineEntry(
  username: string,
  event: string,
  personalitySnapshot: PersonalityProfile,
): bigint {
  const all = loadBig<TimelineEntry[]>(`sentry_timeline_${username}`, []);
  const id = nextId();
  all.push({
    id,
    event,
    personalitySnapshot,
    timestamp: BigInt(Date.now()) * 1_000_000n,
  });
  saveBig(`sentry_timeline_${username}`, all);
  return id;
}

export function deleteTimelineEntry(username: string, id: bigint): void {
  const all = loadBig<TimelineEntry[]>(`sentry_timeline_${username}`, []);
  saveBig(
    `sentry_timeline_${username}`,
    all.filter((e) => e.id !== id),
  );
}

export function updateTimelineEntry(
  username: string,
  id: bigint,
  event: string,
): void {
  const all = loadBig<TimelineEntry[]>(`sentry_timeline_${username}`, []);
  const idx = all.findIndex((e) => e.id === id);
  if (idx !== -1) {
    all[idx].event = event;
    saveBig(`sentry_timeline_${username}`, all);
  }
}

// ── AVATARS (per-user) ─────────────────────────────────────────────────────────

export function getUserAvatar(username: string): string {
  return localStorage.getItem(`sentry_user_avatar_${username}`) || "";
}

export function setUserAvatar(username: string, url: string): void {
  localStorage.setItem(`sentry_user_avatar_${username}`, url);
}

// ── USER PROFILE helper ────────────────────────────────────────────────────────

export function getUserProfile(username: string): {
  username: string;
  avatarUrl: string;
} {
  return { username, avatarUrl: getUserAvatar(username) };
}

// ── CHAT MESSAGES (per-user, persistent) ──────────────────────────────────────
// Data URLs for images/GIFs are stored in IndexedDB (attachmentStore) to avoid
// localStorage quota limits. The message JSON stores an "idb:<key>" reference.

export function getChatMessages(username: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`sentry_chat_${username}`);
    if (!raw) return [];
    return JSON.parse(raw, (_k, v) => {
      if (typeof v === "string" && v.startsWith("__bigint__"))
        return BigInt(v.slice(10));
      return v;
    });
  } catch {
    return [];
  }
}

/** Resolve idb: reference URLs back to data URLs (async, call on load). */
export async function resolveAttachmentUrls(
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  const { loadAttachment } = await import("./attachmentStore");
  return Promise.all(
    messages.map(async (msg) => {
      if (!msg.attachments?.length) return msg;
      const attachments = await Promise.all(
        msg.attachments.map(async (att) => {
          if (att.url?.startsWith("idb:")) {
            const data = await loadAttachment(att.url.slice(4));
            return data ? { ...att, url: data } : att;
          }
          return att;
        }),
      );
      return { ...msg, attachments };
    }),
  );
}

export function saveChatMessages(
  username: string,
  messages: ChatMessage[],
): void {
  // Replace data URLs with idb: refs in the stored JSON (the real data lives in IndexedDB).
  // This is fire-and-forget — storeAttachment is async but we don't need to await it here.
  const refMessages = messages.map((msg) => ({
    ...msg,
    attachments: (msg.attachments || []).map((att) => {
      if (att.url?.startsWith("data:")) {
        const key = `att_${msg.id}_${att.name || "file"}`;
        // Persist to IndexedDB asynchronously
        import("./attachmentStore").then(({ storeAttachment }) => {
          storeAttachment(key, att.url);
        });
        return { ...att, url: `idb:${key}` };
      }
      return att;
    }),
  }));
  try {
    localStorage.setItem(
      `sentry_chat_${username}`,
      JSON.stringify(refMessages, (_k, v) =>
        typeof v === "bigint" ? `__bigint__${v}` : v,
      ),
    );
  } catch {
    // If still too large, save without attachments
    try {
      const noAttach = messages.map((msg) => ({ ...msg, attachments: [] }));
      localStorage.setItem(
        `sentry_chat_${username}`,
        JSON.stringify(noAttach, (_k, v) =>
          typeof v === "bigint" ? `__bigint__${v}` : v,
        ),
      );
    } catch {
      // Nothing we can do
    }
  }
}

export function clearChatMessages(username: string): void {
  localStorage.removeItem(`sentry_chat_${username}`);
  // Also clear attachments from IndexedDB
  import("./attachmentStore").then(({ clearAllAttachments }) => {
    clearAllAttachments();
  });
}

// ── LOCAL GIFS (fallback when canister unavailable) ───────────────────────────

export interface LocalGif {
  id: string;
  url: string;
  gifLabel: string;
  isLocal: true;
}

export function getLocalGifs(): LocalGif[] {
  try {
    const raw = localStorage.getItem("sentry_local_gifs");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addLocalGif(url: string, gifLabel: string): LocalGif {
  const gifs = getLocalGifs();
  const gif: LocalGif = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    url,
    gifLabel,
    isLocal: true,
  };
  gifs.push(gif);
  localStorage.setItem("sentry_local_gifs", JSON.stringify(gifs));
  return gif;
}

export function removeLocalGif(id: string): void {
  const gifs = getLocalGifs().filter((g) => g.id !== id);
  localStorage.setItem("sentry_local_gifs", JSON.stringify(gifs));
}

// ── LOCAL EMOJIS (fallback when canister unavailable) ─────────────────────────

export interface LocalEmoji {
  id: string;
  emoji: string;
  isLocal: true;
}

export function getLocalEmojis(): LocalEmoji[] {
  try {
    const raw = localStorage.getItem("sentry_local_emojis");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addLocalEmoji(emoji: string): LocalEmoji {
  const emojis = getLocalEmojis();
  const entry: LocalEmoji = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    emoji,
    isLocal: true,
  };
  emojis.push(entry);
  localStorage.setItem("sentry_local_emojis", JSON.stringify(emojis));
  return entry;
}

export function removeLocalEmoji(id: string): void {
  const emojis = getLocalEmojis().filter((e) => e.id !== id);
  localStorage.setItem("sentry_local_emojis", JSON.stringify(emojis));
}

// ── PROFILE-SCOPED MEMORIES ───────────────────────────────────────────────────

export function profileGlobalKey(profileId: string) {
  return `sentry_profile_global_${profileId}`;
}
export function profileUserKey(profileId: string, username: string) {
  return `sentry_profile_user_${profileId}_${username}`;
}
export function profileRulesKey(profileId: string) {
  return `sentry_profile_rules_${profileId}`;
}
export function profileTimelineKey(profileId: string, username: string) {
  return `sentry_profile_timeline_${profileId}_${username}`;
}

export function getProfileGlobalMemories(profileId: string): Memory[] {
  return loadBig<Memory[]>(profileGlobalKey(profileId), []);
}
export function addProfileGlobalMemory(
  profileId: string,
  text: string,
  memoryType: string,
  concepts: string[],
): bigint {
  const all = loadBig<Memory[]>(profileGlobalKey(profileId), []);
  const id = nextId();
  all.push({
    id,
    isGlobal: true,
    text,
    concepts,
    timestamp: BigInt(Date.now()) * 1_000_000n,
    principalId: "",
    memoryType,
  });
  saveBig(profileGlobalKey(profileId), all);
  return id;
}
export function deleteProfileGlobalMemory(profileId: string, id: bigint): void {
  const all = loadBig<Memory[]>(profileGlobalKey(profileId), []);
  saveBig(
    profileGlobalKey(profileId),
    all.filter((m) => m.id !== id),
  );
}
export function updateProfileGlobalMemory(
  profileId: string,
  id: bigint,
  text: string,
): void {
  const all = loadBig<Memory[]>(profileGlobalKey(profileId), []);
  const idx = all.findIndex((m) => m.id === id);
  if (idx !== -1) {
    all[idx].text = text;
    saveBig(profileGlobalKey(profileId), all);
  }
}

export function getProfileUserMemories(
  profileId: string,
  username: string,
): Memory[] {
  return loadBig<Memory[]>(profileUserKey(profileId, username), []);
}
export function addProfileUserMemory(
  profileId: string,
  username: string,
  text: string,
  memoryType: string,
  concepts: string[],
): bigint {
  const all = loadBig<Memory[]>(profileUserKey(profileId, username), []);
  const id = nextId();
  all.push({
    id,
    isGlobal: false,
    text,
    concepts,
    timestamp: BigInt(Date.now()) * 1_000_000n,
    principalId: username,
    memoryType,
  });
  saveBig(profileUserKey(profileId, username), all);
  return id;
}
export function deleteProfileUserMemory(
  profileId: string,
  username: string,
  id: bigint,
): void {
  const all = loadBig<Memory[]>(profileUserKey(profileId, username), []);
  saveBig(
    profileUserKey(profileId, username),
    all.filter((m) => m.id !== id),
  );
}
export function updateProfileUserMemory(
  profileId: string,
  username: string,
  id: bigint,
  text: string,
): void {
  const all = loadBig<Memory[]>(profileUserKey(profileId, username), []);
  const idx = all.findIndex((m) => m.id === id);
  if (idx !== -1) {
    all[idx].text = text;
    saveBig(profileUserKey(profileId, username), all);
  }
}

export interface ProfileRule {
  id: bigint;
  condition: string;
  effect: string;
  timestamp: bigint;
}
export function getProfileRules(profileId: string): ProfileRule[] {
  return loadBig<ProfileRule[]>(profileRulesKey(profileId), []);
}
export function addProfileRule(
  profileId: string,
  condition: string,
  effect: string,
): bigint {
  const all = loadBig<ProfileRule[]>(profileRulesKey(profileId), []);
  const id = nextId();
  all.push({
    id,
    condition,
    effect,
    timestamp: BigInt(Date.now()) * 1_000_000n,
  });
  saveBig(profileRulesKey(profileId), all);
  return id;
}
export function deleteProfileRule(profileId: string, id: bigint): void {
  const all = loadBig<ProfileRule[]>(profileRulesKey(profileId), []);
  saveBig(
    profileRulesKey(profileId),
    all.filter((r) => r.id !== id),
  );
}
export function updateProfileRule(
  profileId: string,
  id: bigint,
  condition: string,
  effect: string,
): void {
  const all = loadBig<ProfileRule[]>(profileRulesKey(profileId), []);
  const idx = all.findIndex((r) => r.id === id);
  if (idx !== -1) {
    all[idx].condition = condition;
    all[idx].effect = effect;
    saveBig(profileRulesKey(profileId), all);
  }
}

export function getProfileTimeline(
  profileId: string,
  username: string,
): TimelineEntry[] {
  return loadBig<TimelineEntry[]>(profileTimelineKey(profileId, username), []);
}
export function addProfileTimelineEntry(
  profileId: string,
  username: string,
  event: string,
  personalitySnapshot: PersonalityProfile,
): bigint {
  const all = loadBig<TimelineEntry[]>(
    profileTimelineKey(profileId, username),
    [],
  );
  const id = nextId();
  all.push({
    id,
    event,
    personalitySnapshot,
    timestamp: BigInt(Date.now()) * 1_000_000n,
  });
  saveBig(profileTimelineKey(profileId, username), all);
  return id;
}
export function deleteProfileTimelineEntry(
  profileId: string,
  username: string,
  id: bigint,
): void {
  const all = loadBig<TimelineEntry[]>(
    profileTimelineKey(profileId, username),
    [],
  );
  saveBig(
    profileTimelineKey(profileId, username),
    all.filter((e) => e.id !== id),
  );
}
export function updateProfileTimelineEntry(
  profileId: string,
  username: string,
  id: bigint,
  event: string,
): void {
  const all = loadBig<TimelineEntry[]>(
    profileTimelineKey(profileId, username),
    [],
  );
  const idx = all.findIndex((e) => e.id === id);
  if (idx !== -1) {
    all[idx].event = event;
    saveBig(profileTimelineKey(profileId, username), all);
  }
}

/** Copy all knowledge from "default" profile to a new clone profile. */
export function seedProfileFromDefault(
  newProfileId: string,
  username: string,
): void {
  // Copy global memories
  const globalMems = getProfileGlobalMemories("default");
  if (globalMems.length > 0)
    saveBig(profileGlobalKey(newProfileId), globalMems);
  // Copy user memories
  const userMems = getProfileUserMemories("default", username);
  if (userMems.length > 0)
    saveBig(profileUserKey(newProfileId, username), userMems);
  // Copy rules
  const rules = getProfileRules("default");
  if (rules.length > 0) saveBig(profileRulesKey(newProfileId), rules);
  // Copy timeline
  const timeline = getProfileTimeline("default", username);
  if (timeline.length > 0)
    saveBig(profileTimelineKey(newProfileId, username), timeline);
}

export function getActiveProfileId(): string {
  return localStorage.getItem("sentry_active_profile") || "default";
}
