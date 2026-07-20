import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const formData = await request.formData();
  const audio = formData.get("audio") as Blob;
  const sentenceIndex = formData.get("sentence_index") as string;
  const referenceText = formData.get("reference_text") as string;

  if (!audio || !sentenceIndex || !referenceText) {
    return NextResponse.json(
      { error: "audio, sentence_index and reference_text are required" },
      { status: 400 }
    );
  }

  // Single atomic call: evaluate + save in one backend request
  const pythonFormData = new FormData();
  pythonFormData.append("audio", audio, "recording.wav");
  pythonFormData.append("sentence_index", sentenceIndex);
  pythonFormData.append("session_id", params.id);
  pythonFormData.append("reference_text", referenceText);

  const res = await fetch(`${PYTHON_SERVICE}/attempts/evaluate`, {
    method: "POST",
    body: pythonFormData,
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const attempt = await res.json();
  return NextResponse.json({ attempt });
}
