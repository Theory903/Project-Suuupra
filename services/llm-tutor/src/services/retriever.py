"""
Hybrid Retriever

This module defines a hybrid retriever that combines results from a vector store and a BM25 retriever.
"""

from langchain.retrievers import BM25Retriever
from langchain.vectorstores import Milvus
from langchain.schema import Document

from sentence_transformers import CrossEncoder

class HybridRetriever:
    def __init__(self, vector_store: Milvus, bm25_retriever: BM25Retriever):
        self.vector_store = vector_store
        self.bm25_retriever = bm25_retriever
        self.reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

    def get_relevant_documents(self, query: str):
        """Gets relevant documents from both retrievers and combines them."""

        # 1. Get documents from both retrievers
        vector_docs = self.vector_store.similarity_search(query)
        bm25_docs = self.bm25_retriever.get_relevant_documents(query)

        # 2. Combine the results
        combined_docs = vector_docs + bm25_docs

        # 3. Remove duplicates
        unique_docs = {doc.page_content: doc for doc in combined_docs}
        unique_docs = list(unique_docs.values())

        # 4. Rerank the results
        reranked_docs = self.rerank(query, unique_docs)

        return reranked_docs

    def rerank(self, query: str, documents: list[Document]):
        """Reranks the given documents based on the query."""
        pairs = [(query, doc.page_content) for doc in documents]
        scores = self.reranker.predict(pairs)
        doc_scores = list(zip(documents, scores))
        doc_scores.sort(key=lambda x: x[1], reverse=True)
        return [doc for doc, score in doc_scores]
