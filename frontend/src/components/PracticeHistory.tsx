"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { scoreVariant, cn } from "@/lib/utils";
import type { PracticeReport } from "@/types";

const scoreTextMap = {
  accent: "text-accent",
  warning: "text-warning",
  danger: "text-danger",
} as const;

/** Recent completed practice sessions, sourced from guestStorage's session
 * id list. Only completed sessions are shown — in-progress ones (created
 * on every practice page visit) are noise, not history. */
export default function PracticeHistory() {
  const [reports, setReports] = useState<PracticeReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const { session_ids } = guestStorage.getAll();
    const recent = session_ids.slice(-10).reverse();

    const results = await Promise.all(
      recent.map((id) => apiClient.getReport(id).catch(() => null))
    );

    setReports(
      results.filter(
        (r): r is PracticeReport => r !== null && r.session.status === "completed"
      )
    );
    setLoading(false);
  };

  if (loading || reports.length === 0) return null;

  return (
    <section className="fade-up" style={{ animationDelay: "150ms" }}>
      <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-4 font-mono">
        最近练习
      </h2>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const score = report.session.overall_score ?? 0;
          const variant = scoreVariant(score);
          return (
            <Link key={report.session.id} href={`/report/${report.session.id}`} className="block">
              <Card className="p-4 hover:border-accent/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-sm truncate flex-1">
                    {report.material_title || "未命名素材"}
                  </h3>
                  <span
                    className={cn(
                      "font-mono text-sm font-bold tabular-nums shrink-0",
                      scoreTextMap[variant]
                    )}
                  >
                    {Math.round(score)}
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
