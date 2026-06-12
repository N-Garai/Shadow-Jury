import json
from backend.schemas.models import Weakness
from backend.llm import llm_chat, get_llm


class DevilsAdvocateAgent:
    async def critique(self, brief: dict, scores: list) -> tuple[list[Weakness], dict]:
        if get_llm().is_available():
            return await self._llm_critique(brief, scores)
        return self._rule_critique(brief, scores)

    async def _llm_critique(self, brief: dict, scores: list) -> tuple[list[Weakness], dict]:
        score_summary = [{"criterion": s.criterion, "score": s.score} for s in scores]
        system = (
            "You are a strict Devil's Advocate for hackathon projects. "
            "Return ONLY JSON: {\"weaknesses\": [{\"category\": str, \"severity\": \"critical\"/\"high\"/\"medium\", "
            "\"description\": str, \"suggestion\": str}], \"penalties\": {\"criterion_name\": 0.15}} "
            "Identify unrealistic claims, missing documentation, scope issues, "
            "track misalignment, and technical risks. Penalties (0.05-0.25) for criteria with major flaws."
        )
        user = json.dumps({
            "title": brief.get("title"), "description": brief.get("description"),
            "claims": brief.get("claims"), "features": brief.get("features"),
            "track_hint": brief.get("track_hint"), "tech_stack": brief.get("tech_stack"),
            "scores": score_summary,
        })
        result = await llm_chat(system, user, temperature=0.4)
        return self._parse_response(result, scores)

    def _parse_response(self, llm_text: str, scores: list) -> tuple[list[Weakness], dict]:
        try:
            data = json.loads(llm_text)
            weaknesses = [Weakness(**w) for w in data.get("weaknesses", [])]
            penalties = data.get("penalties", {})
            return weaknesses, penalties
        except Exception:
            return self._rule_critique({}, scores)

    def _rule_critique(self, brief: dict, scores: list) -> tuple[list[Weakness], dict]:
        weaknesses = []
        penalties = {}
        description = brief.get("description", "").lower()
        claims = brief.get("claims", [])
        features = brief.get("features", [])

        overpromises = ["guaranteed", "always", "never", "perfect", "100%", "all",
                        "every", "best", "first", "fastest", "most"]
        for claim in claims:
            found = [w for w in overpromises if w in claim.lower()]
            if found:
                weaknesses.append(Weakness(
                    category="Overpromising", severity="high",
                    description=f"Claim uses absolute language: '{claim[:80]}...'",
                    suggestion="Replace absolutes with measured claims and add qualifiers"))

        if len(features) > 6:
            weaknesses.append(Weakness(
                category="Scope Creep", severity="medium",
                description=f"{len(features)} features listed — risk of over-scoping for hackathon timeline",
                suggestion="Focus on 3-4 core features and make them polished"))

        if not brief.get("track_hint") or brief["track_hint"] == "Unknown":
            weaknesses.append(Weakness(
                category="Track Misalignment", severity="critical",
                description="No hackathon track identified — judges may see this as unfocused",
                suggestion="Explicitly state which track you're competing in and why your project fits"))

        missing_sections = []
        if "architecture" not in description:
            missing_sections.append("Architecture")
        if "demo" not in description:
            missing_sections.append("Demo Plan")
        if "safety" not in description and "security" not in description:
            missing_sections.append("Safety/Security")
        if missing_sections:
            weaknesses.append(Weakness(
                category="Missing Documentation", severity="medium",
                description=f"Missing sections: {', '.join(missing_sections)}",
                suggestion=f"Add sections for: {', '.join(missing_sections)}"))

        for score in scores:
            if score.score < 50:
                penalties[score.criterion] = 0.15
            elif score.score < 30:
                penalties[score.criterion] = 0.25

        return weaknesses, penalties
