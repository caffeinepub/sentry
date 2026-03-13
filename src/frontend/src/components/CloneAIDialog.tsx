import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getCurrentUser, isClass6 } from "../utils/localAuth";

interface AIProfile {
  id: string;
  name: string;
  createdAt: number;
  memories: unknown[];
  rules: unknown[];
  categories: unknown[];
  personality: unknown;
  globalMemories?: unknown[];
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

function getActiveProfileId(): string | null {
  return localStorage.getItem("sentry_active_profile");
}

function setActiveProfileId(id: string | null): void {
  if (id) {
    localStorage.setItem("sentry_active_profile", id);
  } else {
    localStorage.removeItem("sentry_active_profile");
  }
}

interface CloneAIDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CloneAIDialog({ open, onClose }: CloneAIDialogProps) {
  const [newName, setNewName] = useState("");
  const [cloning, setCloning] = useState(false);
  const [profiles, setProfiles] = useState<AIProfile[]>(() => loadProfiles());
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    () => getActiveProfileId(),
  );

  const currentUser = getCurrentUser() || "";
  const userIsClass6 = isClass6(currentUser);

  const isTrainerFor = (profileId: string): boolean => {
    try {
      const raw = localStorage.getItem(`sentry_ai_trainers_${profileId}`);
      const trainers: string[] = raw ? JSON.parse(raw) : [];
      return trainers.some(
        (t) => t.toLowerCase() === currentUser.toLowerCase(),
      );
    } catch {
      return false;
    }
  };

  const refreshProfiles = () => {
    setProfiles(loadProfiles());
    setActiveProfileIdState(getActiveProfileId());
  };

  const handleActivate = (profileId: string) => {
    setActiveProfileId(profileId);
    setActiveProfileIdState(profileId);
    // Restore this profile's global memories into the active key
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
      const profileName =
        localStorage.getItem(`sentry_ai_name_${profileId}`) || profile.name;
      localStorage.setItem(`sentry_ai_name_${profileId}`, profileName);
      // Restore global memories from the profile snapshot
      if (profile.globalMemories) {
        localStorage.setItem(
          "sentry_global_memories",
          JSON.stringify(profile.globalMemories),
        );
      }
    }
    // Notify same-tab listeners (storage event only fires for other tabs)
    window.dispatchEvent(
      new CustomEvent("sentry_profile_changed", { detail: { profileId } }),
    );
    toast.success("AI profile activated");
  };

  const handleDelete = (profileId: string) => {
    if (!userIsClass6) {
      toast.error("Only Class 6 members can delete AI profiles.");
      return;
    }
    const updated = profiles.filter((p) => p.id !== profileId);
    saveProfiles(updated);
    if (activeProfileId === profileId) {
      setActiveProfileId(null);
      setActiveProfileIdState(null);
    }
    setProfiles(updated);
    toast.success("Profile deleted");
  };

  const handleClone = () => {
    if (!userIsClass6) {
      toast.error(
        "Only Class 6 members (Unity, Syndelious) can create new AI templates.",
      );
      return;
    }
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

      // Gather global memories
      const globalMemoriesRaw = localStorage.getItem("sentry_global_memories");
      const globalMemories = globalMemoriesRaw
        ? JSON.parse(globalMemoriesRaw)
        : [];

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
        globalMemories,
        rules,
        categories,
        personality,
        // NOT copied: chat history, avatar, theme, font
      };

      const existing = loadProfiles();
      existing.push(profile);
      saveProfiles(existing);

      toast.success(`AI profile "${newName.trim()}" created.`);
      setNewName("");
      refreshProfiles();
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
        className="bg-card border-gold/30 max-w-md"
        data-ocid="clone_ai.dialog"
      >
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-gold tracking-[0.2em] flex items-center gap-2">
              <Copy className="w-4 h-4" />
              AI PROFILE CLONE
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
          <p className="text-[10px] font-mono text-gold/60 mt-1">
            Select your active AI profile below. All members can switch
            profiles. AI teachers and Class 6 can rename and update profile
            photos.
          </p>
          {!userIsClass6 && (
            <p className="text-[10px] font-mono text-gold/50 mt-1">
              CLASS 6 RESTRICTED — You can use and activate profiles, but only
              Unity or Syndelious can create or delete them.
            </p>
          )}
        </DialogHeader>

        {/* Existing profiles list */}
        <div className="space-y-2 mb-4">
          <p className="text-[10px] font-mono text-gold/60 tracking-widest">
            AI PROFILES
          </p>
          {profiles.length === 0 ? (
            <p
              className="text-[11px] font-mono text-muted-foreground/50 py-2 text-center"
              data-ocid="clone_ai.empty_state"
            >
              No cloned profiles yet
            </p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {profiles.map((profile, idx) => {
                const isActive = profile.id === activeProfileId;
                return (
                  <div
                    key={profile.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded border ${
                      isActive
                        ? "border-gold bg-black"
                        : "border-gold/20 bg-black/50"
                    }`}
                    data-ocid={
                      idx === 0
                        ? "clone_ai.item.1"
                        : idx === 1
                          ? "clone_ai.item.2"
                          : idx === 2
                            ? "clone_ai.item.3"
                            : undefined
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isActive && (
                          <Check className="w-3 h-3 text-gold shrink-0" />
                        )}
                        <span className="text-xs font-mono text-foreground truncate">
                          {profile.name}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">
                        {new Date(profile.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[9px] font-mono text-gold hover:bg-gold/10"
                          onClick={() => handleActivate(profile.id)}
                          data-ocid="clone_ai.primary_button"
                        >
                          ACTIVATE
                        </Button>
                      )}
                      {isActive && (
                        <span className="text-[9px] font-mono text-gold/70 px-1">
                          ACTIVE
                        </span>
                      )}
                      {(userIsClass6 || isTrainerFor(profile.id)) && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[9px] font-mono text-gold/70 hover:bg-gold/10"
                            onClick={() => {
                              const n = prompt("New AI name:", profile.name);
                              if (n?.trim()) {
                                localStorage.setItem(
                                  `sentry_ai_name_${profile.id}`,
                                  n.trim(),
                                );
                                const updated = profiles.map((p) =>
                                  p.id === profile.id
                                    ? { ...p, name: n.trim() }
                                    : p,
                                );
                                saveProfiles(updated);
                                setProfiles(updated);
                                toast.success("AI renamed.");
                              }
                            }}
                            data-ocid="clone_ai.edit_button"
                          >
                            RENAME
                          </Button>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const url = ev.target?.result as string;
                                  localStorage.setItem(
                                    `sentry_ai_avatar_${profile.id}`,
                                    url,
                                  );
                                  toast.success("AI avatar updated.");
                                };
                                reader.readAsDataURL(file);
                                e.target.value = "";
                              }}
                            />
                            <span
                              className="text-[9px] font-mono text-gold/70 px-1.5 py-0.5 rounded hover:bg-gold/10 cursor-pointer"
                              title="Upload AI avatar"
                              data-ocid="clone_ai.upload_button"
                            >
                              📷
                            </span>
                          </label>
                        </>
                      )}
                      {userIsClass6 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(profile.id)}
                          data-ocid="clone_ai.delete_button"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create new clone — Class 6 only */}
        {userIsClass6 && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-[10px] font-mono text-gold/60 tracking-widest">
              CREATE NEW CLONE
            </p>
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">
              Copies memories, rules, categories, and global knowledge — not
              chat history, name, theme, or avatar.
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
        )}
      </DialogContent>
    </Dialog>
  );
}
