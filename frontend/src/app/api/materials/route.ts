import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

// POST /api/materials — submit video URL for processing
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { source_url } = body;

  if (!source_url) {
    return NextResponse.json({ error: "source_url is required" }, { status: 400 });
  }

  // Forward to Python backend
  const res = await fetch(`${PYTHON_SERVICE}/process/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_url }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

// GET /api/materials — list recent materials
export async function GET() {
  const res = await fetch(`${PYTHON_SERVICE}/materials`);
  if (!res.ok) {
    return NextResponse.json([], { status: 200 }); // Return empty if endpoint doesn't exist yet
  }
  const data = await res.json();
  return NextResponse.json(data);
}
