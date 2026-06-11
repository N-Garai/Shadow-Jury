from backend.schemas.models import CriterionScore, EvidenceCitation


class RelevanceJudge:
    WEIGHT = 20

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
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

        citations = [
            EvidenceCitation(
                content=f"Track: {track}. {'; '.join(positives + issues)}",
                source="relevance_analysis",
                relevance_score=0.9,
            )
        ]

        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No major issues"]))

        return CriterionScore(
            criterion="Accuracy & Relevance",
            weight=self.WEIGHT,
            score=score,
            justification=justification,
            citations=citations,
            confidence=0.85 if not issues else 0.6,
        )
