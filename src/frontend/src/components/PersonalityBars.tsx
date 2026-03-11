import { motion } from "motion/react";
import type { PersonalityProfile } from "../backend.d";

interface PersonalityBarsProps {
  personality: PersonalityProfile;
}

const traits = [
  {
    key: "curiosity" as const,
    label: "CURIOSITY",
    color: "oklch(0.72 0.14 85)",
    icon: "🔮",
  },
  {
    key: "friendliness" as const,
    label: "FRIENDLINESS",
    color: "oklch(0.65 0.14 145)",
    icon: "💛",
  },
  {
    key: "analytical" as const,
    label: "ANALYTICAL",
    color: "oklch(0.60 0.14 200)",
    icon: "🧠",
  },
];

export default function PersonalityBars({ personality }: PersonalityBarsProps) {
  return (
    <div
      className="px-3 py-2 border-t border-border"
      data-ocid="personality.panel"
    >
      <p className="text-[10px] font-mono text-muted-foreground tracking-[0.2em] mb-2">
        PERSONALITY MATRIX
      </p>
      <div className="space-y-1.5">
        {traits.map((t) => (
          <div key={t.key} className="flex items-center gap-2">
            <span className="text-[10px] w-3">{t.icon}</span>
            <span className="text-[9px] font-mono text-muted-foreground w-20 tracking-widest">
              {t.label}
            </span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: t.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(personality[t.key] ?? 0.5) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground w-6 text-right">
              {Math.round((personality[t.key] ?? 0.5) * 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
