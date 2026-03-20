const AUTH_KEY = "sentry_auth";
const SESSION_KEY = "sentry_current_user";

interface Credential {
  username: string;
  password: string;
}

const DEFAULT_CREDS: Credential[] = [
  { username: "Unity", password: "Bacon" },
  { username: "Syndelious", password: "Leviathan" },
  { username: "Wolpdragos", password: "Cloud" },
  { username: "wolfi da furri", password: "Manic" },
];

export function getCredentials(): Credential[] {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(DEFAULT_CREDS));
      return DEFAULT_CREDS;
    }
    const stored = JSON.parse(raw) as Credential[];
    // Ensure default users always exist
    const merged = [...stored];
    for (const def of DEFAULT_CREDS) {
      if (
        !merged.find(
          (c) => c.username.toLowerCase() === def.username.toLowerCase(),
        )
      ) {
        merged.push(def);
      }
    }
    if (merged.length !== stored.length) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return DEFAULT_CREDS;
  }
}

function saveCredentials(creds: Credential[]): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(creds));
}

export function addUser(username: string, password: string): boolean {
  const creds = getCredentials();
  if (creds.find((c) => c.username.toLowerCase() === username.toLowerCase()))
    return false;
  creds.push({ username, password });
  saveCredentials(creds);
  return true;
}

export function removeUser(username: string): boolean {
  if (isProtectedUser(username)) return false;
  const creds = getCredentials();
  if (creds.length <= 1) return false;
  const current = getCurrentUser();
  if (current?.toLowerCase() === username.toLowerCase()) return false;
  const updated = creds.filter(
    (c) => c.username.toLowerCase() !== username.toLowerCase(),
  );
  if (updated.length === creds.length) return false;
  saveCredentials(updated);
  return true;
}

export function isProtectedUser(username: string): boolean {
  const lower = username.toLowerCase();
  return lower === "unity" || lower === "syndelious";
}

export function isClass6(username: string): boolean {
  const l = username.toLowerCase();
  return l === "unity" || l === "syndelious";
}

/** Class 5 = members assigned as AI trainers for a specific AI profile.
 *  They have equal teaching access as Class 6 for their assigned AI. */
export function isClass5ForProfile(
  username: string,
  profileId?: string,
): boolean {
  if (!username) return false;
  const pid =
    profileId || localStorage.getItem("sentry_active_profile") || "default";
  try {
    const raw = localStorage.getItem(`sentry_ai_trainers_${pid}`);
    const trainers: string[] = raw ? JSON.parse(raw) : [];
    return trainers.some((t) => t.toLowerCase() === username.toLowerCase());
  } catch {
    return false;
  }
}

/** Returns the class label for a user ("Class 6", "Class 5", or "Member") */
export function getUserClassLabel(
  username: string,
  profileId?: string,
): string {
  if (isClass6(username)) return "Class 6";
  if (isClass5ForProfile(username, profileId)) return "Class 5";
  return "Member";
}

export function updateUser(
  oldUsername: string,
  newUsername: string,
  newPassword: string,
): boolean {
  const creds = getCredentials();
  const idx = creds.findIndex(
    (c) => c.username.toLowerCase() === oldUsername.toLowerCase(),
  );
  if (idx === -1) return false;
  const isProtected = isProtectedUser(oldUsername);
  const finalUsername = isProtected ? creds[idx].username : newUsername.trim();
  if (!finalUsername || !newPassword.trim()) return false;
  if (
    !isProtected &&
    finalUsername.toLowerCase() !== oldUsername.toLowerCase()
  ) {
    const conflict = creds.find(
      (c, i) =>
        i !== idx && c.username.toLowerCase() === finalUsername.toLowerCase(),
    );
    if (conflict) return false;
  }
  creds[idx] = { username: finalUsername, password: newPassword.trim() };
  saveCredentials(creds);
  return true;
}

export function setUserLoginAvatar(username: string, dataUrl: string): void {
  localStorage.setItem(`sentry_login_avatar_${username}`, dataUrl);
}

export function getUserLoginAvatar(username: string): string | null {
  return localStorage.getItem(`sentry_login_avatar_${username}`);
}

export function loginWithAvatar(
  username: string,
  avatarDataUrl: string,
): boolean {
  const stored = getUserLoginAvatar(username);
  if (!stored || stored !== avatarDataUrl) return false;
  const creds = getCredentials();
  const match = creds.find(
    (c) => c.username.toLowerCase() === username.toLowerCase(),
  );
  if (!match) return false;
  localStorage.setItem(SESSION_KEY, match.username);
  return true;
}

export function login(username: string, password: string): boolean {
  const creds = getCredentials();
  const match = creds.find(
    (c) =>
      c.username.toLowerCase() === username.toLowerCase() &&
      c.password === password,
  );
  if (!match) return false;
  localStorage.setItem(SESSION_KEY, match.username);
  return true;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function isLoggedIn(): boolean {
  return !!getCurrentUser();
}

export function getSentryAvatarLocal(): string {
  return localStorage.getItem("sentry_avatar_v2") || "";
}
export function setSentryAvatarLocal(url: string): void {
  localStorage.setItem("sentry_avatar_v2", url);
}
