import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type Category,
  addCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../utils/categoryDB";

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
}

export default function CategoryManager({
  open,
  onClose,
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (open) {
      setCategories(getCategories());
    }
  }, [open]);

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
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="px-5 py-3 space-y-1">
            {categories.length === 0 && (
              <p className="text-gold/40 text-xs font-mono text-center py-4">
                No categories yet.
              </p>
            )}
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                data-ocid={`categories.item.${idx + 1}`}
                className="flex items-center gap-2 py-1.5 border-b border-gold/10 group"
              >
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
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gold truncate">
                      {cat.name}
                    </p>
                    {cat.description && (
                      <p className="text-[10px] text-gold/40 truncate">
                        {cat.description}
                      </p>
                    )}
                  </div>
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
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Add new category */}
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
              className="h-7 text-xs font-mono bg-gold text-black hover:bg-gold/80 border-0 gap-1"
            >
              <Plus size={12} /> Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
