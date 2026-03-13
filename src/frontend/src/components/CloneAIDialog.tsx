import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getCurrentUser } from "../utils/localAuth";

interface AIProfile {
  id: string;
  name: string;
  createdAt: number;
  memories: unknown[];
  rules: unknown[];
  categories: unknown[];
  personality: unknown;
}

function loadProfiles(): AIProfile[] {
  try {
    const raw = localStorage.getItem("sentry_ai_profiles");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProfiles(profiles: AIProfile[]): void {
  localStorage.setItem("sentry_ai_profiles", JSON.stringify(profiles));
}

interface CloneAIDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CloneAIDialog({ open, onClose }: CloneAIDialogProps) {
  const [newName, setNewName] = useState("");
  const [cloning, setCloning] = useState(false);

  const handleClone = () => {
    if (!newName.trim()) {
      toast.error("Name required.");
      return;
    }
    setCloning(true);
    try {
      const username = getCurrentUser() || "Unity";

      // Gather memories from localStorage
      const memoriesRaw = localStorage.getItem(
        `sentry_user_memories_${username}`,
      );
      const memories = memoriesRaw ? JSON.parse(memoriesRaw) : [];

      // Gather rules (global)
      const rulesRaw = localStorage.getItem("sentry_global_rules");
      const rules = rulesRaw ? JSON.parse(rulesRaw) : [];

      // Gather categories
      const catsRaw = localStorage.getItem("sentry_categories");
      const categories = catsRaw ? JSON.parse(catsRaw) : [];

      // Gather personality
      const personalityRaw = localStorage.getItem(
        `sentry_personality_${username}`,
      );
      const personality = personalityRaw ? JSON.parse(personalityRaw) : {};

      const profile: AIProfile = {
        id: `profile_${Date.now()}`,
        name: newName.trim(),
        createdAt: Date.now(),
        memories,
        rules,
        categories,
        personality,
        // NOT copied: chat history, avatar, theme, font
      };

      const profiles = loadProfiles();
      profiles.push(profile);
      saveProfiles(profiles);

      toast.success(`AI profile "${newName.trim()}" created.`);
      setNewName("");
      onClose();
    } catch (err) {
      toast.error("Failed to clone AI profile.");
      console.error(err);
    } finally {
      setCloning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="bg-card border-gold/30 max-w-sm"
        data-ocid="clone_ai.dialog"
      >
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-gold tracking-[0.2em] flex items-center gap-2">
              <Copy className="w-4 h-4" />
              CLONE AI PROFILE
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-gold w-7 h-7"
              onClick={onClose}
              data-ocid="clone_ai.close_button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground font-mono leading-relaxed">
            Creates a new AI profile with the same memories, rules, and
            categories — but not the chat history, name, theme, or avatar.
          </p>

          <div className="space-y-2">
            <Label className="text-xs font-mono text-gold/70">
              NEW AI NAME
            </Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleClone()}
              className="font-mono text-sm bg-black/50 border-gold/30 text-gold"
              placeholder="e.g. Sentry-Alpha"
              data-ocid="clone_ai.input"
            />
          </div>

          <Button
            className="w-full bg-gold text-black font-mono font-bold hover:bg-gold/90"
            onClick={handleClone}
            disabled={cloning}
            data-ocid="clone_ai.submit_button"
          >
            <Copy className="w-4 h-4 mr-2" />
            {cloning ? "CLONING..." : "CLONE AI"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
