import os
from typing import Optional

from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient


class FoundryIQClient:
    """Microsoft Foundry IQ — agentic knowledge retrieval layer.

    Uses Azure AI Search as the knowledge engine. Foundry IQ's knowledge
    source and knowledge base features are accessed through the
    azure-search-documents SDK (create_or_update_knowledge_source,
    create_or_update_knowledge_base).
    """

    def __init__(self):
        self.endpoint = os.getenv("SEARCH_ENDPOINT")
        self.api_key = os.getenv("SEARCH_API_KEY")
        self.index_name = "shadow-jury-kb"
        self._client: Optional[SearchClient] = None

        if self.endpoint and self.api_key:
            self._client = SearchClient(
                endpoint=self.endpoint,
                index_name=self.index_name,
                credential=AzureKeyCredential(self.api_key),
            )

    def is_available(self) -> bool:
        return self._client is not None

    def retrieve(self, query: str, top: int = 3) -> dict:
        if not self.is_available():
            return self._mock_retrieve(query)

        results = self._client.search(query, top=top, include_total_count=True)
        citations = []
        for doc in results:
            citations.append({
                "content": doc.get("content", "")[:500],
                "source": doc.get("source", "unknown"),
                "relevance_score": doc.get("@search.score", 0),
            })

        return {
            "answer": f"Found {len(citations)} relevant documents for: {query}",
            "citations": citations,
            "foundry_iq": True,
        }

    def _mock_retrieve(self, query: str) -> dict:
        return {
            "answer": f"Based on the project materials: {query}",
            "citations": [
                {
                    "content": f"Relevant passage about: {query[:80]}...",
                    "source": "project_readme.md",
                    "relevance_score": 0.85,
                }
            ],
            "foundry_iq": False,
        }
