export interface FontPreset {
  label: string;
  family: string;
}

export const FONT_PRESETS: FontPreset[] = [
  { label: "Default", family: "" },
  { label: "Fancy", family: "Fleur De Leah" },
  { label: "Combat", family: "Bonheur Royale" },
  { label: "Animal", family: "Puppies Play" },
  { label: "Anime", family: "Atma" },
  { label: "Horror", family: "Butcherman" },
  { label: "Fantasy", family: "Mystery Quest" },
  { label: "Candy", family: "Flavors" },
  { label: "Spiritual", family: "Vibes" },
  { label: "Book", family: "Viaoda Libre" },
  { label: "Old Time", family: "Quintessential" },
  { label: "Library", family: "Almendra SC" },
  { label: "Royalty", family: "Kings" },
  { label: "Future", family: "Megrim" },
];

const FONT_KEY = "sentry_font";
const loadedFonts = new Set<string>();

export function loadFont(family: string): void {
  if (!family || loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const id = `gfont-${family.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.replace(/ /g, "+"))}&display=swap`;
  document.head.appendChild(link);
}

export function applyFont(family: string): void {
  if (family) {
    loadFont(family);
    document.body.style.fontFamily = `'${family}', serif`;
  } else {
    document.body.style.fontFamily = "";
  }
}

export function getSavedFont(): string {
  return localStorage.getItem(FONT_KEY) || "";
}

export function saveFont(family: string): void {
  localStorage.setItem(FONT_KEY, family);
}
