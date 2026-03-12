import { Button } from "@/components/ui/button";
import { Brain, Cpu, HelpCircle, LogOut, Settings, Users } from "lucide-react";
import { getCurrentUser, logout } from "../utils/localAuth";

interface HeaderProps {
  onHelpOpen: () => void;
  onSettingsOpen: () => void;
  onUserManagement: () => void;
  onLogout: () => void;
  onBrainToggle?: () => void;
  brainOpen?: boolean;
  isConnecting?: boolean;
}

export default function Header({
  onHelpOpen,
  onSettingsOpen,
  onUserManagement,
  onLogout,
  onBrainToggle,
  brainOpen,
  isConnecting,
}: HeaderProps) {
  const username = getCurrentUser() || "";

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
        <Cpu className="w-5 h-5 text-gold" strokeWidth={1.5} />
        <span className="font-display font-black tracking-[0.25em] text-gold gold-glow-text text-lg uppercase">
          SENTRY
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
          data-ocid="settings.open_modal_button"
        >
          <Settings className="w-4 h-4" />
        </Button>
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
          size="icon"
          className="text-muted-foreground hover:text-destructive w-8 h-8"
          onClick={handleLogout}
          title="Logout"
          data-ocid="logout.button"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
