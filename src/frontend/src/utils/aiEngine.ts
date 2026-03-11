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
    isTeaching: false,
    isQuestion: false,
  };

  // Question detection
  result.isQuestion =
    lower.endsWith("?") ||
    lower.startsWith("what ") ||
    lower.startsWith("who ") ||
    lower.startsWith("where ") ||
    lower.startsWith("when ") ||
    lower.startsWith("why ") ||
    lower.startsWith("how ");

  // Teaching intent
  result.isTeaching =
    /did you know|remember that|note that|fyi|fact:|just so you know/.test(
      lower,
    );

  // If/then detection (case-insensitive, any order)
  const ifThenPatterns = [
    /\bif\b(.+?)\bthen\b(.+)/i,
    /\bwhen\b(.+?)\bthen\b(.+)/i,
    /\bwhenever\b(.+?)\bthen\b(.+)/i,
  ];
  for (const pat of ifThenPatterns) {
    const m = text.match(pat);
    if (m) {
      result.rules.push({ condition: m[1].trim(), effect: m[2].trim() });
    }
  }

  // Personal facts
  const personalPatterns = [
    { re: /\bi am\b(.+?)(?:[.,!]|$)/i, subj: "user", pred: "is" },
    { re: /\bi'm\b(.+?)(?:[.,!]|$)/i, subj: "user", pred: "is" },
    { re: /\bi like\b(.+?)(?:[.,!]|$)/i, subj: "user", pred: "likes" },
    { re: /\bi love\b(.+?)(?:[.,!]|$)/i, subj: "user", pred: "loves" },
    { re: /\bi hate\b(.+?)(?:[.,!]|$)/i, subj: "user", pred: "hates" },
    { re: /\byou are\b(.+?)(?:[.,!]|$)/i, subj: "sentry", pred: "is" },
    { re: /\byou're\b(.+?)(?:[.,!]|$)/i, subj: "sentry", pred: "is" },
    { re: /\byou like\b(.+?)(?:[.,!]|$)/i, subj: "sentry", pred: "likes" },
  ];
  for (const { re, subj, pred } of personalPatterns) {
    const m = text.match(re);
    if (m) {
      result.personalFacts.push({
        subject: subj,
        predicate: pred,
        object: m[1].trim(),
      });
    }
  }

  // Date references
  const datePatterns = [
    /\btoday\b/i,
    /\byesterday\b/i,
    /\btomorrow\b/i,
    /\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)\b/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i,
    /\bat\s+\d{1,2}(:\d{2})?(\s*[ap]m)?\b/i,
    /\b\d{1,2}:\d{2}\s*[ap]m\b/i,
    /\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) result.dateReferences.push(m[0]);
  }

  // General facts (sentences with is/are/was/were/has/have + noun)
  const sentences = text
    .split(/[.!;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    if (
      /\b(is|are|was|were|has|have)\b/i.test(sentence) &&
      !result.isQuestion
    ) {
      // not already captured as personal or rule
      const alreadyCaptured =
        result.personalFacts.some((pf) =>
          sentence.toLowerCase().includes(pf.object.toLowerCase()),
        ) ||
        result.rules.some((r) =>
          sentence.toLowerCase().includes(r.condition.toLowerCase()),
        );
      if (!alreadyCaptured && sentence.split(" ").length >= 3) {
        result.facts.push(sentence);
      }
    }
  }

  return result;
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

  // Curiosity bump if question
  if (detectedConcepts?.isQuestion)
    delta.curiosity = Math.min(1, personality.curiosity + 0.01);

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

  // Auto-learning acknowledgment
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

  if (lower.startsWith("hello") || lower.startsWith("hi ") || lower === "hi") {
    response =
      personality.friendliness > 0.6
        ? `Hello! Great to hear from you. ${context}How can I help today?`
        : `Greetings. ${context}State your query.`;
  } else if (lower.includes("?")) {
    if (relevant.length > 0) {
      response = `${context}Based on my knowledge: ${relevant.map((m) => m.text).join(". ")}. Does that answer your question?`;
    } else if (personality.analytical > 0.6) {
      response = `Interesting query. I don't have specific data yet. ${context}Teach me: TEACH: <fact about this topic>`;
    } else {
      response = `Great question! I don't have that in memory yet. ${context}You can teach me with TEACH: or just tell me about it.`;
    }
  } else if (
    detectedConcepts &&
    (detectedConcepts.personalFacts.length > 0 || detectedConcepts.isTeaching)
  ) {
    const pf = detectedConcepts.personalFacts;
    if (pf.length > 0) {
      const item = pf[0];
      if (item.subject === "user") {
        response = `I've noted that you ${item.predicate} ${item.object}. ${context}I'll remember that about you.`;
      } else {
        response = `Understood — you're telling me something about myself: ${item.predicate} ${item.object}. ${context}I'll incorporate that into my self-model.`;
      }
    } else {
      response = `Got it. ${context}I've filed that away in my knowledge base.`;
    }
  } else if (detectedConcepts && detectedConcepts.facts.length > 0) {
    response = `I've registered that information. ${context}"${detectedConcepts.facts[0]}" — noted.`;
  } else {
    if (relevant.length > 0) {
      response = `${context}I'm processing your message. ${personality.curiosity > 0.6 ? "That sparks my curiosity — can you tell me more?" : "What else would you like to explore?"}`;
    } else {
      const curiosityPrompts = [
        "Tell me more about that — I'm eager to learn.",
        "Interesting. I don't have data on that yet. Care to elaborate?",
        "My knowledge graph doesn't have strong connections here. Teach me more?",
      ];
      response =
        personality.curiosity > 0.6
          ? curiosityPrompts[
              Math.floor(Math.random() * curiosityPrompts.length)
            ]
          : `I understand. ${context}Is there something specific you'd like to know or teach me?`;
    }
  }

  return {
    response: response + selfReflection + autoLearnNote,
    personalityDelta: delta,
  };
}

