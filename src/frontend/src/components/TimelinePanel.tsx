import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useGetTimeline } from "../hooks/useQueries";

function formatTs(ts: bigint) {
  return new Date(Number(ts) / 1_000_000).toLocaleString();
}

interface TimelinePanelProps {
  open: boolean;
  onClose: () => void;
  onHighlightNodes?: (ids: bigint[]) => void;
}

export default function TimelinePanel({
  open,
  onClose,
  onHighlightNodes,
}: TimelinePanelProps) {
  const { data: timeline = [] } = useGetTimeline();
  const sorted = [...timeline].sort(
    (a, b) => Number(b.timestamp) - Number(a.timestamp),
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-gold/30 z-20"
          style={{ maxHeight: "40%" }}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-mono text-gold tracking-widest">
                TIMELINE
              </span>
              <span className="text-xs text-muted-foreground font-mono">{`// ${sorted.length} EVENTS`}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-muted-foreground hover:text-gold"
              onClick={onClose}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <ScrollArea className="h-48">
            {sorted.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-xs font-mono">
                NO TIMELINE EVENTS
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {sorted.map((entry, i) => (
                  <button
                    key={entry.id.toString()}
                    type="button"
                    className="flex gap-3 p-2 rounded border border-border hover:border-gold/30 cursor-pointer transition-colors group w-full text-left"
                    onClick={() => onHighlightNodes?.([entry.id])}
                    data-ocid={
                      i === 0
                        ? "timeline.item.1"
                        : i === 1
                          ? "timeline.item.2"
                          : undefined
                    }
                  >
                    <div className="w-1 bg-gold/40 rounded group-hover:bg-gold transition-colors shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                        {entry.event}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatTs(entry.timestamp)}
                        </span>
                        <div className="flex gap-1">
                          {["C", "F", "A"].map((label, j) => {
                            const val =
                              j === 0
                                ? entry.personalitySnapshot.curiosity
                                : j === 1
                                  ? entry.personalitySnapshot.friendliness
                                  : entry.personalitySnapshot.analytical;
                            return (
                              <span
                                key={label}
                                className="text-[9px] font-mono text-muted-foreground"
                              >
                                {label}:{Math.round(val * 100)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
