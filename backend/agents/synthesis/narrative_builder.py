from backend.schemas.models import FinalReport, Scorecard, ProjectBrief, RiskReport, Weakness


class NarrativeBuilderAgent:
    async def build_narrative(self, brief: ProjectBrief, scorecard: Scorecard,
                               competition_insights: list[str], weaknesses: list[Weakness]) -> dict:
        strengths_found = [s for s in scorecard.criteria if s.score >= 70]
        weak_areas = [s for s in scorecard.criteria if s.score < 50]

        summary_parts = [f"{brief.title} — Overall: {scorecard.final_score.grade} ({scorecard.final_score.total}/100)"]

        if strengths_found:
            names = [s.criterion for s in strengths_found]
            summary_parts.append(f"Strengths: {', '.join(names)}")

        if weak_areas:
            names = [s.criterion for s in weak_areas]
            summary_parts.append(f"Areas to improve: {', '.join(names)}")

        if competition_insights:
            summary_parts.append(f"Competitive edge: {competition_insights[0][:100]}")

        narrative = {
            "executive_summary": ". ".join(summary_parts),
            "strengths": [s.justification for s in strengths_found],
            "weaknesses": [w.description for w in weaknesses],
            "opportunities": competition_insights,
            "recommendation": self._build_recommendation(scorecard, weaknesses),
            "grade_summary": f"Grade {scorecard.final_score.grade}: {'Strong' if scorecard.final_score.grade in ['A', 'B'] else 'Needs improvement'} submission",
            "microsoft_iq": self._build_iq_summary(scorecard),
        }

        return narrative

    def _build_iq_summary(self, scorecard: Scorecard) -> dict:
        return {
            "layer": "Foundry IQ",
            "description": "Azure AI Search for agentic knowledge retrieval — indexes project documents and delivers cited, grounded evidence to reduce hallucination",
            "integration": "Documents are indexed into Azure AI Search via DocumentIndexer. Judges retrieve relevant passages via FoundryIQClient for cited scoring.",
        }

    def _build_recommendation(self, scorecard: Scorecard, weaknesses: list[Weakness]) -> dict:
        if scorecard.final_score.grade in ["A", "B"]:
            verdict = "Advance to next round"
            confidence = scorecard.final_score.total / 100
        elif scorecard.final_score.grade == "C":
            verdict = "Consider with revisions"
            confidence = 0.5
        else:
            verdict = "Unlikely to advance"
            confidence = 0.3

        return {
            "verdict": verdict,
            "confidence": round(confidence, 2),
            "key_action_items": [w.suggestion for w in weaknesses[:3]],
        }
