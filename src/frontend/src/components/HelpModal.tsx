import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";

const SECTIONS = [
  {
    title: "TEACH: command",
    content:
      "Teach Sentry general knowledge that becomes part of the global knowledge base.\n\nExample: TEACH: The speed of light is approximately 299,792 km/s",
    color: "badge-knowledge",
  },
  {
    title: "IF...THEN... rules",
    content:
      "Teach cause-and-effect rules. Sentry can chain these for multi-step reasoning.\n\nExample: IF it rains THEN the ground gets wet",
    color: "badge-rule",
  },
  {
    title: "HISTORY: command",
    content:
      "Record events in Sentry's timeline. These appear in the Timeline panel.\n\nExample: HISTORY: Today we discussed quantum mechanics",
    color: "badge-history",
  },
  {
    title: "REMEMBER: command",
    content:
      "Store a personal memory associated with your profile.\n\nExample: REMEMBER: My favorite language is TypeScript",
    color: "badge-personal",
  },
  {
    title: "WHY queries",
    content:
      "Ask Sentry to explain reasoning chains from its rule base.\n\nExample: WHY does the ground get wet",
    color: "badge-rule",
  },
  {
    title: "WHO ARE YOU",
    content:
      "Display Sentry's identity, current personality stats, and summary of its accumulated knowledge.",
    color: "badge-knowledge",
  },
  {
    title: "Memory Explorer",
    content:
      "The left panel shows all stored memories. Search by keyword, filter by type, click to highlight in chat, delete individual memories.",
    color: "badge-knowledge",
  },
  {
    title: "Semantic Linking",
    content:
      "When you teach knowledge, Sentry automatically extracts concepts and links related memories. The 3D brain shows these connections as edges.",
    color: "badge-knowledge",
  },
  {
    title: "3D Brain",
    content:
      "The right panel shows a 3D visualization of Sentry's knowledge graph. Nodes = memories/rules, edges = relationships. Rotate with mouse, zoom with scroll. Active nodes glow during conversations.",
    color: "badge-rule",
  },
  {
    title: "Personality Growth",
    content:
      "Sentry's personality evolves based on your interaction patterns. Positive messages increase friendliness, analytical queries increase analytical score. The personality bars update in real-time.",
    color: "badge-personal",
  },
  {
    title: "File Uploads",
    content:
      "Click the paperclip icon to attach images, GIFs, audio, video, files, or links. Supported formats: images (png/jpg/gif/webp), audio (mp3/wav/ogg), video (mp4/webm), any file.",
    color: "badge-knowledge",
  },
  {
    title: "Import / Export",
    content:
      "Use the Settings gear icon to access Import/Export. User Data includes your personal memories and personality profile. Global Data includes all shared knowledge and rules.",
    color: "badge-history",
  },
];

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="bg-card border-gold/30 max-w-2xl p-0 overflow-hidden"
        data-ocid="help.modal"
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-gold tracking-[0.2em] text-lg">
              TEACHING MANUAL
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-gold w-7 h-7"
              onClick={onClose}
              data-ocid="help.close_button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            HOW TO TEACH AND INTERACT WITH SENTRY
          </p>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <div className="p-6 space-y-4">
            {SECTIONS.map((s) => (
              <div
                key={s.title}
                className="border border-border rounded-md p-4 hover:border-gold/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-mono ${s.color}`}
                  >
                    {s.title}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {s.content}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
