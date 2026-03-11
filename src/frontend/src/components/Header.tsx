import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Cpu, HelpCircle, Settings } from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

interface HeaderProps {
  onHelpOpen: () => void;
  onSettingsOpen: () => void;
}

export default function Header({ onHelpOpen, onSettingsOpen }: HeaderProps) {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const isAuthenticated = !!identity;

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      queryClient.clear();
    } else {
      try {
        await login();
      } catch (err: any) {
        if (err?.message === "User is already authenticated") {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
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
      </div>

      <div className="flex items-center gap-1">
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
        <button
          type="button"
          onClick={handleAuth}
          disabled={loginStatus === "logging-in"}
          className={`ml-1 px-3 py-1 text-xs font-mono rounded border transition-all ${
            isAuthenticated
              ? "border-gold/40 text-gold hover:border-gold hover:bg-gold/10"
              : "border-muted-foreground/30 text-muted-foreground hover:border-gold hover:text-gold"
          } disabled:opacity-50`}
        >
          {loginStatus === "logging-in"
            ? "CONNECTING..."
            : isAuthenticated
              ? "DISCONNECT"
              : "CONNECT"}
        </button>
      </div>
    </header>
  );
}
