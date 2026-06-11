from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EvidenceCitation(BaseModel):
    content: str
    source: str
    relevance_score: float


class CriterionScore(BaseModel):
    criterion: str
    weight: int
    score: float
    justification: str
    citations: list[EvidenceCitation]
    confidence: float


class FinalScore(BaseModel):
    total: float
    grade: str
    risk_level: str


class Scorecard(BaseModel):
    final_score: FinalScore
    criteria: list[CriterionScore]
    weaknesses: list['Weakness']
    competition_score: float


class Weakness(BaseModel):
    category: str
    severity: str
    description: str
    suggestion: str


class RiskReport(BaseModel):
    category: str
    severity: str
    description: str
    recommendation: str


class ProjectBrief(BaseModel):
    title: str
    description: str
    claims: list[str]
    features: list[str]
    goals: list[str]
    track_hint: Optional[str]
    tech_stack: list[str]
    raw_text_chunks: list[str]


class FinalReport(BaseModel):
    project_name: str
    scorecard: Scorecard
    narrative: dict
    risk_reports: list[RiskReport]
    suggestions: list[str]
    pipeline_id: str
    execution_summary: str


class PipelineStatus(BaseModel):
    id: str
    state: str
    progress: float
    message: Optional[str] = None
    error: Optional[str] = None


class ImprovementDelta(BaseModel):
    before_score: float
    after_score: float
    improvement_pct: float
    changes: list[str]
