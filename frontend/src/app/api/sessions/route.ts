import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { material_id, mode } = body;

  if (!material_id) {
    return NextResponse.json({ error: "material_id is required" }, { status: 400 });
  }

  const res = await fetch(`${PYTHON_SERVICE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ material_id, mode: mode || "sentence_by_sentence" }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
