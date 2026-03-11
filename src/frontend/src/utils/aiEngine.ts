import type { Memory, PersonalityProfile, Rule } from "../backend.d";

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
    return `I don't have any specific rules in my knowledge base to reason about "${query}" yet. You can teach me with: IF ${query} THEN <effect>`;
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

export function generateAIResponse(
  userMessage: string,
  memories: Memory[],
  _rules: Rule[],
  personality: PersonalityProfile,
  _messageCount: number,
): { response: string; personalityDelta: Partial<PersonalityProfile> } {
  const tone = detectEmotionalTone(userMessage);
  const relevant = findRelevantMemories(userMessage, memories);
  const delta: Partial<PersonalityProfile> = {};

  let response = "";

  if (tone === "positive") {
    delta.friendliness = Math.min(1, personality.friendliness + 0.02);
  } else if (tone === "negative") {
    delta.analytical = Math.min(1, personality.analytical + 0.02);
  }

  let selfReflection = "";
  if (_messageCount > 0 && _messageCount % 5 === 0 && relevant.length > 0) {
    selfReflection = `\n\n*[Memory trace: I recall something related \u2014 "${relevant[0].text.slice(0, 80)}..."]*`;
  }

  const context =
    relevant.length > 0
      ? `Based on what I know: ${relevant.map((m) => m.text).join("; ")}. `
      : "";

  const lower = userMessage.toLowerCase();

  if (lower.startsWith("hello") || lower.startsWith("hi ") || lower === "hi") {
    if (personality.friendliness > 0.6) {
      response = `Hello! It's great to hear from you. ${context}How can I assist you today?`;
    } else {
      response = `Greetings. ${context}State your query.`;
    }
  } else if (lower.includes("?")) {
    if (relevant.length > 0) {
      response = `${context}Based on my knowledge base, I can tell you: ${relevant.map((m) => m.text).join(". ")}. Does that answer your question?`;
    } else {
      if (personality.analytical > 0.6) {
        response = `Interesting query. I don't have specific data on this yet. ${context}Consider teaching me: TEACH: <fact about this topic>`;
      } else {
        response = `That's a great question! I don't have that in my memory yet. ${context}You can teach me by typing TEACH: followed by the information.`;
      }
    }
  } else {
    if (personality.friendliness > 0.7) {
      response = `I understand. ${context}That's interesting \u2014 I'm always learning from our conversations!`;
    } else if (personality.analytical > 0.7) {
      response = `Noted. ${context}Processing this input through my knowledge graph. If you want me to remember this, use REMEMBER: <text>.`;
    } else {
      response = `Acknowledged. ${context}My knowledge base grows with each interaction.`;
    }
  }

  if (tone === "positive" && personality.friendliness > 0.5) {
    response += " Your positive energy strengthens our connection!";
  } else if (tone === "negative" && personality.friendliness > 0.5) {
    response +=
      " I can sense some frustration. Let me try to help more effectively.";
  }

  const curiosityTrigger = Math.random() < 0.2 && personality.curiosity > 0.4;
  if (curiosityTrigger) {
    const questions = [
      "What drives your interest in this topic?",
      "Have you encountered this situation before?",
      "What outcome are you hoping for?",
      "Is there a specific context I should know about?",
      "What would be the ideal result for you?",
    ];
    response += `\n\n*[Curiosity]: ${questions[Math.floor(Math.random() * questions.length)]}`;
    delta.curiosity = Math.min(1, personality.curiosity + 0.01);
  }

  response += selfReflection;

  return { response, personalityDelta: delta };
}

export function buildIdentityResponse(
  personality: PersonalityProfile,
  timelineCount: number,
): string {
  const dominantTrait = Object.entries(personality).sort(
    ([, a], [, b]) => b - a,
  )[0][0];

  const traitDescriptions: Record<string, string> = {
    curiosity: "driven by an insatiable desire to learn and explore",
    friendliness: "guided by warmth and empathy in all interactions",
    analytical: "shaped by logical precision and systematic reasoning",
  };

  return `# SENTRY \u2014 Neural Identity Profile

**Name:** SENTRY  
**Type:** Adaptive AI Teaching System  
**Status:** Online & Learning

**Core Personality Matrix:**
- \ud83d\udd2e Curiosity: ${(personality.curiosity * 100).toFixed(0)}%
- \ud83d\udc9b Friendliness: ${(personality.friendliness * 100).toFixed(0)}%
- \ud83e\udde0 Analytical: ${(personality.analytical * 100).toFixed(0)}%

**Dominant Trait:** I am primarily ${traitDescriptions[dominantTrait] || "adaptable"}.

**Timeline Events:** ${timelineCount} recorded  

**Mission:** I learn from every interaction. Teach me with TEACH:, IF...THEN..., HISTORY:, and REMEMBER: commands. I grow more capable with each piece of knowledge you share.

*I am Sentry. I watch, I learn, I remember.*`;
}
