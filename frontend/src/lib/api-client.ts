import type {
  Material,
  MaterialDetailResponse,
  CreateMaterialPayload,
  CreateSessionPayload,
  PracticeSession,
  SubmitAttemptResponse,
  PracticeReport,
} from "@/types";

const BFF_BASE = "/api";

class ApiClient {
  // ===== Materials =====
  async createMaterial(payload: CreateMaterialPayload): Promise<{ task_id: string; status: string }> {
    const res = await fetch(`${BFF_BASE}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create material: ${res.statusText}`);
    return res.json();
  }

  async listMaterials(): Promise<Material[]> {
    const res = await fetch(`${BFF_BASE}/materials`);
    if (!res.ok) throw new Error(`Failed to list materials: ${res.statusText}`);
    return res.json();
  }

  async getMaterial(id: string): Promise<MaterialDetailResponse> {
    const res = await fetch(`${BFF_BASE}/materials/${id}`);
    if (!res.ok) throw new Error(`Failed to get material: ${res.statusText}`);
    return res.json();
  }

  // ===== Sessions =====
  async createSession(payload: CreateSessionPayload): Promise<PracticeSession> {
    const res = await fetch(`${BFF_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
    return res.json();
  }

  async getSession(id: string): Promise<PracticeSession> {
    const res = await fetch(`${BFF_BASE}/sessions/${id}`);
    if (!res.ok) throw new Error(`Failed to get session: ${res.statusText}`);
    return res.json();
  }

  async submitAttempt(
    sessionId: string,
    audio: Blob,
    sentenceIndex: number
  ): Promise<SubmitAttemptResponse> {
    const formData = new FormData();
    formData.append("audio", audio, "recording.wav");
    formData.append("sentence_index", String(sentenceIndex));

    const res = await fetch(`${BFF_BASE}/sessions/${sessionId}/attempts`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`Failed to submit attempt: ${res.statusText}`);
    return res.json();
  }

  async completeSession(id: string): Promise<PracticeSession> {
    const res = await fetch(`${BFF_BASE}/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (!res.ok) throw new Error(`Failed to complete session: ${res.statusText}`);
    return res.json();
  }

  async getReport(sessionId: string): Promise<PracticeReport> {
    const res = await fetch(`${BFF_BASE}/sessions/${sessionId}/report`);
    if (!res.ok) throw new Error(`Failed to get report: ${res.statusText}`);
    return res.json();
  }
}

export const apiClient = new ApiClient();
