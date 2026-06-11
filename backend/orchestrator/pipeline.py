import asyncio
import json
from typing import Optional
from dataclasses import dataclass, field

from backend.schemas.models import (
    ProjectBrief, Scorecard, FinalReport, PipelineStatus,
    CriterionScore, EvidenceCitation, Weakness, RiskReport,
)
from backend.agents.intake.doc_parser import DocParserAgent
from backend.agents.intake.claim_extractor import ClaimExtractorAgent
from backend.agents.judges.relevance_judge import RelevanceJudge
from backend.agents.judges.reasoning_judge import ReasoningJudge
from backend.agents.judges.creativity_judge import CreativityJudge
from backend.agents.judges.ux_judge import UXJudge
from backend.agents.judges.safety_judge import SafetyJudge
from backend.agents.critics.devils_advocate import DevilsAdvocateAgent
from backend.agents.critics.evidence_verifier import EvidenceVerifierAgent
from backend.agents.critics.competitive_analyst import CompetitiveAnalystAgent
from backend.agents.synthesis.scoring_aggregator import ScoringAggregatorAgent
from backend.agents.synthesis.narrative_builder import NarrativeBuilderAgent
from backend.agents.synthesis.readme_doctor import ReadmeDoctorAgent


@dataclass
class PipelineContext:
    files_content: list[dict] = field(default_factory=list)
    paste_text: Optional[str] = None
    github_data: Optional[dict] = None
    brief: Optional[ProjectBrief] = None
    scores: list[CriterionScore] = field(default_factory=list)
    weaknesses: list[Weakness] = field(default_factory=list)
    risk_reports: list[RiskReport] = field(default_factory=list)
    penalties: dict = field(default_factory=dict)
    competition_score: float = 0.0
    competition_insights: list[str] = field(default_factory=list)
    verified_evidence: list[EvidenceCitation] = field(default_factory=list)
    flagged_evidence: list[EvidenceCitation] = field(default_factory=list)
    evidence_confidence: float = 0.0
    scorecard: Optional[Scorecard] = None
    report: Optional[FinalReport] = None


class ProjectJuryPipeline:
    def __init__(self):
        self.status = PipelineStatus(id="", state="idle", progress=0.0)

    async def run(self, pipeline_id: str, files_content: list[dict],
                  paste_text: Optional[str] = None,
                  github_data: Optional[dict] = None) -> FinalReport:

        ctx = PipelineContext(
            files_content=files_content,
            paste_text=paste_text,
            github_data=github_data,
        )
        self.status = PipelineStatus(id=pipeline_id, state="running", progress=0.0)

        try:
            ctx = await self._layer1_intake(ctx)
            ctx = await self._layer2_judges(ctx)
            ctx = await self._layer3_critics(ctx)
            ctx = await self._layer4_synthesis(ctx)
        except Exception as e:
            self.status = PipelineStatus(id=pipeline_id, state="failed", progress=0.0, error=str(e))
            raise

        self.status = PipelineStatus(id=pipeline_id, state="completed", progress=1.0)

        if ctx.report is None:
            raise RuntimeError("Pipeline completed but no report was generated")

        return ctx.report

    async def _layer1_intake(self, ctx: PipelineContext) -> PipelineContext:
        self._update_progress(0.0, 0.25, "Parsing project documents...")

        doc_parser = DocParserAgent()
        brief = await doc_parser.parse(ctx.files_content, ctx.paste_text, ctx.github_data)

        claim_extractor = ClaimExtractorAgent()
        ctx.brief = await claim_extractor.extract(brief)

        # Make brief available as dict for agents that need it
        return ctx

    async def _layer2_judges(self, ctx: PipelineContext) -> PipelineContext:
        self._update_progress(0.25, 0.55, "Running specialist judges...")

        brief_dict = self._brief_to_dict(ctx.brief)
        evidence_dict = {}  # mock evidence for now

        judges = [
            RelevanceJudge(),
            ReasoningJudge(),
            CreativityJudge(),
            UXJudge(),
            SafetyJudge(),
        ]

        results = await asyncio.gather(*[
            judge.evaluate(brief_dict, evidence_dict) for judge in judges
        ])

        ctx.scores = list(results)
        return ctx

    async def _layer3_critics(self, ctx: PipelineContext) -> PipelineContext:
        self._update_progress(0.55, 0.8, "Running critics and validators...")

        brief_dict = self._brief_to_dict(ctx.brief)

        devils = DevilsAdvocateAgent()
        weaknesses, penalties = await devils.critique(brief_dict, ctx.scores)
        ctx.weaknesses = weaknesses
        ctx.penalties = penalties

        verifier = EvidenceVerifierAgent()
        verified, flagged, confidence = await verifier.verify(ctx.scores)
        ctx.verified_evidence = verified
        ctx.flagged_evidence = flagged
        ctx.evidence_confidence = confidence

        analyst = CompetitiveAnalystAgent()
        comp_score, opportunities, comp_risks = await analyst.analyze(brief_dict)
        ctx.competition_score = comp_score
        ctx.competition_insights = opportunities
        ctx.weaknesses.extend(comp_risks)

        return ctx

    async def _layer4_synthesis(self, ctx: PipelineContext) -> PipelineContext:
        self._update_progress(0.8, 1.0, "Synthesizing final report...")

        aggregator = ScoringAggregatorAgent()
        scorecard = await aggregator.aggregate(ctx.scores, ctx.weaknesses,
                                                ctx.penalties, ctx.competition_score)
        ctx.scorecard = scorecard

        narrative_builder = NarrativeBuilderAgent()
        narrative = await narrative_builder.build_narrative(ctx.brief, scorecard,
                                                             ctx.competition_insights,
                                                             ctx.weaknesses)

        doctor = ReadmeDoctorAgent()
        brief_dict = self._brief_to_dict(ctx.brief)
        brief_readme = self._extract_readme(ctx.files_content)
        if not brief_readme and ctx.github_data and ctx.github_data.get("readme_content"):
            brief_readme = ctx.github_data["readme_content"][:2000]
        brief_dict["readme"] = brief_readme
        risks, suggestions = await doctor.diagnose(brief_dict, ctx.weaknesses,
                                                    ctx.competition_insights)
        ctx.risk_reports = risks

        ctx.report = FinalReport(
            project_name=ctx.brief.title,
            scorecard=scorecard,
            narrative=narrative,
            risk_reports=risks,
            suggestions=suggestions,
            pipeline_id=self.status.id,
            execution_summary=self._build_execution_summary(ctx),
        )

        return ctx

    def _brief_to_dict(self, brief: ProjectBrief) -> dict:
        if brief is None:
            return {}
        return {
            "title": brief.title,
            "description": brief.description,
            "claims": brief.claims,
            "features": brief.features,
            "goals": brief.goals,
            "track_hint": brief.track_hint,
            "tech_stack": brief.tech_stack,
        }

    def _extract_readme(self, files: list[dict]) -> str:
        for f in files:
            if "readme" in f["name"].lower():
                return f["content"][:2000]
        return ""

    def _build_execution_summary(self, ctx: PipelineContext) -> str:
        parts = [
            f"Processed {len(ctx.scores)} criteria",
            f"Identified {len(ctx.weaknesses)} weaknesses",
            f"Generated {len(ctx.risk_reports)} risk reports",
            f"Evidence confidence: {ctx.evidence_confidence:.0%}",
        ]
        return "; ".join(parts)

    def _update_progress(self, start: float, end: float, message: str):
        self.status.progress = start
        self.status.message = message

    def get_status(self) -> PipelineStatus:
        return self.status
