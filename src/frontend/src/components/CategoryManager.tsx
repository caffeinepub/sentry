import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useDeleteMemory,
  useDeleteRule,
  useGetMemories,
  useGetRules,
  useGetUserMemories,
  useUpdateMemory,
} from "../hooks/useQueries";
import {
  type Category,
  addCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../utils/categoryDB";
import {
  getCurrentUser,
  isClass5ForProfile,
  isClass6,
} from "../utils/localAuth";

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
}

function canEditGlobal(): boolean {
  const username = getCurrentUser() || "";
  if (!username) return false;
  return isClass6(username) || isClass5ForProfile(username);
}

interface MemoryItem {
  id: bigint;
  text: string;
  memoryType: string;
  timestamp: bigint;
  concepts?: string[];
  isRule?: boolean;
  isGlobal?: boolean;
}

function matchesCategory(memory: MemoryItem, cat: Category): boolean {
  const text = memory.text.toLowerCase();
  const catName = cat.name.toLowerCase();
  const catDesc = (cat.description || "").toLowerCase();

  // Direct name match
  if (text.includes(catName)) return true;

  // Description keyword match (each word > 4 chars)
  const descKeywords = catDesc.split(/[\s,/&]+/).filter((w) => w.length > 4);
  if (descKeywords.some((kw) => text.includes(kw))) return true;

  // Category id (hyphenated) match
  const idWords = cat.id.split("-").filter((w) => w.length > 3);
  if (idWords.some((w) => text.includes(w))) return true;

  return false;
}

