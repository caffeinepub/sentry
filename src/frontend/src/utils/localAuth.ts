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

export function getCredentials(): Credential[] {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(DEFAULT_CREDS));
      return DEFAULT_CREDS;
    }
    return JSON.parse(raw) as Credential[];
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
