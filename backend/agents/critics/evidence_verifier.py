import json
from backend.schemas.models import EvidenceCitation
from backend.llm import llm_chat, get_llm


class EvidenceVerifierAgent:
    async def verify(self, scores: list) -> tuple[list[EvidenceCitation], list[EvidenceCitation], float]:
        if get_llm().is_available():
            return await self._llm_verify(scores)
        return self._rule_verify(scores)

    async def _llm_verify(self, scores: list) -> tuple[list[EvidenceCitation], list[EvidenceCitation], float]:
        system = (
            "You are an evidence verification agent. Review the judge scores and determine "
            "which claims are supported by evidence and which are unsupported. "
            "Return ONLY JSON: {\"verified\": [{\"content\": str, \"source\": str, \"relevance_score\": float}], "
            "\"flagged\": [same format], \"confidence\": float (0-1)}"
        )
        user = json.dumps([{
            "criterion": s.criterion, "score": s.score, "justification": s.justification,
            "confidence": s.confidence,
        } for s in scores])
        result = await llm_chat(system, user, temperature=0.3)
        try:
            data = json.loads(result)
            verified = [EvidenceCitation(**v) for v in data.get("verified", [])]
            flagged = [EvidenceCitation(**f) for f in data.get("flagged", [])]
            confidence = float(data.get("confidence", 0.5))
            return verified, flagged, confidence
        except Exception:
            return self._rule_verify(scores)

    def _rule_verify(self, scores: list) -> tuple[list[EvidenceCitation], list[EvidenceCitation], float]:
        verified = []
        flagged = []
        for s in scores:
            for c in (s.citations or []):
                if s.score >= 50 and s.confidence >= 0.5:
                    verified.append(c)
                elif s.score < 40:
                    flagged.append(c)
        confidence = sum(s.confidence for s in scores) / max(len(scores), 1)
        return verified, flagged, confidence