export default function CategoryManager({
  open,
  onClose,
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [editingMemId, setEditingMemId] = useState<bigint | null>(null);
  const [editMemText, setEditMemText] = useState("");
  const [deletedMemIds, setDeletedMemIds] = useState<Set<string>>(new Set());

  const canEdit = canEditGlobal();

  const { data: globalMemories = [] } = useGetMemories(true);
  const { data: userMemories = [] } = useGetUserMemories();
  const { data: rules = [] } = useGetRules();
  const deleteMemory = useDeleteMemory();
  const deleteRule = useDeleteRule();
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

  useEffect(() => {
    if (open) {
      setCategories(getCategories());
      setCategorySearch("");
    }
  }, [open]);

  // Filter categories by search
  const filteredCategories = categorySearch.trim()
    ? categories.filter(
        (cat) =>
          cat.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
          (cat.description || "")
            .toLowerCase()
            .includes(categorySearch.toLowerCase()),
      )
    : categories;

  function handleEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || "");
  }

  function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    updateCategory(id, {
      name: editName.trim(),
      description: editDesc.trim() || undefined,
    });
    setCategories(getCategories());
    setEditingId(null);
  }

  function handleDelete(id: string) {
    deleteCategory(id);
    setCategories(getCategories());
  }

  function handleAdd() {
    if (!newName.trim()) return;
    addCategory(newName.trim(), newDesc.trim() || undefined);
    setCategories(getCategories());
    setNewName("");
    setNewDesc("");
  }

  const handleDeleteMemory = async (item: MemoryItem) => {
    setDeletedMemIds((prev) => new Set([...prev, item.id.toString()]));
    try {
      if (item.isRule) {
        await deleteRule.mutateAsync(item.id);
      } else {
        await deleteMemory.mutateAsync({
          id: item.id,
          isGlobal: item.isGlobal,
        });
      }
      toast.success("Entry deleted.");
    } catch {
      toast.error("Delete may not have synced, hidden locally.");
    }
  };

  const handleEditMemory = (item: MemoryItem) => {
    setEditingMemId(item.id);
    setEditMemText(item.text);
  };

  const handleSaveMemory = async (id: bigint) => {
    if (!editMemText.trim()) return;
    try {
      await updateMemory.mutateAsync({ id, text: editMemText.trim() });
      toast.success("Entry updated.");
      setEditingMemId(null);
    } catch {
      toast.error("Update failed.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-ocid="categories.modal"
        className="max-w-lg bg-black border border-gold/40 text-gold p-0 gap-0"
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gold/20">
          <DialogTitle className="font-mono text-sm tracking-[0.2em] uppercase text-gold flex items-center justify-between">
            Knowledge Categories
            <button
              type="button"
              data-ocid="categories.close_button"
              onClick={onClose}
              className="text-gold/50 hover:text-gold transition-colors"
            >
              <X size={16} />
            </button>
          </DialogTitle>
          <p className="text-[10px] font-mono text-gold/40 mt-1">
            Click a category to see connected messages
          </p>
        </DialogHeader>

        {/* Category search */}
        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
            <Input
              data-ocid="categories.search_input"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search categories..."
              className="pl-8 h-7 bg-black border-gold/40 text-gold placeholder-gold/30 focus:border-gold text-xs font-mono"
            />
          </div>
          {categorySearch && (
            <p className="text-[9px] font-mono text-gold/40 mt-1">
              {filteredCategories.length} of {categories.length} categories
            </p>
          )}
        </div>

        <ScrollArea className="max-h-[50vh]">
          <div className="px-5 py-2 space-y-1">
            {filteredCategories.length === 0 && (
              <p className="text-gold/40 text-xs font-mono text-center py-4">
                {categorySearch
                  ? "No matching categories."
                  : "No categories yet."}
              </p>
            )}
            {filteredCategories.map((cat, idx) => {
              const connected = allMemories.filter(
                (m) =>
                  !deletedMemIds.has(m.id.toString()) &&
                  matchesCategory(m, cat),
              );
              const isExpanded = expandedCat === cat.id;

              return (
                <div
                  key={cat.id}
                  data-ocid={`categories.item.${idx + 1}`}
                  className="border border-gold/20 rounded overflow-hidden mb-1"
                >
                  {/* Category header row */}
                  <div className="flex items-center gap-2 py-1.5 px-2 bg-black group">
                    {editingId === cat.id ? (
                      <div className="flex-1 flex flex-col gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-xs bg-black border-gold/40 text-gold placeholder-gold/30 focus:border-gold"
                          placeholder="Category name"
                        />
                        <Input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="h-7 text-xs bg-black border-gold/40 text-gold placeholder-gold/30 focus:border-gold"
                          placeholder="Description (optional)"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left flex items-center gap-2"
                        onClick={() =>
                          setExpandedCat(isExpanded ? null : cat.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown
                            size={12}
                            className="text-gold/60 shrink-0"
                          />
                        ) : (
                          <ChevronRight
                            size={12}
                            className="text-gold/60 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-gold truncate">
                            {cat.name}
                          </p>
                          {cat.description && (
                            <p className="text-[10px] text-gold/40 truncate">
                              {cat.description}
                            </p>
                          )}
                        </div>
                        {connected.length > 0 && (
                          <span className="ml-auto shrink-0 flex items-center gap-1 text-[9px] font-mono text-gold/50 border border-gold/20 px-1.5 py-0.5 rounded">
                            <MessageSquare size={8} />
                            {connected.length}
                          </span>
                        )}
                      </button>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      {editingId === cat.id ? (
                        <>
                          <button
                            type="button"
                            data-ocid="categories.save_button"
                            onClick={() => handleSaveEdit(cat.id)}
                            className="p-1 text-gold hover:text-gold/70 transition-colors"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            data-ocid="categories.cancel_button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gold/50 hover:text-gold/70 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        canEdit && (
                          <>
                            <button
                              type="button"
                              data-ocid={`categories.edit_button.${idx + 1}`}
                              onClick={() => handleEdit(cat)}
                              className="p-1 text-gold/40 hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              data-ocid={`categories.delete_button.${idx + 1}`}
                              onClick={() => handleDelete(cat.id)}
                              className="p-1 text-gold/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </div>

                  {/* Connected messages expanded panel */}
                  {isExpanded && (
                    <div className="border-t border-gold/20 bg-black/50">
                      {connected.length === 0 ? (
                        <p className="text-[10px] font-mono text-gold/30 text-center py-3">
                          No messages connected to this category yet.
                        </p>
                      ) : (
                        <div className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
                          {connected.map((mem) => (
                            <div
                              key={mem.id.toString()}
                              className="group flex gap-2 p-1.5 rounded border border-gold/10 hover:border-gold/30 transition-all"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span
                                    className={`text-[9px] px-1 py-0.5 rounded font-mono capitalize ${
                                      mem.isRule
                                        ? "bg-amber-900/40 text-amber-400"
                                        : mem.memoryType === "history"
                                          ? "bg-blue-900/40 text-blue-400"
                                          : mem.memoryType === "personal"
                                            ? "bg-purple-900/40 text-purple-400"
                                            : "bg-gold/10 text-gold/70"
                                    }`}
                                  >
                                    {mem.isRule ? "rule" : mem.memoryType}
                                  </span>
                                </div>

                                {editingMemId === mem.id ? (
                                  <div className="flex gap-1 mt-1">
                                    <Input
                                      value={editMemText}
                                      onChange={(e) =>
                                        setEditMemText(e.target.value)
                                      }
                                      className="h-6 text-xs bg-black border-gold/40 text-gold flex-1"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          handleSaveMemory(mem.id);
                                        if (e.key === "Escape")
                                          setEditingMemId(null);
                                      }}
                                      data-ocid="categories.input"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveMemory(mem.id)}
                                      className="p-1 text-gold hover:text-gold/70"
                                      data-ocid="categories.save_button"
                                    >
                                      <Check size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingMemId(null)}
                                      className="p-1 text-gold/50"
                                      data-ocid="categories.cancel_button"
                                    >
                                      <X size={11} />
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-gold/80 line-clamp-2 leading-relaxed">
                                    {mem.text}
                                  </p>
                                )}
                              </div>

                              {editingMemId !== mem.id &&
                                canEdit &&
                                !mem.isRule && (
                                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleEditMemory(mem)}
                                      className="p-0.5 text-gold/40 hover:text-gold transition-colors"
                                      data-ocid="categories.edit_button.1"
                                    >
                                      <Pencil size={10} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMemory(mem)}
                                      className="p-0.5 text-gold/40 hover:text-red-400 transition-colors"
                                      data-ocid="categories.delete_button.1"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                )}
                              {editingMemId !== mem.id &&
                                canEdit &&
                                mem.isRule && (
                                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMemory(mem)}
                                      className="p-0.5 text-gold/40 hover:text-red-400 transition-colors"
                                      data-ocid="categories.delete_button.1"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Add new category — only Class 5+ can add */}
        {canEdit && (
          <div className="px-5 py-3 border-t border-gold/20 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gold/50">
              Add Category
            </p>
            <div className="flex flex-col gap-1.5">
              <Input
                data-ocid="categories.input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Category name"
                className="h-7 text-xs bg-black border-gold/40 text-gold placeholder-gold/30 focus:border-gold"
              />
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Description (optional)"
                className="h-7 text-xs bg-black border-gold/40 text-gold placeholder-gold/30 focus:border-gold"
              />
              <Button
                data-ocid="categories.add_button"
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="h-7 text-xs font-mono bg-black text-gold border border-gold/50 hover:bg-gold/10 gap-1"
              >
                <Plus size={12} /> Add
              </Button>
            </div>
          </div>
        )}
        {!canEdit && (
          <div className="px-5 py-2 border-t border-gold/20">
            <p className="text-[10px] font-mono text-gold/30 text-center">
              Class 5 or Class 6 required to add/edit categories
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
