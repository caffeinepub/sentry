export interface SentryTheme {
  id: string;
  name: string;
  goldR: number;
  goldG: number;
  goldB: number;
  bgR: number;
  bgG: number;
  bgB: number;
  linkedModel?: string;
}

const THEMES_KEY = "sentry_themes";
const ACTIVE_KEY = "sentry_active_theme_id";

export function loadThemes(): SentryTheme[] {
  try {
    const raw = localStorage.getItem(THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTheme(t: SentryTheme): void {
  const themes = loadThemes();
  const idx = themes.findIndex((x) => x.id === t.id);
  if (idx >= 0) themes[idx] = t;
  else themes.push(t);
  localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
}

export function deleteTheme(id: string): void {
  const themes = loadThemes().filter((t) => t.id !== id);
  localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
  if (loadActiveThemeId() === id) setActiveTheme(null);
}

export function loadActiveThemeId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function loadActiveTheme(): SentryTheme | null {
  const id = loadActiveThemeId();
  if (!id) return null;
  return loadThemes().find((t) => t.id === id) || null;
}

export function setActiveTheme(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function applyTheme(t: SentryTheme | null): void {
  let styleEl = document.getElementById(
    "sentry-theme-override",
  ) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "sentry-theme-override";
    document.head.appendChild(styleEl);
  }

  if (!t) {
    styleEl.textContent = "";
    return;
  }

  const { goldR, goldG, goldB, bgR, bgG, bgB } = t;
  const bgR2 = Math.min(255, bgR + 8);
  const bgG2 = Math.min(255, bgG + 8);
  const bgB2 = Math.min(255, bgB + 8);
  const bgR3 = Math.min(255, bgR + 14);
  const bgG3 = Math.min(255, bgG + 14);
  const bgB3 = Math.min(255, bgB + 14);

  styleEl.textContent = `
    * { --theme-gold: rgb(${goldR},${goldG},${goldB}); --theme-bg: rgb(${bgR},${bgG},${bgB}); }
    body, html { background-color: rgb(${bgR},${bgG},${bgB}) !important; }
    .bg-background, [class*="bg-background"] { background-color: rgb(${bgR},${bgG},${bgB}) !important; }
    .bg-card, [class*="bg-card"] { background-color: rgb(${bgR2},${bgG2},${bgB2}) !important; }
    .bg-black { background-color: rgb(${bgR},${bgG},${bgB}) !important; }
    .text-gold, [class*="text-gold"], .gold-glow-text { color: rgb(${goldR},${goldG},${goldB}) !important; }
    .text-primary { color: rgb(${goldR},${goldG},${goldB}) !important; }
    .border-gold, [class*="border-gold"] { border-color: rgb(${goldR},${goldG},${goldB}) !important; }
    .border-border { border-color: rgba(${goldR},${goldG},${goldB},0.22) !important; }
    .bg-gold, [class*="bg-gold"] { background-color: rgb(${goldR},${goldG},${goldB}) !important; }
    .text-muted-foreground { color: rgba(${goldR},${goldG},${goldB},0.55) !important; }
    .bg-popover, .bg-muted, .bg-secondary { background-color: rgb(${bgR3},${bgG3},${bgB3}) !important; }
    ::-webkit-scrollbar-thumb { background: rgba(${goldR},${goldG},${goldB},0.4) !important; }
    ::-webkit-scrollbar-thumb:hover { background: rgb(${goldR},${goldG},${goldB}) !important; }
    .sentry-message { border-left-color: rgba(${goldR},${goldG},${goldB},0.5) !important; background: linear-gradient(135deg, rgb(${bgR2},${bgG2},${bgB2}) 0%, rgb(${bgR3},${bgG3},${bgB3}) 100%) !important; }
    .gold-glow { box-shadow: 0 0 8px rgba(${goldR},${goldG},${goldB},0.4), 0 0 20px rgba(${goldR},${goldG},${goldB},0.15) !important; }
    .cursor::after { color: rgb(${goldR},${goldG},${goldB}) !important; }
    .badge-knowledge { background: rgba(${goldR},${goldG},${goldB},0.15) !important; color: rgb(${goldR},${goldG},${goldB}) !important; border-color: rgba(${goldR},${goldG},${goldB},0.35) !important; }
    .scanline { background: linear-gradient(to right, transparent, rgba(${goldR},${goldG},${goldB},0.18), transparent) !important; }
  `;
}
