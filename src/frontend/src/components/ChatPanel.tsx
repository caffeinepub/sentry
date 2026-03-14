import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  Copy,
  ExternalLink,
  Image,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  SmilePlus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useAddChatMessage,
  useAddCustomEmoji,
  useAddCustomGif,
  useAddMemory,
  useAddRule,
  useAddTimelineEntry,
  useClearChatMessages,
  useDeleteCustomEmoji,
  useDeleteCustomGif,
  useGetChatMessages,
  useGetCurrentUser,
  useGetCustomEmojis,
  useGetCustomGifs,
  useGetMemories,
  useGetPersonality,
  useGetRules,
  useGetSentryAvatar,
  useGetTimeline,
  useGetUserAvatar,
  useGetUserMemories,
  useSetSentryAvatar,
  useSetUserAvatar,
  useUpdatePersonality,
} from "../hooks/useQueries";
import type { Attachment, ChatMessage } from "../types/sentry";
import {
  buildIdentityResponse,
  buildReasoningChain,
  detectConceptsFromNaturalLanguage,
  detectCorrectionIntent,
  fetchLinkContent,
  fuzzyStartsWith,
  generateAIResponse,
  interpretLink,
  interpretMediaAttachment,
} from "../utils/aiEngine";
import {
  getAttachmentFromCache,
  loadAttachment,
  storeAttachment,
} from "../utils/attachmentStore";
import { getCurrentUser, isClass6 } from "../utils/localAuth";
import {
  type LocalEmoji,
  type LocalGif,
  addLocalEmoji,
  addLocalGif,
  clearChatMessages,
  getChatMessages,
  getLocalEmojis,
  getLocalGifs,
  removeLocalEmoji,
  removeLocalGif,
  saveChatMessages,
} from "../utils/localDB";
import PersonalityBars from "./PersonalityBars";
import TimelinePanel from "./TimelinePanel";

const DEFAULT_PERSONALITY = {
  curiosity: 0.5,
  friendliness: 0.5,
  analytical: 0.5,
};

const EMOJI_LIST = [
  "😀",
  "😂",
  "🥰",
  "😎",
  "🤔",
  "😮",
  "😅",
  "🙃",
  "😍",
  "🤩",
  "😤",
  "😢",
  "😡",
  "🤯",
  "😴",
  "👍",
  "👎",
  "👏",
  "🙌",
  "🤝",
  "✌️",
  "🤞",
  "💪",
  "🫡",
  "👀",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "🔥",
  "✨",
  "⭐",
  "🌟",
  "💫",
  "🎯",
  "🚀",
  "🧠",
  "💡",
  "🔑",
  "🏆",
  "🎉",
  "🌙",
  "☀️",
  "⚡",
  "🌈",
  "🎵",
  "🎶",
  "📚",
  "🔬",
  "💻",
  "🤖",
  "😼",
  "🦁",
  "🐺",
  "🦊",
  "🐉",
  "🌸",
  "🍕",
  "☕",
  "🍷",
  "🌍",
];

// ── Per-profile helpers ─────────────────────────────────────────────────────
function getActiveProfileId(): string {
  return localStorage.getItem("sentry_active_profile") || "default";
}

function getAiNameKey(): string {
  return `sentry_ai_name_${getActiveProfileId()}`;
}

function getAiAvatarKey(): string {
  return `sentry_ai_avatar_${getActiveProfileId()}`;
}

// ── Conversations ──────────────────────────────────────────────────────────
interface Conversation {
  id: string;
  name: string;
  createdAt: number;
}

function getConvListKey(username: string): string {
  const pid = getActiveProfileId();
  return `sentry_conv_list_${username}_${pid}`;
}

function getActiveConvKey(username: string): string {
  const pid = getActiveProfileId();
  return `sentry_active_conv_${username}_${pid}`;
}

function getConvMsgKey(username: string, convId: string): string {
  const pid = getActiveProfileId();
  if (convId === "default") return `sentry_chat_${username}_${pid}`;
  return `sentry_conv_${username}_${pid}_${convId}`;
}

function loadConversations(username: string): Conversation[] {
  try {
    const raw = localStorage.getItem(getConvListKey(username));
    if (!raw)
      return [{ id: "default", name: "Main Chat", createdAt: Date.now() }];
    return JSON.parse(raw);
  } catch {
    return [{ id: "default", name: "Main Chat", createdAt: Date.now() }];
  }
}

function saveConversations(username: string, convs: Conversation[]): void {
  localStorage.setItem(getConvListKey(username), JSON.stringify(convs));
}

function getActiveConvId(username: string): string {
  return localStorage.getItem(getActiveConvKey(username)) || "default";
}

function setActiveConvId(username: string, convId: string): void {
  localStorage.setItem(getActiveConvKey(username), convId);
}

function loadConvMessages(username: string, convId: string): ChatMessage[] {
  try {
    const key = getConvMsgKey(username, convId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw, (_k, v) => {
      if (typeof v === "string" && v.startsWith("__bigint__"))
        return BigInt(v.slice(10));
      return v;
    });
  } catch {
    return [];
  }
}

function saveConvMessages(
  username: string,
  convId: string,
  messages: ChatMessage[],
): void {
  const key = getConvMsgKey(username, convId);
  // Always store all attachment data: URLs in IDB for reliable persistence.
  // localStorage only holds compact idb: reference keys, avoiding quota issues.
  const refMessages = messages.map((msg) => ({
    ...msg,
    attachments: (msg.attachments || []).map((att) => {
      if (att.url?.startsWith("data:")) {
        const attKey = `att_${msg.id}_${att.name || "file"}`;
        // storeAttachment seeds the in-memory cache synchronously, then writes to IDB
        storeAttachment(attKey, att.url).catch(console.warn);
        return { ...att, url: `idb:${attKey}` };
      }
      return att;
    }),
  }));
  try {
    localStorage.setItem(
      key,
      JSON.stringify(refMessages, (_k, v) =>
        typeof v === "bigint" ? `__bigint__${v}` : v,
      ),
    );
  } catch {
    // Still too large (shouldn't happen with idb: refs) — save without attachments
    try {
      const noAttach = messages.map((msg) => ({ ...msg, attachments: [] }));
      localStorage.setItem(
        key,
        JSON.stringify(noAttach, (_k, v) =>
          typeof v === "bigint" ? `__bigint__${v}` : v,
        ),
      );
    } catch {
      // nothing we can do
    }
  }
}

function clearConvMessages(username: string, convId: string): void {
  const key = getConvMsgKey(username, convId);
  localStorage.removeItem(key);
}

/** Returns true if the current user is allowed to teach global memories/rules. */
function canTeachGlobal(): boolean {
  const username = getCurrentUser() || "";
  if (!username) return false;
  if (isClass6(username)) return true;
  const profileId = getActiveProfileId();
  try {
    const raw = localStorage.getItem(`sentry_ai_trainers_${profileId}`);
    const trainers: string[] = raw ? JSON.parse(raw) : [];
    return trainers.some((t) => t.toLowerCase() === username.toLowerCase());
  } catch {
    return false;
  }
}

