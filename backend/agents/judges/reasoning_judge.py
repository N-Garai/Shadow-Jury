import json
from backend.schemas.models import CriterionScore, EvidenceCitation
from backend.llm import llm_chat, get_llm


class ReasoningJudge:
    WEIGHT = 20

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        if get_llm().is_available():
            return await self._llm_evaluate(brief, evidence)
        return self._rule_evaluate(brief, evidence)

    async def _llm_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        system = (
            "You are a strict hackathon judge scoring 'Reasoning & Multi-step Thinking' (weight 20%). "
            "Return ONLY a JSON object with these exact keys: "
            '{"score": int (0-100), "justification": str, "confidence": float (0-1)}. '
            "Score bands — 0-30: no orchestration or multi-step logic; "
            "31-60: basic sequential steps with limited decomposition; "
            "61-80: parallel/stateful workflows with clear architecture; "
            "81-100: sophisticated agent graphs with memory and intelligent routing. "
            "Score based on: evidence of multi-step reasoning, agent orchestration patterns, "
            "architecture clarity, workflow complexity, and structured problem decomposition."
        )
        user_payload = {
            "title": brief.get("title"), "description": brief.get("description"),
            "claims": brief.get("claims"), "features": brief.get("features"),
            "tech_stack": brief.get("tech_stack"), "goals": brief.get("goals"),
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
        citations = [EvidenceCitation(content=justification[:200], source="llm_reasoning_judge", relevance_score=confidence)]
        return CriterionScore(criterion="Reasoning & Multi-step Thinking", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations, confidence=confidence)

    def _rule_evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        claims = brief.get("claims", [])
        features = brief.get("features", [])
        description = brief.get("description", "").lower()
        tech_stack = brief.get("tech_stack", [])
        positives = []
        issues = []
        reasoning_keywords = ["agent", "workflow", "pipeline", "orchestrat", "chain",
                              "multi-step", "reasoning", "sequential", "parallel",
                              "graph", "state", "context", "memory"]
        found_keywords = [kw for kw in reasoning_keywords if kw in description]
        if found_keywords:
            positives.append(f"Shows multi-step reasoning awareness: {', '.join(found_keywords[:4])}")
        else:
            issues.append("No evidence of multi-step reasoning or agent orchestration pattern")
        if len(claims) >= 5:
            positives.append(f"Articulates {len(claims)} distinct claims — good for structured evaluation")
        elif len(claims) < 3:
            issues.append("Too few claims to evaluate reasoning depth meaningfully")
        if "foundry" in tech_stack or "azure" in tech_stack:
            positives.append("Leverages Microsoft ecosystem suitable for complex workflows")
        else:
            issues.append("Tech stack doesn't suggest enterprise-grade orchestration capability")
        if "architecture" in description or "flow" in description or "diagram" in description:
            positives.append("Includes architecture/flow description — reasoning is visible")
        else:
            issues.append("Missing architecture description — reasoning pathway is opaque")
        score = 65
        for _ in issues:
            score -= 10
        for _ in positives:
            score += 5
        score = max(10, min(100, score))
        citations = [EvidenceCitation(content=f"Found {len(found_keywords)} reasoning keywords. Tech stack: {tech_stack}",
                                       source="reasoning_analysis", relevance_score=0.85)]
        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No issues"]))
        return CriterionScore(criterion="Reasoning & Multi-step Thinking", weight=self.WEIGHT, score=score,
                              justification=justification, citations=citations,
                              confidence=0.8 if not issues else 0.55)
