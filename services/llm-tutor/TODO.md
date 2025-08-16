# Service PRD: LLM Tutor Service (GPT‑OSS + Hugging Face + LangChain + Voice)

## 1. 🎯 The Challenge: Problem Statement & Mission

### Problem Statement
> Traditional online learning lacks the personalized guidance and immediate feedback of a human tutor. We must build an AI tutor that understands student needs, adapts learning paths, and offers real‑time help while staying safe, accurate, age‑appropriate, and grounded in citations.

### Mission
> Deliver a safe, multimodal tutor on Suuupra using open‑weight **GPT‑OSS** models (served via Hugging Face + vLLM), **LangChain** for RAG, and a robust **voice** stack (Whisper ASR + OpenVoice/Coqui XTTS‑v2 TTS) to produce accessible, grounded learning experiences.

---

## 2. 🧠 Core Requirements & Edge Cases

### 2.1 Functional Requirements (FRs)

| FR-ID | Feature | Description |
|---|---|---|
| FR-1 | **Conversational AI (GPT‑OSS)** | Multi‑turn tutor with citations, tool use, and streaming. Start with 20B for latency/cost; scale to 120B when needed. Use Harmony chat format. |
| FR-2 | **RAG & Knowledge Base (LangChain)** | Hybrid retrieval (vector + BM25) with reranking; Parent‑Document and Self‑Query retrievers for long docs and filtered queries. |
| FR-3 | **Personalized Learning** | Session memory, mastery tracking, spaced practice, difficulty adaptation. |
| FR-4 | **Safety & Moderation** | Input/output classification, deterministic refusal flows, audit logging. |
| FR-5 | **Adaptive Assessment** | Diagnostics, hints, and next‑best‑action recommendations; mastery map per topic. |
| FR-6 | **Voice I/O** | **ASR:** Whisper large‑v3. **TTS:** OpenVoice or Coqui XTTS‑v2 for natural multilingual output; cloning only with explicit consent. |

### 2.2 Non‑Functional Requirements (NFRs)

| NFR-ID | Requirement | Target | Notes |
|---|---|---|---|
| NFR-1 | **Latency** | p95 < 2 s | vLLM PagedAttention + continuous batching; token streaming for UX. |
| NFR-2 | **Grounded Accuracy** | > 90% | Evaluate via RAG triad: context relevance, groundedness, answer relevance. |
| NFR-3 | **Safety** | < 0.1% harmful pass‑through | Layered filters + red‑teaming prior to release. |
| NFR-4 | **Embeddings Throughput** | Burst to 10k QPS | Serve embeddings via Hugging Face **Text Embeddings Inference (TEI)**. |

### 2.3 Edge Cases & Failure Scenarios
- **Hallucinations:** Retrieval‑first prompting; rerank and corrective flow when low retrieval confidence is detected.
- **Harmful/unsafe content:** Classify inputs/outputs; deterministic refusals; capture traces for audit.
- **Student disengagement:** Detect frustration markers (rapid turns, drop‑offs) and switch to step‑by‑step coaching or simpler problems.

---

## 3. 🗺️ Architecture & Design

### 3.1 System Architecture Diagram
```mermaid
flowchart LR
  C[Client (Web/Mobile/Voice)] --> |Text/Audio| GW[API Gateway]
  GW --> Auth[Auth & Policy]
  GW --> Orch[Conversation Orchestrator (LangChain graph)]
  Orch --> Retr{RAG Router}
  Retr --> V[(Vector Store)]
  Retr --> B[BM25 Index]
  V --> RR[Reranker]
  B --> RR
  RR --> Ctx[Context Pack]
  Orch --> LLM[GPT‑OSS via vLLM]
  Ctx --> LLM
  LLM --> Safe[Safety & Policy Filters]
  Safe --> VO{Voice Out?}
  VO --> |Yes| TTS[OpenVoice / XTTS‑v2]
  VO --> |No| Out[Text Response]
  TTS --> Out
  GW --> Obs[Observability (Tracing, Metrics, Grafana)]
```

### 3.2 Tech Stack

| Component | Technology | Notes |
|---|---|---|
| **LLM Serving** | GPT‑OSS‑20B/120B on Hugging Face; **vLLM** | 20B fits ~16 GB; 120B targets ~80 GB. Use Harmony prompt format; consider MXFP4/quant for fit and throughput. |
| **Backend** | Python 3.11, FastAPI | Async/streaming APIs; policy hooks. |
| **RAG** | **LangChain** | Parent‑Document, Self‑Query, contextual compression, cross‑encoder reranker. |
| **Embeddings** | HF models via **TEI** | Production embedding server; integrates with Milvus/Chroma/Pinecone. |
| **Vector DB** | Milvus / Pinecone / Chroma | Hybrid retrieval, metadata filters. |
| **Reranking** | Cross‑encoder (open CE) | Improves precision on top‑k candidates. |
| **ASR** | Whisper large‑v3 | Robust multilingual speech recognition. |
| **TTS** | OpenVoice / Coqui XTTS‑v2 | Instant cloning, multilingual synthesis (consent required). |
| **Observability** | Traces + Prometheus/Grafana | Latency, retrieval hit@k, WER, safety events. |

### 3.3 Key Components
- **RAG Pipeline:** Hybrid search (vector + BM25), rerank with cross‑encoder; Parent‑Document fetch to broaden context; Self‑Query for structured filters.
- **Serving:** vLLM PagedAttention and continuous batching for SLA compliance.
- **Voice:** Whisper ASR; TTS via OpenVoice or XTTS‑v2 with clear consent UI and logging.

