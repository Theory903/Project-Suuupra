Service PRD: LLM Tutor Service

1. 🎯 The Challenge: Problem Statement & Mission

Problem Statement

Traditional online learning often lacks the personalized guidance and immediate feedback that a human tutor can provide. The challenge is to build an AI-powered tutoring system that can understand a student’s needs, provide personalized learning paths, and offer real-time assistance, all while ensuring the content is safe, accurate, and age-appropriate.

Mission

Build a safe, multimodal AI tutoring system on Suuupra that delivers grounded answers with citations, adaptive practice, and optional voice in/out. We will serve open-weight GPT-OSS models via Hugging Face, power retrieval with LangChain RAG, and use battle-tested voice models for accessibility.  ￼ ￼ ￼

⸻

2. 🧠 The Gauntlet: Core Requirements & Edge Cases

Core Functional Requirements (FRs)

FR-ID	Feature	Description
FR-1	Conversational AI (GPT-OSS)	Multi-turn tutor powered by GPT-OSS-120B/20B with Harmony chat format; streaming, citations, tool use.  ￼ ￼
FR-2	RAG & Knowledge Base (LangChain)	Hybrid retrieval (vector + BM25) with reranking; Parent/Multivector retrievers for long docs.  ￼ ￼
FR-3	Personalized Learning	Session memory, spaced practice, mastery tracking; content selection by level and goal.
FR-4	Safety & Moderation	Input/output classification and deterministic policy rails; log and block unsafe content.
FR-5	Adaptive Assessment	Low-friction diagnostics, targeted hints, and next-best-action recommendations.
FR-6	Voice I/O	ASR: Whisper large-v3. TTS: OpenVoice or Coqui XTTS-v2 for natural read-aloud and multilingual output.  ￼

Non-Functional Requirements (NFRs)

NFR-ID	Requirement	Target	Justification & Key Challenges
NFR-1	Response Latency	p95 < 2 s	vLLM/TGI-class serving with PagedAttention and continuous batching to keep chat snappy.  ￼ ￼
NFR-2	Accuracy	>90% grounded factual answers	Measured via RAG evals (context relevance, groundedness, answer relevance) before GA.
NFR-3	Safety	<0.1% harmful content	Layered classifiers + policy rails; red-team before each release.
NFR-4	Scale-ready Embeddings	10K QPS burstable	Serve embeddings with Hugging Face TEI to keep retrieval fast and cheap.  ￼

Edge Cases & Failure Scenarios
	•	Hallucinations: Prefer retrieval-first prompting; fall back to corrective flows when context confidence is low.
	•	Harmful Content: Classify inputs/outputs and block per policy; capture traces for audit.
	•	Student Disengagement: Detect frustration signals (rapid turns, low success) and switch to step-by-step coaching or simpler problems.

⸻

3. 🗺️ The Blueprint: Architecture & Design

3.1. System Architecture Diagram

graph TD
    A[User Input (Text/Voice)] --> A1{Voice?}
    A1 -- Yes --> V1(ASR: Whisper);
    V1 --> B
    A1 -- No --> B[RAG Pipeline (LangChain)]
    B --> C(LLM Generation: GPT-OSS via vLLM)
    C --> D(Safety & Policy Filters)
    D --> E{Voice Out?}
    E -- Yes --> T1(TTS: OpenVoice / XTTS-v2)
    E -- No --> R[Response]
    T1 --> R[Response]

3.2. Tech Stack Deep Dive

Component	Technology	Version	Justification & Key Considerations
LLM Serving	GPT-OSS-120B / 20B via Hugging Face; vLLM	MXFP4 weights; vLLM latest	Open-weight models with Harmony format; vLLM gives high throughput with PagedAttention & batching.  ￼ ￼ ￼
Backend	Python, FastAPI	3.11+	Async APIs, streaming tokens, policy hooks.
RAG	LangChain retrievers	latest	Parent/Multivector/Self-Query + rerank.  ￼
Embeddings	HF models via TEI	—	Production-grade embedding server; integrates with Milvus/FAISS/Chroma/Pinecone.  ￼ ￼
Vector Store	Chroma / Milvus / Pinecone	—	Hybrid search and metadata filters.
Memory Store	Redis	7+	Session state and short-term memory.
ASR	Whisper large-v3	—	Robust multilingual speech recognition.  ￼
TTS	OpenVoice or Coqui XTTS-v2	—	Instant cloning and multilingual TTS.  ￼

