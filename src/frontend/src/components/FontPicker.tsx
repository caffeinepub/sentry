import { useEffect } from "react";
import { toast } from "sonner";
import {
  FONT_PRESETS,
  applyFont,
  getSavedFont,
  loadFont,
  saveFont,
} from "../utils/fontManager";

interface FontPickerProps {
  currentFont: string;
  onFontChange: (family: string) => void;
}

export default function FontPicker({
  currentFont,
  onFontChange,
}: FontPickerProps) {
  // Pre-load all fonts for preview
  useEffect(() => {
    for (const p of FONT_PRESETS) {
      if (p.family) loadFont(p.family);
    }
  }, []);

  const handleSelect = (family: string) => {
    applyFont(family);
    saveFont(family);
    onFontChange(family);
    toast.success(family ? `Font set to ${family}.` : "Font reset to default.");
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-mono text-gold/70 tracking-widest">
        SELECT FONT STYLE
      </p>
      <div className="grid grid-cols-2 gap-2">
        {FONT_PRESETS.map((preset) => (
          <button
            key={preset.family || "default"}
            type="button"
            onClick={() => handleSelect(preset.family)}
            className={`flex flex-col items-start gap-1 p-2.5 rounded border text-left transition-all ${
              currentFont === preset.family
                ? "border-gold bg-gold/10 text-gold"
                : "border-border text-muted-foreground hover:border-gold/50 hover:text-gold/80"
            }`}
            data-ocid="font.toggle"
          >
            <span className="text-[10px] font-mono tracking-widest uppercase">
              {preset.label}
            </span>
            <span
              style={{
                fontFamily: preset.family
                  ? `'${preset.family}', serif`
                  : "inherit",
                fontSize: "1.1rem",
                lineHeight: 1.2,
              }}
            >
              Aa
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
