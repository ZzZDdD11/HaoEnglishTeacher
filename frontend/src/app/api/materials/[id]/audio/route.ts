import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Audio files are typically well over Next.js's 2MB data-cache limit;
  // opt out of caching entirely to avoid "Failed to set fetch cache" noise
  // and the retry/stall it can cause.
  const res = await fetch(`${PYTHON_SERVICE}/materials/${params.id}/audio`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "audio not available" },
      { status: res.status }
    );
  }

  const contentType = res.headers.get("content-type") || "audio/wav";
  const arrayBuffer = await res.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: { "content-type": contentType },
  });
}
