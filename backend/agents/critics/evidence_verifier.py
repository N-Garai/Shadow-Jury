from backend.schemas.models import EvidenceCitation


class EvidenceVerifierAgent:
    async def verify(self, scores: list) -> tuple[list[EvidenceCitation], list[EvidenceCitation], float]:
        verified = []
        flagged = []
        total_citations = 0
        valid_citations = 0

        for score in scores:
            for citation in score.citations:
                total_citations += 1
                if citation.relevance_score >= 0.5:
                    verified.append(citation)
                    valid_citations += 1
                else:
                    flagged.append(citation)

        overall_confidence = valid_citations / max(total_citations, 1)

        return verified, flagged, overall_confidence
