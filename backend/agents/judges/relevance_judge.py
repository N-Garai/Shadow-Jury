import json
from backend.schemas.models import CriterionScore, EvidenceCitation
from backend.llm import llm_chat, get_llm


class RelevanceJudge:
    WEIGHT = 20

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        if get_llm().is_available():
            return await self._llm_evaluate(brief, evidence)
        return self._rule_evaluate(brief, evidence)

    async def _llm_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        system = (
            "You are a strict hackathon judge scoring 'Accuracy & Relevance' (weight 20%). "
            "Return ONLY a JSON object with keys: score (0-100), justification (str), confidence (0-1). "
            "Score based on: how well the project fits its stated track, whether claims are aligned with "
            "the project description, and relevance of tech choices to the problem."
        )
        user = json.dumps({
            "title": brief.get("title"), "description": brief.get("description"),
            "track_hint": brief.get("track_hint"), "claims": brief.get("claims"),
            "tech_stack": brief.get("tech_stack"),
        })
        result = await llm_chat(system, user, temperature=0.3)
        return self._parse_response(result, brief)

    def _parse_response(self, llm_text: str, brief: dict) -> CriterionScore:
        try:
            data = json.loads(llm_text)
            score = max(0, min(100, int(data.get("score", 50))))
            confidence = max(0, min(1, float(data.get("confidence", 0.5))))
            justification = str(data.get("justification", ""))
        except Exception:
            return self._rule_evaluate(brief, evidence={})
        citations = [EvidenceCitation(content=justification[:200], source="llm_relevance_judge", relevance_score=confidence)]
        return CriterionScore(criterion="Accuracy & Relevance", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations, confidence=confidence)

    def _rule_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        track = brief.get("track_hint", "Unknown")
        track_lower = track.lower()
        issues = []
        positives = []
        if "reasoning" in track_lower or "agent" in track_lower:
            positives.append("Project targets the Reasoning Agents track")
        if track == "Unknown":
            issues.append("Track alignment is unclear — no explicit track mentioned")
        description = brief.get("description", "").lower()
        if any(word in description for word in ["foundry", "mcp", "agent", "orchestrat", "multi-step", "reasoning"]):
            positives.append("Description mentions track-appropriate technologies")
        else:
            issues.append("Description lacks evidence of track-specific technology usage")
        if brief.get("claims"):
            positives.append(f"Project makes {len(brief['claims'])} claims worth evaluating")
        score = 70
        for _ in issues:
            score -= 10
        for _ in positives:
            score += 5
        score = max(10, min(100, score))
        citations = [EvidenceCitation(content=f"Track: {track}. {'; '.join(positives + issues)}",
                                       source="relevance_analysis", relevance_score=0.9)]
        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No major issues"]))
        return CriterionScore(criterion="Accuracy & Relevance", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations,
                              confidence=0.85 if not issues else 0.6)
