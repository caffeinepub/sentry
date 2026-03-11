import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Download, Upload, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import {
  useExportGlobalData,
  useExportUserData,
  useImportGlobalData,
  useImportUserData,
} from "../hooks/useQueries";

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="bg-card border-gold/30 max-w-md"
        data-ocid="import_export.panel"
      >
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-gold tracking-[0.2em]">
              DATA MANAGEMENT
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

        <div className="space-y-5">
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
                className="flex-1 border-gold/30 text-gold hover:bg-gold/10 font-mono text-xs"
                onClick={handleExportUser}
                disabled={exportUser.isPending}
                data-ocid="user_data.export_button"
              >
                <Download className="w-3 h-3 mr-1" />
                {exportUser.isPending ? "EXPORTING..." : "EXPORT"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-border text-muted-foreground hover:border-gold/30 hover:text-gold font-mono text-xs"
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
                className="flex-1 border-gold/30 text-gold hover:bg-gold/10 font-mono text-xs"
                onClick={handleExportGlobal}
                disabled={exportGlobal.isPending}
                data-ocid="global_data.export_button"
              >
                <Download className="w-3 h-3 mr-1" />
                {exportGlobal.isPending ? "EXPORTING..." : "EXPORT"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-border text-muted-foreground hover:border-gold/30 hover:text-gold font-mono text-xs"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