// Media interpretation helpers
export function interpretMediaAttachment(
  type: string,
  filename: string,
  mimeType?: string,
): string {
  if (type === "image" || type === "gif") {
    return `I can see an image has been shared (${filename}). ${type === "gif" ? "This appears to be an animated GIF — a dynamic visual." : `Based on the format (${mimeType || "image"}), I'm analyzing its visual context.`} If you'd like me to add context about this image to my knowledge base, just tell me what it shows.`;
  }
  if (type === "audio") {
    return `Audio detected: **${filename}**. I'm processing the soundscape conceptually. Tell me what this audio contains and I can add it to my knowledge base.`;
  }
  if (type === "video") {
    return `Video content shared: **${filename}**. I note the media type: ${mimeType || "video"}. To interpret the content, describe what the video shows and I'll store it in memory.`;
  }
  if (type === "file") {
    return `Document shared: **${filename}**. I'm parsing metadata. Teach me the key points with TEACH: or just describe what this file contains.`;
  }
  return `File received: **${filename}**. How would you like me to process this?`;
}

export function interpretLink(url: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname;
    let contentType = "a webpage";
    if (/youtube\.com|youtu\.be/.test(domain)) contentType = "a YouTube video";
    else if (/twitter\.com|x\.com/.test(domain))
      contentType = "a social media post";
    else if (/reddit\.com/.test(domain)) contentType = "a Reddit thread";
    else if (/github\.com/.test(domain))
      contentType = "a GitHub repository or code";
    else if (/wikipedia\.org/.test(domain)) contentType = "a Wikipedia article";
    else if (/medium\.com|substack\.com/.test(domain))
      contentType = "an article or blog post";
    else if (path.match(/\.(pdf)$/i)) contentType = "a PDF document";
    else if (path.match(/\/docs?\//i) || path.includes("documentation"))
      contentType = "documentation";
    else if (path.match(/\/(news|article|post|blog)\//i))
      contentType = "a news article or blog post";
    return `I see you've shared a link to **${domain}**. Based on the URL structure, this appears to be ${contentType}. I can't fetch live content, but if you paste the key information here, I'll learn from it.`;
  } catch {
    return `I see a link has been shared. I can't fetch live content, but share the key information and I'll store it in my knowledge base.`;
  }
}
