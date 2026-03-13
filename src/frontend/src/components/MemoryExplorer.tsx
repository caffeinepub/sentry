import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Check,
  Cpu,
  Network,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  useDeleteMemory,
  useDeleteRule,
  useGetMemories,
  useGetRules,
  useGetSentryAvatar,
  useGetUserMemories,
  useSetSentryAvatar,
  useUpdateMemory,
} from "../hooks/useQueries";
import CategoryManager from "./CategoryManager";

function formatTs(ts: bigint) {
  return new Date(Number(ts) / 1_000_000).toLocaleDateString();
}

type FilterTab =
  | "all"
  | "knowledge"
  | "rules"
  | "history"
  | "personal"
  | "user"
  | "global"
  | "concepts";

interface MemoryItem {
  id: bigint;
  text: string;
  memoryType: string;
  timestamp: bigint;
  concepts?: string[];
  isRule?: boolean;
  isGlobal?: boolean;
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

export default function MemoryExplorer({ onMemoryClick }: MemoryExplorerProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editText, setEditText] = useState("");
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [showCategories, setShowCategories] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: globalMemories = [] } = useGetMemories(true);
  const { data: userMemories = [] } = useGetUserMemories();
  const { data: rules = [] } = useGetRules();
  const { data: sentryAvatar } = useGetSentryAvatar();
  const deleteMemory = useDeleteMemory();
  const deleteRule = useDeleteRule();
  const setSentryAvatar = useSetSentryAvatar();
  const updateMemory = useUpdateMemory();

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
        if (!node.sources.includes(mem.text)) {
          node.sources.push(mem.text);
        }
      } else {
        conceptMap.set(key, {
          name: concept,
          type,
          sources: [mem.text],
          count: 1,
        });
      }
    }
    // Also extract concepts from memory text (simple noun extraction)
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

  // Filter out locally-deleted items immediately
  const filtered = allMemories.filter((m) => {
    if (deletedIds.has(m.id.toString())) return false;
    const matchesSearch =
      search === "" || m.text.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === "all") return true;
    if (activeTab === "rules") return m.memoryType === "rule";
    if (activeTab === "knowledge")
      return (
        m.memoryType === "knowledge" ||
        m.memoryType === "fact" ||
        m.memoryType === "concept"
      );
    if (activeTab === "history") return m.memoryType === "history";
    if (activeTab === "personal") return m.memoryType === "personal";
    if (activeTab === "user") return m.isGlobal === false;
    if (activeTab === "global") return m.isGlobal === true || m.isRule === true;
    return true;
  });

  const filteredConcepts = allConcepts.filter(
    (c) =>
      search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.sources.some((s) => s.toLowerCase().includes(search.toLowerCase())),
  );

  const handleDelete = async (item: MemoryItem) => {
    setDeletedIds((prev) => new Set([...prev, item.id.toString()]));
    try {
      if (item.isRule) {
        await deleteRule.mutateAsync(item.id);
      } else {
        await deleteMemory.mutateAsync({
          id: item.id,
          isGlobal: item.isGlobal,
        });
      }
      toast.success("Memory deleted.");
    } catch {
      toast.error("Delete may not have synced to server, but hidden locally.");
    }
  };

  const startEdit = (id: bigint, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const saveEdit = async (id: bigint) => {
    if (!editText.trim()) return;
    try {
      await updateMemory.mutateAsync({ id, text: editText.trim() });
      toast.success("Memory updated.");
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
      try {
        await setSentryAvatar.mutateAsync(dataUrl);
        toast.success("Sentry avatar updated.");
      } catch {
        toast.error("Failed to update avatar.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const tabs: FilterTab[] = [
    "all",
    "concepts",
    "knowledge",
    "rules",
    "history",
    "personal",
    "user",
    "global",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sentry Avatar */}
      <div className="flex flex-col items-center py-4 border-b border-border shrink-0">
        <button
          type="button"
          className="relative w-16 h-16 rounded-full border-2 border-gold/40 cursor-pointer group overflow-hidden hover:border-gold transition-colors p-0"
          onClick={() => avatarInputRef.current?.click()}
          aria-label="Change Sentry avatar"
          data-ocid="sentry_avatar.upload_button"
        >
          {sentryAvatar ? (
            <img
              src={sentryAvatar}
              alt="Sentry"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <Cpu className="w-7 h-7 text-gold" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-[10px] text-gold font-mono">EDIT</span>
          </div>
        </button>
        <span className="text-xs font-mono text-gold mt-2 tracking-widest">
          SENTRY
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
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

      {/* Categories */}
      <div className="px-3 pt-3 shrink-0">
        <button
          type="button"
          data-ocid="memory.open_modal_button"
          onClick={() => setShowCategories(true)}
          className="w-full mb-2 px-2 py-0.5 text-[10px] font-mono rounded tracking-widest uppercase bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-colors"
        >
          Categories
        </button>
        <CategoryManager
          open={showCategories}
          onClose={() => setShowCategories(false)}
        />
      </div>

      {/* Search */}
      <div className="p-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="pl-8 h-8 bg-input border-border text-xs font-mono"
            data-ocid="memory.search_input"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0.5 px-3 pb-2 shrink-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded tracking-widest uppercase transition-colors whitespace-nowrap ${
              activeTab === tab
                ? tab === "concepts"
                  ? "bg-gold/30 text-gold border border-gold/60"
                  : tab === "global"
                    ? "bg-gold/20 text-gold border border-gold/50"
                    : tab === "user"
                      ? "bg-gold/10 text-gold/60 border border-gold/30"
                      : "bg-gold/20 text-gold border border-gold/40"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
            data-ocid="memory.tab"
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Concepts tab */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ minHeight: 0 }}>
        {activeTab === "concepts" ? (
          <ScrollArea className="h-full" style={{ overflowY: "auto" }}>
            {filteredConcepts.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-32 gap-2"
                data-ocid="memory.empty_state"
              >
                <Network className="w-8 h-8 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground font-mono">
                  NO CONCEPTS YET
                </span>
                <span className="text-[10px] text-muted-foreground/50 font-mono text-center px-4">
                  Talk to Sentry — concepts are extracted automatically
                </span>
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1">
                <p className="text-[9px] font-mono text-gold/40 tracking-widest py-1">
                  {filteredConcepts.length} LEARNED CONCEPTS
                </p>
                {filteredConcepts.map((concept, idx) => (
                  <button
                    key={concept.name}
                    type="button"
                    className="w-full text-left group flex gap-2 p-2 rounded border border-border hover:border-gold/30 transition-all"
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
          </ScrollArea>
        ) : (
          /* Memory list */
          <ScrollArea className="h-full" style={{ overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-32 gap-2"
                data-ocid="memory.empty_state"
              >
                <Brain className="w-8 h-8 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground font-mono">
                  NO MEMORIES
                </span>
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1.5">
                {filtered.map((item, idx) => (
                  <div
                    key={item.id.toString()}
                    className="group flex gap-2 p-2.5 rounded border border-border hover:border-gold/30 transition-all"
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
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono capitalize ${
                            item.memoryType === "rule"
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
                          {item.memoryType}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatTs(item.timestamp)}
                        </span>
                        {item.isGlobal && !item.isRule && (
                          <span className="text-[8px] font-mono text-gold/40 tracking-widest">
                            SHARED
                          </span>
                        )}
                        {!item.isGlobal && (
                          <span className="text-[8px] font-mono text-gold/40 tracking-widest">
                            USER
                          </span>
                        )}
                      </div>

                      {editingId === item.id ? (
                        <div className="flex gap-1 items-start">
                          <Input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="h-7 text-xs font-mono bg-input border-border flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(item.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            data-ocid="memory.input"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-gold hover:bg-gold/10"
                            onClick={() => saveEdit(item.id)}
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
                        {!item.isRule && !item.isGlobal && (
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item)}
                          data-ocid="memory.delete_button.1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </div>
      {/* Stats */}
      <div className="px-3 py-2 border-t border-border shrink-0">
        <p className="text-[10px] font-mono text-muted-foreground">
          {allMemories.length - deletedIds.size} MEMORIES {" // "}{" "}
          {rules.length} RULES {" // "} {allConcepts.length} CONCEPTS
        </p>
      </div>
    </div>
  );
}
