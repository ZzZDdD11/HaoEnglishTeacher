"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import { Button } from "@/components/ui/button";

interface Props {
  onMaterialCreated: () => void;
}

export default function MaterialForm({ onMaterialCreated }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.createMaterial({ source_url: url.trim() });
      setTaskId(result.task_id);

      let attempts = 0;
      const maxAttempts = 60;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await fetch(`/api/python/process/status/${result.task_id}`);
          const status = await statusRes.json();

          if (status.status === "ready") {
            clearInterval(poll);
            guestStorage.addMaterial(status.material_id);
            setUrl("");
            setTaskId(null);
            setLoading(false);
            onMaterialCreated();
          } else if (status.status === "error") {
            clearInterval(poll);
            setError(status.error || "处理失败");
            setLoading(false);
          } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            setError("处理超时，请重试");
            setLoading(false);
          }
        } catch {
          // Continue polling
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴 YouTube 或 B站视频链接..."
          className="flex-1 px-4 py-3 bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none transition-all text-base"
          disabled={loading}
        />
        <Button type="submit" variant="accent" disabled={loading || !url.trim()}>
          {loading ? "处理中" : "导入"}
        </Button>
      </form>

      {loading && taskId && (
        <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-end gap-0.5 h-4">
            <span className="eq-bar w-0.5 h-full bg-accent" style={{ animationDelay: "0ms" }} />
            <span className="eq-bar w-0.5 h-full bg-accent" style={{ animationDelay: "150ms" }} />
            <span className="eq-bar w-0.5 h-full bg-accent" style={{ animationDelay: "300ms" }} />
            <span className="eq-bar w-0.5 h-full bg-accent" style={{ animationDelay: "450ms" }} />
          </div>
          正在下载视频并生成字幕...
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm text-danger bg-danger/10 border border-danger/20 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
