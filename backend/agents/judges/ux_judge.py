import json
from backend.schemas.models import CriterionScore, EvidenceCitation
from backend.llm import llm_chat, get_llm


class UXJudge:
    WEIGHT = 15

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        if get_llm().is_available():
            return await self._llm_evaluate(brief, evidence)
        return self._rule_evaluate(brief, evidence)

    async def _llm_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        system = (
            "You are a strict hackathon judge scoring 'User Experience & Presentation' (weight 15%). "
            "Return ONLY JSON with these exact keys: "
            '{"score": int (0-100), "justification": str, "confidence": float (0-1)}. '
            "Score bands — 0-30: no UI/UX consideration, unclear value proposition; "
            "31-60: basic interface with minimal polish; "
            "61-80: well-designed UI with clear demo strategy and documentation; "
            "81-100: polished, production-ready presentation with excellent demo flow. "
            "Score based on: articulation of UX strategy, UI component planning, "
            "demo readiness, documentation quality, presentation strategy, and how easy "
            "it is for judges to understand the value."
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
        citations = [EvidenceCitation(content=justification[:200], source="llm_ux_judge", relevance_score=confidence)]
        return CriterionScore(criterion="User Experience & Presentation", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations, confidence=confidence)

    def _rule_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        description = brief.get("description", "").lower()
        claims = brief.get("claims", [])
        positives = []
        issues = []
        ux_keywords = ["ui", "dashboard", "interface", "visual", "chart", "radar",
                        "demo", "present", "export", "report", "responsive", "polish"]
        found_ux = [kw for kw in ux_keywords if kw in description]
        if found_ux:
            positives.append(f"UX-aware: mentions {', '.join(found_ux[:4])}")
        else:
            issues.append("No UX considerations mentioned — may lack polished demo surface")
        demo_keywords = ["demo", "video", "walkthrough", "screenshot", "showcase", "present"]
        found_demo = [kw for kw in demo_keywords if kw in description]
        if found_demo:
            positives.append("Demo/presentation strategy discussed")
        else:
            issues.append("No demo plan evident — presentation readiness is unclear")
        if len(claims) > 3:
            positives.append(f"Clear value proposition with {len(claims)} claims — easy to demo")
        else:
            issues.append("Weak value proposition — hard to demo impactfully")
        if "readme" in description or "documentation" in description:
            positives.append("Documentation-aware — shows submission readiness")
        score = 55
        for _ in issues:
            score -= 12
        for _ in positives:
            score += 7
        score = max(10, min(100, score))
        citations = [EvidenceCitation(content=f"UX keywords found: {found_ux}. Demo keywords: {found_demo}",
                                       source="ux_analysis", relevance_score=0.75)]
        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No issues"]))
        return CriterionScore(criterion="User Experience & Presentation", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations,
                              confidence=0.7 if found_ux else 0.35)
