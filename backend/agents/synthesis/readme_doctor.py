from backend.schemas.models import RiskReport, Weakness


class ReadmeDoctorAgent:
    async def diagnose(self, brief: dict, weaknesses: list[Weakness],
                       opportunities: list[str]) -> tuple[list[RiskReport], list[str]]:
        risks = []
        suggestions = []

        if not brief.get("readme") or not brief["readme"].strip():
            risks.append(RiskReport(
                category="Missing README",
                severity="critical",
                description="No README content detected — submissions without clear README are at severe disadvantage",
                recommendation="Write a comprehensive README with: project name, description, setup, architecture, tech stack, screenshots, and hackathon track",
            ))
        else:
            readme = brief["readme"].lower()
            required_sections = ["setup", "installation", "usage", "features", "architecture"]
            missing = [s for s in required_sections if s not in readme]
            if missing:
                risks.append(RiskReport(
                    category="Incomplete README",
                    severity="high",
                    description=f"Missing sections in README: {', '.join(missing)}",
                    recommendation=f"Add the following sections: {', '.join(missing)}",
                ))
            else:
                suggestions.append("README covers all essential sections — well-prepared submission")

        if brief.get("track_hint") == "Unknown":
            risks.append(RiskReport(
                category="No Track Declaration",
                severity="high",
                description="Submission does not specify which hackathon track it targets",
                recommendation="Add a line: '## Track' with the track name and why your project fits",
            ))

        if not any("demo" in s.lower() for s in suggestions):
            suggestions.append("Create a GIF/screen recording walkthrough for the README to impress judges")

        if opportunities:
            suggestions.append(f"Differentiation opportunity: {opportunities[0]}")

        return risks, suggestions
