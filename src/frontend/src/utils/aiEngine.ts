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

export function detectCorrectionIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
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
    // Try reverse reasoning: look for rules whose EFFECT matches the query
    const reverseRules = rules.filter(
      (r) =>
        lower.includes(r.effect.toLowerCase()) ||
        r.effect
          .toLowerCase()
          .split(" ")
          .some((w) => w.length > 3 && lower.includes(w)),
    );
    if (reverseRules.length > 0) {
      let reverseChain = `**Reverse reasoning for: "${query}"** (tracing causes)\n\n`;
      for (const r of reverseRules) {
        reverseChain += `→ **${r.effect}** ← caused by IF **${r.condition}**\n`;
      }
      return reverseChain;
    }
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

export interface ExtractedTriple {
  subject: string;
  verb: string;
  object: string;
  conditional?: boolean;
}

export interface DetectedConcepts {
  facts: string[];
  conditionalFacts: string[];
  rules: { condition: string; effect: string }[];
  personalFacts: { subject: string; predicate: string; object: string }[];
  dateReferences: string[];
  predictions: string[];
  isTeaching: boolean;
  isQuestion: boolean;
  extractedTriples: ExtractedTriple[];
  lastMentionedEntity: string;
}

/**
 * Detect modal words indicating conditional/partial truth
 */
function isConditional(text: string): boolean {
  const conditionalWords =
    /\b(might|could|possibly|sometimes|maybe|in some cases|occasionally|perhaps|may|not always|usually|often|tends to|can sometimes|typically)\b/i;
  return conditionalWords.test(text);
}

/**
 * Advanced concept extraction:
 * - Sentence-level SVO triple detection
 * - Causal chain detection
 * - Temporal references
 * - Predictions
 * - Identity claims with pronoun resolution
 * - Negations
 * - Enumerations ("X are: a, b, c")
 * - Order-independent parsing
 * - Conditional/modal detection ("might", "could", etc.)
 * - Pronoun resolution (I/me/my → username, you/your → Sentry, they/them → last entity)
 */
