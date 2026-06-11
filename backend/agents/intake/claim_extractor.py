import re
from backend.schemas.models import ProjectBrief


class ClaimExtractorAgent:
    async def extract(self, brief: ProjectBrief) -> ProjectBrief:
        enhanced_claims = list(brief.claims)

        for feature in brief.features:
            claim = f"The project features {feature}"
            if claim not in enhanced_claims:
                enhanced_claims.append(claim)

        for goal in brief.goals:
            claim = f"The project aims to {goal.lower()}"
            if claim not in enhanced_claims:
                enhanced_claims.append(claim)

        if not brief.track_hint or brief.track_hint == "Unknown":
            for chunk in brief.raw_text_chunks:
                chunk_lower = chunk.lower()
                if "hackathon" in chunk_lower or "track" in chunk_lower or "challenge" in chunk_lower:
                    match = re.search(r"(?:reasoning|creative|enterprise)", chunk_lower)
                    if match:
                        track_map = {
                            "reasoning": "Reasoning Agents",
                            "creative": "Creative Apps",
                            "enterprise": "Enterprise Agents",
                        }
                        enhanced_claims.append(f"Project targets {track_map[match.group()]} track")
                        break

        all_claims = list(dict.fromkeys(enhanced_claims))

        return ProjectBrief(
            title=brief.title,
            description=brief.description,
            claims=all_claims,
            features=brief.features,
            goals=brief.goals,
            track_hint=brief.track_hint,
            tech_stack=brief.tech_stack,
            raw_text_chunks=brief.raw_text_chunks,
        )
