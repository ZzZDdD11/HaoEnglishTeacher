// For MVP, we use polling instead of WebSocket to keep things simple.
// This route serves as a placeholder for v2 WebSocket upgrade.

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    message: "WebSocket endpoint — use polling GET /api/materials/[id] for MVP",
  });
}
