# Low-Level Design: Search & Crawler Service

## 1. 🎯 Overview

This document provides the low-level design for the **Search & Crawler Service**. This service is responsible for crawling the web for educational content, indexing it, and providing a powerful search experience.

### 1.1. Learning Objectives

- Build a distributed web crawler.
- Implement the PageRank algorithm.
- Use Elasticsearch for indexing and searching.

---

## 2. 🏗️ Architecture

```mermaid
graph TD
    A[Crawler] --> B(URL Frontier)
    B --> C{Politeness}
    C --> D[Downloader]
    D --> E[Parser]
    E --> F[Indexer]
    F --> G[Elasticsearch]
```text

- **Crawler**: The main component that orchestrates the crawling process.
- **URL Frontier**: A priority queue of URLs to be crawled.
- **Politeness**: A component that ensures we are crawling responsibly (respecting `robots.txt`, etc.).
- **Downloader**: Downloads the content of a URL.
- **Parser**: Parses the HTML and extracts links and content.
- **Indexer**: Indexes the content in Elasticsearch.

---

## 3. 🚀 PageRank

We use the **PageRank** algorithm to rank the importance of web pages. This is a key signal in our search ranking algorithm.

---

## 4. 🗄️ Search Index (Elasticsearch)

We use **Elasticsearch** to index our crawled content. Our index is designed for fast and relevant search.

**Key Features**:
- **Full-text search**
- **Faceted search**
- **Auto-complete**
- **Highlighting**
