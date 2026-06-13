import logging
import os
import hashlib
from typing import Optional

from azure.core.credentials import AzureKeyCredential
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SimpleField,
    SearchableField,
    SearchFieldDataType,
)
from azure.search.documents import SearchClient

logger = logging.getLogger(__name__)


class DocumentIndexer:
    """Indexes project documents into Azure AI Search for Foundry IQ retrieval."""

    def __init__(self):
        self.endpoint = os.getenv("SEARCH_ENDPOINT")
        self.api_key = os.getenv("SEARCH_API_KEY")
        self.index_name = "shadow-jury-kb"
        self._index_client: Optional[SearchIndexClient] = None
        self._search_client: Optional[SearchClient] = None

        if self.endpoint and self.api_key:
            self._index_client = SearchIndexClient(
                endpoint=self.endpoint,
                credential=AzureKeyCredential(self.api_key),
            )
            self._search_client = SearchClient(
                endpoint=self.endpoint,
                index_name=self.index_name,
                credential=AzureKeyCredential(self.api_key),
            )

    def is_available(self) -> bool:
        return self._index_client is not None

    def ensure_index(self):
        """Create the search index if it doesn't exist."""
        if not self.is_available():
            return
        try:
            existing = self._index_client.get_index(self.index_name)
        except Exception:
            existing = None

        if existing:
            return

        index = SearchIndex(
            name=self.index_name,
            fields=[
                SimpleField(name="id", type=SearchFieldDataType.String, key=True),
                SearchableField(name="content", type=SearchFieldDataType.String),
                SearchableField(name="source", type=SearchFieldDataType.String),
                SimpleField(name="category", type=SearchFieldDataType.String),
                SimpleField(name="project", type=SearchFieldDataType.String),
            ],
        )
        try:
            self._index_client.create_index(index)
        except Exception as e:
            logger.warning("Failed to create search index '%s': %s", self.index_name, str(e))

    def index_document(self, content: str, source: str,
                       category: str = "user_upload", project: str = ""):
        """Upload a document chunk to the search index."""
        if not self._search_client:
            return
        doc_id = hashlib.md5(content.encode()).hexdigest()[:16]
        document = {
            "id": doc_id,
            "content": content[:32000],
            "source": source,
            "category": category,
            "project": project,
        }
        try:
            self._search_client.upload_documents([document])
        except Exception as e:
            logger.warning("Failed to upload document to index '%s': %s", self.index_name, str(e))
