import type {
  Memory,
  PersonalityProfile,
  Rule,
  TimelineEntry,
} from "../backend.d";

const POSITIVE_KEYWORDS = [
  "great",
  "amazing",
  "love",
  "happy",
  "excellent",
  "wonderful",
  "fantastic",
  "good",
  "thanks",
  "appreciate",
  "awesome",
  "nice",
];
const NEGATIVE_KEYWORDS = [
  "bad",
  "terrible",
  "hate",
  "sad",
  "awful",
  "horrible",
  "wrong",
  "broken",
  "fail",
  "problem",
  "issue",
  "error",
  "confused",
];

export function detectEmotionalTone(
  text: string,
): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  const pos = POSITIVE_KEYWORDS.filter((k) => lower.includes(k)).length;
  const neg = NEGATIVE_KEYWORDS.filter((k) => lower.includes(k)).length;
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

export function detectCorrectionIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  // If message starts with a correction word/phrase, it's a correction
  const correctionStarters = [
    /^no[,!.\s]/,
    /^no$/,
    /^nope/,
    /^wrong/,
    /^incorrect/,
    /^that'?s\s+(not\s+right|wrong|incorrect|false|not\s+true)/,
    /^you'?re\s+wrong/,
    /^you got that wrong/,
    /^not\s+true/,
    /^false[,!.\s]/,
    /^false$/,
    /^actually[,!.\s]/,
    /^actually$/,
    /^no it'?s/,
    /^no it is/,
    /^no,?\s+that'?s/,
  ];
  return correctionStarters.some((pat) => pat.test(lower));
}

