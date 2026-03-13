import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type SentryTheme,
  applyTheme,
  deleteTheme,
  loadActiveThemeId,
  loadThemes,
  loadThemes as reloadThemes,
  saveTheme,
  setActiveTheme,
} from "../utils/themeManager";

function colorToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 212, g: 175, b: 55 };
  return {
    r: Number.parseInt(result[1], 16),
    g: Number.parseInt(result[2], 16),
    b: Number.parseInt(result[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function ColorInput({
  label,
  r,
  g,
  b,
  onChange,
}: {
  label: string;
  r: number;
  g: number;
  b: number;
  onChange: (r: number, g: number, b: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-mono text-gold/70">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={rgbToHex(r, g, b)}
          onChange={(e) => {
            const { r: nr, g: ng, b: nb } = colorToRgb(e.target.value);
            onChange(nr, ng, nb);
          }}
          className="w-8 h-8 rounded border border-gold/30 cursor-pointer bg-transparent"
        />
        <div className="flex gap-1 flex-1">
          {(["R", "G", "B"] as const).map((ch, i) => (
            <Input
              key={ch}
              type="number"
              min={0}
              max={255}
              value={[r, g, b][i]}
              onChange={(e) => {
                const val = Math.min(
                  255,
                  Math.max(0, Number.parseInt(e.target.value) || 0),
                );
                const vals = [r, g, b];
                vals[i] = val;
                onChange(vals[0], vals[1], vals[2]);
              }}
              className="h-7 text-xs font-mono bg-black/50 border-gold/30 text-gold text-center px-1"
              placeholder={ch}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ThemeFormState {
  id: string;
  name: string;
  goldR: number;
  goldG: number;
  goldB: number;
  bgR: number;
  bgG: number;
  bgB: number;
  linkedModel: string;
}

const defaultForm = (): ThemeFormState => ({
  id: "",
  name: "",
  goldR: 212,
  goldG: 175,
  bgR: 0,
  bgG: 0,
  bgB: 0,
  goldB: 55,
  linkedModel: "",
});

export default function ThemeEditor() {
  const [themes, setThemes] = useState<SentryTheme[]>(() => loadThemes());
  const [activeId, setActiveId] = useState<string | null>(() =>
    loadActiveThemeId(),
  );
  const [form, setForm] = useState<ThemeFormState>(defaultForm());
  const [editing, setEditing] = useState(false);

  const refresh = () => {
    setThemes(reloadThemes());
    setActiveId(loadActiveThemeId());
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Theme name required.");
      return;
    }
    const id = form.id || `theme_${Date.now()}`;
    const theme: SentryTheme = { ...form, id };
    saveTheme(theme);
    toast.success(editing ? "Theme updated." : "Theme saved.");
    setForm(defaultForm());
    setEditing(false);
    refresh();
  };

  const handleEdit = (t: SentryTheme) => {
    setForm({ ...t, linkedModel: t.linkedModel || "" });
    setEditing(true);
  };

  const handleDelete = (id: string) => {
    deleteTheme(id);
    toast.success("Theme deleted.");
    refresh();
    if (activeId === id) {
      applyTheme(null);
    }
  };

  const handleActivate = (t: SentryTheme) => {
    if (activeId === t.id) {
      setActiveTheme(null);
      applyTheme(null);
      setActiveId(null);
      toast.success("Default theme restored.");
    } else {
      setActiveTheme(t.id);
      applyTheme(t);
      setActiveId(t.id);
      toast.success(`Theme "${t.name}" applied.`);
    }
  };

  const handleReset = () => {
    setActiveTheme(null);
    applyTheme(null);
    setActiveId(null);
    toast.success("Default theme restored.");
  };

  return (
    <div className="space-y-4">
      {/* Theme list */}
      {themes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-mono text-gold/70 tracking-widest">
            SAVED THEMES
          </p>
          <div className="space-y-2">
            {themes.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-2 p-2 rounded border ${
                  activeId === t.id
                    ? "border-gold/60 bg-gold/5"
                    : "border-border"
                }`}
                data-ocid="theme.item"
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div
                    className="w-4 h-4 rounded-full shrink-0 border border-white/10"
                    style={{ background: rgbToHex(t.goldR, t.goldG, t.goldB) }}
                  />
                  <div
                    className="w-4 h-4 rounded-full shrink-0 border border-white/10"
                    style={{ background: rgbToHex(t.bgR, t.bgG, t.bgB) }}
                  />
                  <span className="text-xs font-mono text-gold truncate">
                    {t.name}
                  </span>
                  {t.linkedModel && (
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                      ({t.linkedModel})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`w-6 h-6 ${
                      activeId === t.id
                        ? "text-gold"
                        : "text-muted-foreground hover:text-gold"
                    }`}
                    onClick={() => handleActivate(t)}
                    title={activeId === t.id ? "Deactivate" : "Activate"}
                    data-ocid="theme.toggle"
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-muted-foreground hover:text-gold"
                    onClick={() => handleEdit(t)}
                    data-ocid="theme.edit_button"
                  >
                    <span className="text-[10px] font-mono">ED</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(t.id)}
                    data-ocid="theme.delete_button"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-mono border-gold/30 text-gold/70 hover:text-gold hover:border-gold"
            onClick={handleReset}
            data-ocid="theme.reset_button"
          >
            Reset to Default
          </Button>
        </div>
      )}

      {/* Theme form */}
      <div className="border border-gold/20 rounded-md p-3 space-y-3">
        <p className="text-xs font-mono text-gold/70 tracking-widest">
          {editing ? "EDIT THEME" : "NEW THEME"}
        </p>
        <div>
          <Label className="text-xs font-mono text-gold/70">NAME</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="h-8 text-xs font-mono bg-black/50 border-gold/30 text-gold mt-1"
            placeholder="e.g. Midnight Gold"
            data-ocid="theme.input"
          />
        </div>
        <ColorInput
          label="GOLD / ACCENT COLOR"
          r={form.goldR}
          g={form.goldG}
          b={form.goldB}
          onChange={(r, g, b) =>
            setForm((f) => ({ ...f, goldR: r, goldG: g, goldB: b }))
          }
        />
        <ColorInput
          label="BACKGROUND COLOR"
          r={form.bgR}
          g={form.bgG}
          b={form.bgB}
          onChange={(r, g, b) =>
            setForm((f) => ({ ...f, bgR: r, bgG: g, bgB: b }))
          }
        />
        <div>
          <Label className="text-xs font-mono text-gold/70">
            LINK TO AI MODEL (optional)
          </Label>
          <Input
            value={form.linkedModel}
            onChange={(e) =>
              setForm((f) => ({ ...f, linkedModel: e.target.value }))
            }
            className="h-8 text-xs font-mono bg-black/50 border-gold/30 text-gold mt-1"
            placeholder="e.g. GPT-4, Sentry"
            data-ocid="theme.link_input"
          />
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-gold text-black font-mono text-xs hover:bg-gold/90 h-8"
            onClick={handleSave}
            data-ocid="theme.save_button"
          >
            <Plus className="w-3 h-3 mr-1" />
            {editing ? "UPDATE THEME" : "SAVE THEME"}
          </Button>
          {editing && (
            <Button
              variant="outline"
              className="border-gold/30 text-gold/70 hover:text-gold font-mono text-xs h-8"
              onClick={() => {
                setForm(defaultForm());
                setEditing(false);
              }}
              data-ocid="theme.cancel_button"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div
        className="rounded-md border border-gold/20 p-3 text-xs font-mono"
        style={{
          background: rgbToHex(form.bgR, form.bgG, form.bgB),
          color: rgbToHex(form.goldR, form.goldG, form.goldB),
        }}
      >
        PREVIEW: {form.name || "Theme Name"}
      </div>
    </div>
  );
}
