import json
from backend.schemas.models import CriterionScore, EvidenceCitation
from backend.llm import llm_chat, get_llm


class SafetyJudge:
    WEIGHT = 20

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        if get_llm().is_available():
            return await self._llm_evaluate(brief, evidence)
        return self._rule_evaluate(brief, evidence)

    async def _llm_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        system = (
            "You are a strict hackathon judge scoring 'Reliability & Safety' (weight 20%). "
            "Return ONLY JSON with these exact keys: "
            '{"score": int (0-100), "justification": str, "confidence": float (0-1)}. '
            "Score bands — 0-30: no safety or security consideration; "
            "31-60: basic authentication or minimal safety mentions; "
            "61-80: content filtering, bias analysis, and testing approach; "
            "81-100: red-teaming, adversarial testing, continuous monitoring, and ethical framework. "
            "Score based on: safety/security considerations, ethical awareness, hallucination "
            "prevention, citation strategy, testing approach, and responsible AI practices."
        )
        user_payload = {
            "title": brief.get("title"), "description": brief.get("description"),
            "claims": brief.get("claims"), "features": brief.get("features"),
            "tech_stack": brief.get("tech_stack"),
        }
        citations = evidence.get("foundry_iq", {}).get("citations", [])
        if citations:
            user_payload["retrieved_evidence"] = [
                {"content": c.get("content", "")[:800], "source": c.get("source", ""),
                 "relevance": c.get("relevance_score", 0)}
                for c in citations[:3]
            ]
        user = json.dumps(user_payload)
        result = await llm_chat(system, user, temperature=0.3)
        return self._parse_response(result, brief, evidence)

    def _parse_response(self, llm_text: str, brief: dict, evidence: dict) -> CriterionScore:
        try:
            data = json.loads(llm_text)
            score = max(0, min(100, int(data.get("score", 50))))
            confidence = max(0, min(1, float(data.get("confidence", 0.5))))
            justification = str(data.get("justification", ""))
        except Exception:
            return self._rule_evaluate(brief, evidence)
        citations = [EvidenceCitation(content=justification[:200], source="llm_safety_judge", relevance_score=confidence)]
        return CriterionScore(criterion="Reliability & Safety", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations, confidence=confidence)

    def _rule_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        description = brief.get("description", "").lower()
        claims = brief.get("claims", [])
        tech_stack = brief.get("tech_stack", [])
        positives = []
        issues = []
        safety_keywords = ["safety", "secure", "privacy", "ethical", "responsible",
                           "bias", "fairness", "guardrail", "content filter",
                           "rate limit", "authentication", "authorization"]
        found_safety = [kw for kw in safety_keywords if kw in description]
        if found_safety:
            positives.append(f"Addresses safety: {', '.join(found_safety[:4])}")
        else:
            issues.append("CRITICAL: No safety, security, or ethical considerations mentioned")
        unsupported_claims = 0
        for claim in claims[:10]:
            if any(word in claim.lower() for word in ["best", "first", "fastest", "most", "only", "guaranteed"]):
                unsupported_claims += 1
        if unsupported_claims > 2:
            issues.append(f"{unsupported_claims} claims use superlatives without supporting evidence")
        elif unsupported_claims > 0:
            positives.append("Most claims are measured and reasonable")
        if "hallucination" in description or "grounding" in description or "citation" in description:
            positives.append("Addresses hallucination/grounding — shows reliability awareness")
        else:
            issues.append("No mention of hallucination prevention or citation strategy")
        if "test" in description or "evaluat" in description or "benchmark" in description:
            positives.append("Testing/evaluation mentioned — reliability is considered")
        score = 50
        for _ in issues:
            score -= 12
        for _ in positives:
            score += 5
        score = max(10, min(100, score))
        has_critical = any("CRITICAL" in str(i) for i in issues)
        if has_critical:
            score = min(score, 30)
        citations = [EvidenceCitation(content=f"Safety keywords: {found_safety}. Unsupported claims: {unsupported_claims}",
                                       source="safety_analysis", relevance_score=0.9)]
        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No issues"]))
        return CriterionScore(criterion="Reliability & Safety", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations,
                              confidence=0.9 if found_safety else 0.3)
