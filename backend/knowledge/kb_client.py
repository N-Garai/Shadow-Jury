import os
from typing import Optional

FOUNDRY_IQ_AVAILABLE = False
try:
    from azure.search.documents.knowledge_base import KnowledgeBaseClient
    from azure.core.credentials import AzureKeyCredential
    FOUNDRY_IQ_AVAILABLE = True
except ImportError:
    pass


class FoundryIQClient:
    def __init__(self):
        self.endpoint = os.getenv("SEARCH_ENDPOINT")
        self.api_key = os.getenv("SEARCH_API_KEY")
        self.kb_name = os.getenv("KNOWLEDGE_BASE_NAME", "shadow-jury-kb")
        self._client = None

        if FOUNDRY_IQ_AVAILABLE and self.endpoint and self.api_key:
            self._client = KnowledgeBaseClient(
                endpoint=self.endpoint,
                credential=AzureKeyCredential(self.api_key),
            )

    def is_available(self) -> bool:
        return self._client is not None

    def retrieve(self, query: str, reasoning_effort: str = "minimal") -> dict:
        if self.is_available():
            return self._client.retrieve(
                knowledge_base_name=self.kb_name,
                query=query,
                reasoning_effort=reasoning_effort,
            )
        return self._mock_retrieve(query)

    def _mock_retrieve(self, query: str) -> dict:
        return {
            "answer": f"Based on the project materials: {query}",
            "citations": [
                {
                    "content": f"Relevant passage about: {query[:50]}...",
                    "source": "project_readme.md",
                    "relevance_score": 0.85,
                }
            ],
        }
