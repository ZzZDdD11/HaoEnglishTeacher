"use client";

import { useState } from "react";
import MaterialForm from "@/components/MaterialForm";
import MaterialList from "@/components/MaterialList";
import PracticeHistory from "@/components/PracticeHistory";

export default function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="max-w-4xl mx-auto py-16 px-4">
      <div className="mb-12 fade-up">
        <div className="text-[10px] uppercase tracking-[0.4em] text-accent mb-3 font-mono">
          Shadowing Practice
        </div>
        <h1 className="font-display text-5xl font-bold mb-3 tracking-tight">
          影子跟读
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl">
          粘贴视频链接，逐句跟读模仿，AI 自动纠正发音
        </p>
      </div>

      <div className="mb-12 fade-up" style={{ animationDelay: "100ms" }}>
        <MaterialForm onMaterialCreated={() => setRefreshKey((k) => k + 1)} />
      </div>

      <div className="mb-12">
        <PracticeHistory />
      </div>

      <section className="fade-up" style={{ animationDelay: "200ms" }}>
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-4 font-mono">
          最近素材
        </h2>
        <MaterialList refreshKey={refreshKey} />
      </section>
    </main>
  );
}
