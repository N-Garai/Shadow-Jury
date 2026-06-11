from backend.schemas.models import CriterionScore, EvidenceCitation


class UXJudge:
    WEIGHT = 15

    async def evaluate(self, brief: dict, evidence: dict) -> CriterionScore:
        description = brief.get("description", "").lower()
        claims = brief.get("claims", [])

        positives = []
        issues = []

        ux_keywords = ["ui", "dashboard", "interface", "visual", "chart", "radar",
                       "demo", "present", "export", "report", "responsive", "polish"]
        found_ux = [kw for kw in ux_keywords if kw in description]

        if found_ux:
            positives.append(f"UX-aware: mentions {', '.join(found_ux[:4])}")
        else:
            issues.append("No UX considerations mentioned — may lack polished demo surface")

        demo_keywords = ["demo", "video", "walkthrough", "screenshot", "showcase", "present"]
        found_demo = [kw for kw in demo_keywords if kw in description]
        if found_demo:
            positives.append("Demo/presentation strategy discussed")
        else:
            issues.append("No demo plan evident — presentation readiness is unclear")

        if len(claims) > 3:
            positives.append(f"Clear value proposition with {len(claims)} claims — easy to demo")
        else:
            issues.append("Weak value proposition — hard to demo impactfully")

        if "readme" in description or "documentation" in description:
            positives.append("Documentation-aware — shows submission readiness")

        score = 55
        for _ in issues:
            score -= 12
        for _ in positives:
            score += 7
        score = max(10, min(100, score))

        citations = [
            EvidenceCitation(
                content=f"UX keywords found: {found_ux}. Demo keywords: {found_demo}",
                source="ux_analysis",
                relevance_score=0.75,
            )
        ]

        justification = "; ".join(positives + (["Issues: " + "; ".join(issues)] if issues else ["No issues"]))

        return CriterionScore(
            criterion="User Experience & Presentation",
            weight=self.WEIGHT,
            score=score,
            justification=justification,
            citations=citations,
            confidence=0.7 if found_ux else 0.35,
        )
