import json
from backend.schemas.models import CriterionScore, EvidenceCitation
from backend.llm import llm_chat, get_llm


class CreativityJudge:
    WEIGHT = 15

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        if get_llm().is_available():
            return await self._llm_evaluate(brief, evidence)
        return self._rule_evaluate(brief, evidence)

    async def _llm_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        system = (
            "You are a strict hackathon judge scoring 'Creativity & Originality' (weight 15%). "
            "Return ONLY JSON with these exact keys: "
            '{"score": int (0-100), "justification": str, "confidence": float (0-1)}. '
            "Score bands — 0-20: generic CRUD generator or minor variation; "
            "21-40: standard CRUD app with predictable features; "
            "41-60: novel combination of existing technologies; "
            "61-80: genuinely new approach with surprising elements; "
            "81-100: category-defining innovation with strong differentiation. "
            "Score based on: novelty of the idea, uniqueness compared to common hackathon projects, "
            "surprising elements, creative problem framing, and differentiation from existing solutions."
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
        result = await llm_chat(system, user, temperature=0.4)
        return self._parse_response(result, brief, evidence)

    def _parse_response(self, llm_text: str, brief: dict, evidence: dict) -> CriterionScore:
        try:
            data = json.loads(llm_text)
            score = max(0, min(100, int(data.get("score", 50))))
            confidence = max(0, min(1, float(data.get("confidence", 0.5))))
            justification = str(data.get("justification", ""))
        except Exception:
            return self._rule_evaluate(brief, evidence)
        citations = [EvidenceCitation(content=justification[:200], source="llm_creativity_judge", relevance_score=confidence)]
        return CriterionScore(criterion="Creativity & Originality", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations, confidence=confidence)

    def _rule_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        description = brief.get("description", "").lower()
        title = brief.get("title", "").lower()
        features = brief.get("features", [])
        positives = []
        issues = []
        generic_terms = ["assistant", "chatbot", "helper", "bot", "tool", "platform",
                         "dashboard", "generator", "analyzer"]
        specific_terms = ["agent", "jury", "judge", "ensemble", "orchestrat", "mixture",
                          "critique", "evaluator", "scorer", "delta", "simulat"]
        found_generic = [t for t in generic_terms if t in description or t in title]
        found_specific = [t for t in specific_terms if t in description or t in title]
        if found_specific:
            positives.append(f"Uses novel concepts: {', '.join(found_specific[:3])}")
        else:
            issues.append("Concept appears generic — no surprising or novel elements detected")
        if found_generic and not found_specific:
            issues.append(f"Relies on common patterns: {', '.join(found_generic[:3])}")
        if len(features) >= 4:
            positives.append(f"Offers {len(features)} features — shows breadth of thinking")
        elif len(features) <= 2:
            issues.append("Too few features — scope is narrow for a competitive submission")
        if "unique" in description or "novel" in description or "first" in description:
            positives.append("Self-identifies as unique/novel — ambition detected")
        if "win" in description or "competition" in description or "hackathon" in description:
            positives.append("Shows competition awareness — positioned for judges")
        score = 60
        for _ in issues:
            score -= 12
        for _ in positives:
            score += 6
        score = max(10, min(100, score))
        citations = [EvidenceCitation(content=f"Generic terms: {found_generic}. Novel terms: {found_specific}",
                                       source="creativity_analysis", relevance_score=0.8)]
        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No issues"]))
        return CriterionScore(criterion="Creativity & Originality", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations,
                              confidence=0.75 if found_specific else 0.4)