3.3. Key Components
	•	RAG Pipeline: Hybrid retrieval with reranking; Parent/Multivector retrievers to pull full sections when a chunk hits.  ￼
	•	Voice Layer: Whisper for ASR; OpenVoice/XTTS-v2 for TTS with consented samples.  ￼
	•	Serving: GPT-OSS via vLLM for throughput and cost efficiency.  ￼ ￼

⸻

4. 🚀 The Quest: Implementation Plan & Milestones

Phase 1: LLM Foundation & RAG (Weeks 19–20)
	•	Objective: Stand up GPT-OSS and the first RAG path.
	•	Key Results: Tutor answers are grounded with citations from the KB.
	•	Tasks:
	•	LLM Foundation (vLLM + GPT-OSS): Deploy gpt-oss-20b first; enable streaming and Harmony format.  ￼
	•	RAG Implementation (LangChain): Build hybrid retriever + reranker; set up embeddings via TEI.  ￼ ￼

Phase 2: Conversational AI & Safety (Weeks 21–22)
	•	Objective: Durable conversation + policy guardrails.
	•	Key Results: Multi-turn chat; unsafe content blocked with logs.
	•	Tasks:
	•	Conversation & Memory: Redis-backed session memory and learner profile.
	•	Safety Filters: Input/output classification, refusal templates, and audit traces.

Phase 3: Advanced Tutoring & Analytics (Weeks 23–24)
	•	Objective: Adaptive quizzes, voice, and production telemetry.
	•	Key Results: Adaptive assessments; voice read-aloud; dashboards live.
	•	Tasks:
	•	Adaptive Assessment: Short diagnostics + mastery map.
	•	Voice I/O: Whisper ASR; TTS with OpenVoice or XTTS-v2.  ￼
	•	Analytics & SLOs: Tracing + Prom/Grafana for latency, retrieval quality.

⸻

5. 🧪 Testing & Quality Strategy

Test Type	Tools	Coverage & Scenarios
Unit Tests	pytest	Prompt utils, chunking, rerank adapters, guards.
Integration Tests	Testcontainers	Full RAG flow: embed → retrieve → rerank → answer.
E2E Tests	Cypress	Tutor journeys, quiz flows, voice read-aloud paths.
Safety Testing	Red-teaming + policy evals	Jailbreak/abuse inputs; verify blocklists and refusals.


⸻

6. 🔭 The Observatory: Monitoring & Alerting

Key Performance Indicators (KPIs)
	•	Technical: Response latency p95, LLM tokens/s, retrieval hit@k, reranker NDCG/MRR, ASR WER.
	•	Business: Session retention, hint efficiency, mastery gains, CSAT.

Dashboards & Alerts
	•	Grafana overview with drill-downs per subject.
	•	Prometheus alerts:
	•	HighResponseLatency if p99 > 2 s for 5 min.
	•	LowGroundedness if groundedness score < threshold.
	•	SafetyFilterFailure on any unblocked critical event.

⸻

7. 📚 Learning & Knowledge Base
	•	GPT-OSS models and Harmony format — OpenAI blog + HF model cards.  ￼ ￼
	•	vLLM serving & PagedAttention — project docs/blog and repo features.  ￼ ￼
	•	LangChain retrievers (Parent, Self-Query, compression/rerank) — official docs.  ￼
	•	Embeddings at scale — Hugging Face Text Embeddings Inference docs.  ￼
	•	Whisper (ASR) — model card and demos.  ￼
	•	OpenVoice / Coqui XTTS-v2 (TTS) — HF model cards and Spaces.  ￼

⸻

Notes:
	•	Start with gpt-oss-20b on 16-GB GPUs; scale to gpt-oss-120b on 80-GB (H100/MI300X) as usage grows. Harmony prompting is required for correct behavior.  ￼ ￼
	•	Deploy embeddings via TEI for predictable latency and easier scaling; it plugs into Milvus/Chroma/Pinecone.  ￼ ￼
	•	Voice cloning requires user consent and clear policy disclosures; keep logs for audits.