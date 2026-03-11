import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Paperclip, Send, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useAddMemory,
  useAddRule,
  useAddTimelineEntry,
  useGetCallerUserProfile,
  useGetMemories,
  useGetPersonality,
  useGetRules,
  useGetTimeline,
  useGetUserMemories,
  useSetUserAvatar,
  useUpdatePersonality,
} from "../hooks/useQueries";
import type { Attachment, ChatMessage } from "../types/sentry";
import {
  buildIdentityResponse,
  buildReasoningChain,
  generateAIResponse,
} from "../utils/aiEngine";
import PersonalityBars from "./PersonalityBars";
import TimelinePanel from "./TimelinePanel";

const LS_KEY = "sentry_messages";
const DEFAULT_PERSONALITY = {
  curiosity: 0.5,
  friendliness: 0.5,
  analytical: 0.5,
};

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
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
          // biome-ignore lint/suspicious/noArrayIndexKey: line index is stable
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
  if (attachment.type === "image" || attachment.type === "gif") {
    return (
      <img
        src={attachment.url}
        alt={attachment.name || "attachment"}
        className="max-w-xs max-h-48 rounded border border-border object-contain mt-1"
      />
    );
  }
  if (attachment.type === "audio") {
    return (
      <audio controls src={attachment.url} className="mt-1 max-w-xs">
        <track kind="captions" />
      </audio>
    );
  }
  if (attachment.type === "video") {
    return (
      <video
        controls
        src={attachment.url}
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
      href={attachment.url}
      download={attachment.name}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gold mt-1 border border-border rounded px-2 py-1 w-fit"
    >
      <Paperclip className="w-3 h-3" />
      {attachment.name || "Download file"}
    </a>
  );
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const msgCountRef = useRef(0);

  const { data: globalMemories = [] } = useGetMemories(true);
  const { data: userMemories = [] } = useGetUserMemories();
  const { data: rules = [] } = useGetRules();
  const { data: personality = DEFAULT_PERSONALITY } = useGetPersonality();
  const { data: timeline = [] } = useGetTimeline();
  const { data: userProfile } = useGetCallerUserProfile();

  const addMemory = useAddMemory();
  const addRule = useAddRule();
  const addTimeline = useAddTimelineEntry();
  const updatePersonality = useUpdatePersonality();
  const setUserAvatar = useSetUserAvatar();

  const username = userProfile?.username || "USER";
  const userAvatarUrl = userProfile?.avatarUrl || "";

  useEffect(() => {
    const id = setInterval(() => {
      localStorage.setItem(LS_KEY, JSON.stringify(messages.slice(-200)));
    }, 30_000);
    return () => clearInterval(id);
  }, [messages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll trigger
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isThinking]);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    msgCountRef.current++;

    addMessage({
      role: "user",
      content: text,
      name: username,
      avatarUrl: userAvatarUrl,
    });
    setIsThinking(true);

    try {
      const lower = text.toLowerCase().trim();

      if (text.startsWith("TEACH:")) {
        const fact = text.slice(6).trim();
        const concepts = fact
          .split(" ")
          .filter((w) => w.length > 4)
          .slice(0, 5);
        const id = await addMemory.mutateAsync({
          text: fact,
          memoryType: "knowledge",
          concepts,
          isGlobal: true,
        });
        addMessage({
          role: "sentry",
          content: `Knowledge stored in global memory.\n\n*"${fact}"*\n\nConcepts extracted: ${concepts.join(", ") || "none"}`,
          commandType: "teach",
          highlightedNodeIds: [id],
        });
        return;
      }

      const ifThenMatch = text.match(/^IF\s+(.+)\s+THEN\s+(.+)$/i);
      if (ifThenMatch) {
        const condition = ifThenMatch[1].trim();
        const effect = ifThenMatch[2].trim();
        const id = await addRule.mutateAsync({ condition, effect });
        addMessage({
          role: "sentry",
          content: `Cause-effect rule recorded.\n\n**IF** *${condition}* **THEN** *${effect}*\n\nI can now reason about this relationship.`,
          commandType: "rule",
          highlightedNodeIds: [id],
        });
        return;
      }

      if (text.startsWith("HISTORY:")) {
        const event = text.slice(8).trim();
        const id = await addTimeline.mutateAsync({
          event,
          personalitySnapshot: personality,
        });
        addMessage({
          role: "sentry",
          content: `Timeline entry recorded.\n\n*"${event}"*\n\nThis event has been added to my historical record.`,
          commandType: "history",
          highlightedNodeIds: [id],
        });
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
        addMessage({
          role: "sentry",
          content: `Personal memory stored.\n\n*"${memory}"*\n\nI will remember this about you.`,
          commandType: "remember",
          highlightedNodeIds: [id],
        });
        return;
      }

      if (lower.startsWith("why ")) {
        const query = text.slice(4).trim();
        const chain = buildReasoningChain(query, rules);
        addMessage({ role: "sentry", content: chain, commandType: "why" });
        return;
      }

      if (lower === "who are you" || lower === "who are you?") {
        const identityResponse = buildIdentityResponse(
          personality,
          timeline.length,
        );
        addMessage({
          role: "sentry",
          content: identityResponse,
          commandType: "identity",
        });
        return;
      }

      await new Promise((res) => setTimeout(res, 600 + Math.random() * 600));
      const allMemories = [...globalMemories, ...userMemories];
      const { response, personalityDelta } = generateAIResponse(
        text,
        allMemories,
        rules,
        personality,
        msgCountRef.current,
      );

      if (Object.keys(personalityDelta).length > 0) {
        updatePersonality.mutate({ ...personality, ...personalityDelta });
      }

      addMessage({ role: "sentry", content: response });
    } finally {
      setIsThinking(false);
    }
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        let type: Attachment["type"] = "file";
        if (file.type.startsWith("image/gif")) type = "gif";
        else if (file.type.startsWith("image/")) type = "image";
        else if (file.type.startsWith("audio/")) type = "audio";
        else if (file.type.startsWith("video/")) type = "video";
        addMessage({
          role: "user",
          name: username,
          avatarUrl: userAvatarUrl,
          content: "",
          attachments: [{ type, url, name: file.name, mimeType: file.type }],
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleLinkAttach = () => {
    const url = prompt("Enter URL:");
    if (!url) return;
    addMessage({
      role: "user",
      name: username,
      avatarUrl: userAvatarUrl,
      content: "",
      attachments: [{ type: "link", url, name: url }],
    });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className="flex flex-col h-full relative">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
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
                type a message or use TEACH: to begin
              </p>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <button
                type="button"
                className={`shrink-0 w-8 h-8 rounded-full border overflow-hidden cursor-pointer p-0 ${msg.role === "user" ? "border-gold/30" : "border-gold/50"}`}
                onClick={
                  msg.role === "user"
                    ? () => avatarInputRef.current?.click()
                    : undefined
                }
                aria-label={
                  msg.role === "user" ? "Change user avatar" : "Sentry avatar"
                }
                data-ocid={
                  msg.role === "user" ? "avatar.upload_button" : undefined
                }
              >
                {msg.avatarUrl ? (
                  <img
                    src={msg.avatarUrl}
                    alt={msg.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center text-xs font-mono ${msg.role === "user" ? "bg-secondary text-gold" : "bg-gold/10 text-gold"}`}
                  >
                    {msg.role === "user" ? <User className="w-4 h-4" /> : "S"}
                  </div>
                )}
              </button>

              <div
                className={`flex flex-col gap-0.5 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono tracking-widest ${msg.role === "sentry" ? "text-gold" : "text-muted-foreground"}`}
                  >
                    {msg.role === "sentry" ? "SENTRY" : msg.name || "USER"}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  {msg.commandType && (
                    <span
                      className={`text-[9px] px-1.5 rounded font-mono ${
                        msg.commandType === "teach"
                          ? "badge-knowledge"
                          : msg.commandType === "rule"
                            ? "badge-rule"
                            : msg.commandType === "history"
                              ? "badge-history"
                              : "badge-personal"
                      }`}
                    >
                      {msg.commandType}
                    </span>
                  )}
                </div>
                {msg.content && (
                  <div
                    className={`px-3 py-2 rounded-lg text-sm leading-relaxed transition-all ${
                      msg.role === "user"
                        ? "bg-secondary text-foreground"
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
            <div className="w-8 h-8 rounded-full border border-gold/50 bg-gold/10 flex items-center justify-center text-xs font-mono text-gold">
              S
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
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message or use TEACH: / IF...THEN... / WHY..."
            className="flex-1 min-h-[40px] max-h-32 resize-none bg-input border-border text-sm font-mono text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-ocid="chat.input"
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
        onChange={handleAvatarChange}
      />
    </div>
  );
}
