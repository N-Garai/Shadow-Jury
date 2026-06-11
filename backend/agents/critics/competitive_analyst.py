from backend.schemas.models import Weakness


class CompetitiveAnalystAgent:
    async def analyze(self, brief: dict) -> tuple[float, list[str], list[Weakness]]:
        description = brief.get("description", "").lower()
        title = brief.get("title", "").lower()
        features = brief.get("features", [])
        claims = brief.get("claims", [])

        uniqueness_score = 50
        opportunities = []
        risks = []

        generic_project_types = ["assistant", "chatbot", "helper", "bot", "generator",
                                 "analyzer", "dashboard", "platform", "tool", "copilot"]
        found_generic = [t for t in generic_project_types if t in title or t in description]

        if found_generic:
            uniqueness_score -= 20
            risks.append(Weakness(
                category="Competitive Overlap",
                severity="high",
                description=f"Project type ({', '.join(found_generic[:3])}) is very common in hackathons",
                suggestion="Differentiate with a specific niche, unexpected data source, or novel interaction pattern"
            ))
            opportunities.append("Focus on a specific underserved use case rather than a general assistant")

        if len(features) >= 4:
            uniqueness_score += 10
        else:
            opportunities.append("Add a differentiating feature that competitors don't have")

        evaluation_keywords = ["score", "evaluat", "judge", "jury", "critique", "assess", "review", "audit"]
        found_eval = [kw for kw in evaluation_keywords if kw in description]
        if found_eval:
            uniqueness_score += 15
            opportunities.append(f"Your evaluation focus ('{', '.join(found_eval[:2])}') is relatively uncommon — lean into it")

        multi_agent_keywords = ["multi-agent", "ensemble", "panel", "mixture", "orchestrat", "parallel"]
        found_multi = [kw for kw in multi_agent_keywords if kw in description]
        if found_multi:
            uniqueness_score += 15
        else:
            opportunities.append("Consider a multi-agent or ensemble approach for differentiation")

        score = max(10, min(100, uniqueness_score))

        return score, opportunities, risks
