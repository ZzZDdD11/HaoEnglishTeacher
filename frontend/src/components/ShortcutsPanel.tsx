"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Props {
  open: boolean;
  onClose: () => void;
}

const rows: Array<{ keys: string; description: string }> = [
  { keys: "Space", description: "播放原声 / 开始录音 / 停止录音 / 下一句" },
  { keys: "?", description: "打开或关闭本说明面板" },
];

export default function ShortcutsPanel({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-sm mx-4 p-6 score-reveal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg">操作说明</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.keys} className="flex items-center gap-3">
              <kbd className="px-2 py-1 rounded border border-border bg-muted/40 font-mono text-xs shrink-0 min-w-[2.5rem] text-center">
                {row.keys}
              </kbd>
              <span className="text-sm text-muted-foreground">{row.description}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
