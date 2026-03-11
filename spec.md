# Sentry

## Current State
- Full-stack Sentry app with black/gold theme, chat panel, memory explorer, 3D brain visualization
- User and Sentry avatar upload exist but Sentry avatar relies solely on ICP canister (fails when large data URLs exceed limits)
- AI concept detection uses basic keyword/pattern matching in aiEngine.ts
- Media/link interpretation gives generic placeholder responses
- GIF/emoji support fully wired
- Memory explorer has user/global tabs, search, edit/delete
- Chat search and clear work
- Personality tracking, timeline, 3D brain all functional
- Image login exists in LoginScreen

## Requested Changes (Diff)

### Add
- Sentry avatar localStorage fallback so it always persists/loads regardless of canister data URL limits
- Richer AI concept detection: semantic sentence parsing, relationship extraction, cause/effect chains, situational context detection (time, place, identity claims), not just keyword triggers
- Richer media/link interpretation: specific contextual responses for image types, audio genres, video formats, file types, link domains with more detail
- Sentry avatar also exported/imported alongside user image data for Unity and Syndelious

### Modify
- `useGetSentryAvatar` and `useSetSentryAvatar` hooks: also read/write localStorage as a fast fallback, use canister as secondary sync
- `detectConceptsFromNaturalLanguage` in aiEngine.ts: expand to use semantic sentence analysis — subject-verb-object extraction, temporal context, causal reasoning, belief/opinion patterns, comparison statements, negation detection
- `interpretMediaAttachment` and `interpretLink`: richer, more specific responses based on file type, domain patterns, MIME type
- `generateAIResponse`: improve response quality with more varied personality-driven phrasing and better memory context integration
- Black and gold theme: audit all components (LoginScreen, MemoryExplorer, BrainVisualization, Header, UserManagement, ChatPanel) — ensure consistent use of gold/black color tokens everywhere, no off-theme grays leaking in headings, labels, borders

### Remove
- Nothing

## Implementation Plan
1. Fix Sentry avatar: in `useSetSentryAvatar` mutation, also write to `localStorage.setItem('sentry_avatar', url)`. In `useGetSentryAvatar`, fall back to localStorage if canister returns empty string
2. Expand `detectConceptsFromNaturalLanguage`: add subject-verb-object extractor, temporal/conditional context, negation, comparisons, belief/opinion patterns, multi-sentence awareness
3. Improve `interpretMediaAttachment`: provide contextual descriptions per image subtype (PNG/JPEG/GIF/WebP), audio (music/voice/podcast heuristics), video (resolution/format), files (PDF/text/code/archive)
4. Improve `interpretLink`: expand domain map, extract path-based hints (article, profile, repo, docs, search, watch)
5. Improve `generateAIResponse`: more varied, personality-driven replies with empathy on negative tone, excitement on positive, analysis on questions
6. Theme audit: ensure all text/border/bg colors use gold/black CSS vars consistently across all component files