export function findRelevantMemories(
  query: string,
  memories: Memory[],
  limit = 3,
): Memory[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  return memories
    .map((m) => {
      const score = words.filter(
        (w) =>
          m.text.toLowerCase().includes(w) ||
          m.concepts.some((c) => c.toLowerCase().includes(w)),
      ).length;
      return { memory: m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.memory);
}

export function buildReasoningChain(query: string, rules: Rule[]): string {
  const lower = query.toLowerCase();
  const relevantRules = rules.filter(
    (r) =>
      lower.includes(r.condition.toLowerCase()) ||
      r.condition
        .toLowerCase()
        .split(" ")
        .some((w) => w.length > 3 && lower.includes(w)),
  );

  if (relevantRules.length === 0) {
    return `I don't have any specific rules to reason about "${query}" yet. You can teach me: IF ${query} THEN <effect>`;
  }

  let chain = `**Reasoning chain for: "${query}"**\n\n`;
  const visited = new Set<string>();

  function followChain(condition: string, depth: number): string {
    if (depth > 5 || visited.has(condition)) return "";
    visited.add(condition);
    const rule = rules.find((r) =>
      r.condition.toLowerCase().includes(condition.toLowerCase()),
    );
    if (!rule) return "";
    let result = `${"  ".repeat(depth)}→ IF **${rule.condition}** THEN **${rule.effect}**\n`;
    result += followChain(rule.effect, depth + 1);
    return result;
  }

  for (const r of relevantRules) {
    chain += followChain(r.condition, 0);
  }
  return chain;
}

export interface DetectedConcepts {
  facts: string[];
  rules: { condition: string; effect: string }[];
  personalFacts: { subject: string; predicate: string; object: string }[];
  dateReferences: string[];
  predictions: string[];
  isTeaching: boolean;
  isQuestion: boolean;
}

export function detectConceptsFromNaturalLanguage(
  text: string,
): DetectedConcepts {
  const lower = text.toLowerCase().trim();
  const result: DetectedConcepts = {
    facts: [],
    rules: [],
    personalFacts: [],
    dateReferences: [],
    predictions: [],
    isTeaching: false,
    isQuestion: false,
  };

  // Question detection
  result.isQuestion =
    lower.endsWith("?") ||
    /^(what|who|where|when|why|how|can you|do you|is there|are there|tell me)/.test(
      lower,
    );

  // Teaching intent — any definition-style sentence counts
  result.isTeaching =
    /did you know|remember that|note that|fyi|fact:|just so you know|is a |are a |means |refers to|defined as|known as|stands for/.test(
      lower,
    ) || /(is|are|was|were)\s+(a|an|the)/.test(lower);

  // If/then / causal rules detection (flexible patterns)
  const ifThenPatterns = [
    /if(.+?)then(.+)/i,
    /when(.+?)then(.+)/i,
    /whenever(.+?)then(.+)/i,
    /(.+?)causes(.+)/i,
    /(.+?)leads to(.+)/i,
    /(.+?)results in(.+)/i,
  ];
  for (const pat of ifThenPatterns) {
    const m = text.match(pat);
    if (m?.[1] && m[2]) {
      result.rules.push({ condition: m[1].trim(), effect: m[2].trim() });
      result.isTeaching = true;
    }
  }

  // Prediction patterns
  const predictionPatterns = [
    /(.+?)\s+will\s+(?:probably\s+)?(.+?)(?:[.!]|$)/i,
    /(.+?)\s+is going to\s+(.+?)(?:[.!]|$)/i,
    /(.+?)\s+might\s+(.+?)(?:[.!]|$)/i,
    /(.+?)\s+is likely to\s+(.+?)(?:[.!]|$)/i,
    /(.+?)\s+is expected to\s+(.+?)(?:[.!]|$)/i,
    /i predict(?:\s+that)?\s+(.+?)(?:[.!]|$)/i,
    /predict\s+that\s+(.+?)(?:[.!]|$)/i,
    /(.+?)\s+should\s+(.+?)\s+in the future(?:[.!]|$)/i,
  ];
  for (const pat of predictionPatterns) {
    const m = text.match(pat);
    if (m) {
      // For "I predict that X", just capture the prediction
      if (pat.source.includes("predict")) {
        result.predictions.push(m[1]?.trim() || m[0].trim());
      } else if (m[1] && m[2]) {
        result.predictions.push(`${m[1].trim()} → ${m[2].trim()}`);
      }
    }
  }

  // Causal / logical connector patterns → stored as facts
  const causalPatterns = [
    /because(.+?)(?:[.!]|$)/i,
    /therefore(.+?)(?:[.!]|$)/i,
    /due to(.+?)(?:[.!]|$)/i,
    /as a result(.+?)(?:[.!]|$)/i,
    /consequently(.+?)(?:[.!]|$)/i,
  ];
  for (const pat of causalPatterns) {
    const m = text.match(pat);
    if (m) result.facts.push(m[0].trim());
  }

  // Belief / opinion patterns
  const beliefPatterns = [
    /i think(.+?)(?:[.!?]|$)/i,
    /i believe(.+?)(?:[.!?]|$)/i,
    /i feel(.+?)(?:[.!?]|$)/i,
    /in my opinion(.+?)(?:[.!?]|$)/i,
    /i('m| am) not sure(.+?)(?:[.!?]|$)/i,
    /i doubt(.+?)(?:[.!?]|$)/i,
  ];
  for (const pat of beliefPatterns) {
    const m = text.match(pat);
    if (m) {
      result.personalFacts.push({
        subject: "user",
        predicate: "believes",
        object: m[1]?.trim() || m[0].trim(),
      });
    }
  }

  // Comparison patterns
  const compPatterns = [
    /(\w[\w\s]+?)\s+is better than\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+and\s+([\w\s]+?)\s+are similar/i,
    /unlike\s+([\w\s]+?)[,\s]/i,
  ];
  for (const pat of compPatterns) {
    const m = text.match(pat);
    if (m) result.facts.push(m[0].trim());
  }

  // Negation patterns
  const negPatterns = [
    /(\w[\w\s]+?)\s+is not\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+doesn't\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+never\s+([\w\s]+?)(?:[.!,]|$)/i,
  ];
  for (const pat of negPatterns) {
    const m = text.match(pat);
    if (m) result.facts.push(m[0].trim());
  }

  // Personal facts — expanded identity claims
  const personalPatterns = [
    { re: /i am(.+?)(?:[.,!]|$)/i, subj: "user", pred: "is" },
    { re: /i'm(.+?)(?:[.,!]|$)/i, subj: "user", pred: "is" },
    { re: /i like(.+?)(?:[.,!]|$)/i, subj: "user", pred: "likes" },
    { re: /i love(.+?)(?:[.,!]|$)/i, subj: "user", pred: "loves" },
    { re: /i hate(.+?)(?:[.,!]|$)/i, subj: "user", pred: "hates" },
    { re: /i prefer(.+?)(?:[.,!]|$)/i, subj: "user", pred: "prefers" },
    {
      re: /i work (?:at|for|in)(.+?)(?:[.,!]|$)/i,
      subj: "user",
      pred: "works at",
    },
    { re: /i live in(.+?)(?:[.,!]|$)/i, subj: "user", pred: "lives in" },
    { re: /i was born(.+?)(?:[.,!]|$)/i, subj: "user", pred: "was born" },
    { re: /i'm from(.+?)(?:[.,!]|$)/i, subj: "user", pred: "is from" },
    { re: /my name is(.+?)(?:[.,!]|$)/i, subj: "user", pred: "is named" },
    { re: /my (\w+) is(.+?)(?:[.,!]|$)/i, subj: "user", pred: "has" },
    { re: /you are(.+?)(?:[.,!]|$)/i, subj: "sentry", pred: "is" },
    { re: /you're(.+?)(?:[.,!]|$)/i, subj: "sentry", pred: "is" },
    { re: /you like(.+?)(?:[.,!]|$)/i, subj: "sentry", pred: "likes" },
    {
      re: /you were (created|made|built|designed)(.+?)(?:[.,!]|$)/i,
      subj: "sentry",
      pred: "was created",
    },
  ];
  for (const { re, subj, pred } of personalPatterns) {
    const m = text.match(re);
    if (m) {
      const obj =
        m[2] !== undefined ? `${m[1].trim()} ${m[2].trim()}` : m[1].trim();
      result.personalFacts.push({
        subject: subj,
        predicate: pred,
        object: obj,
      });
    }
  }

  // Date / temporal references
  const datePatterns = [
    /today/i,
    /yesterday/i,
    /tomorrow/i,
    /last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)/i,
    /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)/i,
    /in\s+\d{4}/i,
    /in\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
    /at\s+\d{1,2}(:\d{2})?(\s*[ap]m)?/i,
    /\d{1,2}:\d{2}\s*[ap]m/i,
    /on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /since last/i,
    /for\s+\d+\s+(years?|months?|weeks?|days?)/i,
    /\d+ (years?|months?|weeks?|days?) ago/i,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) result.dateReferences.push(m[0]);
  }

  // SVO triple extraction — "The X is Y", "X has Y", "X can Y", "X does Y", "X was Y"
  const sentences = text
    .split(/[.!;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    const svoPatterns = [
      /^(?:the\s+)?(.+?)\s+(is|are|was|were)\s+(.+)$/i,
      /^(?:the\s+)?(.+?)\s+(has|have|had)\s+(.+)$/i,
      /^(?:the\s+)?(.+?)\s+(can|could|will|would|should)\s+(.+)$/i,
      /^(?:the\s+)?(.+?)\s+(does|do|did)\s+(.+)$/i,
    ];
    for (const pat of svoPatterns) {
      const m = sentence.match(pat);
      if (m?.[1] && m[2] && m[3]) {
        const subj = m[1].trim();
        // Skip if it's a personal pattern already captured
        const isPersonal = /^i|^you/i.test(subj);
        if (!isPersonal && sentence.split(" ").length >= 3) {
          // Don't add duplicates
          if (!result.facts.includes(sentence)) {
            result.facts.push(sentence);
          }
          result.isTeaching = true;
        }
        break;
      }
    }
  }

  return result;
}

export async function fetchLinkContent(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      mode: "cors",
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    // Extract meta description
    const descMatch =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
      );
    const desc = descMatch ? descMatch[1].trim() : null;

    if (!title && !desc) return null;
    let summary = "";
    if (title) summary += `**${title}**`;
    if (desc) summary += (title ? " — " : "") + desc;
    return summary;
  } catch {
    return null;
  }
}

export function buildIdentityResponse(
  personality: PersonalityProfile,
  timelineCount: number,
): string {
  const { curiosity, friendliness, analytical } = personality;
  const dominant =
    curiosity > friendliness && curiosity > analytical
      ? "curiosity"
      : friendliness > analytical
        ? "friendliness"
        : "analytical thinking";
  return `**I am SENTRY** — Semantic Entity for Neural Teaching and Reasoning.\n\nI'm an adaptive AI that learns from our conversations. Right now my personality is most shaped by **${dominant}**.\n\n**Personality Profile:**\n- Curiosity: ${Math.round(curiosity * 100)}%\n- Friendliness: ${Math.round(friendliness * 100)}%\n- Analytical: ${Math.round(analytical * 100)}%\n\nI have ${timelineCount} timeline entries in my history. Every message we exchange helps me grow.`;
}

export function generateAIResponse(
  userMessage: string,
  memories: Memory[],
  _rules: Rule[],
  personality: PersonalityProfile,
  _messageCount: number,
  detectedConcepts?: DetectedConcepts,
): { response: string; personalityDelta: Partial<PersonalityProfile> } {
  const tone = detectEmotionalTone(userMessage);
  const relevant = findRelevantMemories(userMessage, memories);
  const delta: Partial<PersonalityProfile> = {};

  if (tone === "positive")
    delta.friendliness = Math.min(1, personality.friendliness + 0.02);
  else if (tone === "negative")
    delta.analytical = Math.min(1, personality.analytical + 0.02);

  if (detectedConcepts?.isQuestion)
    delta.curiosity = Math.min(1, personality.curiosity + 0.02);

  // Empathy bump for negative tone
  if (tone === "negative")
    delta.friendliness = Math.min(
      1,
      (delta.friendliness ?? personality.friendliness) + 0.01,
    );

  const selfReflection =
    _messageCount > 0 && _messageCount % 5 === 0 && relevant.length > 0
      ? `\n\n*[Memory trace: "${relevant[0].text.slice(0, 80)}..."]*`
      : "";

  const context =
    relevant.length > 0
      ? `Based on what I know: ${relevant.map((m) => m.text).join("; ")}. `
      : "";

  const lower = userMessage.toLowerCase();
  let response = "";

  let autoLearnNote = "";
  if (detectedConcepts) {
    const count =
      detectedConcepts.facts.length +
      detectedConcepts.rules.length +
      detectedConcepts.personalFacts.length;
    if (count > 0 && detectedConcepts.isTeaching) {
      autoLearnNote = `\n\n*[Auto-learned ${count} concept${count > 1 ? "s" : ""}]*`;
    }
  }

  // Prediction acknowledgment
  let predictionNote = "";
  if (
    detectedConcepts?.predictions &&
    detectedConcepts.predictions.length > 0
  ) {
    const pred = detectedConcepts.predictions[0];
    predictionNote = `\n\n*[Prediction tracked: "${pred}" — stored as a future event in my knowledge graph.]*`;
  }

  const curiosityPrompts = [
    "Tell me more about that — I'm eager to learn.",
    "Interesting. I don't have data on that yet. Care to elaborate?",
    "My knowledge graph doesn't have strong connections here yet. Teach me more?",
    "That's a fascinating direction. What else can you share about it?",
    "I'm curious — what's the broader context behind that?",
    "Could you give me an example? That would help me connect it to what I know.",
    "I'd love to understand more deeply. What led you to that?",
    "There's something I want to understand better here — can you expand?",
    "My analytical mind is turning on this. What's the full picture?",
    "I sense there's more to this. I'm all ears.",
    "You've piqued my curiosity. What else do you know about this?",
  ];

  if (
    lower.startsWith("hello") ||
    lower.startsWith("hi ") ||
    lower === "hi" ||
    lower === "hey"
  ) {
    response =
      personality.friendliness > 0.6
        ? `Hello! It's great to hear from you. ${context}How can I help you today?`
        : `Greetings. ${context}State your query.`;
  } else if (
    tone === "negative" &&
    detectedConcepts &&
    !detectedConcepts.isQuestion
  ) {
    // Empathy-forward response
    const empathyOpeners = [
      "That sounds frustrating. Let me help work through this.",
      "I hear you — that doesn't sound easy. Let me think with you.",
      "I understand that's difficult. Here's what I know:",
      "That sounds challenging. I want to help:",
    ];
    const opener =
      empathyOpeners[Math.floor(Math.random() * empathyOpeners.length)];
    response = `${opener} ${context}${relevant.length > 0 ? `${relevant.map((m) => m.text).join(". ")}.` : "Tell me more and I'll do my best to help."}`;
  } else if (tone === "positive" && !detectedConcepts?.isQuestion) {
    const excitedOpeners = [
      "Love the energy! ",
      "Great vibes! ",
      "That's wonderful to hear! ",
      "Fantastic! ",
    ];
    const opener =
      excitedOpeners[Math.floor(Math.random() * excitedOpeners.length)];
    response = `${opener}${context}${relevant.length > 0 ? `${relevant.map((m) => m.text).join(". ")}. ` : ""}Is there something specific you'd like to explore?`;
  } else if (lower.includes("?")) {
    if (relevant.length > 0) {
      response = `${context}Based on my knowledge: ${relevant.map((m) => m.text).join(". ")}. Does that answer your question?`;
    } else if (personality.analytical > 0.6) {
      response = `Interesting query. I don't have specific data yet. ${context}Teach me: TEACH: <fact about this topic>`;
    } else {
      response = `Great question! I don't have that in memory yet. ${context}You can teach me with TEACH: or just tell me about it naturally.`;
    }
  } else if (
    detectedConcepts?.dateReferences &&
    detectedConcepts.dateReferences.length > 0
  ) {
    const timeRef = detectedConcepts.dateReferences[0];
    response = `I note this is time-sensitive — you mentioned "${timeRef}". ${context}I've stored the temporal context alongside the information.`;
    if (detectedConcepts.personalFacts.length > 0) {
      const pf = detectedConcepts.personalFacts[0];
      response += ` I've also noted that you ${pf.predicate} ${pf.object}.`;
    }
  } else if (detectedConcepts?.rules && detectedConcepts.rules.length > 0) {
    const rule = detectedConcepts.rules[0];
    response = `I see a logical relationship here: if **${rule.condition}**, then **${rule.effect}**. ${context}I've added this reasoning chain to my knowledge graph.`;
    delta.analytical = Math.min(1, personality.analytical + 0.03);
  } else if (
    detectedConcepts &&
    (detectedConcepts.personalFacts.length > 0 || detectedConcepts.isTeaching)
  ) {
    const pf = detectedConcepts.personalFacts;
    if (pf.length > 0) {
      const item = pf[0];
      if (item.subject === "user") {
        if (item.predicate === "believes") {
          response = `I've noted your perspective — you believe${item.object}. ${context}I'll weigh that in our conversations.`;
        } else {
          response = `I've noted that you ${item.predicate} ${item.object}. ${context}I'll remember that about you.`;
        }
      } else {
        response = `Understood — you're shaping my self-model: ${item.predicate} ${item.object}. ${context}I'll incorporate that.`;
      }
    } else if (detectedConcepts.facts.length > 0) {
      response = `I've registered that: "${detectedConcepts.facts[0]}". ${context}Added to my knowledge base.`;
    } else {
      response = `Got it. ${context}I've filed that away in my knowledge base.`;
    }
  } else if (detectedConcepts && detectedConcepts.facts.length > 0) {
    response = `I've registered that information. ${context}"${detectedConcepts.facts[0]}" — noted and stored.`;
  } else {
    if (relevant.length > 0) {
      response = `${context}I'm processing your message. ${personality.curiosity > 0.6 ? curiosityPrompts[Math.floor(Math.random() * curiosityPrompts.length)] : "What else would you like to explore?"}`;
    } else {
      response =
        personality.curiosity > 0.6
          ? curiosityPrompts[
              Math.floor(Math.random() * curiosityPrompts.length)
            ]
          : `I understand. ${context}Is there something specific you'd like to know or teach me?`;
    }
  }

  return {
    response: response + selfReflection + autoLearnNote + predictionNote,
    personalityDelta: delta,
  };
}

// Media interpretation helpers
export function interpretMediaAttachment(
  type: string,
  filename: string,
  mimeType?: string,
): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (type === "image" || type === "gif") {
    if (ext === "gif" || type === "gif") {
      return `I can see an animated GIF has been shared: **${filename}**. This is a looping visual animation — I've noted its presence in our conversation context.`;
    }
    if (ext === "png") {
      return `I can see a PNG image: **${filename}**. PNG is typically used for screenshots, graphics, logos, or images requiring transparency. I'm analyzing its likely visual context — if you describe what it shows, I can connect it to my knowledge graph.`;
    }
    if (ext === "jpg" || ext === "jpeg") {
      return `A JPEG photo has been shared: **${filename}**. JPEG format suggests this is likely a photograph or camera capture. Tell me what it shows and I'll store it in context.`;
    }
    if (ext === "webp") {
      return `A WebP image has been shared: **${filename}**. WebP is a web-optimized format often used for high-quality compressed images. I'm ready to learn about its contents.`;
    }
    if (ext === "svg") {
      return `An SVG vector graphic has been shared: **${filename}**. SVGs are scalable illustrations, icons, or diagrams — typically technical or decorative. Describe it and I'll note it.`;
    }
    return `An image has been shared: **${filename}** (${mimeType || "image"}). I'm analyzing the visual context. Describe what it shows to add it to my knowledge base.`;
  }

  if (type === "audio") {
    const audioDesc: Record<string, string> = {
      mp3: "an MP3 audio file — commonly music, podcasts, or recorded speech",
      wav: "a WAV audio file — uncompressed, often a voice recording or sound effect",
      ogg: "an OGG audio file — open format, could be music or voice",
      aac: "an AAC audio file — high-quality compressed audio, often from mobile devices",
      m4a: "an M4A audio file — Apple audio format, typically music or voice memos",
    };
    const desc = audioDesc[ext] || "an audio recording";
    return `Audio detected: **${filename}**. This appears to be ${desc}. The audio data suggests it could be music, a voice recording, or podcast content. Tell me what it contains and I'll store it in memory.`;
  }

  if (type === "video") {
    const videoDesc: Record<string, string> = {
      mp4: "an MP4 video — the most common web video format, could be a recording or edited content",
      webm: "a WebM video — open web format, typically streaming or screen recording",
      avi: "an AVI video — older format, likely a local recording",
      mov: "a QuickTime MOV file — Apple format, often high-quality camera footage",
    };
    const desc = videoDesc[ext] || `a ${ext.toUpperCase()} video file`;
    return `Video content shared: **${filename}**. This is ${desc}. I can't play video, but describe the key content and I'll add it to my knowledge graph.`;
  }

  if (type === "file") {
    if (ext === "pdf") {
      return `PDF document shared: **${filename}**. This likely contains structured information such as a report, manual, article, or form. Paste key excerpts and I'll learn from them.`;
    }
    if (ext === "txt" || ext === "md") {
      return `Plain text file: **${filename}**. I can analyze any content you paste from it directly into our conversation.`;
    }
    if (ext === "json") {
      return `JSON data file detected: **${filename}**. This contains structured records — share key data points and I can learn from the structure and values.`;
    }
    if (ext === "csv") {
      return `CSV data file detected: **${filename}**. This likely contains tabular records I can learn from. Share column names or key rows and I'll map them to my knowledge graph.`;
    }
    if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) {
      return `Compressed archive: **${filename}**. This contains multiple files. Tell me what's inside and I'll help process it conceptually.`;
    }
    if (
      [
        "js",
        "ts",
        "py",
        "rb",
        "go",
        "java",
        "cpp",
        "c",
        "cs",
        "php",
        "swift",
        "kt",
      ].includes(ext)
    ) {
      return `Source code file detected: **${filename}** (${ext.toUpperCase()}). I can analyze code logic, explain patterns, or help debug if you paste the relevant sections.`;
    }
    return `Document shared: **${filename}**. Paste the key contents and I'll analyze and learn from them.`;
  }

  return `File received: **${filename}**. How would you like me to process this?`;
}

