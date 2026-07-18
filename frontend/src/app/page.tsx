"use client";

import { useState } from "react";
import MaterialForm from "@/components/MaterialForm";
import MaterialList from "@/components/MaterialList";

export default function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">🎤 影子跟读</h1>
      <p className="text-gray-600 mb-8">
        粘贴视频链接，逐句跟读模仿，AI 自动纠正发音
      </p>

      <div className="mb-10">
        <MaterialForm
          onMaterialCreated={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-gray-700">最近素材</h2>
        <MaterialList refreshKey={refreshKey} />
      </section>
    </main>
  );
}
