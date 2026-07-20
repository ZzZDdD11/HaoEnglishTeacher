// ===== Material =====
export interface TranscriptSentence {
  sentence_index: number;
  text: string;
  start_ms: number;
  end_ms: number;
  words: TranscriptWord[];
}

export interface TranscriptWord {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface Material {
  id: string;
  source_type: "youtube" | "bilibili";
  source_url: string;
  title: string;
  duration_seconds: number;
  transcript: TranscriptSentence[] | null;
  status: "processing" | "ready" | "error";
  created_at: string;
}

// ===== Practice Session =====
export interface PracticeSession {
  id: string;
  material_id: string;
  mode: "sentence_by_sentence";
  status: "in_progress" | "completed";
  overall_score: number | null;
  pronunciation_score: number | null;
  rhythm_score: number | null;
  intonation_score: number | null;
  completed_at: string | null;
  created_at: string;
}

// ===== Sentence Attempt =====
export interface WordScore {
  word: string;
  score: number;
  issue: string | null;
}

export interface SentenceAttempt {
  id: string;
  session_id: string;
  sentence_index: number;
  sentence_text?: string;
  score: number;
  word_scores: WordScore[];
  waveform_data: number[] | null;
  suggestions: string[];
  created_at: string;
}

// ===== Report =====
export interface PracticeReport {
  session: PracticeSession;
  attempts: SentenceAttempt[];
  material_title: string;
}

// ===== API Responses =====
export interface MaterialDetailResponse extends Material {
  transcript: TranscriptSentence[] | null;
}

// ===== API Payloads =====
export interface CreateMaterialPayload {
  source_url: string;
}

export interface CreateSessionPayload {
  material_id: string;
  mode: "sentence_by_sentence";
}

export interface SubmitAttemptPayload {
  audio: Blob;
  sentence_index: number;
}

export interface SubmitAttemptResponse {
  attempt: SentenceAttempt;
}

// ===== Guest Storage =====
export interface GuestRecord {
  material_ids: string[];
  session_ids: string[];
}
