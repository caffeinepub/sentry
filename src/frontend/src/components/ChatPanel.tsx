import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  Image,
  Paperclip,
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
import { getCurrentUser } from "../utils/localAuth";
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
  resolveAttachmentUrls,
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

/** Returns true if the current user is allowed to teach global memories/rules */
function canTeachGlobal(): boolean {
  const u = getCurrentUser()?.toLowerCase();
  return u === "unity" || u === "syndelious";
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

function AttachmentDisplay({ attachment }: { attachment: Attachment }) {
  // Resolve idb: references to real data URLs on the fly
  const [resolvedUrl, setResolvedUrl] = useState<string>(() =>
    attachment.url?.startsWith("idb:") ? "" : attachment.url || "",
  );
  useEffect(() => {
    if (attachment.url?.startsWith("idb:")) {
      import("../utils/attachmentStore").then(({ loadAttachment }) => {
        loadAttachment(attachment.url.slice(4)).then((data) => {
          if (data) setResolvedUrl(data);
        });
      });
    } else {
      setResolvedUrl(attachment.url || "");
    }
  }, [attachment.url]);

  if (attachment.type === "gif") {
    if (!resolvedUrl)
      return (
        <span className="text-xs text-muted-foreground font-mono italic">
          [GIF loading…]
        </span>
      );
    return (
      <img
        src={resolvedUrl}
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
        className="text-gold underline text-sm mt-1 block hover:text-gold-bright"
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
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const u = getCurrentUser() || "";
    return getChatMessages(u);
  });

  // Resolve idb: attachment references back to real data URLs on initial load
  useEffect(() => {
    setMessages((prev) => {
      const hasIdb = prev.some((m) =>
        m.attachments?.some((a) => a.url?.startsWith("idb:")),
      );
      if (!hasIdb) return prev;
      resolveAttachmentUrls(prev).then((resolved) => {
        setMessages(resolved);
      });
      return prev; // keep current state until async resolves
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const { data: globalMemories = [] } = useGetMemories(true);
  const { data: userMemories = [] } = useGetUserMemories();
  const { data: rules = [] } = useGetRules();
  const { data: personality = DEFAULT_PERSONALITY } = useGetPersonality();
  const { data: timeline = [] } = useGetTimeline();
  const { data: currentUsername = "USER" } = useGetCurrentUser();
  const { data: userAvatarUrl = "" } = useGetUserAvatar();
  const { data: sentryAvatarUrl = "" } = useGetSentryAvatar();

  // Canister-backed chat, GIFs, emojis
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
        timestamp: Number(m.timestamp) / 1_000_000, // nanoseconds → ms
        avatarUrl: "",
      }));
      setMessages((prev) => {
        // Keep local messages (preserves data URLs for GIFs/images).
        // Use canister message ID as dedup key — NOT role:content, which collides
        // for GIF messages that all have content="".
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = converted.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newOnes];
      });
      // NOTE: do NOT save canister messages to localStorage here — canister
      // messages may have empty/missing attachment data for large GIFs.
      // The messages useEffect below saves the merged state correctly.
    }
    // If canister returns empty, keep localStorage messages (already initialized from there)
  }, [canisterMessages]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    const u = getCurrentUser() || "";
    if (u) {
      saveChatMessages(u, messages);
    }
  }, [messages]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const u = getCurrentUser() || "";
      if (u && messages.length > 0) {
        saveChatMessages(u, messages);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [messages]);

  // Save before page unload so refresh never loses messages
  useEffect(() => {
    const handleBeforeUnload = () => {
      const u = getCurrentUser() || "";
      if (u && messages.length > 0) {
        saveChatMessages(u, messages);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [messages]);

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
      // Add to local fallback so it's visible and deletable
      const localGif = addLocalGif(url, label);
      setLocalGifs((prev) => [...prev, localGif]);
      toast.success("GIF saved locally (canister unavailable).");
    }
  };

  const removeGif = async (id: bigint | string) => {
    // Check if it's a local gif (string id)
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
    (msg: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMsg: ChatMessage = {
        ...msg,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newMsg]);
      return newMsg;
    },
    [],
  );

  /** Persist a message to the canister in the background */
  const persistMessage = useCallback(
    (msg: ChatMessage) => {
      addChatMessageMutation
        .mutateAsync({
          role: msg.role,
          name: msg.name || "",
          content: msg.content,
          attachmentsJson: JSON.stringify(msg.attachments || []),
        })
        .catch(() => {
          // Non-fatal: message already shown optimistically
        });
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

      // --- Confusion repeat-back flow ---
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

      // --- Correction flow ---
      if (awaitingCorrection) {
        // This message IS the correction
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

        // Store the corrected memory
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
        // First step: acknowledge and ask for correct info
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
          // Non-admin: save as personal memory instead
          const id = await addMemory.mutateAsync({
            text: `IF ${condition} THEN ${effect}`,
            memoryType: "rule",
            concepts: [],
            isGlobal: false,
          });
          const sentryMsg = addMessage({
            role: "sentry",
            content: `Added to your personal memory (only Unity/Syndelious can set global rules).\n\n**IF** *${condition}* **THEN** *${effect}*`,
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

      // Store predictions as memories
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
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        let type: Attachment["type"] = "file";
        if (file.type.startsWith("image/gif")) type = "gif";
        else if (file.type.startsWith("image/")) type = "image";
        else if (file.type.startsWith("audio/")) type = "audio";
        else if (file.type.startsWith("video/")) type = "video";

        // Keep the full data URL in memory so the GIF/image shows immediately.
        // saveChatMessages will convert it to an idb: reference when persisting.
        // Also pre-store in IndexedDB in background for faster reload after refresh.
        const attUrl = dataUrl;
        try {
          const { storeAttachment } = await import("../utils/attachmentStore");
          const safeKey = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const attachKey = `att_${Date.now()}_${safeKey}`;
          storeAttachment(attachKey, dataUrl); // fire-and-forget — don't await
        } catch {
          // IndexedDB unavailable — data URL still works in-session
        }

        const userMsg = addMessage({
          role: "user",
          name: currentUsername,
          avatarUrl: userAvatarUrl,
          content: "",
          attachments: [
            { type, url: attUrl, name: file.name, mimeType: file.type },
          ],
        });
        persistMessage(userMsg);
        setTimeout(() => {
          const sentryMsg = addMessage({
            role: "sentry",
            content: interpretMediaAttachment(type, file.name, file.type),
          });
          persistMessage(sentryMsg);
        }, 400);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleLinkAttach = async () => {
    const url = prompt("Enter URL:");
    if (!url) return;
    const userMsg = addMessage({
      role: "user",
      name: currentUsername,
      avatarUrl: userAvatarUrl,
      content: "",
      attachments: [{ type: "link", url, name: url }],
    });
    persistMessage(userMsg);

    // Try to fetch live content
    const liveContent = await fetchLinkContent(url);
    const sentryResponseContent = liveContent
      ? `I fetched the content from that link. Here's what I found:\n\n${liveContent}\n\nI've stored this in my knowledge graph for our conversation.`
      : interpretLink(url);

    const sentryMsg = addMessage({
      role: "sentry",
      content: sentryResponseContent,
    });
    persistMessage(sentryMsg);
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
      try {
        await setSentryAvatar.mutateAsync(dataUrl);
        toast.success("Sentry avatar updated.");
      } catch {
        toast.error("Failed to update.");
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
    // Clear localStorage immediately
    const u = getCurrentUser() || "";
    if (u) clearChatMessages(u);
    setMessages([]);
    setConfirmClearChat(false);
    // Also attempt canister clear
    clearChatMessagesMutation.mutateAsync().catch(() => {});
    toast.success("Chat history cleared. Memories preserved.");
  };

  const visibleMessages = msgSearch.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(msgSearch.toLowerCase()),
      )
    : messages;

  return (
    <div className="flex flex-col h-full relative">
      {/* Search bar + clear chat */}
      <div className="px-4 pt-2 pb-1 border-b border-border shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowMsgSearch((v) => !v)}
          className="text-muted-foreground hover:text-gold transition-colors"
          aria-label="Toggle message search"
          data-ocid="chat.search_input"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
        {showMsgSearch && (
          <input
            type="text"
            value={msgSearch}
            onChange={(e) => setMsgSearch(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent border-b border-gold/30 text-gold font-mono text-xs py-0.5 focus:outline-none focus:border-gold placeholder:text-muted-foreground/40"
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
        <div className="ml-auto flex items-center gap-1">
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
            {confirmClearChat ? "CONFIRM CLEAR" : "CLEAR CHAT"}
          </button>
        </div>
      </div>

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
                    SENTRY
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
              className="flex gap-3 flex-row"
            >
              <button
                type="button"
                className={`shrink-0 w-8 h-8 rounded-full border overflow-hidden cursor-pointer p-0 ${
                  msg.role === "user" ? "border-gold/30" : "border-gold/50"
                }`}
                onClick={() => {
                  if (msg.role === "user") avatarInputRef.current?.click();
                  else sentryAvatarInputRef.current?.click();
                }}
                aria-label={
                  msg.role === "user"
                    ? "Change user avatar"
                    : "Change Sentry avatar"
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
                ) : sentryAvatarUrl ? (
                  <img
                    src={sentryAvatarUrl}
                    alt="Sentry"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gold/10 text-gold text-xs font-mono">
                    S
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
                    {msg.role === "sentry"
                      ? "SENTRY"
                      : (msg.name || "USER").toUpperCase()}
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
                        ? "bg-secondary/80 border border-gold/10 text-foreground"
                        : "sentry-message text-foreground"
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
              {sentryAvatarUrl ? (
                <img
                  src={sentryAvatarUrl}
                  alt="Sentry"
                  className="w-full h-full object-cover"
                />
              ) : (
                "S"
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

      {/* Emoji picker */}
      {showEmoji && (
        <div
          className="absolute bottom-[88px] left-4 z-20 bg-card border border-gold/40 rounded-lg p-3 shadow-2xl"
          style={{ width: 300 }}
        >
          {/* Custom emojis: canister + local fallback */}
          <div className="mb-3">
            <p className="text-[9px] font-mono text-gold/50 tracking-widest mb-1">
              CUSTOM EMOJIS
            </p>
            {(canisterEmojis ?? []).length === 0 && localEmojis.length === 0 ? (
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
            className="flex-1 min-h-[40px] max-h-32 resize-none bg-input border-border text-sm font-mono text-foreground placeholder:text-muted-foreground"
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
            className="w-8 h-8 shrink-0 p-0 bg-gold hover:bg-gold-bright text-primary-foreground"
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
        accept="image/*,audio/*,video/*,.pdf,.txt,.json,.doc,.docx,.zip"
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
