import { Toaster } from "@/components/ui/sonner";
import { Brain, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import BrainVisualization from "./components/BrainVisualization";
import ChatPanel from "./components/ChatPanel";
import Header from "./components/Header";
import HelpModal from "./components/HelpModal";
import ImportExportPanel from "./components/ImportExportPanel";
import MemoryExplorer from "./components/MemoryExplorer";
import ProfileSetup from "./components/ProfileSetup";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "./hooks/useQueries";

const FEATURES = [
  "Teaching with TEACH: and IF...THEN...",
  "3D knowledge brain visualization",
  "Evolving personality system",
  "Personal memory and history",
];

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const { identity, isInitializing } = useInternetIdentity();
  const isAuthenticated = !!identity;
  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched,
  } = useGetCallerUserProfile();
  const showProfileSetup =
    isAuthenticated && !profileLoading && isFetched && userProfile === null;

  const currentYear = new Date().getFullYear();

  if (isInitializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Brain className="w-10 h-10 text-gold animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground tracking-[0.3em]">
            INITIALIZING SENTRY...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Header
        onHelpOpen={() => setHelpOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      {!isAuthenticated ? (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-6 p-8 max-w-sm text-center"
          >
            <div className="w-20 h-20 rounded-full border-2 border-gold/40 flex items-center justify-center gold-glow">
              <Brain className="w-10 h-10 text-gold" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-black tracking-[0.25em] text-gold gold-glow-text mb-2">
                SENTRY
              </h1>
              <p className="text-sm text-muted-foreground font-mono leading-relaxed">
                ADAPTIVE NEURAL TEACHING SYSTEM
              </p>
              <p className="text-xs text-muted-foreground/60 font-mono mt-1">
                Connect to begin learning together.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full text-left">
              {FEATURES.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <p className="text-xs font-mono text-muted-foreground/60">
              CLICK CONNECT IN THE HEADER TO BEGIN
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Memory Explorer */}
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

          {/* Right: Brain Visualization */}
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
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-5 h-8 bg-card border border-border rounded-l text-muted-foreground hover:text-gold"
              onClick={() => setRightOpen(true)}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

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
      <ProfileSetup open={showProfileSetup} />
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
