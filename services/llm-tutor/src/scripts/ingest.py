"""
Content Ingestion Pipeline

This script ingests documents from a specified directory, processes them, and stores them in Milvus and Elasticsearch.
"""

import os
import click
from langchain.document_loaders import DirectoryLoader, UnstructuredFileLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import Milvus
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.document_transformers import EmbeddingsRedundantFilter
from langchain.schema import Document
from elasticsearch import Elasticsearch

# --- Configuration ---

# Milvus configuration
MILVUS_HOST = os.environ.get("MILVUS_HOST", "localhost")
MILVUS_PORT = os.environ.get("MILVUS_PORT", "19530")

# Elasticsearch configuration
ELASTICSEARCH_HOST = os.environ.get("ELASTICSEARCH_HOST", "localhost")
ELASTICSEARCH_PORT = os.environ.get("ELASTICSEARCH_PORT", "9200")

# Embedding model
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# --- Main Ingestion Logic ---

@click.command()
@click.option("--path", "--p", default="./data", help="Path to the directory containing the documents to ingest.")
def main(path):
    """Ingests documents from the specified path."""

    # 1. Load documents
    print(f"Loading documents from {path}...")
    loader = DirectoryLoader(path, glob="**/*.md", loader_cls=UnstructuredFileLoader)
    documents = loader.load()
    print(f"Loaded {len(documents)} documents.")

    # 2. Chunk documents
    print("Chunking documents...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks.")

    # 3. Initialize embedding model
    print(f"Initializing embedding model: {EMBEDDING_MODEL}...")
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

    # 4. Store in Milvus
    print("Storing chunks in Milvus...")
    vector_store = Milvus.from_documents(
        chunks,
        embeddings,
        connection_args={"host": MILVUS_HOST, "port": MILVUS_PORT},
        collection_name="llm_tutor_content"
    )
    print("Successfully stored chunks in Milvus.")

    # 5. Store in Elasticsearch
    print("Storing chunks in Elasticsearch...")
    es_client = Elasticsearch(f"http://{ELASTICSEARCH_HOST}:{ELASTICSEARCH_PORT}")
    for i, chunk in enumerate(chunks):
        es_client.index(index="llm_tutor_content", id=i, body=chunk.page_content)
    print("Successfully stored chunks in Elasticsearch.")

if __name__ == "__main__":
    main()
