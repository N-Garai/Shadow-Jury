from backend.schemas.models import CriterionScore, EvidenceCitation


class SafetyJudge:
    WEIGHT = 20

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
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

        if "CRITICAL" in str(issues):
            score = min(score, 30)

        citations = [
            EvidenceCitation(
                content=f"Safety keywords: {found_safety}. Unsupported claims: {unsupported_claims}",
                source="safety_analysis",
                relevance_score=0.9,
            )
        ]

        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No issues"]))

        return CriterionScore(
            criterion="Reliability & Safety",
            weight=self.WEIGHT,
            score=score,
            justification=justification,
            citations=citations,
            confidence=0.9 if found_safety else 0.3,
        )
