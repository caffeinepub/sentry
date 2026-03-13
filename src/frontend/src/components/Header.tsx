import { Button } from "@/components/ui/button";
import {
  Brain,
  Copy,
  Cpu,
  HelpCircle,
  LogOut,
  Palette,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getCurrentUser, isClass6, logout } from "../utils/localAuth";

interface HeaderProps {
  onHelpOpen: () => void;
  onSettingsOpen: () => void;
  onUserManagement: () => void;
  onCloneAI: () => void;
  onLogout: () => void;
  onBrainToggle?: () => void;
  brainOpen?: boolean;
  isConnecting?: boolean;
}

function getActiveProfileId(): string {
  return localStorage.getItem("sentry_active_profile") || "default";
}

function getActiveAiName(): string {
  const pid = getActiveProfileId();
  return localStorage.getItem(`sentry_ai_name_${pid}`) || "SENTRY";
}

function getActiveAiAvatar(): string {
  const pid = getActiveProfileId();
  return localStorage.getItem(`sentry_ai_avatar_${pid}`) || "";
}

export default function Header({
  onHelpOpen,
  onSettingsOpen,
  onUserManagement,
  onCloneAI,
  onLogout,
  onBrainToggle,
  brainOpen,
  isConnecting,
}: HeaderProps) {
  const username = getCurrentUser() || "";
  const userIsClass6 = isClass6(username);

  const [aiName, setAiName] = useState<string>(getActiveAiName);
  const [aiAvatar, setAiAvatar] = useState<string>(getActiveAiAvatar);

  useEffect(() => {
    const refresh = () => {
      setAiName(getActiveAiName());
      setAiAvatar(getActiveAiAvatar());
    };
    window.addEventListener("sentry_profile_changed", refresh);
    window.addEventListener("sentry_ai_name_changed", refresh);
    window.addEventListener("sentry_ai_avatar_changed", refresh);
    // Poll every 2s as fallback for cases where events aren't fired
    const poll = setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("sentry_profile_changed", refresh);
      window.removeEventListener("sentry_ai_name_changed", refresh);
      window.removeEventListener("sentry_ai_avatar_changed", refresh);
      clearInterval(poll);
    };
  }, []);

  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <header
      className="relative flex items-center justify-between px-4 py-2 bg-black/80 backdrop-blur-sm border-b border-border overflow-hidden shrink-0"
      style={{ minHeight: 52 }}
    >
      <div className="scanline" />
      <div className="flex items-center gap-2">
        {/* Active AI avatar or default CPU icon */}
        {aiAvatar ? (
          <img
            src={aiAvatar}
            alt={aiName}
            className="w-6 h-6 rounded-full object-cover border border-gold/50 shrink-0"
          />
        ) : (
          <Cpu className="w-5 h-5 text-gold" strokeWidth={1.5} />
        )}
        <span className="font-display font-black tracking-[0.25em] text-gold gold-glow-text text-lg uppercase">
          {aiName}
        </span>
        <span className="hidden sm:inline-block text-xs text-muted-foreground font-mono tracking-widest ml-2 opacity-60">
          v2.0 NEURAL INTERFACE
        </span>
        {isConnecting && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50 tracking-widest ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gold/40 animate-pulse" />
            SYNCING
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {username && (
          <span className="text-[10px] font-mono text-gold/70 tracking-widest mr-2 hidden sm:inline">
            AGENT: {username.toUpperCase()}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-gold w-8 h-8"
          onClick={onHelpOpen}
          data-ocid="help.open_modal_button"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-gold w-8 h-8"
          onClick={onSettingsOpen}
          title="Settings & Theme"
          data-ocid="settings.open_modal_button"
        >
          <Settings className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-gold w-8 h-8"
          onClick={onSettingsOpen}
          title="Chat Theme"
          data-ocid="theme.open_modal_button"
        >
          <Palette className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-gold w-8 h-8"
          onClick={onCloneAI}
          title="AI Profiles"
          data-ocid="clone_ai.open_modal_button"
        >
          <Copy className="w-4 h-4" />
        </Button>
        {userIsClass6 && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-gold w-8 h-8"
            onClick={onUserManagement}
            title="Manage agents"
            data-ocid="user_management.open_modal_button"
          >
            <Users className="w-4 h-4" />
          </Button>
        )}
        {onBrainToggle && (
          <Button
            variant="ghost"
            size="icon"
            className={`w-8 h-8 transition-colors ${
              brainOpen
                ? "text-gold bg-gold/10 border border-gold/30"
                : "text-muted-foreground hover:text-gold"
            }`}
            onClick={onBrainToggle}
            title={brainOpen ? "Hide 3D Brain" : "Show 3D Brain"}
            data-ocid="brain.toggle"
          >
            <Brain className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          className="text-gold hover:text-gold/80 hover:bg-gold/10 border border-gold/30 hover:border-gold/60 h-8 px-3 font-mono text-[10px] tracking-widest gap-1.5 transition-all"
          onClick={handleLogout}
          title="Sign Out"
          data-ocid="logout.button"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>SIGN OUT</span>
        </Button>
      </div>
    </header>
  );
}
