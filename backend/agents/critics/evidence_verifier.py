import json
from backend.schemas.models import EvidenceCitation
from backend.llm import llm_chat, get_llm


class EvidenceVerifierAgent:
    async def verify(self, scores: list, brief: dict = None, evidence: dict = None) -> tuple[list[EvidenceCitation], list[EvidenceCitation], float]:
        if get_llm().is_available():
            return await self._llm_verify(scores, brief, evidence)
        return self._rule_verify(scores, brief, evidence)

    async def _llm_verify(self, scores: list, brief: dict = None, evidence: dict = None) -> tuple[list[EvidenceCitation], list[EvidenceCitation], float]:
        system = (
            "You are an evidence verification agent. Review the judge scores and the original project "
            "materials to determine which claims are supported by evidence and which are unsupported. "
            "A claim is VERIFIED if the justification cites specific evidence matching the claim. "
            "It is FLAGGED if the justification is vague, uses weasel words, or contradicts the claim. "
            "Return ONLY JSON: {\"verified\": [{\"content\": str, \"source\": str, \"relevance_score\": float}], "
            "\"flagged\": [same format], \"confidence\": float (0-1)}"
        )
        payload = [{
            "criterion": s.criterion, "score": s.score, "justification": s.justification,
            "confidence": s.confidence,
        } for s in scores]
        if brief:
            payload.append({"project_title": brief.get("title"), "project_description": brief.get("description")[:300]})
        if evidence:
            citations = evidence.get("foundry_iq", {}).get("citations", [])
            if citations:
                payload.append({"retrieved_evidence": [{"content": c.get("content", "")[:800], "source": c.get("source", "")} for c in citations[:3]]})
        user = json.dumps(payload)
        result = await llm_chat(system, user, temperature=0.3)
        try:
            data = json.loads(result)
            verified = [EvidenceCitation.model_validate(v) for v in data.get("verified", [])]
            flagged = [EvidenceCitation.model_validate(f) for f in data.get("flagged", [])]
            confidence = float(data.get("confidence", 0.5))
            return verified, flagged, confidence
        except Exception:
            return self._rule_verify(scores, brief, evidence)

    def _rule_verify(self, scores: list, brief: dict = None, evidence: dict = None) -> tuple[list[EvidenceCitation], list[EvidenceCitation], float]:
        verified = []
        flagged = []
        for s in scores:
            for c in (s.citations or []):
                weight = s.score * s.confidence
                if weight >= 30:
                    verified.append(c)
                elif weight < 20:
                    flagged.append(c)
        kb_citations = []
        if evidence:
            kb_citations = evidence.get("foundry_iq", {}).get("citations", [])
        for c in kb_citations:
            relevant = EvidenceCitation(content=c.get("content", "")[:500], source=c.get("source", "kb"), relevance_score=c.get("relevance_score", 0.5))
            verified.append(relevant)
        confidence = sum(s.confidence for s in scores) / max(len(scores), 1)
        return verified, flagged, confidence
