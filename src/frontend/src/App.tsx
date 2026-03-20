import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { Brain, ChevronLeft, ChevronRight, Cpu } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import BrainVisualization from "./components/BrainVisualization";
import ChatPanel from "./components/ChatPanel";
import CloneAIDialog from "./components/CloneAIDialog";
import Header from "./components/Header";
import HelpModal from "./components/HelpModal";
import ImportExportPanel from "./components/ImportExportPanel";
import LoginScreen from "./components/LoginScreen";
import MemoryExplorer from "./components/MemoryExplorer";
import UserManagement from "./components/UserManagement";
import { useActor } from "./hooks/useActor";
import { applyFont, getSavedFont } from "./utils/fontManager";
import { isLoggedIn } from "./utils/localAuth";
import { applyTheme, loadActiveTheme } from "./utils/themeManager";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);
  const [cloneAIOpen, setCloneAIOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobileMemoryOpen, setMobileMemoryOpen] = useState(false);
  const [mobileBrainOpen, setMobileBrainOpen] = useState(false);
  // Track active profile so MemoryExplorer remounts on switch
  const [activeProfileId, setActiveProfileId] = useState(
    () => localStorage.getItem("sentry_active_profile") || "default",
  );

  // Actor initializes in background — never block UI on this
  const { isFetching: actorInitializing } = useActor();

  // Apply saved theme and font on mount
  useEffect(() => {
    const theme = loadActiveTheme();
    applyTheme(theme);
    const font = getSavedFont();
    if (font) applyFont(font);
  }, []);

  // Listen for profile changes to remount MemoryExplorer
  useEffect(() => {
    const handler = () => {
      setActiveProfileId(
        localStorage.getItem("sentry_active_profile") || "default",
      );
    };
    window.addEventListener("sentry_profile_changed", handler);
    return () => window.removeEventListener("sentry_profile_changed", handler);
  }, []);

  const currentYear = new Date().getFullYear();

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header
        onHelpOpen={() => setHelpOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
        onUserManagement={() => setUserMgmtOpen(true)}
        onCloneAI={() => setCloneAIOpen(true)}
        onLogout={() => setLoggedIn(false)}
        onBrainToggle={() => {
          setRightOpen((v) => !v);
          // On mobile, open the brain sheet
          setMobileBrainOpen((v) => !v);
        }}
        brainOpen={rightOpen || mobileBrainOpen}
        isConnecting={actorInitializing}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Memory Explorer — desktop only */}
        <motion.div
          initial={false}
          animate={{ width: leftOpen ? 240 : 0 }}
          className="hidden md:flex flex-col border-r border-border overflow-hidden shrink-0"
          style={{ minWidth: 0 }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-xs font-mono text-gold tracking-widest">
              MEMORY CORE
            </span>
            <button
              type="button"
              onClick={() => setLeftOpen((v) => !v)}
              className="text-muted-foreground hover:text-gold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          <MemoryExplorer
            key={activeProfileId}
            onMemoryClick={(text) => console.log("Focus:", text)}
          />
        </motion.div>

        {/* Center: Chat */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {!leftOpen && (
            <button
              type="button"
              className="absolute left-2 top-3 z-10 flex items-center justify-center w-6 h-6 bg-card border border-border rounded text-muted-foreground hover:text-gold"
              onClick={() => setLeftOpen(true)}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <ChatPanel />
        </div>

        {/* Right: Brain Visualization — desktop only */}
        <motion.div
          initial={false}
          animate={{ width: rightOpen ? 280 : 0 }}
          className="hidden lg:flex flex-col border-l border-border overflow-hidden shrink-0 relative"
          style={{ minWidth: 0 }}
        >
          {rightOpen && (
            <button
              type="button"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-5 h-8 bg-card border border-border rounded-r text-muted-foreground hover:text-gold"
              onClick={() => setRightOpen(false)}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <BrainVisualization />
        </motion.div>

        {!rightOpen && (
          <button
            type="button"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden lg:flex items-center justify-center w-5 h-8 bg-card border border-border rounded-l text-muted-foreground hover:text-gold"
            onClick={() => setRightOpen(true)}
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}

        {/* Mobile floating action buttons */}
        <div className="md:hidden fixed bottom-24 left-3 z-30 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMobileMemoryOpen(true)}
            className="w-10 h-10 rounded-full bg-card border border-gold/40 flex items-center justify-center text-gold hover:border-gold transition-colors shadow-lg"
            aria-label="Open Memory Core"
            data-ocid="memory.open_modal_button"
          >
            <Cpu className="w-4 h-4" />
          </button>
        </div>

        <div className="lg:hidden fixed bottom-24 right-3 z-30 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMobileBrainOpen(true)}
            className="w-10 h-10 rounded-full bg-card border border-gold/40 flex items-center justify-center text-gold hover:border-gold transition-colors shadow-lg"
            aria-label="Open Brain Visualization"
            data-ocid="brain.open_modal_button"
          >
            <Brain className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Memory Core Sheet */}
      <Sheet open={mobileMemoryOpen} onOpenChange={setMobileMemoryOpen}>
        <SheetContent
          side="left"
          className="w-72 bg-black border-r border-gold/30 p-0"
          data-ocid="memory.sheet"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gold/30">
            <span className="text-xs font-mono text-gold tracking-widest">
              MEMORY CORE
            </span>
          </div>
          <MemoryExplorer
            key={`mobile-${activeProfileId}`}
            onMemoryClick={(_text) => {
              setMobileMemoryOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Mobile Brain Sheet */}
      <Sheet open={mobileBrainOpen} onOpenChange={setMobileBrainOpen}>
        <SheetContent
          side="right"
          className="w-80 bg-black border-l border-gold/30 p-0"
          data-ocid="brain.sheet"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gold/30">
            <span className="text-xs font-mono text-gold tracking-widest">
              BRAIN VISUALIZATION
            </span>
          </div>
          <BrainVisualization />
        </SheetContent>
      </Sheet>

      {/* Footer */}
      <footer className="shrink-0 border-t border-border px-4 py-1.5 flex items-center justify-center">
        <p className="text-[10px] text-muted-foreground/40 font-mono">
          &copy; {currentYear}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold/40 hover:text-gold transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </footer>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ImportExportPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <UserManagement
        open={userMgmtOpen}
        onClose={() => setUserMgmtOpen(false)}
      />
      <CloneAIDialog open={cloneAIOpen} onClose={() => setCloneAIOpen(false)} />
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
