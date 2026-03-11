# Sentry

## Current State
New project with no existing code.

## Requested Changes (Diff)

### Add
- Full-stack AI teaching & chat application named "Sentry"
- Black and gold visual theme
- Chat interface with user and AI message bubbles, each with uploadable icon images (avatars) shown to the left of messages with names
- File upload support: images, GIFs, files, audio, video, and links embedded in chat
- Special teaching commands parsed from chat input:
  - `TEACH: <fact>` — store general knowledge
  - `IF <condition> THEN <effect>` — store cause-effect rules
  - `HISTORY: <event>` — teach AI its own history
  - `REMEMBER: <memory>` — store key memories
  - `WHY <query>` — trigger reasoning chain explanation
  - `WHO ARE YOU` — display AI identity and personality
- Semantic memory recall: AI surfaces relevant past messages/concepts in responses
- Memory Explorer panel: searchable and filterable list of stored memories, click to view in chat
- Auto semantic linking: related concepts linked in knowledge graph, similar concepts merged
- Rules storage: cause-effect statements with multi-step chaining and reverse reasoning
- 3D Brain Visualization using React Three Fiber / Three.js:
  - Rotatable sphere of nodes representing concepts
  - Nodes colored by type (memory=blue/gold, rule=orange, both=green)
  - Nodes highlighted/scaled on hover or when active in conversation
  - Animated edges between related nodes
  - Animated link colors for active reasoning chains
  - Hover tooltip showing concept name
  - Auto-layout algorithm spacing nodes on a sphere
- Personality system with three dimensions: Curiosity, Friendliness, Analytical
  - Grows based on user messages, emotional tone, AI reasoning activity
  - Influences response type, empathy, curiosity prompts
  - Emotion awareness adjusts personality/responses
- Timeline & History panel:
  - Chronological list of AI history events and interactions
  - Personality snapshot per timeline entry
  - Timeline selection highlights nodes in 3D brain
- Separate Import/Export controls:
  - User data (personality, personal history, opinions) — separate from global data
  - Global data (knowledge, rules, shared memories) — separate export/import
- Help button opening a teaching manual modal explaining all commands and features
- Auto-save to backend every 30 seconds + localStorage fallback
- Self-reflection: AI periodically highlights relevant concepts from history
- Curiosity-driven prompts: AI occasionally asks follow-up questions

### Modify
- Nothing (new project)

### Remove
- Nothing (new project)

## Implementation Plan
1. Backend (Motoko):
   - `Memory` type: id, text, type (knowledge/rule/history/remember), concepts[], timestamp, userId
   - `Rule` type: id, condition, effect, timestamp
   - `PersonalityProfile` type: curiosity, friendliness, analytical (0.0–1.0 floats)
   - `TimelineEntry` type: id, event, timestamp, personalitySnapshot
   - `UserProfile` type: userId, avatarUrl, personality, timelineEntries[]
   - Global store: memories[], rules[], knowledgeGraph edges[]
   - User store: per-principal personality, history, opinions
   - CRUD APIs: addMemory, getMemories, addRule, getRules, updatePersonality, getPersonality, addTimelineEntry, getTimeline, setUserAvatar, setSentryAvatar
   - Import/export endpoints for user data vs global data
2. Frontend:
   - Three-panel responsive layout: left=Memory Explorer, center=Chat, right=3D Brain
   - Chat panel with message input, file upload button, send button
   - Message bubbles with avatar image on left, name, timestamp, content
   - Command parser for TEACH/IF-THEN/HISTORY/REMEMBER/WHY/WHO ARE YOU
   - AI response engine using stored knowledge/rules/personality
   - Memory Explorer with search input and type filter tabs
   - 3D Brain with React Three Fiber: spherical node layout, animated edges, hover tooltips
   - Personality bar showing three dimensions with animated growth
   - Timeline panel toggle showing chronological events
   - Import/Export UI: two separate sections (User Data, Global Data) with download/upload buttons
   - Help modal with full teaching manual
   - Avatar upload: click avatar to upload image, stored via blob-storage
   - Black (#0a0a0a) and gold (#c9a227) color scheme throughout
