import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import type { UserProfile } from "../backend.d";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useSaveCallerUserProfile } from "../hooks/useQueries";

interface ProfileSetupProps {
  open: boolean;
}

export default function ProfileSetup({ open }: ProfileSetupProps) {
  const [username, setUsername] = useState("");
  const { identity } = useInternetIdentity();
  const saveProfile = useSaveCallerUserProfile();

  const handleSubmit = async () => {
    if (!username.trim()) return;
    const principalId = identity?.getPrincipal().toString() ?? "";
    const profile: UserProfile = {
      principalId,
      username: username.trim(),
      avatarUrl: "",
      personality: { curiosity: 0.5, friendliness: 0.5, analytical: 0.5 },
    };
    try {
      await saveProfile.mutateAsync(profile);
      toast.success("Profile created. Welcome to Sentry.");
    } catch {
      toast.error("Failed to save profile.");
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="bg-card border-gold/30 max-w-sm"
        data-ocid="profile.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-gold tracking-widest">
            INITIALIZE PROFILE
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Choose your callsign to begin interfacing with Sentry.
          </p>
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground tracking-widest">
              CALLSIGN
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name..."
              className="bg-input border-border font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              data-ocid="profile.input"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!username.trim() || saveProfile.isPending}
            className="w-full bg-gold text-primary-foreground hover:bg-gold-bright font-mono tracking-widest"
            data-ocid="profile.submit_button"
          >
            {saveProfile.isPending ? "INITIALIZING..." : "INITIALIZE"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
