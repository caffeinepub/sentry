import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Network,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useDeleteMemory,
  useDeleteRule,
  useDeleteTimelineEntry,
  useGetMemories,
  useGetRules,
  useGetSentryAvatar,
  useGetTimeline,
  useGetUserMemories,
  useSetSentryAvatar,
  useUpdateMemory,
  useUpdateTimelineEntry,
} from "../hooks/useQueries";
import {
  getCurrentUser,
  isClass5ForProfile,
  isClass6,
} from "../utils/localAuth";
import CategoryManager from "./CategoryManager";

function formatTs(ts: bigint) {
  return new Date(Number(ts) / 1_000_000).toLocaleDateString();
}

interface MemoryItem {
  id: bigint;
  text: string;
  memoryType: string;
  timestamp: bigint;
  concepts?: string[];
  isRule?: boolean;
  isGlobal?: boolean;
  isTimeline?: boolean;
}

interface ConceptNode {
  name: string;
  type: string;
  sources: string[];
  count: number;
}

interface MemoryExplorerProps {
  onMemoryClick?: (text: string) => void;
}

function getActiveProfileId(): string {
  return localStorage.getItem("sentry_active_profile") || "default";
}

function canTeachGlobalForProfile(username: string): boolean {
  if (!username) return false;
  return isClass6(username) || isClass5ForProfile(username);
}

interface SectionProps {
  title: string;
  count: number;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

function CollapsibleSection({
  title,
  count,
  badge,
  children,
  defaultOpen = false,
  icon,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gold/20 rounded mb-2 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-1.5 bg-black hover:bg-gold/5 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-3 h-3 text-gold/60" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gold/60" />
          )}
          {icon && <span className="text-gold/60">{icon}</span>}
          <span className="text-[10px] font-mono text-gold tracking-widest uppercase">
            {title}
          </span>
          {badge && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gold/10 text-gold/70 border border-gold/20">
              {badge}
            </span>
          )}
        </div>
        <span className="text-[9px] font-mono text-gold/40">{count}</span>
      </button>
      {open && <div className="border-t border-gold/10">{children}</div>}
    </div>
  );
}