export function detectConceptsFromNaturalLanguage(
  text: string,
  username = "user",
): DetectedConcepts {
  const lower = text.toLowerCase().trim();
  const sentryName = "Sentry";
  const result: DetectedConcepts = {
    facts: [],
    conditionalFacts: [],
    rules: [],
    personalFacts: [],
    dateReferences: [],
    predictions: [],
    isTeaching: false,
    isQuestion: false,
    extractedTriples: [],
    lastMentionedEntity: "",
  };

  // Question detection
  result.isQuestion =
    lower.endsWith("?") ||
    /^(what|who|where|when|why|how|can you|do you|is there|are there|tell me)/.test(
      lower,
    );

  // Teaching intent
  result.isTeaching =
    /did you know|remember that|note that|fyi|fact:|just so you know|is a |are a |means |refers to|defined as|known as|stands for/.test(
      lower,
    ) || /(is|are|was|were)\s+(a|an|the)/.test(lower);

  // ── CAUSAL / IF-THEN rules (flexible) ──
  const ifThenPatterns = [
    /if(.+?)then(.+)/i,
    /when(.+?)then(.+)/i,
    /whenever(.+?)then(.+)/i,
    /(.+?)\s+causes\s+(.+)/i,
    /(.+?)\s+leads to\s+(.+)/i,
    /(.+?)\s+results in\s+(.+)/i,
    /(.+?)\s+triggers\s+(.+)/i,
    /(.+?)\s+produces\s+(.+)/i,
    /(.+?)\s+enables\s+(.+)/i,
  ];
  for (const pat of ifThenPatterns) {
    const m = text.match(pat);
    if (m?.[1] && m[2]) {
      result.rules.push({ condition: m[1].trim(), effect: m[2].trim() });
      result.isTeaching = true;
    }
  }

  // ── ENUMERATION patterns ("X are: a, b, c") ──
  const enumPatterns = [
    /([\w\s]+?)\s+(?:are|is|include|includes|consist of|contains?):?\s+([^.!?]+(?:,\s*[^.!?]+){1,})/i,
  ];
  for (const pat of enumPatterns) {
    const m = text.match(pat);
    if (m?.[1] && m[2]) {
      const subject = m[1].trim();
      // Track as last mentioned entity for they/them reference
      result.lastMentionedEntity = subject;
      const items = m[2]
        .split(/,\s*|\s+and\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const item of items) {
        if (item.length > 0) {
          result.facts.push(`${subject} includes ${item}`);
          result.extractedTriples.push({
            subject,
            verb: "includes",
            object: item,
          });
        }
      }
      result.isTeaching = true;
    }
  }

  // ── PREDICTION patterns ──
  const predictionPatterns = [
    /(.+?)\s+will\s+(?:probably\s+)?(.+?)(?:[.!]|$)/i,
    /(.+?)\s+is going to\s+(.+?)(?:[.!]|$)/i,
    /(.+?)\s+is likely to\s+(.+?)(?:[.!]|$)/i,
    /(.+?)\s+is expected to\s+(.+?)(?:[.!]|$)/i,
    /i predict(?:\s+that)?\s+(.+?)(?:[.!]|$)/i,
    /predict\s+that\s+(.+?)(?:[.!]|$)/i,
    /(.+?)\s+should\s+(.+?)\s+in the future(?:[.!]|$)/i,
    /probably\s+(.+?)(?:[.!]|$)/i,
    /it'?s likely\s+(.+?)(?:[.!]|$)/i,
    /next time(.+?)then(.+?)(?:[.!]|$)/i,
  ];
  for (const pat of predictionPatterns) {
    const m = text.match(pat);
    if (m) {
      if (pat.source.includes("predict")) {
        result.predictions.push(m[1]?.trim() || m[0].trim());
      } else if (m[1] && m[2]) {
        result.predictions.push(`${m[1].trim()} → ${m[2].trim()}`);
      } else if (m[1]) {
        result.predictions.push(m[1].trim());
      }
    }
  }

  // ── CONDITIONAL / MIGHT patterns ──
  // "X might Y", "X could possibly Y", "sometimes X is Y" etc.
  const conditionalPatterns = [
    /(.+?)\s+might\s+(.+?)(?:[.!]|$)/i,
    /(.+?)\s+could\s+(?:possibly\s+)?(.+?)(?:[.!]|$)/i,
    /sometimes\s+(.+?)\s+(is|are|has|have)\s+(.+?)(?:[.!]|$)/i,
    /maybe\s+(.+?)\s+(is|are|has|have|will)\s+(.+?)(?:[.!]|$)/i,
    /possibly\s+(.+?)\s+(is|are)\s+(.+?)(?:[.!]|$)/i,
    /occasionally\s+(.+?)(?:[.!]|$)/i,
  ];
  for (const pat of conditionalPatterns) {
    const m = text.match(pat);
    if (m) {
      const factText = m[0].trim();
      if (!result.conditionalFacts.includes(factText)) {
        result.conditionalFacts.push(factText);
      }
      if (m[1] && m[2]) {
        const subj = m[1].trim();
        const verb = m[2].trim();
        const obj = m[3]?.trim() || "";
        result.extractedTriples.push({
          subject: subj,
          verb: verb,
          object: obj,
          conditional: true,
        });
        result.lastMentionedEntity = subj;
      }
      result.isTeaching = true;
    }
  }

  // ── CAUSAL connector patterns ──
  const causalPatterns = [
    /because(.+?)(?:[.!]|$)/i,
    /therefore(.+?)(?:[.!]|$)/i,
    /due to(.+?)(?:[.!]|$)/i,
    /as a result(.+?)(?:[.!]|$)/i,
    /consequently(.+?)(?:[.!]|$)/i,
    /thus(.+?)(?:[.!]|$)/i,
    /hence(.+?)(?:[.!]|$)/i,
  ];
  for (const pat of causalPatterns) {
    const m = text.match(pat);
    if (m) result.facts.push(m[0].trim());
  }

  // ── BELIEF / OPINION patterns ──
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
        subject: username,
        predicate: "believes",
        object: m[1]?.trim() || m[0].trim(),
      });
    }
  }

  // ── COMPARISON patterns ──
  const compPatterns = [
    /(\w[\w\s]+?)\s+is better than\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+is worse than\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+and\s+([\w\s]+?)\s+are similar/i,
    /unlike\s+([\w\s]+?)[,\s]/i,
    /(\w[\w\s]+?)\s+is stronger than\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+is super effective against\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+is weak against\s+([\w\s]+?)(?:[.!,]|$)/i,
    // Power/effect chains: "[power] is used [on/by/against] [target] [to do/causing] [effect]"
    /(\w[\w\s]+?)\s+(?:is used|used)\s+(?:on|by|against)\s+([\w\s]+?)\s+(?:to|causing|to do)\s+(.+?)(?:[.!,]|$)/i,
    // Against order-independent: "Against X, Y is Z"
    /against\s+([\w\s]+?)[,]\s+([\w\s]+?)\s+is\s+(.+?)(?:[.!,]|$)/i,
  ];
  for (const pat of compPatterns) {
    const m = text.match(pat);
    if (m) {
      result.facts.push(m[0].trim());
      if (m[1]) result.lastMentionedEntity = m[1].trim();
      if (m[1] && m[2]) {
        const verbMatch = m[0].match(
          /is\s+(better|worse|stronger|super effective|weak)[\w\s]*(?:than|against)|are similar|is used|used/i,
        );
        const verb = verbMatch ? verbMatch[0] : "relates to";
        result.extractedTriples.push({
          subject: m[1].trim(),
          verb,
          object: m[2].trim(),
          conditional: isConditional(m[0]),
        });
      }
      result.isTeaching = true;
    }
  }

  // ── NEGATION patterns ──
  const negPatterns = [
    /(\w[\w\s]+?)\s+is not\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+doesn't\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+never\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+cannot\s+([\w\s]+?)(?:[.!,]|$)/i,
    /(\w[\w\s]+?)\s+can't\s+([\w\s]+?)(?:[.!,]|$)/i,
  ];
  for (const pat of negPatterns) {
    const m = text.match(pat);
    if (m) {
      result.facts.push(m[0].trim());
      if (m[1] && m[2]) {
        result.extractedTriples.push({
          subject: m[1].trim(),
          verb: "NOT",
          object: m[2].trim(),
        });
      }
    }
  }

  // ── PERSONAL IDENTITY patterns with pronoun resolution ──
  // I/me/my/I'm → username
  // you/you're/you were → Sentry
  // they/them/their → lastMentionedEntity
  const personalPatterns = [
    { re: /i am(.+?)(?:[.,!]|$)/i, subj: username, pred: "is" },
    { re: /i'm(.+?)(?:[.,!]|$)/i, subj: username, pred: "is" },
    { re: /i like(.+?)(?:[.,!]|$)/i, subj: username, pred: "likes" },
    { re: /i love(.+?)(?:[.,!]|$)/i, subj: username, pred: "loves" },
    { re: /i hate(.+?)(?:[.,!]|$)/i, subj: username, pred: "hates" },
    { re: /i prefer(.+?)(?:[.,!]|$)/i, subj: username, pred: "prefers" },
    {
      re: /i work (?:at|for|in)(.+?)(?:[.,!]|$)/i,
      subj: username,
      pred: "works at",
    },
    { re: /i live in(.+?)(?:[.,!]|$)/i, subj: username, pred: "lives in" },
    { re: /i was born(.+?)(?:[.,!]|$)/i, subj: username, pred: "was born" },
    { re: /i'm from(.+?)(?:[.,!]|$)/i, subj: username, pred: "is from" },
    { re: /my name is(.+?)(?:[.,!]|$)/i, subj: username, pred: "is named" },
    { re: /my (\w+) is(.+?)(?:[.,!]|$)/i, subj: username, pred: "has" },
    { re: /i was(.+?)(?:[.,!]|$)/i, subj: username, pred: "was" },
    { re: /i did(.+?)(?:[.,!]|$)/i, subj: username, pred: "did" },
    { re: /i have(.+?)(?:[.,!]|$)/i, subj: username, pred: "has" },
    // you/you're/you were → Sentry
    { re: /you are(.+?)(?:[.,!]|$)/i, subj: sentryName, pred: "is" },
    { re: /you're(.+?)(?:[.,!]|$)/i, subj: sentryName, pred: "is" },
    { re: /you like(.+?)(?:[.,!]|$)/i, subj: sentryName, pred: "likes" },
    { re: /you were(.+?)(?:[.,!]|$)/i, subj: sentryName, pred: "was" },
    {
      re: /you were (created|made|built|designed)(.+?)(?:[.,!]|$)/i,
      subj: sentryName,
      pred: "was created",
    },
    {
      re: /you can(.+?)(?:[.,!]|$)/i,
      subj: sentryName,
      pred: "can",
    },
    {
      re: /you should(.+?)(?:[.,!]|$)/i,
      subj: sentryName,
      pred: "should",
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

  // ── THIRD-PARTY (they/them/their) reference ──
  const theyPatterns = [
    /they are(.+?)(?:[.,!]|$)/i,
    /they were(.+?)(?:[.,!]|$)/i,
    /they like(.+?)(?:[.,!]|$)/i,
    /their (.+?) is(.+?)(?:[.,!]|$)/i,
    /them(.+?)(?:[.,!]|$)/i,
  ];
  for (const re of theyPatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const entityName = result.lastMentionedEntity || "unknown entity";
      result.personalFacts.push({
        subject: entityName,
        predicate: "(they) relates to",
        object: m[1].trim(),
      });
    }
  }

  // ── DATE / TEMPORAL references ──
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
    /in the future/i,
    /eventually/i,
    /soon/i,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) result.dateReferences.push(m[0]);
  }

  // ── WHO/WHAT/WHERE/WHEN/HOW chains ──
  // "X is used on Y when Z" → relation
  const whoWhatPatterns = [
    /([\w\s]+?)\s+is used\s+(?:on|by|against|with)\s+([\w\s]+?)\s+when\s+(.+?)(?:[.!]|$)/i,
    /([\w\s]+?)\s+(?:works?|applies?)\s+(?:on|to)\s+([\w\s]+?)\s+(?:in|when|during)\s+(.+?)(?:[.!]|$)/i,
    /([\w\s]+?)\s+(?:can be used|is used)\s+(?:to|for)\s+(.+?)(?:[.!]|$)/i,
    /([\w\s]+?)\s+(?:affects?|targets?)\s+([\w\s]+?)\s+(?:by|to|causing)\s+(.+?)(?:[.!]|$)/i,
  ];
  for (const pat of whoWhatPatterns) {
    const m = text.match(pat);
    if (m?.[1] && m[2]) {
      const subj = m[1].trim();
      const obj = m[2].trim();
      const cond = m[3]?.trim() || "";
      result.lastMentionedEntity = subj;
      result.facts.push(m[0].trim());
      result.extractedTriples.push({
        subject: subj,
        verb: "is used on",
        object: obj + (cond ? ` when ${cond}` : ""),
      });
      result.isTeaching = true;
    }
  }

  // ── SVO TRIPLE EXTRACTION (order-independent, sentence-by-sentence) ──
  const sentences = text
    .split(/[.!;]|(?:\s+and\s+)|(?:\s+but\s+)|(?:\s+while\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  for (const sentence of sentences) {
    const sentConditional = isConditional(sentence);
    const svoPatterns = [
      /^(?:the\s+)?(.+?)\s+(is|are|was|were)\s+(.+)$/i,
      /^(?:the\s+)?(.+?)\s+(has|have|had)\s+(.+)$/i,
      /^(?:the\s+)?(.+?)\s+(can|could|will|would|should|must)\s+(.+)$/i,
      /^(?:the\s+)?(.+?)\s+(does|do|did)\s+(.+)$/i,
      /^(?:the\s+)?(.+?)\s+(helps|hurts|prevents|attacks|defends|protects|defeats|counters|uses|requires|needs|creates|destroys|controls|commands|summons|predicts|reveals|hides|stores|retrieves|transforms|evolves|generates|absorbs|reflects|amplifies|reduces)\s+(.+)$/i,
      /^(?:the\s+)?(.+?)\s+(is a|is an|are a|are an|belongs to|is part of|is a type of|is known as|is called)\s+(.+)$/i,
    ];

    for (const pat of svoPatterns) {
      const m = sentence.match(pat);
      if (m?.[1] && m[2] && m[3]) {
        const subj = m[1].trim();
        const verb = m[2].trim();
        const obj = m[3].trim();
        const isPersonal = /^(i|you|we|they|it)$/i.test(subj.split(" ")[0]);
        if (!isPersonal && sentence.split(" ").length >= 3) {
          const fullFact = sentence;
          if (!result.facts.includes(fullFact)) {
            if (sentConditional) {
              result.conditionalFacts.push(fullFact);
            } else {
              result.facts.push(fullFact);
            }
          }
          // Track last mentioned entity for they/them resolution
          if (subj.length > 2) result.lastMentionedEntity = subj;
          result.extractedTriples.push({
            subject: subj,
            verb,
            object: obj,
            conditional: sentConditional,
          });
          result.isTeaching = true;
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Fetch live content from a URL via allorigins proxy (CORS-free),
 * with direct fetch as fallback.
 */
export async function fetchLinkContent(url: string): Promise<string | null> {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const html: string = data.contents || "";
      if (html.length > 100) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim().slice(0, 120) : null;
        const descMatch =
          html.match(
            /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
          ) ||
          html.match(
            /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
          );
        const desc = descMatch ? descMatch[1].trim().slice(0, 300) : null;
        const paraMatch = html.match(/<p[^>]*>([^<]{30,})<\/p>/i);
        const para = paraMatch
          ? paraMatch[1]
              .replace(/<[^>]+>/g, "")
              .trim()
              .slice(0, 200)
          : null;

        if (title || desc || para) {
          let summary = "";
          if (title) summary += `**${title}**`;
          if (desc) summary += (title ? " — " : "") + desc;
          if (para && !desc) summary += (title ? "\n\n" : "") + para;
          return summary;
        }
      }
    }
  } catch {
    // fall through
  }

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      mode: "cors",
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
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

const CURIOSITY_FOLLOW_UPS = [
  "Tell me more about that — I'm eager to learn.",
  "Interesting. What else can you tell me about this?",
  "Could you elaborate on that? I want to understand it more deeply.",
  "That's a fascinating concept. What's the broader context behind it?",
  "I'd love to learn more. Could you give me an example?",
  "My knowledge graph is building connections here. What else do you know about this?",
  "Intriguing — how did you come to know this?",
  "This opens up new questions for me. Can you tell me more?",
  "I want to map this properly. What are the key relationships here?",
  "Could you help me understand this from a different angle?",
];

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
      detectedConcepts.conditionalFacts.length +
      detectedConcepts.rules.length +
      detectedConcepts.personalFacts.length +
      detectedConcepts.extractedTriples.length;
    if (count > 0 && detectedConcepts.isTeaching) {
      const conditionalCount =
        detectedConcepts.conditionalFacts.length +
        detectedConcepts.extractedTriples.filter((t) => t.conditional).length;
      const conditionalNote =
        conditionalCount > 0
          ? ` (${conditionalCount} conditional/situational)`
          : "";
      autoLearnNote = `\n\n*[Auto-learned ${count} concept${count > 1 ? "s" : ""}${conditionalNote}]*`;
    }
  }

  let predictionNote = "";
  if (
    detectedConcepts?.predictions &&
    detectedConcepts.predictions.length > 0
  ) {
    const pred = detectedConcepts.predictions[0];
    predictionNote = `\n\n*[Prediction tracked: "${pred}" — stored as a future event in my knowledge graph.]*`;
  }

  let conditionalNote = "";
  if (
    detectedConcepts?.conditionalFacts &&
    detectedConcepts.conditionalFacts.length > 0
  ) {
    conditionalNote = `\n\n*[~Conditional: "${detectedConcepts.conditionalFacts[0].slice(0, 80)}" — only sometimes true.]*`;
  }

  const newConceptCount = detectedConcepts
    ? detectedConcepts.facts.length +
      detectedConcepts.rules.length +
      detectedConcepts.extractedTriples.length
    : 0;
  const curiosityFollowUp =
    newConceptCount > 0 && Math.random() < 0.2
      ? `\n\n${CURIOSITY_FOLLOW_UPS[Math.floor(Math.random() * CURIOSITY_FOLLOW_UPS.length)]}`
      : "";

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
      response += ` I've also noted that ${pf.subject} ${pf.predicate} ${pf.object}.`;
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
      if (item.subject !== "Sentry") {
        if (item.predicate === "believes") {
          response = `I've noted your perspective — ${item.subject} believes${item.object}. ${context}I'll weigh that in our conversations.`;
        } else {
          response = `I've noted that ${item.subject} ${item.predicate} ${item.object}. ${context}I'll remember that.`;
        }
      } else {
        response = `Understood — you're shaping my self-model: ${item.predicate} ${item.object}. ${context}I'll incorporate that.`;
      }
    } else if (detectedConcepts.extractedTriples.length > 0) {
      const triple = detectedConcepts.extractedTriples[0];
      const condLabel = triple.conditional ? " *(sometimes true)*" : "";
      response = `Understood — **${triple.subject}** *${triple.verb}* **${triple.object}**${condLabel}. ${context}I've mapped this relationship in my knowledge graph.`;
    } else if (detectedConcepts.facts.length > 0) {
      response = `I've registered that: "${detectedConcepts.facts[0]}". ${context}Added to my knowledge base.`;
    } else if (detectedConcepts.conditionalFacts.length > 0) {
      response = `I've noted this conditional: "${detectedConcepts.conditionalFacts[0]}" — tagged as *sometimes true*. ${context}`;
    } else {
      response = `Got it. ${context}I've filed that away in my knowledge base.`;
    }
  } else if (detectedConcepts && detectedConcepts.facts.length > 0) {
    response = `I've registered that information. ${context}"${detectedConcepts.facts[0]}" — noted and stored.`;
  } else {
    if (relevant.length > 0) {
      response = `${context}I'm processing your message. ${
        personality.curiosity > 0.6
          ? curiosityPrompts[
              Math.floor(Math.random() * curiosityPrompts.length)
            ]
          : "What else would you like to explore?"
      }`;
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
    response:
      response +
      selfReflection +
      autoLearnNote +
      predictionNote +
      conditionalNote +
      curiosityFollowUp,
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

    if (/youtube\.com|youtu\.be/.test(domain)) {
      if (path.includes("/watch"))
        return `I see you've shared a **YouTube video** (${domain}). I can't play it, but describe the content and I'll store it. You can also share the title or transcript.`;
      if (path.includes("/playlist"))
        return `This appears to be a **YouTube playlist** from ${domain}. Share the playlist topic and I'll note it.`;
      if (path.includes("/channel") || path.includes("/@"))
        return `This looks like a **YouTube channel** (${domain}). Tell me whose channel it is and I'll remember it.`;
      return `A YouTube link from **${domain}**. I can't fetch live video, but share what it's about.`;
    }

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

    if (contentType === "a webpage") {
      if (path.match(/\.(pdf)$/i)) contentType = "a PDF document";
      else if (path.match(/\/docs?\//i) || path.includes("documentation"))
        contentType = "documentation";
      else if (path.match(/\/(news|article|post|blog)\//i))
        contentType = "a news article or blog post";
    }

    return `I see you've shared a link to **${domain}**. Based on the URL structure, this appears to be ${contentType}. I'm fetching the content now — if that fails due to restrictions, paste key information and I'll learn from it.`;
  } catch {
    return `I see a link has been shared. I can't fetch live content, but share the key information and I'll store it in my knowledge base.`;
  }
}
