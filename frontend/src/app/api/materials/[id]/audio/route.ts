import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${PYTHON_SERVICE}/materials/${params.id}/audio`);

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