export default function MemoryExplorer({ onMemoryClick }: MemoryExplorerProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editText, setEditText] = useState("");
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [showCategories, setShowCategories] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const username = getCurrentUser() || "";
  const canTeachGlobal = canTeachGlobalForProfile(username);

  const [activeProfileName, setActiveProfileName] = useState<string>(() => {
    const pid = getActiveProfileId();
    return localStorage.getItem(`sentry_ai_name_${pid}`) || "SENTRY";
  });
  const [activeProfileAvatar, setActiveProfileAvatar] = useState<string | null>(
    () => {
      const pid = getActiveProfileId();
      return localStorage.getItem(`sentry_ai_avatar_${pid}`) || null;
    },
  );

  useEffect(() => {
    const refresh = () => {
      const pid = getActiveProfileId();
      setActiveProfileName(
        localStorage.getItem(`sentry_ai_name_${pid}`) || "SENTRY",
      );
      setActiveProfileAvatar(
        localStorage.getItem(`sentry_ai_avatar_${pid}`) || null,
      );
    };
    window.addEventListener("sentry_profile_changed", refresh);
    window.addEventListener("sentry_ai_name_changed", refresh);
    window.addEventListener("sentry_ai_avatar_changed", refresh);
    return () => {
      window.removeEventListener("sentry_profile_changed", refresh);
      window.removeEventListener("sentry_ai_name_changed", refresh);
      window.removeEventListener("sentry_ai_avatar_changed", refresh);
    };
  }, []);

  const { data: globalMemories = [] } = useGetMemories(true);
  const { data: userMemories = [] } = useGetUserMemories();
  const { data: rules = [] } = useGetRules();
  const { data: timelineEntries = [] } = useGetTimeline();
  const { data: sentryAvatar } = useGetSentryAvatar();
  const deleteMemory = useDeleteMemory();
  const deleteRule = useDeleteRule();
  const deleteTimeline = useDeleteTimelineEntry();
  const setSentryAvatar = useSetSentryAvatar();
  const updateMemory = useUpdateMemory();
  const updateTimeline = useUpdateTimelineEntry();

  const allMemories: MemoryItem[] = [
    ...globalMemories.map((m) => ({
      ...m,
      memoryType: m.memoryType || "knowledge",
      isGlobal: true,
    })),
    ...userMemories.map((m) => ({
      ...m,
      memoryType: m.memoryType || "personal",
      isGlobal: false,
    })),
    ...rules.map((r) => ({
      id: r.id,
      memoryType: "rule" as const,
      text: `IF ${r.condition} THEN ${r.effect}`,
      concepts: [] as string[],
      timestamp: r.timestamp,
      isRule: true,
      isGlobal: true,
    })),
  ];

  // Timeline entries as MemoryItems for the History section
  const timelineAsMemory: MemoryItem[] = timelineEntries.map((e) => ({
    id: e.id,
    text: e.event,
    memoryType: "history",
    timestamp: e.timestamp,
    concepts: [],
    isTimeline: true,
    isGlobal: false,
  }));

  // Build concept graph from memories
  const conceptMap = new Map<string, ConceptNode>();
  for (const mem of [...globalMemories, ...userMemories]) {
    const type = mem.memoryType || "knowledge";
    for (const concept of mem.concepts || []) {
      const key = concept.toLowerCase().trim();
      if (!key || key.length < 2) continue;
      if (conceptMap.has(key)) {
        const node = conceptMap.get(key)!;
        node.count++;
        if (!node.sources.includes(mem.text)) node.sources.push(mem.text);
      } else {
        conceptMap.set(key, {
          name: concept,
          type,
          sources: [mem.text],
          count: 1,
        });
      }
    }
    const words = mem.text
      .split(/[\s,.!?;:]+/)
      .filter((w) => w.length > 4 && /^[A-Za-z]/.test(w))
      .slice(0, 8);
    for (const word of words) {
      const key = word.toLowerCase();
      if (!conceptMap.has(key)) {
        conceptMap.set(key, {
          name: word,
          type: mem.memoryType || "knowledge",
          sources: [mem.text],
          count: 1,
        });
      }
    }
  }
  const allConcepts = Array.from(conceptMap.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  // Filtered helpers
  const lc = search.toLowerCase();
  const matchText = (text: string) =>
    !search || text.toLowerCase().includes(lc);

  const visible = (items: MemoryItem[]) =>
    items.filter((m) => !deletedIds.has(m.id.toString()) && matchText(m.text));

  const personalItems = visible(
    allMemories.filter((m) => m.memoryType === "personal" && !m.isGlobal),
  );
  const userKnowledgeItems = visible(
    allMemories.filter(
      (m) => m.isGlobal === false && m.memoryType !== "personal",
    ),
  );
  const globalItems = visible(
    allMemories.filter(
      (m) =>
        m.isGlobal === true &&
        m.memoryType !== "rule" &&
        m.memoryType !== "history",
    ),
  );
  // History = timeline entries + any memory with type "history"
  const memoryHistoryItems = visible(
    allMemories.filter((m) => m.memoryType === "history"),
  );
  const timelineVisible = timelineAsMemory.filter(
    (m) => !deletedIds.has(m.id.toString()) && matchText(m.text),
  );
  // Merge and deduplicate by id
  const seenIds = new Set<string>();
  const historyItems: MemoryItem[] = [];
  for (const item of [...timelineVisible, ...memoryHistoryItems]) {
    const key = item.id.toString();
    if (!seenIds.has(key)) {
      seenIds.add(key);
      historyItems.push(item);
    }
  }
  historyItems.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  const ruleItems = visible(allMemories.filter((m) => m.isRule === true));
  const conceptItems = allConcepts.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(lc) ||
      c.sources.some((s) => s.toLowerCase().includes(lc)),
  );

  const handleDelete = async (item: MemoryItem) => {
    setDeletedIds((prev) => new Set([...prev, item.id.toString()]));
    try {
      if (item.isTimeline) {
        await deleteTimeline.mutateAsync(item.id);
      } else if (item.isRule) {
        await deleteRule.mutateAsync(item.id);
      } else {
        await deleteMemory.mutateAsync({
          id: item.id,
          isGlobal: item.isGlobal,
        });
      }
      toast.success("Deleted.");
    } catch {
      toast.error("Delete may not have synced to server, but hidden locally.");
    }
  };

  const startEdit = (id: bigint, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const saveEdit = async (item: MemoryItem) => {
    if (!editText.trim()) return;
    try {
      if (item.isTimeline) {
        await updateTimeline.mutateAsync({
          id: item.id,
          event: editText.trim(),
        });
      } else {
        await updateMemory.mutateAsync({ id: item.id, text: editText.trim() });
      }
      toast.success("Updated.");
      setEditingId(null);
    } catch {
      toast.error("Update failed.");
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const pid = getActiveProfileId();
      localStorage.setItem(`sentry_ai_avatar_${pid}`, dataUrl);
      setActiveProfileAvatar(dataUrl);
      window.dispatchEvent(new CustomEvent("sentry_ai_avatar_changed"));
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

  const saveProfileName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    const pid = getActiveProfileId();
    localStorage.setItem(`sentry_ai_name_${pid}`, trimmed);
    setActiveProfileName(trimmed);
    window.dispatchEvent(new CustomEvent("sentry_ai_name_changed"));
    setEditingName(false);
    toast.success("AI name updated.");
  };

  const MemoryRow = ({
    item,
    canEdit,
    canDelete,
    idx,
  }: {
    item: MemoryItem;
    canEdit: boolean;
    canDelete: boolean;
    idx: number;
  }) => (
    <div
      key={item.id.toString()}
      className="group flex gap-2 p-2 rounded border border-transparent hover:border-gold/20 transition-all"
      data-ocid={
        idx === 0
          ? "memory.item.1"
          : idx === 1
            ? "memory.item.2"
            : idx === 2
              ? "memory.item.3"
              : undefined
      }
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-mono capitalize ${
              item.isTimeline
                ? "badge-history"
                : item.isRule
                  ? "badge-rule"
                  : item.memoryType === "history"
                    ? "badge-history"
                    : item.memoryType === "personal"
                      ? "badge-personal"
                      : item.memoryType === "prediction"
                        ? "badge-prediction"
                        : "badge-knowledge"
            }`}
          >
            {item.isTimeline
              ? "timeline"
              : item.isRule
                ? "rule"
                : item.memoryType}
          </span>
          <span className="text-[9px] text-muted-foreground/50 font-mono">
            {formatTs(item.timestamp)}
          </span>
        </div>

        {editingId === item.id ? (
          <div className="flex gap-1 mt-1">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="h-6 text-xs font-mono bg-input border-border flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(item);
                if (e.key === "Escape") setEditingId(null);
              }}
              data-ocid="memory.input"
            />
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-gold"
              onClick={() => saveEdit(item)}
              data-ocid="memory.save_button"
            >
              <Check className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-muted-foreground"
              onClick={() => setEditingId(null)}
              data-ocid="memory.cancel_button"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="text-xs text-foreground line-clamp-2 leading-relaxed w-full text-left"
            onClick={() => onMemoryClick?.(item.text)}
          >
            {item.text}
          </button>
        )}
      </div>

      {editingId !== item.id && (
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-muted-foreground hover:text-gold"
              onClick={() => startEdit(item.id, item.text)}
              data-ocid="memory.edit_button.1"
            >
              <Pencil className="w-3 h-3" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(item)}
              data-ocid="memory.delete_button.1"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const totalCount =
    allMemories.length + timelineEntries.length - deletedIds.size;

  return (
    <div className="flex flex-col h-full">
      {/* AI Profile Header */}
      <div className="flex flex-col items-center py-3 px-3 border-b border-border shrink-0 gap-2">
        <button
          type="button"
          className={`relative w-14 h-14 rounded-full border-2 overflow-hidden transition-colors ${
            canTeachGlobal
              ? "border-gold/40 cursor-pointer group hover:border-gold"
              : "border-gold/20 cursor-default"
          }`}
          onClick={() => canTeachGlobal && avatarInputRef.current?.click()}
          aria-label={canTeachGlobal ? "Change AI avatar" : "AI avatar"}
          data-ocid="sentry_avatar.upload_button"
        >
          {activeProfileAvatar || sentryAvatar ? (
            <img
              src={activeProfileAvatar || sentryAvatar!}
              alt={activeProfileName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <Cpu className="w-6 h-6 text-gold" />
            </div>
          )}
          {canTeachGlobal && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-[9px] text-gold font-mono">EDIT</span>
            </div>
          )}
        </button>

        {/* AI Name */}
        {editingName ? (
          <div className="flex items-center gap-1 w-full">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-6 text-xs font-mono text-center bg-input border-border flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveProfileName();
                if (e.key === "Escape") setEditingName(false);
              }}
              data-ocid="memory.input"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5 shrink-0 text-gold"
              onClick={saveProfileName}
              data-ocid="memory.save_button"
            >
              <Check className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5 shrink-0"
              onClick={() => setEditingName(false)}
              data-ocid="memory.cancel_button"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono text-gold tracking-widest">
              {activeProfileName}
            </span>
            {canTeachGlobal && (
              <button
                type="button"
                className="text-muted-foreground/40 hover:text-gold transition-colors"
                onClick={() => {
                  setNameDraft(activeProfileName);
                  setEditingName(true);
                }}
                data-ocid="memory.edit_button.1"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}

        <span className="text-[9px] text-muted-foreground font-mono -mt-1">
          NEURAL CORE
        </span>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all memories..."
            className="pl-8 h-7 bg-input border-border text-xs font-mono"
            data-ocid="memory.search_input"
          />
        </div>
      </div>

      {/* Categories button */}
      <div className="px-3 pb-2 shrink-0">
        <button
          type="button"
          data-ocid="memory.open_modal_button"
          onClick={() => setShowCategories(true)}
          className="w-full px-2 py-0.5 text-[10px] font-mono rounded tracking-widest uppercase bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-colors"
        >
          Categories
        </button>
        <CategoryManager
          open={showCategories}
          onClose={() => setShowCategories(false)}
        />
      </div>

      {/* Sections */}
      <ScrollArea className="flex-1 min-h-0" style={{ overflowY: "auto" }}>
        <div className="px-3 pb-3 space-y-0">
          {/* Personal — everyone can edit/delete */}
          <CollapsibleSection
            title="Personal"
            count={personalItems.length}
            badge="You"
            defaultOpen
          >
            {personalItems.length === 0 ? (
              <div
                className="p-3 text-[10px] font-mono text-muted-foreground text-center"
                data-ocid="memory.empty_state"
              >
                No personal memories yet
              </div>
            ) : (
              <div className="px-2 py-1 space-y-0.5">
                {personalItems.map((item, idx) => (
                  <MemoryRow
                    key={item.id.toString()}
                    item={item}
                    canEdit
                    canDelete
                    idx={idx}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* User Knowledge — Class 6 + trainers can edit */}
          <CollapsibleSection
            title="User Knowledge"
            count={userKnowledgeItems.length}
            badge={canTeachGlobal ? undefined : "View Only"}
          >
            {userKnowledgeItems.length === 0 ? (
              <div
                className="p-3 text-[10px] font-mono text-muted-foreground text-center"
                data-ocid="memory.empty_state"
              >
                No user knowledge yet
              </div>
            ) : (
              <div className="px-2 py-1 space-y-0.5">
                {userKnowledgeItems.map((item, idx) => (
                  <MemoryRow
                    key={item.id.toString()}
                    item={item}
                    canEdit={canTeachGlobal}
                    canDelete={canTeachGlobal}
                    idx={idx}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Global Knowledge — Class 6 + trainers only */}
          <CollapsibleSection
            title="Global Knowledge"
            count={globalItems.length}
            badge={canTeachGlobal ? undefined : "View Only"}
          >
            {globalItems.length === 0 ? (
              <div
                className="p-3 text-[10px] font-mono text-muted-foreground text-center"
                data-ocid="memory.empty_state"
              >
                No global knowledge yet
              </div>
            ) : (
              <div className="px-2 py-1 space-y-0.5">
                {globalItems.map((item, idx) => (
                  <MemoryRow
                    key={item.id.toString()}
                    item={item}
                    canEdit={canTeachGlobal}
                    canDelete={canTeachGlobal}
                    idx={idx}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* History / Timeline — Class 6 + trainers only */}
          <CollapsibleSection
            title="History / Timeline"
            count={historyItems.length}
            badge={canTeachGlobal ? undefined : "View Only"}
            icon={<Clock className="w-3 h-3" />}
          >
            {historyItems.length === 0 ? (
              <div
                className="p-3 text-[10px] font-mono text-muted-foreground text-center"
                data-ocid="memory.empty_state"
              >
                No history recorded yet. Use HISTORY: in chat to add entries.
              </div>
            ) : (
              <div className="px-2 py-1 space-y-0.5">
                {historyItems.map((item, idx) => (
                  <MemoryRow
                    key={item.id.toString()}
                    item={item}
                    canEdit={canTeachGlobal}
                    canDelete={canTeachGlobal}
                    idx={idx}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Rules — Class 6 + trainers can edit/delete */}
          <CollapsibleSection
            title="Rules"
            count={ruleItems.length}
            badge={canTeachGlobal ? undefined : "View Only"}
          >
            {ruleItems.length === 0 ? (
              <div
                className="p-3 text-[10px] font-mono text-muted-foreground text-center"
                data-ocid="memory.empty_state"
              >
                No rules defined yet. Use IF ... THEN ... in chat.
              </div>
            ) : (
              <div className="px-2 py-1 space-y-0.5">
                {ruleItems.map((item, idx) => (
                  <MemoryRow
                    key={item.id.toString()}
                    item={item}
                    canEdit={canTeachGlobal}
                    canDelete={canTeachGlobal}
                    idx={idx}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Concepts — derived, view only */}
          <CollapsibleSection
            title="Concepts"
            count={conceptItems.length}
            badge="Derived"
          >
            {conceptItems.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-4 gap-2"
                data-ocid="memory.empty_state"
              >
                <Network className="w-6 h-6 text-muted-foreground/30" />
                <span className="text-[10px] text-muted-foreground font-mono">
                  NO CONCEPTS YET
                </span>
                <span className="text-[9px] text-muted-foreground/50 font-mono text-center px-4">
                  Extracted automatically from conversations
                </span>
              </div>
            ) : (
              <div className="px-2 py-1 space-y-0.5">
                {conceptItems.map((concept, idx) => (
                  <button
                    key={concept.name}
                    type="button"
                    className="w-full text-left group flex gap-2 p-2 rounded border border-transparent hover:border-gold/20 transition-all"
                    onClick={() => onMemoryClick?.(concept.name)}
                    data-ocid={
                      idx === 0
                        ? "memory.item.1"
                        : idx === 1
                          ? "memory.item.2"
                          : idx === 2
                            ? "memory.item.3"
                            : undefined
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono capitalize ${
                            concept.type === "rule"
                              ? "badge-rule"
                              : concept.type === "prediction"
                                ? "badge-prediction"
                                : concept.type === "personal"
                                  ? "badge-personal"
                                  : "badge-knowledge"
                          }`}
                        >
                          {concept.type}
                        </span>
                        {concept.count > 1 && (
                          <span className="text-[9px] font-mono text-gold/50">
                            ×{concept.count}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gold font-mono">
                        {concept.name}
                      </span>
                      {concept.sources[0] && (
                        <p className="text-[9px] text-muted-foreground/60 line-clamp-1 mt-0.5">
                          {concept.sources[0].slice(0, 60)}
                          {concept.sources[0].length > 60 ? "..." : ""}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 self-center">
                      <Network className="w-3 h-3 text-gold/20 group-hover:text-gold/50 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </ScrollArea>

      {/* Stats */}
      <div className="px-3 py-2 border-t border-border shrink-0">
        <p className="text-[9px] font-mono text-muted-foreground">
          {totalCount} MEMORIES {" // "} {rules.length} RULES {" // "}{" "}
          {allConcepts.length} CONCEPTS {" // "} {timelineEntries.length}{" "}
          TIMELINE
        </p>
        {!canTeachGlobal && (
          <p className="text-[9px] font-mono text-gold/30 mt-0.5">
            VIEW ONLY — Personal memories are editable
          </p>
        )}
      </div>
    </div>
  );
}
