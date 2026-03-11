/**
 * localDB — user-specific data only (keyed by username).
 * Global data (memories, rules, knowledge edges, sentry avatar) lives on the ICP canister.
 */
import type { Memory, PersonalityProfile, TimelineEntry } from "../backend.d";

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
