# Sentry

## Current State
Sentry is a full-featured AI chat app with black/gold theme, teaching commands, 3D brain, memory explorer, category system, GIF/emoji picker, persistent chat, and multi-user auth.

## Requested Changes (Diff)

### Add
- Help modal: add a clear top-level "HOW RULES WORK" section explaining IF/THEN syntax, chaining, reverse reasoning, and teaching via natural language
- AI occasionally asks a follow-up question when new concept is learned (10-20% chance)

### Modify
- `main.tsx`: fix CSS import `../index.css` → `./index.css` (recurring bug, must be hardened)
- `ChatPanel.tsx` / `AttachmentDisplay`: ensure uploaded GIFs render as animated `<img>` tags using the data URL directly; fix blank GIF issue by checking type is `"gif"` and rendering with `<img className="max-w-xs rounded" src={attachment.url} alt="gif" />`
- `ChatPanel.tsx`: when user sends a message with an image attachment, pass the image data URL to the AI context so the AI's response bubble also shows the image inline (or references it)
- `aiEngine.ts` `generateAIResponse`: responses must be short, natural, human-like — no meta-commentary like "I've stored that" or "I'm noting this"; just state what Sentry thinks is correct or a natural reply
- `aiEngine.ts` `generateAIResponse`: when a concept is learned/confirmed, only output the core fact/result Sentry believes is correct (e.g., "Fire beats grass." not "I've learned that fire beats grass and stored it.")
- `aiEngine.ts` `generateAIResponse`: improve keyword-based memory recall so that when user message contains keywords matching stored memories, Sentry references them naturally in its reply
- `aiEngine.ts` `interpretMediaAttachment`: for image types, include the image URL in the returned context so the AI message bubble can render it
- Chat history: verify `localStorage` persistence survives logout and page refresh; ensure `getChatMessages()` is loaded on mount before any canister sync (already partially done — just make sure it doesn't get cleared on logout)
- Auto-save: ensure auto-save runs every 30 seconds via `setInterval`

### Remove
- Any meta-commentary phrases in AI responses like "I've stored that", "I'm noting this", "I've learned", "I'll remember", "I've added this to my knowledge"

## Implementation Plan
1. Fix `main.tsx` CSS import to `./index.css`
2. Update `HelpModal.tsx` — add prominent HOW RULES WORK section at the very top of SECTIONS array
3. Fix `AttachmentDisplay` in `ChatPanel.tsx` — render GIFs as animated img tags; fix blank GIF
4. Improve `generateAIResponse` in `aiEngine.ts` — short/human responses, keyword recall, no meta-commentary, occasionally ask follow-up
5. Ensure chat history persists through logout (do not clear messages on logout)
6. Verify 30-second auto-save interval is present
