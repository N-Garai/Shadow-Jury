import json
from backend.schemas.models import Weakness
from backend.llm import llm_chat, get_llm


class CompetitiveAnalystAgent:
    async def analyze(self, brief: dict) -> tuple[float, list[str], list[Weakness]]:
        if get_llm().is_available():
            return await self._llm_analyze(brief)
        return self._rule_analyze(brief)

    async def _llm_analyze(self, brief: dict) -> tuple[float, list[str], list[Weakness]]:
        system = (
            "You are a competitive analyst for hackathon projects. Compare this project to typical "
            "submissions. Return ONLY JSON: {\"competition_score\": 0-100, "
            "\"opportunities\": [str], \"risks\": [{\"category\": str, \"severity\": str, "
            "\"description\": str, \"suggestion\": str}]}"
        )
        user = json.dumps({
            "title": brief.get("title"), "description": brief.get("description"),
            "claims": brief.get("claims"), "features": brief.get("features"),
            "tech_stack": brief.get("tech_stack"),
        })
        result = await llm_chat(system, user, temperature=0.4)
        try:
            data = json.loads(result)
            risks = [Weakness(**r) for r in data.get("risks", [])]
            return float(data.get("competition_score", 50)), data.get("opportunities", []), risks
        except Exception:
            return self._rule_analyze(brief)

    def _rule_analyze(self, brief: dict) -> tuple[float, list[str], list[Weakness]]:
        features = brief.get("features", [])
        tech_stack = brief.get("tech_stack", [])
        opportunities = []
        risks = []

        if len(features) <= 2:
            opportunities.append("Add a differentiating feature that competitors don't have")

        if "agent" not in str(brief).lower() and "ensemble" not in str(brief).lower():
            opportunities.append("Consider a multi-agent or ensemble approach for differentiation")

        if not tech_stack:
            risks.append(Weakness(
                category="Generic", severity="medium",
                description="No specific tech stack mentioned — may appear ungrounded",
                suggestion="List your key technologies to show technical depth"))

        comp_score = 50.0
        if len(features) >= 4:
            comp_score += 20
        if "azure" in str(tech_stack).lower() or "foundry" in str(tech_stack).lower():
            comp_score += 15
        if len(opportunities) <= 1:
            comp_score += 15

        return comp_score, opportunities, risks
