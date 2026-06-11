from backend.schemas.models import Weakness


class DevilsAdvocateAgent:
    async def critique(self, brief: dict, scores: list) -> tuple[list[Weakness], dict]:
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
                    category="Overpromising",
                    severity="high",
                    description=f"Claim uses absolute language: '{claim[:80]}...'",
                    suggestion="Replace absolutes with measured claims and add qualifiers"
                ))

        if len(features) > 6:
            weaknesses.append(Weakness(
                category="Scope Creep",
                severity="medium",
                description=f"{len(features)} features listed — risk of over-scoping for hackathon timeline",
                suggestion="Focus on 3-4 core features and make them polished"
            ))

        if not brief.get("track_hint") or brief["track_hint"] == "Unknown":
            weaknesses.append(Weakness(
                category="Track Misalignment",
                severity="critical",
                description="No hackathon track identified — judges may see this as unfocused",
                suggestion="Explicitly state which track you're competing in and why your project fits"
            ))

        missing_sections = []
        if "architecture" not in description:
            missing_sections.append("Architecture")
        if "demo" not in description:
            missing_sections.append("Demo Plan")
        if "safety" not in description and "security" not in description:
            missing_sections.append("Safety/Security")
        if missing_sections:
            weaknesses.append(Weakness(
                category="Missing Documentation",
                severity="medium",
                description=f"Missing sections: {', '.join(missing_sections)}",
                suggestion=f"Add sections for: {', '.join(missing_sections)}"
            ))

        for score in scores:
            if score.score < 50:
                penalties[score.criterion] = 0.15
            elif score.score < 30:
                penalties[score.criterion] = 0.25

        return weaknesses, penalties
