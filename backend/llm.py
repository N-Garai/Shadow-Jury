import asyncio
import logging
import os
from typing import Optional

import httpx

_GLOBAL_LLM: Optional["LLMClient"] = None

logger = logging.getLogger(__name__)


def get_llm():
    global _GLOBAL_LLM
    if _GLOBAL_LLM is None:
        _GLOBAL_LLM = LLMClient()
    return _GLOBAL_LLM


async def llm_chat(system: str, user: str, temperature: float = 0.3) -> str:
    llm = get_llm()
    if not llm.is_available():
        return ""
    return await llm.chat(system, user, temperature)


class LLMClient:
    """GitHub Models — free GPT-4o-mini access via GITHUB_TOKEN.

    Up to 150 requests/day, no credit card needed.
    Falls back silently when token is missing.
    """

    BASE_URL = "https://models.inference.ai.azure.com"
    MODEL = "gpt-4o-mini"
    MAX_RETRIES = 3

    def __init__(self):
        token = os.getenv("GITHUB_TOKEN", "").strip()
        self._available = bool(token)
        self._client: Optional[httpx.AsyncClient] = None
        if self._available:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )

    def is_available(self) -> bool:
        return self._available

    async def chat(self, system: str, user: str, temperature: float = 0.3) -> str:
        if not self._available:
            return ""

        payload = {
            "model": self.MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": 2048,
        }

        last_error = None
        for attempt in range(self.MAX_RETRIES):
            try:
                resp = await self._client.post("/chat/completions", json=payload)
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                if content and content.strip():
                    return content
                logger.warning("LLM returned empty response on attempt %d/%d", attempt + 1, self.MAX_RETRIES)
            except Exception as e:
                last_error = e
                logger.warning("LLM call failed on attempt %d/%d: %s", attempt + 1, self.MAX_RETRIES, str(e))
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)
        logger.error("LLM call exhausted all %d retries: %s", self.MAX_RETRIES, last_error)
        return ""

    async def close(self):
        if self._client:
            await self._client.aclose()
