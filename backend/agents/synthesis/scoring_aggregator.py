from backend.schemas.models import Scorecard, FinalScore, CriterionScore, Weakness


class ScoringAggregatorAgent:
    async def aggregate(self, scores: list[CriterionScore], weaknesses: list[Weakness],
                        penalties: dict, competition_score: float) -> Scorecard:

        weighting_sum = sum(s.weight for s in scores)
        raw_weighted = sum(s.score * s.weight for s in scores)

        penalty_total = sum(penalties.get(s.criterion, 0) for s in scores)
        adjusted_weighted = raw_weighted * (1 - penalty_total)
        average = adjusted_weighted / max(weighting_sum, 1)

        total = round(average, 1)
        grades = []
        if total >= 85:
            grade = "A"
        elif total >= 75:
            grade = "B"
        elif total >= 60:
            grade = "C"
        elif total >= 40:
            grade = "D"
        else:
            grade = "F"

        risk_level = "low"
        for w in weaknesses:
            if w.severity == "critical":
                risk_level = "critical"
                break
            if w.severity == "high":
                risk_level = "high"

        final_score = FinalScore(total=total, grade=grade, risk_level=risk_level)

        return Scorecard(
            final_score=final_score,
            criteria=scores,
            weaknesses=weaknesses,
            competition_score=competition_score,
        )
