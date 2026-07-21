"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex items-end gap-0.5 h-5">
          <span className="eq-bar w-1 h-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
          <span className="eq-bar w-1 h-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
          <span className="eq-bar w-1 h-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <div className="font-display text-lg mb-1">还没有练习素材</div>
        <div className="text-sm">粘贴一个视频链接开始吧</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {materials.map((m) => (
        <Link key={m.id} href={`/practice/${m.id}`} className="block">
          <Card className="p-5 hover:border-accent/40 hover:bg-accent/[0.03] transition-all duration-300 group cursor-pointer h-full">
            <h3 className="font-display text-base text-foreground truncate group-hover:text-accent transition-colors">
              {m.title || "未命名素材"}
            </h3>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  m.status === "ready"
                    ? "bg-accent"
                    : m.status === "error"
                    ? "bg-danger"
                    : "bg-warning animate-pulse"
                )}
              />
              <span className="text-xs text-muted-foreground">
                {m.status === "ready" ? "就绪" : m.status === "error" ? "失败" : "处理中"}
              </span>
            </div>
            {m.duration_seconds > 0 && (
              <div className="mt-1 text-xs font-mono text-muted-foreground tabular-nums">
                {Math.floor(m.duration_seconds / 60)}:
                {String(Math.floor(m.duration_seconds % 60)).padStart(2, "0")}
              </div>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}
