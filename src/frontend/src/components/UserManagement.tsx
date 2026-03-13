import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Pencil,
  Search,
  Shield,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  addUser,
  getCredentials,
  getCurrentUser,
  getUserLoginAvatar,
  isClass6,
  isProtectedUser,
  removeUser,
  setUserLoginAvatar,
  updateUser,
} from "../utils/localAuth";
import { getUserAvatar } from "../utils/localDB";

interface AIProfile {
  id: string;
  name: string;
}

function loadAIProfiles(): AIProfile[] {
  try {
    const raw = localStorage.getItem("sentry_ai_profiles");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getTrainers(profileId: string): string[] {
  try {
    const raw = localStorage.getItem(`sentry_ai_trainers_${profileId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setTrainers(profileId: string, trainers: string[]): void {
  localStorage.setItem(
    `sentry_ai_trainers_${profileId}`,
    JSON.stringify(trainers),
  );
}

interface UserManagementProps {
  open: boolean;
  onClose: () => void;
}

export default function UserManagement({ open, onClose }: UserManagementProps) {
  const [search, setSearch] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [, forceUpdate] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageTargetUser, setImageTargetUser] = useState<string | null>(null);
  const [showAIAccess, setShowAIAccess] = useState(false);
  const [aiAccessSearchMap, setAiAccessSearchMap] = useState<
    Record<string, string>
  >({});
  const [aiProfiles] = useState<AIProfile[]>(() => loadAIProfiles());
  const [trainerMap, setTrainerMap] = useState<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {};
    for (const p of loadAIProfiles()) {
      result[p.id] = getTrainers(p.id);
    }
    return result;
  });

  if (!open) return null;

  const currentUser = getCurrentUser();
  const canManageImages = currentUser ? isProtectedUser(currentUser) : false;
  const userIsClass6 = currentUser ? isClass6(currentUser) : false;
  const creds = getCredentials();
  const filtered = search
    ? creds.filter((c) =>
        c.username.toLowerCase().includes(search.toLowerCase()),
      )
    : creds;

  const handleAdd = () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error("Username and password required");
      return;
    }
    if (addUser(newUsername.trim(), newPassword.trim())) {
      toast.success(`Agent "${newUsername}" created`);
      setNewUsername("");
      setNewPassword("");
      forceUpdate((n) => n + 1);
    } else {
      toast.error("Agent ID already exists");
    }
  };

  const handleRemove = (username: string) => {
    if (username === currentUser) {
      toast.error("Cannot remove current agent");
      return;
    }
    if (removeUser(username)) {
      toast.success(`Agent "${username}" removed`);
      setConfirmDelete(null);
      forceUpdate((n) => n + 1);
    } else {
      toast.error("Cannot remove — only one agent remaining");
    }
  };

  const startEdit = (username: string) => {
    setEditingUser(username);
    setEditUsername(username);
    setEditPassword("");
  };

  const saveEdit = (oldUsername: string) => {
    if (!editPassword.trim()) {
      toast.error("Password required");
      return;
    }
    const targetUsername = isProtectedUser(oldUsername)
      ? oldUsername
      : editUsername.trim();
    if (!targetUsername) {
      toast.error("Username required");
      return;
    }
    if (updateUser(oldUsername, targetUsername, editPassword.trim())) {
      toast.success(`Agent "${targetUsername}" updated`);
      setEditingUser(null);
      forceUpdate((n) => n + 1);
    } else {
      toast.error("Update failed — username may be taken");
    }
  };

  const handleSetLoginImage = (username: string) => {
    setImageTargetUser(username);
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageTargetUser) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUserLoginAvatar(imageTargetUser, dataUrl); // login image only
      toast.success(`Login image set for "${imageTargetUser}"`);
      setImageTargetUser(null);
      forceUpdate((n) => n + 1);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleExportLoginImage = (username: string) => {
    const avatar = getUserLoginAvatar(username);
    if (!avatar) {
      toast.error(`No login image set for "${username}"`);
      return;
    }
    const a = document.createElement("a");
    a.href = avatar;
    a.download = `${username}_login_image.png`;
    a.click();
    toast.success(`Login image exported for "${username}"`);
  };

  const toggleTrainer = (profileId: string, username: string) => {
    const current = trainerMap[profileId] || [];
    const updated = current.includes(username)
      ? current.filter((u) => u !== username)
      : [...current, username];
    setTrainers(profileId, updated);
    setTrainerMap((prev) => ({ ...prev, [profileId]: updated }));
    toast.success(`AI access updated for ${username}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "oklch(0 0 0 / 0.8)" }}
    >
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md bg-card border border-gold/30 rounded-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        data-ocid="user_management.dialog"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-black text-gold tracking-widest text-sm">
            AGENT MANAGEMENT
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-gold"
            onClick={onClose}
            data-ocid="user_management.close_button"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agent ID..."
            className="pl-8 h-8 bg-input border-border text-xs font-mono"
            data-ocid="user_management.search_input"
          />
        </div>

        <div className="space-y-1.5 mb-6 max-h-56 overflow-y-auto">
          {filtered.map((c, idx) => {
            const loginAvatar = getUserLoginAvatar(c.username);
            return (
              <div
                key={c.username}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary/30 border border-border rounded"
                data-ocid={
                  idx === 0
                    ? "user_management.item.1"
                    : idx === 1
                      ? "user_management.item.2"
                      : idx === 2
                        ? "user_management.item.3"
                        : undefined
                }
              >
                {editingUser === c.username ? (
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Input
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      disabled={isProtectedUser(c.username)}
                      placeholder="Username"
                      className="h-7 text-xs font-mono bg-input border-border"
                      data-ocid="user_management.input"
                    />
                    <Input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="New access code"
                      className="h-7 text-xs font-mono bg-input border-border"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(c.username);
                        if (e.key === "Escape") setEditingUser(null);
                      }}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-gold hover:bg-gold/10 font-mono"
                        onClick={() => saveEdit(c.username)}
                        data-ocid="user_management.save_button"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        SAVE
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-muted-foreground font-mono"
                        onClick={() => setEditingUser(null)}
                        data-ocid="user_management.cancel_button"
                      >
                        CANCEL
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {/* Login image preview — 24x24 circular */}
                        {loginAvatar ? (
                          <img
                            src={loginAvatar}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover border border-gold/40 shrink-0"
                          />
                        ) : (
                          (() => {
                            const chatAvatar = getUserAvatar(c.username);
                            return chatAvatar ? (
                              <img
                                src={chatAvatar}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover border border-gold/20 shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                                <span className="text-[8px] font-mono text-gold">
                                  {c.username[0]?.toUpperCase()}
                                </span>
                              </div>
                            );
                          })()
                        )}
                        {isProtectedUser(c.username) && (
                          <Shield className="w-3 h-3 text-gold/50 shrink-0" />
                        )}
                        <span className="text-xs font-mono text-foreground truncate">
                          {c.username}
                        </span>
                        {c.username === currentUser && (
                          <span className="text-[9px] font-mono text-gold">
                            [YOU]
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {/* Upload: privileged users can upload for anyone; any user can upload their own */}
                      {(canManageImages || c.username === currentUser) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-muted-foreground hover:text-gold"
                          onClick={() => handleSetLoginImage(c.username)}
                          title="Set Login Image"
                          data-ocid="user_management.upload_button"
                        >
                          <Camera className="w-3 h-3" />
                        </Button>
                      )}
                      {/* Export: privileged users only */}
                      {canManageImages && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-muted-foreground hover:text-gold"
                          onClick={() => handleExportLoginImage(c.username)}
                          title={`Export login image for ${c.username}`}
                          data-ocid="user_management.secondary_button"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 text-muted-foreground hover:text-gold"
                        onClick={() => startEdit(c.username)}
                        data-ocid="user_management.edit_button.1"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      {!isProtectedUser(c.username) &&
                        (confirmDelete === c.username ? (
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6 text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemove(c.username)}
                              data-ocid="user_management.confirm_button"
                            >
                              <AlertTriangle className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6 text-muted-foreground"
                              onClick={() => setConfirmDelete(null)}
                              data-ocid="user_management.cancel_button"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-muted-foreground hover:text-destructive"
                            disabled={c.username === currentUser}
                            onClick={() => setConfirmDelete(c.username)}
                            data-ocid="user_management.delete_button.1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* AI Access / Trainer Permissions — Class 6 only */}
        {userIsClass6 && aiProfiles.length > 0 && (
          <div className="border-t border-border pt-4 mb-4">
            <button
              type="button"
              className="flex items-center gap-1 text-[10px] font-mono text-gold/60 tracking-widest hover:text-gold transition-colors mb-3"
              onClick={() => setShowAIAccess((v) => !v)}
              data-ocid="user_management.toggle"
            >
              {showAIAccess ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              AI GLOBAL TEACH ACCESS
            </button>
            {showAIAccess && (
              <div className="space-y-4">
                <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed">
                  Select which members can globally teach each AI. Non-selected
                  members can still use the AI but can only teach it about
                  themselves.
                </p>
                {aiProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="border border-border rounded p-3 space-y-2"
                  >
                    <p className="text-[10px] font-mono text-gold/80 tracking-widest">
                      {profile.name}
                    </p>
                    <div className="mb-2">
                      <input
                        type="text"
                        value={aiAccessSearchMap[profile.id] || ""}
                        onChange={(e) =>
                          setAiAccessSearchMap((prev) => ({
                            ...prev,
                            [profile.id]: e.target.value,
                          }))
                        }
                        placeholder="Search members..."
                        className="w-full bg-input border border-gold/30 rounded px-2 py-1 text-gold font-mono text-xs focus:outline-none focus:border-gold placeholder:text-muted-foreground/40"
                        data-ocid="user_management.search_input"
                      />
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {creds
                        .filter(
                          (c) =>
                            !isClass6(c.username) &&
                            (!(aiAccessSearchMap[profile.id] || "") ||
                              c.username
                                .toLowerCase()
                                .includes(
                                  (
                                    aiAccessSearchMap[profile.id] || ""
                                  ).toLowerCase(),
                                )),
                        )
                        .map((c) => {
                          const trainers = trainerMap[profile.id] || [];
                          const isTrainer = trainers.includes(c.username);
                          return (
                            <div
                              key={c.username}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id={`trainer-${profile.id}-${c.username}`}
                                checked={isTrainer}
                                onCheckedChange={() =>
                                  toggleTrainer(profile.id, c.username)
                                }
                                className="border-gold/30 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                                data-ocid="user_management.checkbox"
                              />
                              <label
                                htmlFor={`trainer-${profile.id}-${c.username}`}
                                className="text-xs font-mono text-foreground cursor-pointer"
                              >
                                {c.username}
                              </label>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border pt-4">
          <p className="text-[10px] font-mono text-gold/60 tracking-widest mb-3">
            ADD NEW AGENT
          </p>
          <div className="space-y-2">
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Agent ID"
              className="h-8 bg-input border-border text-xs font-mono"
              data-ocid="user_management.input"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Access code"
              className="h-8 bg-input border-border text-xs font-mono"
            />
            <Button
              className="w-full h-8 bg-gold border border-gold text-black font-bold hover:bg-gold-bright text-xs font-mono tracking-widest"
              variant="ghost"
              onClick={handleAdd}
              data-ocid="user_management.primary_button"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              CREATE AGENT
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden file input for login image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
    </div>
  );
}
