import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  useExportGlobalData,
  useExportUserData,
  useImportGlobalData,
  useImportUserData,
} from "../hooks/useQueries";
import { getSavedFont } from "../utils/fontManager";
import FontPicker from "./FontPicker";
import ThemeEditor from "./ThemeEditor";

function downloadJson(data: string, filename: string) {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface ImportExportPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportExportPanel({
  open,
  onClose,
}: ImportExportPanelProps) {
  const userFileRef = useRef<HTMLInputElement>(null);
  const globalFileRef = useRef<HTMLInputElement>(null);
  const exportUser = useExportUserData();
  const exportGlobal = useExportGlobalData();
  const importUser = useImportUserData();
  const importGlobal = useImportGlobalData();
  const [currentFont, setCurrentFont] = useState(() => getSavedFont());

  const handleExportUser = async () => {
    try {
      const data = await exportUser.mutateAsync();
      downloadJson(data, `sentry-user-data-${Date.now()}.json`);
      toast.success("User data exported.");
    } catch {
      toast.error("Failed to export user data.");
    }
  };

  const handleExportGlobal = async () => {
    try {
      const data = await exportGlobal.mutateAsync();
      downloadJson(data, `sentry-global-data-${Date.now()}.json`);
      toast.success("Global data exported.");
    } catch {
      toast.error("Failed to export global data.");
    }
  };

  const handleImportUser = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      try {
        await importUser.mutateAsync(text);
        toast.success("User data imported successfully.");
      } catch {
        toast.error("Failed to import user data.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportGlobal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      try {
        await importGlobal.mutateAsync(text);
        toast.success("Global data imported successfully.");
      } catch {
        toast.error("Failed to import global data.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const offlineFileRef = useRef<HTMLInputElement>(null);

  const handleExportOfflineApp = () => {
    try {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("sentry_")) {
          data[key] = localStorage.getItem(key) || "";
        }
      }
      const jsonStr = JSON.stringify(data).replace(/<\/script>/gi, "</script>");
      const html = `<!DOCTYPE html>
<html>
<head><title>Sentry Backup</title></head>
<body style="background:#000;color:#FFD700;font-family:monospace;padding:2rem;">
<h1>SENTRY BACKUP</h1>
<p>Opening this file restores your Sentry data to this browser's localStorage.</p>
<p id="status">Restoring data...</p>
<script>
window.__SENTRY_BACKUP__ = ${jsonStr};
(function(){
  var data = window.__SENTRY_BACKUP__;
  var count = 0;
  for(var k in data){if(Object.prototype.hasOwnProperty.call(data,k)){localStorage.setItem(k,data[k]);count++;}}
  document.getElementById('status').textContent = 'Done! ' + count + ' items restored. You can now open the main Sentry app.';
})();
<\/script>
</body>
</html>`;
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sentry-offline-backup-${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Offline backup exported (${Object.keys(data).length} keys).`,
      );
    } catch {
      toast.error("Failed to export offline backup.");
    }
  };

  const handleImportOfflineHtml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const match = text.match(
          /window\.__SENTRY_BACKUP__\s*=\s*(\{[\s\S]*?\});/,
        );
        if (!match) {
          toast.error("Invalid Sentry backup file.");
          return;
        }
        const data: Record<string, string> = JSON.parse(match[1]);
        let count = 0;
        for (const [k, v] of Object.entries(data)) {
          localStorage.setItem(k, v);
          count++;
        }
        toast.success(
          `${count} keys restored from offline backup. Refresh to apply.`,
        );
      } catch {
        toast.error("Failed to parse offline backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="bg-card border-gold/30 max-w-md max-h-[85vh] overflow-y-auto"
        data-ocid="import_export.panel"
      >
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-gold tracking-[0.2em]">
              SETTINGS
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-gold w-7 h-7"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="data" className="w-full">
          <TabsList className="w-full bg-black/50 border border-gold/20 mb-4">
            <TabsTrigger
              value="data"
              className="flex-1 text-xs font-mono text-gold data-[state=active]:bg-black data-[state=active]:border-gold data-[state=active]:border data-[state=active]:text-gold"
              data-ocid="settings.data.tab"
            >
              DATA
            </TabsTrigger>
            <TabsTrigger
              value="theme"
              className="flex-1 text-xs font-mono text-gold data-[state=active]:bg-black data-[state=active]:border-gold data-[state=active]:border data-[state=active]:text-gold"
              data-ocid="settings.theme.tab"
            >
              THEME
            </TabsTrigger>
            <TabsTrigger
              value="font"
              className="flex-1 text-xs font-mono text-gold data-[state=active]:bg-black data-[state=active]:border-gold data-[state=active]:border data-[state=active]:text-gold"
              data-ocid="settings.font.tab"
            >
              FONT
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="space-y-5 mt-0">
            {/* User Data */}
            <div className="border border-border rounded-md p-4 space-y-3">
              <div>
                <p className="text-sm font-mono text-gold tracking-widest">
                  USER DATA
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Personal memories, history, personality & opinions
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-gold border-gold text-black font-bold hover:bg-gold-bright font-mono text-xs"
                  onClick={handleExportUser}
                  disabled={exportUser.isPending}
                  data-ocid="user_data.export_button"
                >
                  <Download className="w-3 h-3 mr-1" />
                  {exportUser.isPending ? "EXPORTING..." : "EXPORT"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-gold/40 text-gold hover:bg-gold/10 font-mono text-xs"
                  onClick={() => userFileRef.current?.click()}
                  disabled={importUser.isPending}
                  data-ocid="user_data.upload_button"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {importUser.isPending ? "IMPORTING..." : "IMPORT"}
                </Button>
                <input
                  ref={userFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportUser}
                />
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Global Data */}
            <div className="border border-border rounded-md p-4 space-y-3">
              <div>
                <p className="text-sm font-mono text-gold tracking-widest">
                  GLOBAL DATA
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shared knowledge, rules & cause-effect chains
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-gold border-gold text-black font-bold hover:bg-gold-bright font-mono text-xs"
                  onClick={handleExportGlobal}
                  disabled={exportGlobal.isPending}
                  data-ocid="global_data.export_button"
                >
                  <Download className="w-3 h-3 mr-1" />
                  {exportGlobal.isPending ? "EXPORTING..." : "EXPORT"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-gold/40 text-gold hover:bg-gold/10 font-mono text-xs"
                  onClick={() => globalFileRef.current?.click()}
                  disabled={importGlobal.isPending}
                  data-ocid="global_data.upload_button"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {importGlobal.isPending ? "IMPORTING..." : "IMPORT"}
                </Button>
                <input
                  ref={globalFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportGlobal}
                />
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Offline App Backup */}
            <div className="border border-border rounded-md p-4 space-y-3">
              <div>
                <p className="text-sm font-mono text-gold tracking-widest">
                  OFFLINE BACKUP
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Export a self-contained HTML file to restore all data offline
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-gold border-gold text-black font-bold hover:bg-gold-bright font-mono text-xs"
                  onClick={handleExportOfflineApp}
                  data-ocid="offline_backup.export_button"
                >
                  <Download className="w-3 h-3 mr-1" />
                  EXPORT HTML
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-gold/40 text-gold hover:bg-gold/10 font-mono text-xs"
                  onClick={() => offlineFileRef.current?.click()}
                  data-ocid="offline_backup.upload_button"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  IMPORT HTML
                </Button>
                <input
                  ref={offlineFileRef}
                  type="file"
                  accept=".html"
                  className="hidden"
                  onChange={handleImportOfflineHtml}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="theme" className="mt-0">
            <ThemeEditor />
          </TabsContent>

          <TabsContent value="font" className="mt-0">
            <FontPicker
              currentFont={currentFont}
              onFontChange={setCurrentFont}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
