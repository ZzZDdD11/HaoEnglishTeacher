"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import type { Material } from "@/types";

interface Props {
  refreshKey: number;
}

export default function MaterialList({ refreshKey }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterials();
  }, [refreshKey]);

  const loadMaterials = async () => {
    try {
      const data = await apiClient.listMaterials();
      setMaterials(data);
    } catch {
      // No materials yet — that's ok
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8 text-gray-400">
        <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        还没有练习素材，粘贴一个视频链接开始吧
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {materials.map((m) => (
        <Link
          key={m.id}
          href={`/practice/${m.id}`}
          className="block p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <h3 className="font-semibold text-gray-900 truncate">
            {m.title || "未命名素材"}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                m.status === "ready"
                  ? "bg-green-500"
                  : m.status === "error"
                  ? "bg-red-500"
                  : "bg-yellow-500"
              }`}
            />
            {m.status === "ready" ? "就绪" : m.status === "error" ? "失败" : "处理中"}
          </div>
          {m.duration_seconds > 0 && (
            <div className="mt-1 text-xs text-gray-400">
              {Math.floor(m.duration_seconds / 60)}分{Math.floor(m.duration_seconds % 60)}秒
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
