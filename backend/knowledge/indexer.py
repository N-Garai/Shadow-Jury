import os
import hashlib
from typing import Optional

try:
    from azure.search.documents.indexes import SearchIndexClient
    from azure.search.documents.indexes.models import (
        SearchIndex, SimpleField, SearchableField,
    )
    from azure.core.credentials import AzureKeyCredential
    AZURE_AVAILABLE = True
except ImportError:
    AZURE_AVAILABLE = False


class DocumentIndexer:
    def __init__(self):
        self.endpoint = os.getenv("SEARCH_ENDPOINT")
        self.api_key = os.getenv("SEARCH_API_KEY")
        self.index_name = "shadow-jury-docs"
        self._client = None

        if AZURE_AVAILABLE and self.endpoint and self.api_key:
            self._client = SearchIndexClient(
                endpoint=self.endpoint,
                credential=AzureKeyCredential(self.api_key),
            )

    def is_available(self) -> bool:
        return self._client is not None

    def ensure_index(self):
        if not self.is_available():
            return
        index = SearchIndex(
            name=self.index_name,
            fields=[
                SimpleField(name="id", type="Edm.String", key=True),
                SearchableField(name="content", type="Edm.String"),
                SearchableField(name="source", type="Edm.String"),
                SimpleField(name="category", type="Edm.String"),
            ],
        )
        try:
            self._client.create_index(index)
        except Exception:
            pass

    def index_document(self, content: str, source: str, category: str = "user_upload"):
        if not self.is_available():
            return
        doc_id = hashlib.md5(content.encode()).hexdigest()[:16]
        document = {
            "id": doc_id,
            "content": content[:32000],
            "source": source,
            "category": category,
        }
        try:
            from azure.search.documents import SearchClient
            client = SearchClient(self.endpoint, self.index_name, AzureKeyCredential(self.api_key))
            client.upload_documents([document])
        except Exception:
            pass