---

## 4. 🚀 Implementation Phases

> Duration: **10 weeks** total. Parallelize where feasible.

### Phase 0 — Foundations (Week 1)
**Objective:** Stand up core serving and storage.  
**Tasks:**
- Deploy GPT‑OSS‑20B via vLLM with streaming; validate Harmony prompts.
- Spin up embeddings via HF **TEI**.
- Provision vector database (Milvus/Pinecone/Chroma).  
**Exit Criteria:**
- Response token‑start p95 ≤ 600 ms warm.
- Embeddings QPS ≥ 2k single instance.

### Phase 1 — RAG v1 (Weeks 2–3)
**Objective:** Working retrieval and citations.  
**Tasks:**
- Content ingestion + chunking.
- Embedding pipeline + hybrid retrieval (vector + BM25).
- Integrate reranker and contextual compression.  
**Exit Criteria:**
- Tutor answers include ≥ 2 citations.
- Groundedness ≥ 0.85 on pilot eval set; p95 ≤ 2 s at 10 RPS.

### Phase 2 — Conversation & Safety (Weeks 4–5)
**Objective:** Durable sessions + policy guardrails.  
**Tasks:**
- Redis‑backed session memory and learner profile store.
- Input/output classification; refusal templates; audit logging.  
**Exit Criteria:**
- < 0.1% unsafe pass‑through on staged red‑team corpus.
- Full traceability of blocked/allowed decisions.

### Phase 3 — Voice I/O (Week 6)
**Objective:** Voice input and read‑aloud output.  
**Tasks:**
- Whisper ASR API; language auto‑detect, punctuation.
- TTS via OpenVoice or XTTS‑v2; consent flow for cloning; watermarks/logs.  
**Exit Criteria:**
- ASR WER meets domain target.
- TTS latency < 700 ms for short utterances.

### Phase 4 — Adaptive Assessment & Personalization (Weeks 7–8)
**Objective:** Diagnostics, mastery map, and next‑best‑action.  
**Tasks:**
- Item bank; difficulty adaptation; spaced‑practice scheduler.  
**Exit Criteria:**
- Mastery deltas observable over 1‑week cohorts.
- Hint efficiency improves week‑over‑week.

### Phase 5 — Evals, Observability, Launch Readiness (Weeks 9–10)
**Objective:** Hardening and compliance.  
**Tasks:**
- Traces, metrics, dashboards, SLOs.
- Load tests; privacy & consent UX (DSR export/delete).  
**Exit Criteria:**
- p95 latency ≤ 2 s at target RPS.
- DSR/consent flows verified; launch checklist passed.

---

## 5. 🧪 Testing & Quality Strategy

| Layer | Tools | Scope |
|---|---|---|
| Unit | `pytest` | Prompt utils, chunkers, safety adapters, reranker wrapper |
| Integration | Testcontainers | End‑to‑end RAG: embed → retrieve → rerank → answer |
| E2E | Cypress | Tutor journeys, quizzes, voice read‑aloud |
| LLM Evals | Custom + LangChain evals | RAG triad, citation correctness, refusal correctness |
| Red Team | Curated prompts | Jailbreaks, data leakage, unsafe topics |

---

## 6. 🔭 Monitoring & Alerting

**KPIs**
- **Technical:** p95 latency, tokens/s, retrieval hit@k, reranker NDCG/MRR, ASR WER, safety events.
- **Learning:** Mastery gains, hint efficiency, session retention.

**Alerts**
- `HighResponseLatency` if p99 > 2 s for 5 min.
- `LowGroundedness` below threshold on rolling window.
- `SafetyFilterFailure` on any unblocked critical event.

---

## 7. 📚 Knowledge Base & References

- GPT‑OSS models and Harmony prompt schema.
- vLLM serving features (PagedAttention, batching).
- LangChain retrievers: Parent‑Document, Self‑Query, compression + reranker.
- Hugging Face **TEI** for high‑throughput embeddings.
- Whisper large‑v3 (ASR), OpenVoice / Coqui XTTS‑v2 (TTS).

---

## 8. ✅ Acceptance Criteria

- Tutor responses return p95 < 2 s with ≥ 2 citations on RAG queries.
- Groundedness ≥ 0.90 on curated eval set; citation correctness ≥ 0.95.
- < 0.1% unsafe I/O over 10k staged turns.
- Voice: ASR WER meets domain target; TTS latency < 700 ms for short utterances.
- Privacy: DSR export/delete and consent flows verified.

---

## 9. 🔧 Implementation Notes

- Start on **GPT‑OSS‑20B** (fits ~16 GB); scale to **120B** on 80 GB (H100/MI300X) as usage grows.
- Lock prompts to **Harmony** format for consistent outputs.
- Use **TEI** for embeddings throughput; compatible with Milvus/Chroma/Pinecone.
- Rerank after hybrid retrieval to boost precision (open cross‑encoder works well).

---

## 10. 📎 Appendix: Model IDs (Hugging Face)

- LLM: `openai/gpt-oss-20b`, `openai/gpt-oss-120b`
- ASR: `openai/whisper-large-v3`
- TTS: `myshell-ai/OpenVoice` (or `myshell-ai/OpenVoiceV2`), `coqui/XTTS-v2`
- Embedding server: Hugging Face Text Embeddings Inference (TEI)
