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
    title: "SUGGESTIONS & FEEDBACK",
    content: null,
    isLink: true,
    linkUrl: "https://www.socialcreator.com/xution/?s=326221",
    linkText:
      "Have ideas for what topics the AIs should learn? Submit anonymous suggestions here:",
    color: "badge-knowledge",
  },
  {
    title: "ACCESS LEVELS",
    content:
      "CLASS 6 (Unity, Syndelious): Full access — create/delete AIs, manage members, assign trainers, teach globally.\n\nCLASS 5 (AI Trainers): Members assigned by Class 6 to a specific AI profile. They can teach that AI globally using all keyword commands (TEACH:, IF...THEN..., HISTORY:, REMEMBER:). They cannot create/delete AIs or manage members.\n\nMEMBERS: Can use all AI profiles and teach personal info only. Cannot update AI names or profile photos.",
    color: "badge-rule",
  },
  {
    title: "PROFILES & CUSTOMIZATION",
    content:
      "Changing your profile pic: Click your avatar next to any of your messages in chat to upload a new one.\n\nChanging the AI's profile pic: Click the AI's avatar next to any Sentry message. Note: Only Class 5 and Class 6 members can change the AI's photo for their assigned AI.\n\nChanging your display name: Hover over your name in a chat message and click the pencil icon (✎).\n\nChanging the AI's name: Hover over the AI's name in a message and click the pencil icon. Only Class 5/6 can change the AI's name.\n\nCreating new AIs: Only Class 6 (Unity or Syndelious) can create or delete AI templates.\n\nAll other settings and info are in the gear icon (⚙) or stored in chat history.",
    color: "badge-personal",
  },
  {
    title: "HOW TO ADD KNOWLEDGE MANUALLY",
    content:
      "You can add information directly in normal conversation using these commands:\n\nUser Knowledge (facts about yourself):\n  REMEMBER: I prefer dark themes\n  REMEMBER: My name is Unity\n  (Use REMEMBER: for personal facts about yourself)\n\nGlobal Knowledge (facts the AI should know):\n  TEACH: The sky is blue because of light scattering\n  TEACH: Hypnosis works by focusing attention\n  (Use TEACH: for general world knowledge — Class 5/6 only)\n\nHistory / Timeline entries:\n  HISTORY: Today we discussed light and color\n  HISTORY: Unity first joined on March 2026\n  (Use HISTORY: to log events — Class 5/6 only)\n\nRules (cause-effect logic):\n  IF fire touches wood THEN it burns\n  IF someone is tired THEN they need rest\n  (Use IF...THEN... for rules — Class 5/6 only)\n\nAll entries appear in the Memory Core panel immediately after sending.",
    color: "badge-knowledge",
  },
  {
    title: "HOW RULES WORK",
    content:
      'Rules are IF...THEN statements that Sentry uses for reasoning and cause-effect chains.\n\nYou can teach them naturally in conversation:\n  "If it rains the ground gets wet"\n  "When fire hits grass it burns"\n\nOr use explicit syntax:\n  IF it rains THEN the ground gets wet\n  IF someone is angry THEN give them space\n\nRules chain together automatically. Sentry can trace them forward (A → B → C) or backwards (WHY does C happen? → traces back to A).\n\nTry: "WHY does the ground get wet" after teaching the rain rule.\n\nRules from different categories can cross-reference each other over time.',
    color: "badge-rule",
  },
  {
    title: "Knowledge Categories",
    content:
      "You can organize what Sentry learns by category. Categories include: Grammar, Powers, Occult, Zener Cards, Hypnosis, Math, Coding, and many more — you can add/edit/delete your own (Class 5+ only).\n\nTo teach Sentry within a category, just mention it naturally: \"In hypnosis, the subject enters a trance state\" or use TEACH: prefix.\n\nClick any category in the Categories panel to see all connected messages and edit or delete them.\n\nSentry learns how categories relate to each other. If you teach something about 'hypnosis' and something about 'psychological engineering', Sentry tracks that these domains overlap.",
    color: "badge-knowledge",
  },
  {
    title: "Prediction & 'Might' Logic",
    content:
      "Sentry learns to predict outcomes from context. Teach it predictions naturally:\n\n\"Zener cards might predict symbols through intuition\"\n\"Using fire on grass will likely cause burning\"\n\n'Might' signals to Sentry that something is only sometimes true — it stores this as a conditional fact. 'Will' or 'always' signals a stronger rule.\n\nSentry can also predict from patterns: if you've taught it enough related cause-effect chains, it can reason forward to likely outcomes.",
    color: "badge-prediction",
  },
  {
    title: "Cross-Category Learning",
    content:
      "When Sentry learns concepts from multiple categories in the same conversation, it stores relationship edges between those categories. For example, if you discuss both 'astral projection' and 'psychological engineering', Sentry notes the overlap.\n\nThis means over time, Sentry can suggest connections: 'hypnosis connects to psychological engineering because both involve altering mental states'.\n\nYou can ask WHY or ask Sentry to explain how two topics are related.",
    color: "badge-knowledge",
  },
  {
    title: "HOW TO CONNECT CATEGORIES",
    content:
      "To connect categories through conversation, just mention both in the same message or conversation:\n\n  'Hypnosis and psychological engineering both work on the mind'\n  'Astral projection relates to occult practices'\n  'In subliminal making, you apply psychological engineering'\n\nSentry automatically links the categories when you discuss them together. Over time, it learns crossover rules — ask 'WHY does X relate to Y' to see the connection it found.\n\nYou can also say things like:\n  'This is similar to what I said about [category]'\n  'The same rule applies in [other category]'",
    color: "badge-knowledge",
  },
  {
    title: "TEACH: command",
    content:
      "Available to: Class 5 and Class 6 (for global knowledge). Any member (for personal knowledge).\n\nTeach Sentry general knowledge that becomes part of the global knowledge base.\n\nExample: TEACH: The speed of light is approximately 299,792 km/s",
    color: "badge-knowledge",
  },
  {
    title: "IF...THEN... rules",
    content:
      "Available to: Class 5 and Class 6 (for global rules). Any member (stores to personal memory).\n\nTeach cause-and-effect rules. Sentry can chain these for multi-step reasoning.\n\nExample: IF it rains THEN the ground gets wet",
    color: "badge-rule",
  },
  {
    title: "HISTORY: command",
    content:
      "Available to: Class 5 and Class 6.\n\nRecord events in Sentry's timeline. These appear in the Timeline panel.\n\nExample: HISTORY: Today we discussed quantum mechanics",
    color: "badge-history",
  },
  {
    title: "REMEMBER: command",
    content:
      "Available to: All members.\n\nStore a personal memory associated with your profile.\n\nExample: REMEMBER: My favorite language is TypeScript",
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
      "Click the paperclip icon to attach images, GIFs, audio, video, files, or links. Supported formats: images (png/jpg/gif/webp), audio (mp3/wav/ogg), video (mp4/webm), any file.\n\nImages: Sentry will describe what it sees (colors, brightness, composition).\nCode files (.html, .js, .ts, etc.): Shown in an editable code panel with copy and preview options.\nVideos: Sentry summarizes based on the title and duration.\nAudio: Sentry reflects on the title and mood.\nPDFs/Docs: Sentry reads and summarizes the content.\nLinks: Sentry fetches and reports what it finds.",
    color: "badge-knowledge",
  },
  {
    title: "Import / Export",
    content:
      "Use the Settings gear icon to access Import/Export. User Data includes your personal memories and personality profile. Global Data includes all shared knowledge and rules.",
    color: "badge-history",
  },
  {
    title: "IMPORTANT DISCLAIMER",
    content:
      "AI has unlimited potential. So AI trainers (Class 5) have equal access with Class 6 for teaching their AI profile. However. Only Class 6 may delete their AI. Which will only ever be for safety reasons. If they'd like to try taking their AI elsewhere. There's a way to import/export its knowledge.",
    color: "badge-rule",
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
                {s.isLink ? (
                  <div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                      {s.linkText}
                    </p>
                    <a
                      href={s.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold underline text-sm hover:text-gold/80 transition-colors break-all"
                    >
                      {s.linkUrl}
                    </a>
                    <p className="text-xs text-muted-foreground/60 font-mono mt-2">
                      Click the link or copy it to your browser.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {s.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
