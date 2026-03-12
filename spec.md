# Sentry

## Current State
Full-featured AI chat app with 3D brain visualization, memory explorer, personality system, teaching/reasoning commands, emoji/gif support, and persistent storage. Black and gold theme enforced. Chat history persists. Memory core accessible on mobile.

## Requested Changes (Diff)

### Add
- Default/built-in emojis should also be deletable (currently only custom-uploaded ones are)
- Memory Core panel should display learned concepts (knowledge graph nodes/concepts extracted from conversation)
- Pronoun/speaker context detection: distinguish who is referred to by me/my/I'm vs they/them vs you/you're/you were and store accordingly
- "Might" qualifier logic: concepts tagged with "might" are only sometimes true (probabilistic/conditional)
- Auto-save every 30 seconds (if not already)
- GIFs uploaded in chat messages should render as animated images (not broken)

### Modify
- AI concept extraction: improve to handle complex, situational, multi-part concepts in any word order. Support prediction learning (Zener cards, future events, "X is used on Y to do Z", power/effect/target chains). Not just keyword matching.
- Pronoun resolution: when user says "I", "me", "my", "I'm" → attribute to current user. "you", "you're", "you were" → attribute to Sentry. "they", "them" → third-party entity last mentioned.
- Reasoning chains: single-step, multi-step, and reverse (effect → cause). AI occasionally asks follow-up questions.
- Timeline reasoning: highlight relevant knowledge graph nodes from history.
- Live content fetching: when a URL is shared, fetch and summarize/interpret the page content. When image/file/audio/video is uploaded, interpret it directly (existing feature, ensure it works).
- Chat history: persists after logout and page refresh unless explicitly cleared (confirm working).
- Persistent memory: auto-save to localStorage every 30 seconds and on every new concept learned.

### Remove
- Nothing removed

## Implementation Plan
1. Fix GIF rendering in chat messages - ensure `<img>` tags are used for GIF URLs so animation plays
2. Make default emoji list deletable - store deletions in localStorage, filter out deleted ones on render
3. Memory Core learned concepts view - list extracted knowledge graph nodes in the Memory Core panel with search
4. Pronoun resolution engine - parse messages for first/second/third person pronouns and attribute concepts to correct entity
5. "Might" qualifier - detect "might", "could", "possibly", "sometimes" and tag those concepts as conditional
6. Enhanced concept extraction - improve NLP pipeline to handle multi-word, situational, predictive, and chained concepts (who/what/where/when/how/why patterns)
7. Confirm auto-save every 30 seconds and on concept learning
8. Confirm chat history persistence and live content fetching