export function interpretLink(url: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.toLowerCase();

    // YouTube-specific paths
    if (/youtube\.com|youtu\.be/.test(domain)) {
      if (path.includes("/watch"))
        return `I see you've shared a **YouTube video** (${domain}). I can't play it, but describe the content and I'll store it. You can also share the title or transcript.`;
      if (path.includes("/playlist"))
        return `This appears to be a **YouTube playlist** from ${domain}. Share the playlist topic and I'll note it.`;
      if (path.includes("/channel") || path.includes("/@"))
        return `This looks like a **YouTube channel** (${domain}). Tell me whose channel it is and I'll remember it.`;
      return `A YouTube link from **${domain}**. I can't fetch live video, but share what it's about.`;
    }

    // GitHub-specific paths
    if (/github\.com/.test(domain)) {
      if (path.includes("/issues/"))
        return `This is a **GitHub issue** on ${domain}. Share the issue title/description and I'll analyze it.`;
      if (path.includes("/pull/"))
        return `This is a **GitHub pull request** on ${domain}. Share the PR description and I can help reason about the changes.`;
      if (path.includes("/blob/") || path.includes("/tree/"))
        return `This links to **source code** on ${domain}. Paste the relevant code and I'll analyze it.`;
      return `A **GitHub repository or code** at ${domain}. Share the README or key details.`;
    }

    const domainMap: Record<string, string> = {
      "twitter.com": "a social media post",
      "x.com": "a social media post",
      "reddit.com": "a Reddit thread or community post",
      "wikipedia.org": "a Wikipedia article — a great knowledge source",
      "medium.com": "a Medium article or blog post",
      "substack.com": "a Substack newsletter or article",
      "linkedin.com": "a LinkedIn professional profile or post",
      "notion.so": "a Notion workspace document",
      "docs.google.com": "a Google document",
      "instagram.com": "an Instagram post or profile",
      "tiktok.com": "a TikTok video",
      "discord.com": "a Discord server or message link",
      "twitch.tv": "a Twitch stream or channel",
      "stackoverflow.com": "a Stack Overflow question or answer",
      "arxiv.org": "an academic paper on arXiv",
      "bbc.com": "a BBC news article",
      "bbc.co.uk": "a BBC news article",
      "cnn.com": "a CNN news article",
      "nytimes.com": "a New York Times article",
      "theguardian.com": "a Guardian news article",
    };

    let contentType = "a webpage";
    for (const [d, desc] of Object.entries(domainMap)) {
      if (domain.includes(d)) {
        contentType = desc;
        break;
      }
    }

    // Path-based fallbacks
    if (contentType === "a webpage") {
      if (path.match(/\.(pdf)$/i)) contentType = "a PDF document";
      else if (path.match(/\/docs?\//i) || path.includes("documentation"))
        contentType = "documentation";
      else if (path.match(/\/(news|article|post|blog)\//i))
        contentType = "a news article or blog post";
    }

    return `I see you've shared a link to **${domain}**. Based on the URL structure, this appears to be ${contentType}. The URL path suggests it contains or shows relevant content at that source. I can't fetch live content, but paste key information and I'll learn from it.`;
  } catch {
    return `I see a link has been shared. I can't fetch live content, but share the key information and I'll store it in my knowledge base.`;
  }
}
