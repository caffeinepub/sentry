import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Search, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  addUser,
  getCredentials,
  getCurrentUser,
  removeUser,
} from "../utils/localAuth";

interface UserManagementProps {
  open: boolean;
  onClose: () => void;
}

export default function UserManagement({ open, onClose }: UserManagementProps) {
  const [search, setSearch] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  if (!open) return null;

  const currentUser = getCurrentUser();
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

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "oklch(0 0 0 / 0.8)" }}
    >
      {/* Invisible click-away area */}
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md bg-card border border-gold/30 rounded-lg shadow-2xl p-6"
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

        <div className="space-y-1.5 mb-6 max-h-48 overflow-y-auto">
          {filtered.map((c, idx) => (
            <div
              key={c.username}
              className="flex items-center justify-between px-3 py-2 bg-secondary/30 border border-border rounded"
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
              <div>
                <span className="text-xs font-mono text-foreground">
                  {c.username}
                </span>
                {c.username === currentUser && (
                  <span className="ml-2 text-[9px] font-mono text-gold">
                    [YOU]
                  </span>
                )}
              </div>
              {confirmDelete === c.username ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-destructive mr-1">
                    Confirm?
                  </span>
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
              )}
            </div>
          ))}
        </div>

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
              className="w-full h-8 bg-gold/10 border border-gold/40 text-gold hover:bg-gold/20 text-xs font-mono tracking-widest"
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
    </div>
  );
}
