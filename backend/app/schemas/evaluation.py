from pydantic import BaseModel


class WordScoreItem(BaseModel):
    word: str
    score: float  # 0-100
    issue: str | None = None


class EvaluationResult(BaseModel):
    overall_score: float
    pronunciation_score: float
    rhythm_score: float
    intonation_score: float
    word_scores: list[WordScoreItem]
    suggestions: list[str]