/** Analyze image data URL via canvas to generate a description. */
async function analyzeImageDataUrl(
  dataUrl: string,
  type: "gif" | "image",
  width?: number,
  height?: number,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const w = img.naturalWidth || width || 0;
      const h = img.naturalHeight || height || 0;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(w, 120);
        canvas.height = Math.min(h, 120);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(
            `This ${type === "gif" ? "animated GIF" : "image"} is ${w}×${h}px.`,
          );
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        // Sample every 4th pixel for more coverage
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let totalBright = 0;
        let hueCounts = new Array(12).fill(0); // 12 buckets of 30° each
        let sampleCount = 0;

        for (let i = 0; i < pixels.length; i += 16) {
          // step by 4 pixels (4 channels each)
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          totalR += r;
          totalG += g;
          totalB += b;
          totalBright += (r + g + b) / 3;
          sampleCount++;

          // Convert RGB to HSL to get hue
          const rn = r / 255;
          const gn = g / 255;
          const bn = b / 255;
          const max = Math.max(rn, gn, bn);
          const min = Math.min(rn, gn, bn);
          const l = (max + min) / 2;
          const s =
            max === min
              ? 0
              : l > 0.5
                ? (max - min) / (2 - max - min)
                : (max - min) / (max + min);
          if (s > 0.15) {
            // only count saturated pixels for hue
            let h = 0;
            if (max === rn) h = (((gn - bn) / (max - min) + 6) % 6) * 60;
            else if (max === gn) h = ((bn - rn) / (max - min) + 2) * 60;
            else h = ((rn - gn) / (max - min) + 4) * 60;
            hueCounts[Math.floor(h / 30) % 12]++;
          }
        }

        if (sampleCount === 0) {
          resolve(
            `Received ${type === "gif" ? "an animated GIF" : "an image"}.`,
          );
          return;
        }

        const avgR = totalR / sampleCount;
        const avgG = totalG / sampleCount;
        const avgB = totalB / sampleCount;
        const avgBright = totalBright / sampleCount;

        // Detect dominant hue
        const dominantBucket = hueCounts.indexOf(Math.max(...hueCounts));
        const totalSaturated = hueCounts.reduce((a, b) => a + b, 0);
        const avgRn = avgR / 255;
        const avgGn = avgG / 255;
        const avgBn = avgB / 255;
        const maxC = Math.max(avgRn, avgGn, avgBn);
        const minC = Math.min(avgRn, avgGn, avgBn);
        const avgSat =
          maxC === minC ? 0 : (maxC - minC) / (1 - Math.abs(maxC + minC - 1));

        let colorDesc = "neutral";
        if (avgSat < 0.12 || totalSaturated < sampleCount * 0.05) {
          colorDesc = "black and white / grayscale";
        } else {
          const hue = dominantBucket * 30;
          if (hue >= 330 || hue < 30) colorDesc = "red tones";
          else if (hue < 60) colorDesc = "orange tones";
          else if (hue < 90) colorDesc = "yellow/orange tones";
          else if (hue < 150) colorDesc = "green tones";
          else if (hue < 210) colorDesc = "cyan/teal tones";
          else if (hue < 270) colorDesc = "blue tones";
          else colorDesc = "purple/pink tones";
        }

        const lightDesc =
          avgBright > 210
            ? "bright/daytime scene"
            : avgBright > 160
              ? "well-lit scene"
              : avgBright > 90
                ? "mid-toned scene"
                : avgBright > 40
                  ? "dark/indoor scene"
                  : "dark/night scene";

        const prefix =
          type === "gif"
            ? "This animated GIF appears to show"
            : "This appears to be";
        resolve(
          `${prefix} a ${lightDesc} with ${colorDesc}, captured at ${w}×${h}.`,
        );
      } catch {
        resolve(
          `This ${type === "gif" ? "animated GIF" : "image"} is ${w}×${h}px.`,
        );
      }
    };
    img.onerror = () =>
      resolve(`Received ${type === "gif" ? "an animated GIF" : "an image"}.`);
    img.src = dataUrl;
  });
}

/** Generate media-type-specific AI response for an uploaded file. */
async function generateMediaResponse(
  file: File,
  dataUrl: string,
  type: Attachment["type"],
): Promise<string> {
  const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");

  if (type === "gif" || type === "image") {
    return analyzeImageDataUrl(dataUrl, type);
  }

  if (type === "audio") {
    const mood = /sad|cry|tears|lament|grief/i.test(name)
      ? "melancholic and emotional"
      : /happy|joy|upbeat|dance|party|fun/i.test(name)
        ? "upbeat and energetic"
        : /calm|relax|peace|ambient|sleep|soft/i.test(name)
          ? "calm and relaxing"
          : /intense|battle|epic|power|war/i.test(name)
            ? "intense and powerful"
            : /love|romance|tender/i.test(name)
              ? "romantic and tender"
              : "expressive";
    return `Based on the title "${name}", this audio feels ${mood}. Tell me more about what you'd like to know.`;
  }

  if (type === "video") {
    const topic = /tutorial|how.?to|learn|guide|course/i.test(name)
      ? "an instructional tutorial"
      : /music|song|concert|live|performance/i.test(name)
        ? "a music performance"
        : /game|play|gaming|stream/i.test(name)
          ? "gaming content"
          : /vlog|day|life|daily/i.test(name)
            ? "a personal vlog"
            : /news|report|documentary/i.test(name)
              ? "documentary or news content"
              : "video content";
    return `I've received "${name}". Based on the title, this looks like ${topic}. What aspects would you like to explore?`;
  }

  if (file.type === "application/pdf") {
    return `I've received "${file.name}". This appears to be a PDF document. Ask me to summarize it or discuss specific topics from it.`;
  }

  return interpretMediaAttachment(type, file.name, file.type);
}

function renderContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `part-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="text-gold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={key} className="text-muted-foreground italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="bg-secondary px-1 rounded text-gold font-mono text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return (
      <span key={key}>
        {part.split("\n").map((line, j, arr) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable index
          <span key={`${key}-${j}`}>
            {line}
            {j < arr.length - 1 ? <br /> : null}
          </span>
        ))}
      </span>
    );
  });
}

function CodeBlock({
  content,
  filename,
}: { content: string; filename?: string }) {
  const [code, setCode] = useState(content);
  const [showPreview, setShowPreview] = useState(false);
  const isHtml = /\.(html|htm)$/i.test(filename || "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => toast.success("Copied!"));
  };

  return (
    <div className="mt-2 w-full max-w-lg">
      <div className="flex items-center justify-between mb-1">
        {filename && (
          <span className="text-[9px] font-mono text-gold/50 tracking-widest">
            {filename}
          </span>
        )}
        <div className="flex gap-1 ml-auto">
          {isHtml && (
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center gap-1 text-[9px] font-mono text-gold/70 hover:text-gold px-2 py-0.5 rounded border border-gold/20 hover:border-gold/50 transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              {showPreview ? "EDIT" : "PREVIEW"}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[9px] font-mono text-gold/70 hover:text-gold px-2 py-0.5 rounded border border-gold/20 hover:border-gold/50 transition-colors"
          >
            <Copy className="w-2.5 h-2.5" />
            COPY
          </button>
        </div>
      </div>
      {showPreview && isHtml ? (
        <iframe
          srcDoc={code}
          className="w-full h-64 rounded border border-gold/30 bg-white"
          sandbox="allow-scripts"
          title="HTML Preview"
        />
      ) : (
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono text-xs bg-black border border-gold/30 rounded p-2 w-full resize-y text-gold/90 focus:outline-none focus:border-gold/60 min-h-[120px]"
          spellCheck={false}
        />
      )}
    </div>
  );
}

function AttachmentDisplay({ attachment }: { attachment: Attachment }) {
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (!attachment.url) return "";
    if (attachment.url.startsWith("idb:")) {
      return getAttachmentFromCache(attachment.url.slice(4)) ?? "";
    }
    return attachment.url;
  });

  useEffect(() => {
    if (attachment.url?.startsWith("idb:")) {
      const key = attachment.url.slice(4);
      const cached = getAttachmentFromCache(key);
      if (cached) {
        setResolvedUrl(cached);
      } else {
        loadAttachment(key).then((data) => {
          if (data) setResolvedUrl(data);
        });
      }
    } else {
      setResolvedUrl(attachment.url || "");
    }
  }, [attachment.url]);

  if (attachment.type === "code") {
    return (
      <CodeBlock
        content={attachment.codeContent || attachment.url || ""}
        filename={attachment.name}
      />
    );
  }

  if (attachment.type === "gif") {
    const displayUrl =
      resolvedUrl ||
      (attachment.url?.startsWith("data:") ? attachment.url : "") ||
      "";
    if (!displayUrl)
      return (
        <span className="text-xs text-muted-foreground font-mono italic">
          [GIF loading…]
        </span>
      );
    return (
      <img
        src={displayUrl}
        alt={attachment.name || "GIF"}
        loading="eager"
        decoding="async"
        className="max-w-xs max-h-48 rounded border border-border mt-1"
        style={{ display: "block", imageRendering: "auto" }}
      />
    );
  }

  if (attachment.type === "image") {
    if (!resolvedUrl)
      return (
        <span className="text-xs text-muted-foreground font-mono italic">
          [image loading…]
        </span>
      );
    return (
      <img
        src={resolvedUrl}
        alt={attachment.name || "attachment"}
        className="max-w-xs max-h-48 rounded border border-border object-contain mt-1"
      />
    );
  }

  if (attachment.type === "audio") {
    return (
      <audio
        controls
        src={resolvedUrl || attachment.url}
        className="mt-1 max-w-xs"
      >
        <track kind="captions" />
      </audio>
    );
  }

  if (attachment.type === "video") {
    return (
      <video
        controls
        src={resolvedUrl || attachment.url}
        className="mt-1 max-w-xs max-h-36 rounded border border-border"
      >
        <track kind="captions" />
      </video>
    );
  }

  if (attachment.type === "link") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gold underline text-sm mt-1 block hover:text-gold/80"
      >
        {attachment.name || attachment.url}
      </a>
    );
  }

  return (
    <a
      href={resolvedUrl || attachment.url}
      download={attachment.name}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gold mt-1 border border-border rounded px-2 py-1 w-fit"
    >
      <Paperclip className="w-3 h-3" />
      {attachment.name || "Download file"}
    </a>
  );
}

function getBadgeClass(commandType: string): string {
  switch (commandType) {
    case "teach":
      return "badge-knowledge";
    case "rule":
      return "badge-rule";
    case "history":
      return "badge-history";
    case "correction":
      return "badge-correction";
    case "prediction":
      return "badge-prediction";
    default:
      return "badge-personal";
  }
}

export default function ChatPanel() {
  const [convId, setConvId] = useState<string>(() => {
    const u = getCurrentUser() || "";
    return getActiveConvId(u);
  });
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const u = getCurrentUser() || "";
    return loadConversations(u);
  });
  const [showConvMenu, setShowConvMenu] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [convNameDraft, setConvNameDraft] = useState("");
  // Inline rename for current chat (in the header bar)
  const [renamingCurrentChat, setRenamingCurrentChat] = useState(false);
  const [currentChatNameDraft, setCurrentChatNameDraft] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const u = getCurrentUser() || "";
    const cid = getActiveConvId(u);
    return loadConvMessages(u, cid);
  });

  // Per-profile AI avatar — takes precedence over canister avatar
  const [perProfileAiAvatar, setPerProfileAiAvatar] = useState<string>(() => {
    return localStorage.getItem(getAiAvatarKey()) || "";
  });

  // Resolve idb: attachment refs in messages loaded from localStorage
  useEffect(() => {
    const u = getCurrentUser() || "";
    const rawMsgs = loadConvMessages(u, convId);
    const hasIdbRefs = rawMsgs.some((m) =>
      (m.attachments || []).some((a) => a.url?.startsWith("idb:")),
    );
    if (!hasIdbRefs) return;
    (async () => {
      const resolved = await Promise.all(
        rawMsgs.map(async (msg) => {
          if (!(msg.attachments || []).some((a) => a.url?.startsWith("idb:")))
            return msg;
          const attachments = await Promise.all(
            (msg.attachments || []).map(async (att) => {
              if (!att.url?.startsWith("idb:")) return att;
              const data = await loadAttachment(att.url.slice(4));
              return data ? { ...att, url: data } : att;
            }),
          );
          return { ...msg, attachments };
        }),
      );
      const resolvedMap = new Map(resolved.map((m) => [m.id, m]));
      setMessages((prev) => prev.map((m) => resolvedMap.get(m.id) ?? m));
    })();
  }, [convId]);

  // Re-initialize conversations when the active AI profile changes
  useEffect(() => {
    const reloadForProfile = () => {
      const u = getCurrentUser() || "";
      const newConvId = getActiveConvId(u);
      setConversations(loadConversations(u));
      setConvId(newConvId);
      setMessages(loadConvMessages(u, newConvId));
      // Update AI name and avatar for the new profile
      const newPid = localStorage.getItem("sentry_active_profile") || "default";
      setAiDisplayName(
        localStorage.getItem(`sentry_ai_name_${newPid}`) || "SENTRY",
      );
      setPerProfileAiAvatar(
        localStorage.getItem(`sentry_ai_avatar_${newPid}`) || "",
      );
      // Resolve idb: refs in new profile messages
      const newMsgs = loadConvMessages(u, newConvId);
      const hasIdb = newMsgs.some((m) =>
        (m.attachments || []).some((a) => a.url?.startsWith("idb:")),
      );
      if (hasIdb) {
        (async () => {
          const resolved = await Promise.all(
            newMsgs.map(async (msg) => {
              if (
                !(msg.attachments || []).some((a) => a.url?.startsWith("idb:"))
              )
                return msg;
              const attachments = await Promise.all(
                (msg.attachments || []).map(async (att) => {
                  if (!att.url?.startsWith("idb:")) return att;
                  const data = await loadAttachment(att.url.slice(4));
                  return data ? { ...att, url: data } : att;
                }),
              );
              return { ...msg, attachments };
            }),
          );
          const resolvedMap = new Map(resolved.map((m) => [m.id, m]));
          setMessages((prev) => prev.map((m) => resolvedMap.get(m.id) ?? m));
        })();
      }
    };
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sentry_active_profile") reloadForProfile();
    };
    const handleCustomProfileChange = () => reloadForProfile();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "sentry_profile_changed",
      handleCustomProfileChange,
    );
    const handleNameChange = () => {
      const pid = localStorage.getItem("sentry_active_profile") || "default";
      setAiDisplayName(
        localStorage.getItem(`sentry_ai_name_${pid}`) || "SENTRY",
      );
    };
    const handleAvatarChange2 = () => {
      const pid = localStorage.getItem("sentry_active_profile") || "default";
      setPerProfileAiAvatar(
        localStorage.getItem(`sentry_ai_avatar_${pid}`) || "",
      );
    };
    window.addEventListener("sentry_ai_name_changed", handleNameChange);
    window.addEventListener("sentry_ai_avatar_changed", handleAvatarChange2);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "sentry_profile_changed",
        handleCustomProfileChange,
      );
      window.removeEventListener("sentry_ai_name_changed", handleNameChange);
      window.removeEventListener(
        "sentry_ai_avatar_changed",
        handleAvatarChange2,
      );
    };
  }, []);

  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [newGifUrl, setNewGifUrl] = useState("");
  const [newGifLabel, setNewGifLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [msgSearch, setMsgSearch] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const [awaitingCorrection, setAwaitingCorrection] = useState(false);
  const [correctionContext, setCorrectionContext] = useState("");
  const [awaitingConfusion, setAwaitingConfusion] = useState(false);
  const [confusedOriginalMessage, setConfusedOriginalMessage] = useState("");
  const [confusedParaphrase, setConfusedParaphrase] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const sentryAvatarInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgCountRef = useRef(0);
  const [localGifs, setLocalGifs] = useState<LocalGif[]>(() => getLocalGifs());
  const [localEmojis, setLocalEmojis] = useState<LocalEmoji[]>(() =>
    getLocalEmojis(),
  );
  const [deletedDefaultEmojis, setDeletedDefaultEmojis] = useState<Set<string>>(
    () => {
      try {
        const stored = localStorage.getItem("sentry-deleted-default-emojis");
        return stored ? new Set(JSON.parse(stored)) : new Set<string>();
      } catch {
        return new Set<string>();
      }
    },
  );

  const [aiDisplayName, setAiDisplayName] = useState<string>(() => {
    return localStorage.getItem(getAiNameKey()) || "SENTRY";
  });
  const [userDisplayName, setUserDisplayName] = useState<string>(() => {
    const u = getCurrentUser() || "";
    return localStorage.getItem(`sentry_display_name_${u}`) || u;
  });
  const [editingAiName, setEditingAiName] = useState(false);
  const [editingUserName, setEditingUserName] = useState(false);
  const [aiNameDraft, setAiNameDraft] = useState("");
  const [userNameDraft, setUserNameDraft] = useState("");

  const { data: globalMemories = [] } = useGetMemories(true);
  const { data: userMemories = [] } = useGetUserMemories();
  const { data: rules = [] } = useGetRules();
  const { data: personality = DEFAULT_PERSONALITY } = useGetPersonality();
  const { data: timeline = [] } = useGetTimeline();
  const { data: currentUsername = "USER" } = useGetCurrentUser();
  const { data: userAvatarUrl = "" } = useGetUserAvatar();
  const { data: sentryAvatarUrl = "" } = useGetSentryAvatar();

  // Effective AI avatar: per-profile local storage takes precedence over canister
  const effectiveAiAvatar = perProfileAiAvatar || sentryAvatarUrl;

  const { data: canisterMessages = [] } = useGetChatMessages();
  const { data: canisterGifs = [] } = useGetCustomGifs();
  const { data: canisterEmojis = [] } = useGetCustomEmojis();

  const addChatMessageMutation = useAddChatMessage();
  const clearChatMessagesMutation = useClearChatMessages();
  const addCustomGifMutation = useAddCustomGif();
  const deleteCustomGifMutation = useDeleteCustomGif();
  const addCustomEmojiMutation = useAddCustomEmoji();
  const deleteCustomEmojiMutation = useDeleteCustomEmoji();

  const addMemory = useAddMemory();
  const addRule = useAddRule();
  const addTimeline = useAddTimelineEntry();
  const updatePersonality = useUpdatePersonality();
  const setUserAvatar = useSetUserAvatar();
  const setSentryAvatar = useSetSentryAvatar();

  // Sync messages from canister into local state
  useEffect(() => {
    if (canisterMessages.length > 0) {
      const converted: ChatMessage[] = canisterMessages.map((m) => ({
        id: m.id.toString(),
        role: m.role as "user" | "sentry",
        name: m.name,
        content: m.content,
        attachments: (() => {
          try {
            return JSON.parse(m.attachmentsJson || "[]");
          } catch {
            return [];
          }
        })(),
        timestamp: Number(m.timestamp) / 1_000_000,
        avatarUrl: "",
      }));
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = converted.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newOnes];
      });
    }
  }, [canisterMessages]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    const u = getCurrentUser() || "";
    if (u) saveConvMessages(u, convId, messages);
  }, [messages, convId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const u = getCurrentUser() || "";
      if (u && messages.length > 0) saveConvMessages(u, convId, messages);
    }, 30_000);
    return () => clearInterval(interval);
  }, [messages, convId]);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const u = getCurrentUser() || "";
      if (u && messages.length > 0) saveConvMessages(u, convId, messages);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [messages, convId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll trigger
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, isThinking]);

  const addGif = async () => {
    if (!newGifUrl.trim()) return;
    const url = newGifUrl.trim();
    const label = newGifLabel.trim() || "GIF";
    setNewGifUrl("");
    setNewGifLabel("");
    try {
      await addCustomGifMutation.mutateAsync({ url, gifLabel: label });
      toast.success("GIF added successfully!");
    } catch (err) {
      console.error("[GIF] Canister add failed, storing locally:", err);
      const localGif = addLocalGif(url, label);
      setLocalGifs((prev) => [...prev, localGif]);
      toast.success("GIF saved locally (canister unavailable).");
    }
  };

  const removeGif = async (id: bigint | string) => {
    if (typeof id === "string") {
      removeLocalGif(id);
      setLocalGifs((prev) => prev.filter((g) => g.id !== id));
      toast.success("GIF removed.");
      return;
    }
    try {
      await deleteCustomGifMutation.mutateAsync(id);
      toast.success("GIF removed.");
    } catch {
      toast.error("Failed to remove GIF.");
    }
  };

  const insertGif = (gif: { url: string; gifLabel: string }) => {
    const msg = addMessage({
      role: "user",
      name: currentUsername,
      avatarUrl: userAvatarUrl,
      content: "",
      attachments: [{ type: "gif", url: gif.url, name: gif.gifLabel }],
    });
    persistMessage(msg);
    setShowGif(false);
  };

  const addCustomEmojiHandler = async () => {
    if (!newEmoji.trim()) return;
    const emoji = newEmoji.trim();
    setNewEmoji("");
    try {
      await addCustomEmojiMutation.mutateAsync(emoji);
      toast.success("Emoji added!");
    } catch (err) {
      console.error("[Emoji] Canister add failed, storing locally:", err);
      const localEmoji = addLocalEmoji(emoji);
      setLocalEmojis((prev) => [...prev, localEmoji]);
      toast.success("Emoji saved locally (canister unavailable).");
    }
  };

  const removeCustomEmoji = async (id: bigint | string) => {
    if (typeof id === "string") {
      removeLocalEmoji(id);
      setLocalEmojis((prev) => prev.filter((e) => e.id !== id));
      toast.success("Emoji removed.");
      return;
    }
    try {
      await deleteCustomEmojiMutation.mutateAsync(id);
      toast.success("Emoji removed.");
    } catch {
      toast.error("Failed to remove emoji.");
    }
  };

  const addMessage = useCallback(
    (msg: Omit<ChatMessage, "id" | "timestamp"> & { id?: string }) => {
      const newMsg: ChatMessage = {
        ...msg,
        id: msg.id ?? crypto.randomUUID(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newMsg]);
      return newMsg;
    },
    [],
  );

  const persistMessage = useCallback(
    (msg: ChatMessage) => {
      addChatMessageMutation
        .mutateAsync({
          role: msg.role,
          name: msg.name || "",
          content: msg.content,
          attachmentsJson: JSON.stringify(msg.attachments || []),
        })
        .catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addChatMessageMutation.mutateAsync],
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setShowEmoji(false);
    setShowGif(false);
    msgCountRef.current++;

    const userMsg = addMessage({
      role: "user",
      content: text,
      name: currentUsername,
      avatarUrl: userAvatarUrl,
    });
    persistMessage(userMsg);
    setIsThinking(true);

    try {
      const lower = text.toLowerCase().trim();
      const isAdmin = canTeachGlobal();

      if (awaitingConfusion) {
        const lower2 = text.toLowerCase().trim();
        if (
          lower2.includes("that's how i'd say it") ||
          lower2.includes("thats how id say it") ||
          lower2.includes("that's how i would say it") ||
          lower2.includes("thats how i would say it")
        ) {
          await addMemory
            .mutateAsync({
              text: `[user phrasing] ${confusedOriginalMessage}`,
              memoryType: "personal" as const,
              concepts: confusedOriginalMessage
                .split(" ")
                .filter((w) => w.length > 4)
                .slice(0, 5),
              isGlobal: false,
            })
            .catch(() => {});
          setAwaitingConfusion(false);
          setIsThinking(false);
          const sentryMsg = addMessage({
            role: "sentry",
            content: "Got it — I've stored that as how you'd express it.",
          });
          persistMessage(sentryMsg);
          return;
        }
        if (
          lower2.includes("how you would say it") ||
          lower2.includes("how you'd say it") ||
          lower2.includes("how youd say it")
        ) {
          await addMemory
            .mutateAsync({
              text: `[sentry phrasing] ${confusedParaphrase}`,
              memoryType: "personal" as const,
              concepts: confusedParaphrase
                .split(" ")
                .filter((w) => w.length > 4)
                .slice(0, 5),
              isGlobal: false,
            })
            .catch(() => {});
          setAwaitingConfusion(false);
          setIsThinking(false);
          const sentryMsg = addMessage({
            role: "sentry",
            content: "Noted — I'll remember to phrase it that way.",
          });
          persistMessage(sentryMsg);
          return;
        }
        setAwaitingConfusion(false);
      }

      if (awaitingCorrection) {
        const correction = text;
        const allMemories = [...globalMemories, ...userMemories];
        const relevant = allMemories
          .filter((m) => {
            const words = correctionContext
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 3);
            return words.some((w) => m.text.toLowerCase().includes(w));
          })
          .slice(0, 1);

        await addMemory
          .mutateAsync({
            text: correction,
            memoryType: "knowledge",
            concepts: correction
              .split(" ")
              .filter((w) => w.length > 4)
              .slice(0, 5),
            isGlobal: isAdmin,
          })
          .catch(() => {});

        setAwaitingCorrection(false);
        setCorrectionContext("");

        const correctionNote =
          relevant.length > 0
            ? ` I've also flagged the related memory: "${relevant[0].text.slice(0, 60)}..."`
            : "";

        const sentryMsg = addMessage({
          role: "sentry",
          content: `Thank you for the correction! I've updated my knowledge. *"${correction}"* has been stored as the correct information.${correctionNote}`,
          commandType: "correction",
        });
        persistMessage(sentryMsg);
        return;
      }

      if (detectCorrectionIntent(text)) {
        setAwaitingCorrection(true);
        setCorrectionContext(text);
        const sentryMsg = addMessage({
          role: "sentry",
          content:
            "I understand — what I said was wrong. Can you tell me the correct information? I'll update my knowledge.",
          commandType: "correction",
        });
        persistMessage(sentryMsg);
        return;
      }

      if (text.startsWith("TEACH:")) {
        const fact = text.slice(6).trim();
        const concepts = fact
          .split(" ")
          .filter((w) => w.length > 4)
          .slice(0, 5);
        if (isAdmin) {
          const id = await addMemory.mutateAsync({
            text: fact,
            memoryType: "knowledge",
            concepts,
            isGlobal: true,
          });
          const sentryMsg = addMessage({
            role: "sentry",
            content: `Knowledge stored globally.\n\n*"${fact}"*\n\nConcepts extracted: ${concepts.join(", ") || "none"}`,
            commandType: "teach",
            highlightedNodeIds: [id],
          });
          persistMessage(sentryMsg);
        } else {
          const id = await addMemory.mutateAsync({
            text: fact,
            memoryType: "knowledge",
            concepts,
            isGlobal: false,
          });
          const sentryMsg = addMessage({
            role: "sentry",
            content: `Added to your personal memory.\n\n*"${fact}"*\n\nConcepts extracted: ${concepts.join(", ") || "none"}`,
            commandType: "teach",
            highlightedNodeIds: [id],
          });
          persistMessage(sentryMsg);
        }
        return;
      }

      const ifThenMatch = text.match(/^IF\s+(.+)\s+THEN\s+(.+)$/i);
      if (ifThenMatch) {
        const condition = ifThenMatch[1].trim();
        const effect = ifThenMatch[2].trim();
        if (isAdmin) {
          const id = await addRule.mutateAsync({ condition, effect });
          const sentryMsg = addMessage({
            role: "sentry",
            content: `Global cause-effect rule recorded.\n\n**IF** *${condition}* **THEN** *${effect}*`,
            commandType: "rule",
            highlightedNodeIds: [id],
          });
          persistMessage(sentryMsg);
        } else {
          const id = await addMemory.mutateAsync({
            text: `IF ${condition} THEN ${effect}`,
            memoryType: "rule",
            concepts: [],
            isGlobal: false,
          });
          const sentryMsg = addMessage({
            role: "sentry",
            content: `Saved to your personal memory. Only AI trainers or Class 6 can set global rules.\n\n**IF** *${condition}* **THEN** *${effect}*`,
            commandType: "rule",
            highlightedNodeIds: [id],
          });
          persistMessage(sentryMsg);
        }
        return;
      }

      if (text.startsWith("HISTORY:")) {
        const event = text.slice(8).trim();
        const id = await addTimeline.mutateAsync({
          event,
          personalitySnapshot: personality,
        });
        const sentryMsg = addMessage({
          role: "sentry",
          content: `Timeline entry recorded.\n\n*"${event}"*`,
          commandType: "history",
          highlightedNodeIds: [id],
        });
        persistMessage(sentryMsg);
        return;
      }

      if (text.startsWith("REMEMBER:")) {
        const memory = text.slice(9).trim();
        const id = await addMemory.mutateAsync({
          text: memory,
          memoryType: "personal",
          concepts: [],
          isGlobal: false,
        });
        const sentryMsg = addMessage({
          role: "sentry",
          content: `Personal memory stored.\n\n*"${memory}"*`,
          commandType: "remember",
          highlightedNodeIds: [id],
        });
        persistMessage(sentryMsg);
        return;
      }

      if (lower.startsWith("why ") || fuzzyStartsWith(lower, "why ", 1)) {
        const query = text.slice(4).trim();
        const chain = buildReasoningChain(query, rules);
        const sentryMsg = addMessage({
          role: "sentry",
          content: chain,
          commandType: "why",
        });
        persistMessage(sentryMsg);
        return;
      }

      if (
        lower === "who are you" ||
        lower === "who are you?" ||
        fuzzyStartsWith(lower, "who are you", 2)
      ) {
        const sentryMsg = addMessage({
          role: "sentry",
          content: buildIdentityResponse(personality, timeline.length),
          commandType: "identity",
        });
        persistMessage(sentryMsg);
        return;
      }

      const detected = detectConceptsFromNaturalLanguage(
        text,
        getCurrentUser() || currentUsername,
      );

      for (const rule of detected.rules) {
        if (isAdmin) {
          await addRule
            .mutateAsync({ condition: rule.condition, effect: rule.effect })
            .catch(() => {});
        } else {
          await addMemory
            .mutateAsync({
              text: `IF ${rule.condition} THEN ${rule.effect}`,
              memoryType: "rule",
              concepts: [],
              isGlobal: false,
            })
            .catch(() => {});
        }
      }
      for (const pf of detected.personalFacts) {
        const factText = `${pf.subject} ${pf.predicate} ${pf.object}`;
        await addMemory
          .mutateAsync({
            text: factText,
            memoryType: "personal",
            concepts: [pf.object.split(" ")[0]],
            isGlobal: false,
          })
          .catch(() => {});
      }
      if (detected.isTeaching) {
        for (const fact of detected.facts) {
          const concepts = fact
            .split(" ")
            .filter((w) => w.length > 4)
            .slice(0, 5);
          await addMemory
            .mutateAsync({
              text: fact,
              memoryType: "knowledge",
              concepts,
              isGlobal: isAdmin,
            })
            .catch(() => {});
        }
      }

      for (const pred of detected.predictions) {
        await addMemory
          .mutateAsync({
            text: pred,
            memoryType: "prediction",
            concepts: pred
              .split(" ")
              .filter((w) => w.length > 4)
              .slice(0, 5),
            isGlobal: false,
          })
          .catch(() => {});
      }

      await new Promise((res) => setTimeout(res, 600 + Math.random() * 600));
      const allMemories = [...globalMemories, ...userMemories];
      const { response, personalityDelta, isConfused } = generateAIResponse(
        text,
        allMemories,
        rules,
        personality,
        msgCountRef.current,
        detected,
      );

      if (Object.keys(personalityDelta).length > 0) {
        updatePersonality.mutate({ ...personality, ...personalityDelta });
      }

      if (isConfused) {
        setAwaitingConfusion(true);
        setConfusedOriginalMessage(text);
        setConfusedParaphrase(response);
      }
      const commandType =
        detected.predictions.length > 0 ? "prediction" : undefined;
      const sentryMsg = addMessage({
        role: "sentry",
        content: response,
        commandType,
      });
      persistMessage(sentryMsg);
    } finally {
      setIsThinking(false);
    }
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const isCodeFile =
        /\.(js|ts|jsx|tsx|py|rb|html|htm|css|json|xml|sh|java|cpp|c|cs|go|rs|php|swift|kt|md)$/i.test(
          file.name,
        );
      const reader = new FileReader();
      reader.onerror = () => toast.error(`Failed to read file: ${file.name}`);

      if (isCodeFile) {
        // Read as text for editable code block
        reader.onload = (ev) => {
          const codeContent = (ev.target?.result as string) || "";
          const msgId = crypto.randomUUID();
          const userMsg = addMessage({
            id: msgId,
            role: "user",
            name: currentUsername,
            avatarUrl: userAvatarUrl,
            content: "",
            attachments: [
              {
                type: "code",
                url: "",
                name: file.name,
                mimeType: file.type,
                codeContent,
              },
            ],
          });
          persistMessage(userMsg);
          const isHtml = /\.(html|htm)$/i.test(file.name);
          const sentryMsg = addMessage({
            role: "sentry",
            content: `Here's the code from **${file.name}**. You can edit it below.${
              isHtml ? " Use the Preview button to see it rendered." : ""
            }`,
          });
          persistMessage(sentryMsg);
        };
        reader.readAsText(file);
      } else {
        reader.onload = async (ev) => {
          try {
            const dataUrl = ev.target?.result as string;
            let type: Attachment["type"] = "file";
            if (
              file.type.startsWith("image/gif") ||
              file.name.toLowerCase().endsWith(".gif")
            )
              type = "gif";
            else if (
              file.type.startsWith("image/") ||
              /\.(png|jpg|jpeg|webp|svg|bmp)$/i.test(file.name)
            )
              type = "image";
            else if (file.type.startsWith("audio/")) type = "audio";
            else if (file.type.startsWith("video/")) type = "video";

            // Pre-generate message ID so IDB key matches localStorage reference exactly.
            // Await storeAttachment so memoryCache is populated before addMessage renders.
            const msgId = crypto.randomUUID();
            const idbKey = `att_${msgId}_${file.name}`;
            await storeAttachment(idbKey, dataUrl).catch(console.warn);

            // Store the full dataUrl in the message so it renders immediately.
            // saveConvMessages replaces data: URLs with idb: keys for localStorage.
            const userMsg = addMessage({
              id: msgId,
              role: "user",
              name: currentUsername,
              avatarUrl: userAvatarUrl,
              content: "",
              attachments: [
                {
                  type,
                  url: dataUrl,
                  name: file.name,
                  mimeType: file.type,
                },
              ],
            });
            persistMessage(userMsg);

            const aiContent = await generateMediaResponse(file, dataUrl, type);
            const sentryMsg = addMessage({
              role: "sentry",
              content: aiContent,
            });
            persistMessage(sentryMsg);
          } catch (err) {
            console.error("[attach] handleFileAttach error:", err);
            toast.error(`Could not attach ${file.name}`);
          }
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = "";
  };

  const handleLinkAttach = async () => {
    const url = prompt("Enter URL:");
    if (!url?.trim()) return;
    const trimmedUrl = url.trim();

    const userMsg = addMessage({
      role: "user",
      name: currentUsername,
      avatarUrl: userAvatarUrl,
      content: "",
      attachments: [{ type: "link", url: trimmedUrl, name: trimmedUrl }],
    });
    persistMessage(userMsg);

    const fetchingMsg = addMessage({
      role: "sentry",
      content: "Looking at that link…",
    });
    persistMessage(fetchingMsg);

    let reply = "";
    try {
      const liveContent = await Promise.race([
        fetchLinkContent(trimmedUrl),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);
      if (liveContent) {
        reply = liveContent.slice(0, 600);
      } else {
        const domain = (() => {
          try {
            return new URL(trimmedUrl).hostname;
          } catch {
            return trimmedUrl;
          }
        })();
        reply =
          interpretLink(trimmedUrl) ||
          `I couldn't directly access that link due to browser restrictions, but it's from **${domain}**. Try opening it directly or paste its content here and I'll analyze it.`;
      }
    } catch {
      const domain = (() => {
        try {
          return new URL(trimmedUrl).hostname;
        } catch {
          return trimmedUrl;
        }
      })();
      reply =
        interpretLink(trimmedUrl) ||
        `I couldn't reach ${domain} — it may be offline, require login, or block browser requests. Paste the content here and I'll work with it.`;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === fetchingMsg.id ? { ...m, content: reply } : m)),
    );
    const u = getCurrentUser() || "";
    if (u) {
      const cid = convId;
      setTimeout(() => {
        setMessages((prev) => {
          saveConvMessages(u, cid, prev);
          return prev;
        });
      }, 50);
    }
  };

  const handleUserAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        await setUserAvatar.mutateAsync(dataUrl);
        toast.success("Avatar updated.");
      } catch {
        toast.error("Failed to update avatar.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSentryAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      // Save to per-profile localStorage key immediately
      const pid = getActiveProfileId();
      localStorage.setItem(`sentry_ai_avatar_${pid}`, dataUrl);
      setPerProfileAiAvatar(dataUrl);
      // Notify all panels (Header, MemoryExplorer) to refresh avatar
      window.dispatchEvent(new CustomEvent("sentry_ai_avatar_changed"));
      // Also attempt to sync to canister
      try {
        await setSentryAvatar.mutateAsync(dataUrl);
        toast.success("AI avatar updated.");
      } catch {
        toast.success("AI avatar saved locally.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setInput((v) => v + emoji);
      return;
    }
    const start = ta.selectionStart ?? input.length;
    const end = ta.selectionEnd ?? input.length;
    const newVal = input.slice(0, start) + emoji + input.slice(end);
    setInput(newVal);
    setTimeout(() => {
      ta.selectionStart = start + emoji.length;
      ta.selectionEnd = start + emoji.length;
      ta.focus();
    }, 0);
  };

  const handleClearChat = async () => {
    if (!confirmClearChat) {
      setConfirmClearChat(true);
      setTimeout(() => setConfirmClearChat(false), 4000);
      return;
    }
    const u = getCurrentUser() || "";
    if (u) clearConvMessages(u, convId);
    setMessages([]);
    setConfirmClearChat(false);
    if (convId === "default") {
      clearChatMessagesMutation.mutateAsync().catch(() => {});
    }
    toast.success("Chat history cleared. Memories preserved.");
  };

  const currentConv = conversations.find((c) => c.id === convId);
  const visibleMessages = msgSearch.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(msgSearch.toLowerCase()),
      )
    : messages;

  return (
    <div className="flex flex-col h-full relative">
      {/* Chat header bar: current chat name + rename + conv dropdown */}
      <div className="px-3 pt-1.5 pb-1 border-b border-border shrink-0 flex items-center gap-2 min-h-[36px]">
        {/* Chat name / inline rename */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setShowConvMenu((v) => !v)}
            className="text-muted-foreground hover:text-gold transition-colors shrink-0"
            title="All conversations"
            data-ocid="chat.open_modal_button"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </button>

          {renamingCurrentChat ? (
            <input
              type="text"
              value={currentChatNameDraft}
              onChange={(e) => setCurrentChatNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const u = getCurrentUser() || "";
                  const updated = conversations.map((c) =>
                    c.id === convId
                      ? { ...c, name: currentChatNameDraft.trim() || c.name }
                      : c,
                  );
                  saveConversations(u, updated);
                  setConversations(updated);
                  setRenamingCurrentChat(false);
                }
                if (e.key === "Escape") setRenamingCurrentChat(false);
              }}
              onBlur={() => setRenamingCurrentChat(false)}
              className="flex-1 bg-transparent border-b border-gold/40 text-gold font-mono text-xs focus:outline-none min-w-0"
              // biome-ignore lint/a11y/noAutofocus: needed for inline rename UX
              // biome-ignore lint/correctness/useExhaustiveDependencies: stable
              autoFocus
            />
          ) : (
            <span className="text-[10px] font-mono text-gold/70 truncate flex-1 min-w-0">
              {currentConv?.name || "Main Chat"}
            </span>
          )}

          {!renamingCurrentChat && (
            <button
              type="button"
              onClick={() => {
                setCurrentChatNameDraft(currentConv?.name || "Main Chat");
                setRenamingCurrentChat(true);
              }}
              className="shrink-0 text-muted-foreground/40 hover:text-gold transition-colors"
              title="Rename this chat"
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* Conversations dropdown */}
        {showConvMenu && (
          <div
            className="absolute top-8 left-3 z-30 bg-card border border-gold/30 rounded-lg shadow-2xl"
            style={{ minWidth: 210 }}
            data-ocid="chat.popover"
          >
            <div className="p-2">
              <p className="text-[9px] font-mono text-gold/50 tracking-widest px-2 pb-1">
                CONVERSATIONS
              </p>
              <div className="space-y-0.5 max-h-52 overflow-y-auto">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-1 rounded px-2 py-1.5 group ${
                      conv.id === convId
                        ? "bg-gold/10 border border-gold/30"
                        : "hover:bg-secondary/50"
                    }`}
                  >
                    {editingConvId === conv.id ? (
                      <input
                        type="text"
                        value={convNameDraft}
                        onChange={(e) => setConvNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const u = getCurrentUser() || "";
                            const updated = conversations.map((c) =>
                              c.id === conv.id
                                ? { ...c, name: convNameDraft.trim() || c.name }
                                : c,
                            );
                            saveConversations(u, updated);
                            setConversations(updated);
                            setEditingConvId(null);
                          }
                          if (e.key === "Escape") setEditingConvId(null);
                        }}
                        onBlur={() => setEditingConvId(null)}
                        className="flex-1 bg-transparent border-b border-gold/40 text-gold font-mono text-xs focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        className="flex-1 text-left text-xs font-mono text-foreground truncate hover:text-gold"
                        onClick={() => {
                          const u = getCurrentUser() || "";
                          setActiveConvId(u, conv.id);
                          setConvId(conv.id);
                          const msgs = loadConvMessages(u, conv.id);
                          setMessages(msgs);
                          setShowConvMenu(false);
                        }}
                        data-ocid="chat.tab"
                      >
                        {conv.id === convId ? (
                          <span className="text-gold">▶ </span>
                        ) : null}
                        {conv.name}
                      </button>
                    )}
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-gold shrink-0"
                      onClick={() => {
                        setConvNameDraft(conv.name);
                        setEditingConvId(conv.id);
                      }}
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {conversations.length > 1 && (
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => {
                          const u = getCurrentUser() || "";
                          const updated = conversations.filter(
                            (c) => c.id !== conv.id,
                          );
                          saveConversations(u, updated);
                          setConversations(updated);
                          if (conv.id === convId) {
                            const next = updated[0];
                            setActiveConvId(u, next.id);
                            setConvId(next.id);
                            setMessages(loadConvMessages(u, next.id));
                          }
                        }}
                        title="Delete"
                        data-ocid="chat.delete_button"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border mt-2 pt-2">
                <button
                  type="button"
                  className="w-full text-left text-[10px] font-mono text-gold hover:text-gold/80 px-2 py-1 flex items-center gap-1"
                  onClick={() => {
                    const u = getCurrentUser() || "";
                    const newConv: Conversation = {
                      id: `conv_${Date.now()}`,
                      name: `Chat ${conversations.length + 1}`,
                      createdAt: Date.now(),
                    };
                    const updated = [...conversations, newConv];
                    saveConversations(u, updated);
                    setConversations(updated);
                    setActiveConvId(u, newConv.id);
                    setConvId(newConv.id);
                    setMessages([]);
                    setShowConvMenu(false);
                  }}
                  data-ocid="chat.primary_button"
                >
                  <Plus className="w-3 h-3" />
                  NEW CONVERSATION
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search + clear */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowMsgSearch((v) => !v)}
            className="text-muted-foreground hover:text-gold transition-colors"
            aria-label="Toggle message search"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          {showMsgSearch && (
            <input
              type="text"
              value={msgSearch}
              onChange={(e) => setMsgSearch(e.target.value)}
              placeholder="Search…"
              className="bg-transparent border-b border-gold/30 text-gold font-mono text-xs py-0.5 w-24 focus:outline-none focus:border-gold placeholder:text-muted-foreground/40"
              data-ocid="chat.search_input"
            />
          )}
          {showMsgSearch && msgSearch && (
            <button
              type="button"
              onClick={() => setMsgSearch("")}
              className="text-muted-foreground hover:text-gold"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {awaitingCorrection && (
            <span className="text-[9px] font-mono badge-correction px-1.5 py-0.5 rounded">
              AWAITING CORRECTION
            </span>
          )}
          <button
            type="button"
            onClick={handleClearChat}
            className={`text-[10px] font-mono tracking-widest flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
              confirmClearChat
                ? "text-destructive border border-destructive/50 bg-destructive/10"
                : "text-muted-foreground hover:text-gold border border-transparent"
            }`}
            data-ocid="chat.delete_button"
          >
            <Trash2 className="w-3 h-3" />
            {confirmClearChat ? "CONFIRM CLEAR" : ""}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
        {visibleMessages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
            {msgSearch ? (
              <>
                <Search className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-xs font-mono text-muted-foreground">
                  NO MESSAGES MATCH
                </p>
              </>
            ) : (
              <>
                <div className="relative flex items-center justify-center w-32 h-32">
                  <div className="absolute inset-0 rounded-full border border-gold/10 ring-pulse" />
                  <div className="absolute inset-3 rounded-full border border-gold/15 ring-pulse-2" />
                  <div className="absolute inset-6 rounded-full border border-gold/25 ring-pulse-3" />
                  <div className="absolute inset-9 rounded-full border-2 border-gold/40 gold-glow" />
                  <span className="text-gold font-mono font-black text-xl tracking-widest gold-glow-text z-10">
                    S
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-display font-black tracking-[0.3em] text-gold gold-glow-text mb-1">
                    {aiDisplayName.toUpperCase()}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/60 tracking-[0.2em]">
                    NEURAL INTERFACE READY
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/40 mt-2">
                    type a message to begin
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {visibleMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex gap-3 flex-row group/msg"
            >
              <button
                type="button"
                className={`shrink-0 w-8 h-8 rounded-full border overflow-hidden cursor-pointer p-0 ${
                  msg.role === "user" ? "border-gold/30" : "border-gold/50"
                }`}
                onClick={() => {
                  if (msg.role === "user") {
                    avatarInputRef.current?.click();
                  } else if (
                    isClass6(getCurrentUser() || "") ||
                    canTeachGlobal()
                  ) {
                    sentryAvatarInputRef.current?.click();
                  } else {
                    toast.error(
                      "Only Class 6 or assigned trainers can change the AI avatar.",
                    );
                  }
                }}
                aria-label={
                  msg.role === "user"
                    ? "Change user avatar"
                    : "Change AI avatar"
                }
                data-ocid={
                  msg.role === "user"
                    ? "avatar.upload_button"
                    : "sentry_avatar.upload_button"
                }
              >
                {msg.role === "user" ? (
                  userAvatarUrl ? (
                    <img
                      src={userAvatarUrl}
                      alt={msg.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary text-gold">
                      <User className="w-4 h-4" />
                    </div>
                  )
                ) : effectiveAiAvatar ? (
                  <img
                    src={effectiveAiAvatar}
                    alt={aiDisplayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gold/10 text-gold text-xs font-mono">
                    {aiDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              <div className="flex flex-col gap-0.5 max-w-[80%] items-start">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono tracking-widest ${
                      msg.role === "sentry"
                        ? "text-gold"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {msg.role === "sentry"
                        ? aiDisplayName.toUpperCase()
                        : (msg.name || userDisplayName || "USER").toUpperCase()}
                      {/* AI name rename: Class 6 only. User name: always allowed */}
                      {(msg.role === "user" ||
                        isClass6(getCurrentUser() || "") ||
                        canTeachGlobal()) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (msg.role === "sentry") {
                              if (
                                !isClass6(getCurrentUser() || "") &&
                                !canTeachGlobal()
                              ) {
                                toast.error(
                                  "Only Class 6 or assigned trainers can rename the AI.",
                                );
                                return;
                              }
                              setAiNameDraft(aiDisplayName);
                              setEditingAiName(true);
                            } else {
                              setUserNameDraft(
                                userDisplayName || msg.name || "USER",
                              );
                              setEditingUserName(true);
                            }
                          }}
                          className="opacity-0 group-hover/msg:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground hover:text-gold"
                          aria-label="Edit name"
                        >
                          ✎
                        </button>
                      )}
                    </span>
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  {msg.commandType && (
                    <span
                      className={`text-[9px] px-1.5 rounded font-mono ${getBadgeClass(msg.commandType)}`}
                    >
                      {msg.commandType}
                    </span>
                  )}
                </div>
                {msg.content && (
                  <div
                    className={`px-3 py-2 rounded-lg text-sm leading-relaxed transition-all ${
                      msg.role === "user"
                        ? "bg-black border border-gold/30 text-gold"
                        : "sentry-message text-gold"
                    }`}
                  >
                    {renderContent(msg.content)}
                  </div>
                )}
                {msg.attachments?.map((att, i) => (
                  <AttachmentDisplay
                    key={`${msg.id}-att-${i}`}
                    attachment={att}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full border border-gold/50 bg-gold/10 flex items-center justify-center text-xs font-mono text-gold overflow-hidden">
              {effectiveAiAvatar ? (
                <img
                  src={effectiveAiAvatar}
                  alt={aiDisplayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                aiDisplayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="bg-card border border-gold/20 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gold"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1,
                      delay: i * 0.2,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <PersonalityBars personality={personality} />

      <div className="px-4 py-1 border-t border-border shrink-0">
        <button
          type="button"
          onClick={() => setShowTimeline((v) => !v)}
          className="text-[10px] font-mono text-muted-foreground hover:text-gold transition-colors flex items-center gap-1"
          data-ocid="timeline.toggle"
        >
          <Clock className="w-3 h-3" />
          {`TIMELINE ${showTimeline ? "▼" : "▶"}`}
        </button>
      </div>

      <TimelinePanel
        open={showTimeline}
        onClose={() => setShowTimeline(false)}
        onHighlightNodes={() => {}}
      />

      {/* AI name edit modal — Class 6 only */}
      {editingAiName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "oklch(0 0 0 / 0.7)" }}
        >
          <div className="bg-card border border-gold/40 rounded-lg p-4 shadow-2xl w-72">
            <p className="text-[10px] font-mono text-gold/60 tracking-widest mb-3">
              RENAME AI
            </p>
            <input
              type="text"
              value={aiNameDraft}
              onChange={(e) => setAiNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const name = aiNameDraft.trim() || "SENTRY";
                  setAiDisplayName(name);
                  localStorage.setItem(getAiNameKey(), name);
                  window.dispatchEvent(
                    new CustomEvent("sentry_ai_name_changed"),
                  );
                  setEditingAiName(false);
                }
                if (e.key === "Escape") setEditingAiName(false);
              }}
              className="w-full bg-input border border-gold/30 rounded px-3 py-2 text-gold font-mono text-sm focus:outline-none focus:border-gold mb-3"
              placeholder="SENTRY"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingAiName(false)}
                className="text-xs font-mono text-muted-foreground hover:text-gold px-3 py-1.5 rounded border border-border"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = aiNameDraft.trim() || "SENTRY";
                  setAiDisplayName(name);
                  localStorage.setItem(getAiNameKey(), name);
                  window.dispatchEvent(
                    new CustomEvent("sentry_ai_name_changed"),
                  );
                  setEditingAiName(false);
                }}
                className="text-xs font-mono text-black bg-gold hover:bg-gold/90 px-3 py-1.5 rounded font-bold"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User display name edit modal */}
      {editingUserName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "oklch(0 0 0 / 0.7)" }}
        >
          <div className="bg-card border border-gold/40 rounded-lg p-4 shadow-2xl w-72">
            <p className="text-[10px] font-mono text-gold/60 tracking-widest mb-3">
              RENAME PROFILE
            </p>
            <input
              type="text"
              value={userNameDraft}
              onChange={(e) => setUserNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const name = userNameDraft.trim() || currentUsername;
                  setUserDisplayName(name);
                  const u = getCurrentUser() || "";
                  if (u) localStorage.setItem(`sentry_display_name_${u}`, name);
                  setEditingUserName(false);
                }
                if (e.key === "Escape") setEditingUserName(false);
              }}
              className="w-full bg-input border border-gold/30 rounded px-3 py-2 text-gold font-mono text-sm focus:outline-none focus:border-gold mb-3"
              placeholder={currentUsername}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingUserName(false)}
                className="text-xs font-mono text-muted-foreground hover:text-gold px-3 py-1.5 rounded border border-border"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = userNameDraft.trim() || currentUsername;
                  setUserDisplayName(name);
                  const u = getCurrentUser() || "";
                  if (u) localStorage.setItem(`sentry_display_name_${u}`, name);
                  setEditingUserName(false);
                }}
                className="text-xs font-mono text-black bg-gold hover:bg-gold/90 px-3 py-1.5 rounded font-bold"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div
          className="absolute bottom-[88px] left-4 z-20 bg-card border border-gold/40 rounded-lg p-3 shadow-2xl"
          style={{ width: 300 }}
        >
          <div className="max-h-72 overflow-y-auto">
            <div className="mb-3">
              <p className="text-[9px] font-mono text-gold/50 tracking-widest mb-1">
                CUSTOM EMOJIS
              </p>
              {(canisterEmojis ?? []).length === 0 &&
              localEmojis.length === 0 ? (
                <p className="text-[10px] font-mono text-muted-foreground/50 py-1">
                  No custom emojis yet — add one below
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(canisterEmojis ?? []).map((emojiEntry) => (
                    <div
                      key={emojiEntry.id.toString()}
                      className="relative group"
                    >
                      <button
                        type="button"
                        className="text-xl hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center rounded hover:bg-gold/10"
                        onClick={() => {
                          insertEmoji(emojiEntry.emoji);
                          setShowEmoji(false);
                        }}
                      >
                        {emojiEntry.emoji}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustomEmoji(emojiEntry.id)}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive rounded-full text-destructive-foreground text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-ocid="chat.delete_button"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                  ))}
                  {localEmojis.map((emojiEntry) => (
                    <div key={emojiEntry.id} className="relative group">
                      <button
                        type="button"
                        className="text-xl hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center rounded hover:bg-gold/10"
                        onClick={() => {
                          insertEmoji(emojiEntry.emoji);
                          setShowEmoji(false);
                        }}
                      >
                        {emojiEntry.emoji}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustomEmoji(emojiEntry.id)}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive rounded-full text-destructive-foreground text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-ocid="chat.delete_button"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-gold/20 mb-2" />
            <div className="flex flex-wrap gap-1 mb-3">
              <p className="w-full text-[9px] font-mono text-gold/50 tracking-widest mb-1">
                DEFAULT EMOJIS
              </p>
              {EMOJI_LIST.filter((e) => !deletedDefaultEmojis.has(e)).map(
                (emoji) => (
                  <div key={emoji} className="relative group">
                    <button
                      type="button"
                      className="text-xl hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center rounded hover:bg-gold/10"
                      onClick={() => {
                        insertEmoji(emoji);
                        setShowEmoji(false);
                      }}
                    >
                      {emoji}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(deletedDefaultEmojis);
                        next.add(emoji);
                        setDeletedDefaultEmojis(next);
                        try {
                          localStorage.setItem(
                            "sentry-deleted-default-emojis",
                            JSON.stringify([...next]),
                          );
                        } catch {}
                      }}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive rounded-full text-destructive-foreground text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      data-ocid="chat.delete_button"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </div>
                ),
              )}
              {deletedDefaultEmojis.size > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDeletedDefaultEmojis(new Set());
                    localStorage.removeItem("sentry-deleted-default-emojis");
                  }}
                  className="text-[9px] font-mono text-gold/40 hover:text-gold transition-colors px-1"
                >
                  restore
                </button>
              )}
            </div>
          </div>
          <div className="border-t border-gold/20 pt-2 flex gap-1">
            <input
              type="text"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="Add emoji or paste..."
              className="flex-1 bg-black border border-gold/20 text-gold font-mono text-sm px-2 py-1 rounded focus:outline-none focus:border-gold/50 placeholder:text-muted-foreground/30"
              data-ocid="chat.input"
            />
            <button
              type="button"
              onClick={addCustomEmojiHandler}
              className="px-2 py-1 bg-gold/10 border border-gold/30 text-gold text-[10px] font-mono rounded hover:bg-gold/20 transition-colors"
              data-ocid="chat.primary_button"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* GIF picker */}
      {showGif && (
        <div
          className="absolute bottom-[88px] left-14 z-20 bg-card border border-gold/40 rounded-lg p-3 shadow-2xl"
          style={{ width: 300 }}
        >
          <p className="text-[10px] font-mono text-gold/60 tracking-widest mb-2">
            GIF LIBRARY
          </p>
          {addCustomGifMutation.isPending && (
            <p className="text-[10px] font-mono text-gold/60 text-center py-1 animate-pulse">
              ADDING GIF...
            </p>
          )}
          {(canisterGifs ?? []).length === 0 &&
          localGifs.length === 0 &&
          !addCustomGifMutation.isPending ? (
            <p className="text-[10px] font-mono text-muted-foreground text-center py-4">
              NO GIFS — ADD BELOW
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1 mb-3 max-h-40 overflow-y-auto">
              {(canisterGifs ?? []).map((gif) => (
                <div key={gif.id.toString()} className="relative group">
                  <button
                    type="button"
                    onClick={() => insertGif(gif)}
                    className="w-full aspect-square overflow-hidden rounded border border-gold/20 hover:border-gold/50 transition-colors"
                  >
                    <img
                      src={gif.url}
                      alt={gif.gifLabel}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGif(gif.id)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/80 border border-destructive/50 rounded text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    data-ocid="chat.delete_button"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              {localGifs.map((gif) => (
                <div key={gif.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => insertGif(gif)}
                    className="w-full aspect-square overflow-hidden rounded border border-gold/20 hover:border-gold/50 transition-colors"
                  >
                    <img
                      src={gif.url}
                      alt={gif.gifLabel}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGif(gif.id)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/80 border border-destructive/50 rounded text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    data-ocid="chat.delete_button"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-gold/20 pt-2 space-y-1.5">
            <input
              type="text"
              value={newGifUrl}
              onChange={(e) => setNewGifUrl(e.target.value)}
              placeholder="GIF URL..."
              className="w-full bg-black border border-gold/20 text-gold font-mono text-xs px-2 py-1.5 rounded focus:outline-none focus:border-gold/50 placeholder:text-muted-foreground/30"
              data-ocid="chat.input"
            />
            <input
              type="text"
              value={newGifLabel}
              onChange={(e) => setNewGifLabel(e.target.value)}
              placeholder="Label (optional)"
              className="w-full bg-black border border-gold/20 text-gold font-mono text-xs px-2 py-1.5 rounded focus:outline-none focus:border-gold/50 placeholder:text-muted-foreground/30"
            />
            <button
              type="button"
              onClick={addGif}
              disabled={addCustomGifMutation.isPending}
              className="w-full py-1.5 bg-gold/10 border border-gold/30 text-gold text-[10px] font-mono tracking-widest rounded hover:bg-gold/20 transition-colors disabled:opacity-50"
              data-ocid="chat.primary_button"
            >
              {addCustomGifMutation.isPending ? "ADDING..." : "ADD GIF"}
            </button>
          </div>
        </div>
      )}

      {awaitingCorrection && (
        <div className="px-4 py-2 bg-gold/5 border-t border-gold/40 flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-gold tracking-widest animate-pulse">
            ⟲
          </span>
          <span className="text-[10px] font-mono text-gold/90 tracking-widest">
            CORRECTION MODE — Type the correct information and press Enter
          </span>
        </div>
      )}

      <div className="px-4 pb-4 pt-2 shrink-0 border-t border-border">
        <div className="flex gap-2 items-end">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 shrink-0 text-muted-foreground hover:text-gold"
            onClick={() => fileInputRef.current?.click()}
            data-ocid="chat.upload_button"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 shrink-0 text-muted-foreground hover:text-gold"
            onClick={() => {
              setShowEmoji((v) => !v);
              setShowGif(false);
            }}
            data-ocid="chat.toggle"
          >
            <SmilePlus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 shrink-0 text-muted-foreground hover:text-gold"
            onClick={() => {
              setShowGif((v) => !v);
              setShowEmoji(false);
            }}
            data-ocid="chat.secondary_button"
          >
            <Image className="w-4 h-4" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              awaitingCorrection
                ? "Type the correct information..."
                : "Send a message, share a fact, or just chat..."
            }
            className="flex-1 min-h-[40px] max-h-32 resize-none bg-input border-border text-sm font-mono text-gold placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-ocid="chat.textarea"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="w-8 h-8 shrink-0 p-0 bg-gold hover:bg-gold/90 text-primary-foreground"
            data-ocid="chat.submit_button"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-1.5">
          <button
            type="button"
            onClick={handleLinkAttach}
            className="text-[10px] font-mono text-muted-foreground hover:text-gold transition-colors"
          >
            + LINK
          </button>
          <span className="text-[10px] font-mono text-muted-foreground/30">
            |
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/40">
            SHIFT+ENTER for newline
          </span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,audio/*,video/*,.pdf,.txt,.json,.doc,.docx,.zip,.js,.ts,.jsx,.tsx,.py,.rb,.html,.css,.xml,.sh,.java,.cpp,.c,.cs,.go,.rs,.php,.swift,.kt,.md"
        className="hidden"
        onChange={handleFileAttach}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUserAvatarChange}
      />
      <input
        ref={sentryAvatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSentryAvatarChange}
      />
    </div>
  );
}
