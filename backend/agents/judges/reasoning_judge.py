from backend.schemas.models import CriterionScore, EvidenceCitation


class ReasoningJudge:
    WEIGHT = 20

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
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

        citations = [
            EvidenceCitation(
                content=f"Found {len(found_keywords)} reasoning keywords. Tech stack: {tech_stack}",
                source="reasoning_analysis",
                relevance_score=0.85,
            )
        ]

        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No issues"]))

        return CriterionScore(
            criterion="Reasoning & Multi-step Thinking",
            weight=self.WEIGHT,
            score=score,
            justification=justification,
            citations=citations,
            confidence=0.8 if not issues else 0.55,
        )
