import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const res = await fetch(`${PYTHON_SERVICE}/materials/${params.id}`);
  if (!res.ok) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
