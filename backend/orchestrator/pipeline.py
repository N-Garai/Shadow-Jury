import asyncio
import json
import logging
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
from backend.knowledge.indexer import DocumentIndexer
from backend.knowledge.kb_client import FoundryIQClient
from backend.llm import get_llm

logger = logging.getLogger(__name__)


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
    evidence_dict: dict = field(default_factory=dict)
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

    async def run_stream(self, pipeline_id: str, files_content: list[dict],
                         paste_text: Optional[str] = None,
                         github_data: Optional[dict] = None):
        """Async generator that yields deliberation events as the pipeline runs."""

        ctx = PipelineContext(
            files_content=files_content,
            paste_text=paste_text,
            github_data=github_data,
        )
        self.status = PipelineStatus(id=pipeline_id, state="running", progress=0.0)

        llm = get_llm()
        llm_status = "AI scoring: GPT-4o-mini (GitHub Models)" if llm.is_available() else "AI scoring: not available (set GITHUB_TOKEN)"
        yield self._evt("pipeline_start", layer=0, agent=None,
                        desc=f"Shadow Jury convened. 13 agents preparing for deliberation. {llm_status}")

        try:
            # ── Layer 1: Intake ──
            yield self._evt("layer_start", layer=1, agent=None,
                            desc="Intake Layer — parsing project files and extracting claims")
            yield self._evt("agent_start", layer=1, agent="Doc Parser",
                            desc="Reading uploaded files and GitHub README...")
            doc_parser = DocParserAgent()
            brief = await doc_parser.parse(ctx.files_content, ctx.paste_text, ctx.github_data)
            yield self._evt("agent_result", layer=1, agent="Doc Parser",
                            desc=f"Parsed project: {brief.title}",
                            data={"title": brief.title, "description": brief.description[:150]})

            yield self._evt("agent_start", layer=1, agent="Claim Extractor",
                            desc="Extracting claims, features, and goals from project materials...")
            claim_extractor = ClaimExtractorAgent()
            ctx.brief = await claim_extractor.extract(brief)
            yield self._evt("agent_result", layer=1, agent="Claim Extractor",
                            desc=f"Extracted {len(ctx.brief.claims)} claims, {len(ctx.brief.features)} features",
                            data={"claims": ctx.brief.claims, "features": ctx.brief.features,
                                  "goals": ctx.brief.goals, "tech_stack": ctx.brief.tech_stack})

            yield self._evt("agent_start", layer=1, agent="Foundry IQ Indexer",
                            desc="Indexing documents into Azure AI Search for grounded retrieval...")
            indexer = DocumentIndexer()
            indexed_count = 0
            if indexer.is_available():
                try:
                    indexer.ensure_index()
                    for chunk in brief.raw_text_chunks:
                        indexer.index_document(
                            content=chunk,
                            source="project_readme.md" if not ctx.files_content else ctx.files_content[0]["name"],
                            category="user_upload",
                            project=brief.title,
                        )
                        indexed_count += 1
                except Exception as e:
                    logger.warning("Foundry IQ indexing failed: %s", str(e))
            yield self._evt("agent_result", layer=1, agent="Foundry IQ Indexer",
                            desc=f"Indexed {indexed_count} document chunks" if indexed_count
                                 else "Foundry IQ not available (no SEARCH_ENDPOINT configured)",
                            data={"chunks_indexed": indexed_count})
            yield self._evt("layer_done", layer=1, agent=None,
                            desc="Intake complete — project brief ready for judging")

            # ── Layer 2: Judges ──
            yield self._evt("layer_start", layer=2, agent=None,
                            desc="Judges Layer — 5 specialist judges scoring your project")
            brief_dict = self._brief_to_dict(ctx.brief)

            evidence_dict = {}
            kb = FoundryIQClient()
            if kb.is_available():
                yield self._evt("agent_start", layer=2, agent="Foundry IQ Retriever",
                                desc="Retrieving relevant evidence from knowledge base...")
                try:
                    query = (
                        f"Project: {ctx.brief.title}. "
                        f"Description: {ctx.brief.description[:300]}. "
                        f"Keywords: {', '.join(ctx.brief.tech_stack)}. "
                        f"Track: {ctx.brief.track_hint or 'Unknown'}."
                    )
                    result = kb.retrieve(query)
                    evidence_dict["foundry_iq"] = result
                    ctx.evidence_dict = evidence_dict
                    citations = result.get("citations", [])
                    yield self._evt("agent_result", layer=2, agent="Foundry IQ Retriever",
                                    desc=f"Retrieved {len(citations)} relevant document passages",
                                    data={"citations": citations})
                except Exception as e:
                    logger.warning("Foundry IQ retrieval failed: %s", str(e))
                    yield self._evt("agent_result", layer=2, agent="Foundry IQ Retriever",
                                    desc="Retrieval failed — proceeding with mock evidence")

            judges = [
                ("Relevance Judge", RelevanceJudge(), "Evaluating how well the project fits the selected track and requirements"),
                ("Reasoning Judge", ReasoningJudge(), "Assessing multi-step thinking and agent orchestration patterns"),
                ("Creativity Judge", CreativityJudge(), "Measuring originality, novelty, and surprising elements"),
                ("UX Judge", UXJudge(), "Analyzing user experience quality and demo readiness"),
                ("Safety Judge", SafetyJudge(), "Checking reliability, safety, and ethical considerations"),
            ]

            results = []
            for name, judge, purpose in judges:
                yield self._evt("agent_start", layer=2, agent=name,
                                desc=purpose)
                score = await judge.evaluate(brief_dict, evidence_dict)
                results.append(score)
                yield self._evt("agent_result", layer=2, agent=name,
                                desc=f"Score: {score.score}/100 (confidence: {score.confidence:.0%}) — {score.justification[:120]}",
                                data={"criterion": score.criterion, "score": score.score,
                                      "weight": score.weight, "confidence": score.confidence,
                                      "justification": score.justification,
                                      "citations": [c.model_dump() for c in (score.citations or [])]})

            ctx.scores = list(results)
            yield self._evt("layer_done", layer=2, agent=None,
                            desc=f"All 5 judges have submitted their scores")

            # ── Layer 3: Critics ──
            yield self._evt("layer_start", layer=3, agent=None,
                            desc="Critics Layer — stress-testing the project and verifying evidence")
            brief_dict = self._brief_to_dict(ctx.brief)

            yield self._evt("agent_start", layer=3, agent="Devil's Advocate",
                            desc="Challenging weak claims, missing proof, and risky assumptions...")
            devils = DevilsAdvocateAgent()
            weaknesses, penalties = await devils.critique(brief_dict, ctx.scores)
            ctx.weaknesses = weaknesses
            ctx.penalties = penalties
            yield self._evt("agent_result", layer=3, agent="Devil's Advocate",
                            desc=f"Identified {len(weaknesses)} weaknesses with penalties: {penalties}",
                            data={"weaknesses": [{"category": w.category, "severity": w.severity,
                                                   "description": w.description, "suggestion": w.suggestion}
                                                  for w in weaknesses],
                                  "penalties": penalties})

            yield self._evt("agent_start", layer=3, agent="Evidence Verifier",
                            desc="Cross-checking scoring evidence and flagging unsupported claims...")
            verifier = EvidenceVerifierAgent()
            verified, flagged, confidence = await verifier.verify(ctx.scores, brief_dict, evidence_dict)
            ctx.verified_evidence = verified
            ctx.flagged_evidence = flagged
            ctx.evidence_confidence = confidence
            yield self._evt("agent_result", layer=3, agent="Evidence Verifier",
                            desc=f"Verified {len(verified)} evidence items, flagged {len(flagged)} issues (confidence: {confidence:.0%})",
                            data={"verified_count": len(verified), "flagged_count": len(flagged),
                                  "confidence": confidence})

            yield self._evt("agent_start", layer=3, agent="Competitive Analyst",
                            desc="Benchmarking against other submissions in the same space...")
            analyst = CompetitiveAnalystAgent()
            comp_score, opportunities, comp_risks = await analyst.analyze(brief_dict)
            ctx.competition_score = comp_score
            ctx.competition_insights = opportunities
            ctx.weaknesses.extend(comp_risks)
            yield self._evt("agent_result", layer=3, agent="Competitive Analyst",
                            desc=f"Competitive edge score: {comp_score}/100. {len(opportunities)} opportunities identified",
                            data={"competition_score": comp_score, "opportunities": opportunities,
                                  "risks": [{"category": r.category, "severity": r.severity,
                                              "description": r.description, "suggestion": r.suggestion}
                                             for r in comp_risks]})
            yield self._evt("layer_done", layer=3, agent=None,
                            desc="Critique complete — project weaknesses and risks documented")

            # ── Layer 4: Synthesis ──
            yield self._evt("layer_start", layer=4, agent=None,
                            desc="Synthesis Layer — aggregating scores, building narrative, generating report")
            yield self._evt("agent_start", layer=4, agent="Scoring Aggregator",
                            desc="Weighting and aggregating all judge scores into final scorecard...")
            aggregator = ScoringAggregatorAgent()
            scorecard = await aggregator.aggregate(ctx.scores, ctx.weaknesses,
                                                    ctx.penalties, ctx.competition_score)
            ctx.scorecard = scorecard
            yield self._evt("agent_result", layer=4, agent="Scoring Aggregator",
                            desc=f"Final grade: {scorecard.final_score.grade} (total: {scorecard.final_score.total:.1f}/100)",
                            data={"grade": scorecard.final_score.grade,
                                  "total": scorecard.final_score.total,
                                  "risk_level": scorecard.final_score.risk_level,
                                  "criteria": [{"criterion": c.criterion, "score": c.score,
                                                 "weight": c.weight, "confidence": c.confidence}
                                               for c in scorecard.criteria]})

            yield self._evt("agent_start", layer=4, agent="Narrative Builder",
                            desc="Crafting executive summary, strengths, weaknesses, and recommendations...")
            narrative_builder = NarrativeBuilderAgent()
            narrative = await narrative_builder.build_narrative(ctx.brief, scorecard,
                                                                  ctx.competition_insights,
                                                                  ctx.weaknesses)
            yield self._evt("agent_result", layer=4, agent="Narrative Builder",
                            desc=f"Verdict: {narrative.get('recommendation', {}).get('verdict', 'N/A')}",
                            data={"executive_summary": narrative.get("executive_summary", ""),
                                  "verdict": narrative.get("recommendation", {}),
                                  "opportunities": narrative.get("opportunities", [])})

            yield self._evt("agent_start", layer=4, agent="README Doctor",
                            desc="Analyzing README completeness and generating actionable suggestions...")
            doctor = ReadmeDoctorAgent()
            brief_dict = self._brief_to_dict(ctx.brief)
            brief_readme = self._extract_readme(ctx.files_content)
            if not brief_readme and ctx.github_data and ctx.github_data.get("readme_content"):
                brief_readme = ctx.github_data["readme_content"][:2000]
            brief_dict["readme"] = brief_readme
            risks, suggestions = await doctor.diagnose(brief_dict, ctx.weaknesses,
                                                        ctx.competition_insights)
            ctx.risk_reports = risks
            yield self._evt("agent_result", layer=4, agent="README Doctor",
                            desc=f"Generated {len(suggestions)} suggestions and {len(risks)} risk reports",
                            data={"risks": [{"category": r.category, "severity": r.severity,
                                              "description": r.description, "recommendation": r.recommendation}
                                             for r in risks],
                                  "suggestions": suggestions})

            ctx.report = FinalReport(
                project_name=ctx.brief.title,
                scorecard=scorecard,
                narrative=narrative,
                risk_reports=risks,
                suggestions=suggestions,
                pipeline_id=self.status.id,
                execution_summary=self._build_execution_summary(ctx),
            )

            yield self._evt("pipeline_done", layer=4, agent=None,
                            desc="Shadow Jury deliberation complete. Delivering final verdict...",
                            data={"report": ctx.report.model_dump()})

        except Exception as e:
            yield self._evt("error", layer=0, agent=None,
                            desc=f"Pipeline error: {str(e)}")
            self.status = PipelineStatus(id=pipeline_id, state="failed", progress=0.0, error=str(e))
            raise

    def _evt(self, event_type: str, layer: int, agent: Optional[str],
             desc: str, data: Optional[dict] = None):
        return {
            "type": event_type,
            "layer": layer,
            "agent": agent,
            "description": desc,
            "data": data or {},
        }

    async def _layer1_intake(self, ctx: PipelineContext) -> PipelineContext:
        self._update_progress(0.0, "Parsing project documents...")

        doc_parser = DocParserAgent()
        brief = await doc_parser.parse(ctx.files_content, ctx.paste_text, ctx.github_data)

        claim_extractor = ClaimExtractorAgent()
        ctx.brief = await claim_extractor.extract(brief)

        indexer = DocumentIndexer()
        if indexer.is_available():
            try:
                indexer.ensure_index()
                for chunk in brief.raw_text_chunks:
                    indexer.index_document(
                        content=chunk,
                        source="project_readme.md" if not ctx.files_content else ctx.files_content[0]["name"],
                        category="user_upload",
                        project=brief.title,
                    )
            except Exception as e:
                logger.warning("Foundry IQ indexing in _layer1_intake failed: %s", str(e))

        return ctx

    async def _layer2_judges(self, ctx: PipelineContext) -> PipelineContext:
        self._update_progress(0.25, "Running specialist judges...")

        brief_dict = self._brief_to_dict(ctx.brief)

        evidence_dict = {}
        kb = FoundryIQClient()
        if kb.is_available():
            try:
                query = (
                    f"Project: {ctx.brief.title}. "
                    f"Description: {ctx.brief.description[:300]}. "
                    f"Keywords: {', '.join(ctx.brief.tech_stack)}. "
                    f"Track: {ctx.brief.track_hint or 'Unknown'}."
                )
                result = kb.retrieve(query)
                evidence_dict["foundry_iq"] = result
                ctx.evidence_dict = evidence_dict
            except Exception as e:
                logger.warning("Foundry IQ retrieval in _layer2_judges failed: %s", str(e))

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
        self._update_progress(0.55, "Running critics and validators...")

        brief_dict = self._brief_to_dict(ctx.brief)

        devils = DevilsAdvocateAgent()
        weaknesses, penalties = await devils.critique(brief_dict, ctx.scores)
        ctx.weaknesses = weaknesses
        ctx.penalties = penalties

        verifier = EvidenceVerifierAgent()
        verified, flagged, confidence = await verifier.verify(ctx.scores, brief_dict, ctx.evidence_dict)
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
        self._update_progress(0.8, "Synthesizing final report...")

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
            name = f.get("name", "").lower()
            path = f.get("path", "").lower()
            if "readme" in name or "readme" in path:
                return f.get("content", "")[:2000]
        return ""

    def _build_execution_summary(self, ctx: PipelineContext) -> str:
        parts = [
            f"Processed {len(ctx.scores)} criteria",
            f"Identified {len(ctx.weaknesses)} weaknesses",
            f"Generated {len(ctx.risk_reports)} risk reports",
            f"Evidence confidence: {ctx.evidence_confidence:.0%}",
        ]
        kb = FoundryIQClient()
        if kb.is_available():
            parts.append("Microsoft IQ: Foundry IQ (Azure AI Search) — active")
        else:
            parts.append("Microsoft IQ: not configured (add SEARCH_ENDPOINT + SEARCH_API_KEY)")
        llm = get_llm()
        if llm.is_available():
            parts.append("LLM: GPT-4o-mini (GitHub Models) — active")
        else:
            parts.append("LLM: not configured (set GITHUB_TOKEN)")
        if ctx.competition_score:
            parts.append(f"Competitive edge: {ctx.competition_score:.0f}/100")
        return "; ".join(parts)

    def _update_progress(self, progress: float, message: str):
        self.status.progress = min(progress, 1.0)
        self.status.message = message

    def get_status(self) -> PipelineStatus:
        return self.status
