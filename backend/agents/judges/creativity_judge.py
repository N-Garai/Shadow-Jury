from backend.schemas.models import CriterionScore, EvidenceCitation


class CreativityJudge:
    WEIGHT = 15

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
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

        citations = [
            EvidenceCitation(
                content=f"Generic terms: {found_generic}. Novel terms: {found_specific}",
                source="creativity_analysis",
                relevance_score=0.8,
            )
        ]

        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No issues"]))

        return CriterionScore(
            criterion="Creativity & Originality",
            weight=self.WEIGHT,
            score=score,
            justification=justification,
            citations=citations,
            confidence=0.75 if found_specific else 0.4,
        )
