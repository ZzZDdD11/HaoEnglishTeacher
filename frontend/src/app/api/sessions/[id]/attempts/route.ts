import { NextRequest, NextResponse } from "next/server";

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL || "http://backend:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const formData = await request.formData();
  const audio = formData.get("audio") as Blob;
  const sentenceIndex = formData.get("sentence_index") as string;

  if (!audio || !sentenceIndex) {
    return NextResponse.json(
      { error: "audio and sentence_index are required" },
      { status: 400 }
    );
  }

  // Forward to Python evaluation service
  const pythonFormData = new FormData();
  pythonFormData.append("audio", audio, "recording.wav");
  pythonFormData.append("sentence_index", sentenceIndex);
  pythonFormData.append("session_id", params.id);

  // First, evaluate pronunciation
  const evaluateRes = await fetch(`${PYTHON_SERVICE}/evaluate/pronunciation`, {
    method: "POST",
    body: pythonFormData,
  });

  if (!evaluateRes.ok) {
    const err = await evaluateRes.text();
    return NextResponse.json({ error: err }, { status: evaluateRes.status });
  }

  const evalData = await evaluateRes.json();

  // Then save attempt
  const saveRes = await fetch(`${PYTHON_SERVICE}/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: params.id,
      sentence_index: parseInt(sentenceIndex),
      score: evalData.overall_score,
      word_scores: evalData.word_scores,
      suggestions: evalData.suggestions,
    }),
  });

  const attemptData = await saveRes.json();
  return NextResponse.json(attemptData);
}
