# Sentry

## Current State
Sentry is a full-featured AI chat application with black and gold theme, 3D brain visualization, memory explorer, teaching/reasoning commands, persistent chat history, emoji/GIF support, user management, and real-time canister sync. The CSS import in main.tsx currently uses `../index.css` (wrong) instead of `./index.css` (correct gold theme) — this must be fixed. Themes are hardcoded; no font selection or per-model theming exists. The menu has no Clone AI option.

## Requested Changes (Diff)

### Add
- **Theme Editor**: A settings UI that lets the user set two RGB color values — one for "gold" (primary accent) and one for "black" (background). Themes can be saved with a name and optionally linked to a specific AI model name. When a linked model is active in chat, its theme auto-applies. Store themes in localStorage as `sentry_themes`. Apply by injecting CSS variables (`--theme-gold-r/g/b`, `--theme-bg-r/g/b`) on `:root` and convert to `rgb()` usage via a thin inline style tag on the app wrapper.
- **Font Selection**: 13 font presets loaded from Google Fonts at runtime. User selects by category name. Font applies to the entire UI body. Stored in localStorage as `sentry_selected_font`. Categories and Google Font families:
  - Fancy: Fleur De Leah
  - Combat: Bonheur Royale
  - Animal: Puppies Play
  - Anime: Atma
  - Horror: Butcherman
  - Fantasy: Mystery Quest
  - Candy: Flavors
  - Spiritual: Vibes
  - Book: Viaoda Libre
  - Old Time: Quintessential
  - Library: Almendra SC
  - Royalty: Kings
  - Future: Megrim
  - (Default): system font stack
- **Clone AI Button** in the header menu (accessible via a kebab/menu button or directly as a button). Clones: all memories, rules, categories, personality into a new AI profile named by the user. Does NOT clone: chat history, logo/avatar, AI name, chat theme, font. The cloned AI appears as a selectable profile. Show a dialog asking for the new AI's name before cloning.
- **GIF Display Fix**: Ensure uploaded GIFs render properly — store full data URL in IndexedDB, load from IndexedDB before rendering, use `<img>` tag with the blob/data URL directly, avoid any truncation.

### Modify
- **main.tsx**: Fix CSS import from `../index.css` to `./index.css` permanently.
- **Header**: Add Clone AI icon button and a Theme/Font quick-access button alongside existing buttons.
- **Settings/ImportExport Panel**: Add Theme Editor and Font Picker tabs within the existing settings modal.
- **App.tsx**: Inject theme CSS variables as inline style on root div, read from localStorage on mount, update when theme changes via context.
- **index.css**: Replace all hardcoded `oklch(var(--gold)...)` references with a fallback that respects the new theme variables when set. Keep oklch fallbacks for when no custom theme is active.

### Remove
- Nothing removed.

## Implementation Plan
1. Fix `main.tsx` CSS import.
2. Create `src/frontend/src/utils/themeManager.ts` — types, load/save, apply (injects `<style>` on `<head>` with CSS var overrides), list themes, delete theme, auto-apply by model name.
3. Create `src/frontend/src/utils/fontManager.ts` — font catalog, load Google Font dynamically via `<link>`, apply to body, persist selection.
4. Create `src/frontend/src/components/ThemeEditor.tsx` — form with two RGB pickers (gold color, background color), theme name input, optional model link input, save/delete buttons, list of saved themes.
5. Create `src/frontend/src/components/FontPicker.tsx` — grid of 13 + default preset buttons, shows category name, preview text in that font.
6. Create `src/frontend/src/components/CloneAIDialog.tsx` — dialog with name input, clone button, confirmation.
7. Update `Header.tsx` — add Clone AI button (Copy icon) and Theme button (Palette icon) with appropriate handlers passed from App.
8. Update `App.tsx` — manage theme/font state, pass handlers to Header, apply theme via style on root, open ThemeEditor and CloneAI dialogs.
9. Update `ImportExportPanel.tsx` — add Theme and Font tabs using the new components.
10. Fix GIF display in `ChatPanel.tsx` — ensure attachment src is loaded from IndexedDB before rendering, use blob URL or direct data URL in `<img src>`.
