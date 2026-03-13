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

function saveBig(key: string, value: unknown): void {
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

export function saveChatMessages(
  username: string,
  messages: ChatMessage[],
): void {
  // Strip large data URLs from attachments before saving to avoid quota errors
  const stripped = messages.map((msg) => ({
    ...msg,
    attachments: (msg.attachments || []).map((att) => {
      if (att.url?.startsWith("data:") && att.url.length > 200000) {
        return { ...att, url: att.url.slice(0, 200000), _truncated: true };
      }
      return att;
    }),
  }));
  try {
    localStorage.setItem(
      `sentry_chat_${username}`,
      JSON.stringify(stripped, (_k, v) =>
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
