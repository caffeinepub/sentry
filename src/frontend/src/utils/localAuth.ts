const AUTH_KEY = "sentry_auth";
const SESSION_KEY = "sentry_current_user";

interface Credential {
  username: string;
  password: string;
}

const DEFAULT_CREDS: Credential[] = [
  { username: "Unity", password: "Bacon" },
  { username: "Syndelious", password: "Leviathan" },
];

// Additional users to seed on every install/upgrade
const EXTRA_USERS: Credential[] = [
  { username: "Wolpdragos", password: "Cloud" },
  { username: "wolfi da furri", password: "Manic" },
];

export function getCredentials(): Credential[] {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    let creds: Credential[];
    if (!raw) {
      creds = [...DEFAULT_CREDS];
    } else {
      creds = JSON.parse(raw) as Credential[];
    }
    // Ensure extra users always exist (handles existing installs)
    let modified = false;
    for (const extra of EXTRA_USERS) {
      if (
        !creds.find(
          (c) => c.username.toLowerCase() === extra.username.toLowerCase(),
        )
      ) {
        creds.push(extra);
        modified = true;
      }
    }
    if (modified || !raw) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(creds));
    }
    return creds;
  } catch {
    return [...DEFAULT_CREDS, ...EXTRA_USERS];
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
