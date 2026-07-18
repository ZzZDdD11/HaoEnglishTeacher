"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";

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

      // Poll for completion (simplified — v2 would use WebSocket)
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max
      const poll = setInterval(async () => {
        attempts++;
        try {
          // Check via Python service status endpoint
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
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "处理中..." : "导入"}
        </button>
      </form>

      {loading && taskId && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          正在下载视频并生成字幕...
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
