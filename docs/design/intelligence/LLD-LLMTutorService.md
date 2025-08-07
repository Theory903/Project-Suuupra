# Low-Level Design: LLM Tutor Service

## 1. 🎯 Overview

This document provides the low-level design for the **LLM Tutor Service**. This service provides a personalized, AI-powered tutoring experience to our users.

### 1.1. Learning Objectives

- Use large language models (LLMs) for educational applications.
- Implement a Retrieval-Augmented Generation (RAG) system.
- Build a conversational AI with memory.

---

## 2. 🏗️ Architecture

Our LLM Tutor Service uses a **Retrieval-Augmented Generation (RAG)** architecture.

**Why RAG?**
- It allows us to combine the power of a pre-trained LLM with a knowledge base of educational content.
- It helps to reduce hallucinations and improve the factual accuracy of the LLM's responses.

```mermaid
graph TD
    A[User Query] --> B(Query Reformulation)
    B --> C[Vector Database]
    C --> D[Context Retrieval]
    D --> E[LLM]
    E --> F[Response Generation]
    F --> G[Safety Filter]
    G --> H[User]
```text

- **Query Reformulation**: We reformulate the user's query to be more effective for retrieval.
- **Vector Database**: We use a vector database to find relevant documents from our knowledge base.
- **Context Retrieval**: We retrieve the most relevant documents and provide them to the LLM as context.
- **LLM**: We use a fine-tuned, open-source LLM to generate a response based on the user's query and the retrieved context.
- **Safety Filter**: We have a safety filter to ensure that the LLM's responses are appropriate and safe.

---

## 3. 🧠 Conversational Memory

We implement both short-term and long-term memory to provide a personalized and context-aware conversational experience.

- **Short-term Memory**: We store the recent history of the conversation in Redis.
- **Long-term Memory**: We use a vector database to store a summary of the user's past conversations, allowing the LLM to remember what the user has learned.
