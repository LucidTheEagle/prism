# PRISM — Precision Document Intelligence

> Transform any PDF into an intelligent knowledge base with forensic citation accuracy.

PRISM is a production-grade AI document Q&A system. Upload any PDF, ask questions in plain English, and receive verified answers pinned to the exact paragraph they came from — with a confidence score on every response.

Built for legal teams, compliance officers, researchers, and anyone who needs to extract precise, verifiable information from complex documents.

---

## Live Demo

🔗 **[prism.vercel.app](https://https://prism-mu-one.vercel.app/)**

---

## What Makes PRISM Different

Most AI document tools give you summaries. PRISM gives you **verified answers**.

| Feature | PRISM | Typical RAG tool |
|---|---|---|
| Search method | Hybrid (Vector + BM25 + RRF) | Vector only |
| Answer validation | Multi-pass self-critique | Single pass |
| Citation accuracy | Exact paragraph, clickable | Page reference only |
| Confidence scoring | Per-answer score | None |
| Dark mode | ✅ | Rarely |
| Multi-document | ✅ | Rarely |

---

## Architecture

### The PRISM Pipeline

Every query runs through a four-stage pipeline:

```
PDF Upload
    │
    ▼
┌─────────────────────────────────────┐
│  Stage 1: Adaptive Ingestion        │
│  • AI document analysis             │
│  • Structure-aware chunking         │
│  • 1536-dim vector embeddings       │
│  • BM25 full-text index             │
│  • AI metadata enrichment           │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Stage 2: Hybrid Search             │
│  • Vector search (pgvector/HNSW)    │
│  • BM25 keyword search (tsvector)   │
│  • Reciprocal Rank Fusion (RRF)     │
│  • Deduplication                    │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Stage 3: Multi-Pass Reasoning      │
│  • Cross-encoder re-ranking         │
│  • Answer generation (GPT-4o)       │
│  • Self-critique validation         │
│  • Confidence scoring               │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Stage 4: Verified Answer           │
│  • Answer + confidence score        │
│  • Clickable citations              │
│  • PDF viewer jump-to-page          │
└─────────────────────────────────────┘
```

### Hybrid Search — Why Both?

**Vector search** finds semantically similar content. Ask "what are the penalties?" and it finds "consequences of breach" even without the word "penalties."

**BM25 search** finds exact keyword matches. Critical for legal and technical documents where precise terminology matters — "Section 4.2(b)" must match exactly.

**Reciprocal Rank Fusion (RRF)** combines both result sets into a single ranked list using the formula `score = Σ 1/(k + rank_i)` where `k=60`. This consistently outperforms either method alone.

### Multi-Pass Reasoning — Why Not Single-Pass?

Single-pass RAG generates an answer and stops. PRISM runs three passes:

1. **Initial answer** — generated from the top 5 retrieved chunks
2. **Self-critique** — a second model call reviews the answer against the source material, checking for hallucinations and unsupported claims
3. **Revised answer** — if the critique flags issues, the answer is regenerated with explicit corrections

The confidence score reflects the critique's assessment, not just the model's self-reported certainty.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 + Turbopack |
| UI | React 19, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Vector search | pgvector (HNSW index) |
| Full-text search | PostgreSQL tsvector (GIN index) |
| AI | OpenAI GPT-4o + text-embedding-3-small |
| Auth | Supabase Auth (Email + Google OAuth) |
| Storage | Supabase Storage (private bucket) |
| Deployment | Vercel |
| PDF parsing | pdf-parse (server), react-pdf (client) |
| Chunking | LangChain RecursiveCharacterTextSplitter |

---

## Security Architecture

PRISM is built security-first. Every data access point enforces the same ownership rule: **you can only access your own data.**

### Three enforcement layers (defence in depth):

**1. Supabase Row Level Security (RLS)**
Every table has RLS enabled with per-operation policies. At the database level, `auth.uid() = user_id` is enforced on every SELECT, INSERT, UPDATE, and DELETE. Even if application code is bypassed, the database rejects unauthorised access.

**2. Application ownership checks**
API routes explicitly verify `document.user_id === session.user.id` before returning data — belt-and-suspenders alongside RLS.

**3. Search-level scoping**
Both vector and BM25 PostgreSQL RPC functions accept `filter_user_id` — search results are scoped to the authenticated user's chunks even at the query level.

### Auth flow
- Supabase Auth with email/password and Google OAuth
- Sessions managed via HTTP-only cookies (SSR-safe via `@supabase/ssr`)
- Next.js proxy (middleware) refreshes tokens on every request
- OAuth callback at `/auth/callback` exchanges code for session server-side

---

## Database Schema

```sql
-- Core tables
documents        (id, user_id, name, file_url, file_size_bytes,
                  page_count, document_type, complexity_score,
                  has_toc, key_entities, status, error_message,
                  created_at, updated_at)

document_chunks  (id, user_id, document_id, content, chunk_index,
                  metadata, embedding, ai_summary, keywords,
                  semantic_category)

chat_messages    (id, user_id, document_id, role, content,
                  confidence, citations, created_at)

-- Supporting tables
profiles         (id, email, display_name, avatar_url,
                  created_at, updated_at)

analytics_logs   (id, user_id, document_id, event_type,
                  query_text, vector_weight, bm25_weight,
                  tokens_used, estimated_cost, confidence_score,
                  feedback, response_time_ms, created_at)
```

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 18+
- A Supabase project
- An OpenAI API key
- A Google Cloud project with OAuth credentials (for Google sign-in)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/prism.git
cd prism
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Database setup

Run the migrations in order in your Supabase SQL editor:

```
sql/phase-5.2-schema.sql      — tables, RLS policies, triggers
sql/phase-5.2-rpc-update.sql  — hybrid search RPC functions
sql/phase-5.3-indexes.sql     — performance indexes
```

### 4. Enable Google OAuth (optional)

1. Create OAuth credentials in Google Cloud Console
2. Add `https://your-project.supabase.co/auth/v1/callback` as an authorised redirect URI
3. Add the Client ID and Secret in Supabase → Authentication → Providers → Google

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## First Run Guide

### Uploading your first document

1. **Sign up** at `/register` — email/password or Google
2. **Upload a PDF** — drag and drop or click the upload zone on the home page
3. **Wait for processing** — PRISM runs 7 pipeline stages (typically 30–120 seconds depending on document size)
4. **Start chatting** — you're automatically navigated to the split-screen workspace

### The split-screen workspace

The workspace has two panels:

**Left panel — PDF Viewer**
Your document rendered in-browser. Navigate pages using the controls. When you click a citation in chat, the viewer jumps to that exact page automatically.

**Right panel — Chat Interface**
Ask questions in plain English. Each answer includes:
- The answer text
- Numbered citations (click any to jump to that page in the PDF)
- A confidence score (High / Good / Moderate)

### Tips for best results

- **Be specific** — "What is the liability cap in Section 8?" gets better results than "what are the limits"
- **Use document terminology** — the BM25 engine rewards exact term matches
- **Check confidence scores** — scores below 70% indicate the answer may be incomplete
- **Multiple documents** — use the document selector in the chat header to switch between documents without leaving the workspace
- **Export** — click the download icon to export the full conversation as Markdown

---

## Project Structure

```
prism/
├── app/
│   ├── (auth)/              # Auth pages — login, register
│   │   ├── login/
│   │   └── register/
│   ├── api/                 # API routes
│   │   ├── chat/            # Q&A pipeline
│   │   ├── documents/       # Document CRUD
│   │   ├── ingest/          # Ingestion trigger
│   │   ├── search/          # Search endpoint
│   │   └── upload/          # File upload
│   ├── auth/callback/       # OAuth callback handler
│   ├── chat/                # Split-screen workspace
│   ├── layout.tsx           # Root layout + metadata
│   └── page.tsx             # Landing page
├── components/
│   ├── ChatInterface.tsx    # Right panel — Q&A UI
│   ├── ConditionalShell.tsx # Header/footer shell
│   ├── DocumentUploader.tsx # Drag-and-drop upload
│   ├── DocumentStatus.tsx   # Processing status poller
│   ├── ErrorBoundary.tsx    # Panel-isolated error recovery
│   ├── PDFViewer.tsx        # Left panel — PDF renderer
│   └── SplitLayout.tsx      # Two-panel orchestrator
├── lib/
│   ├── ai/
│   │   ├── adaptive-chunking.ts     # Structure-aware text splitting
│   │   ├── answer-generation.ts     # Multi-pass GPT-4o generation
│   │   ├── hybrid-search.ts         # Vector + BM25 + RRF
│   │   ├── ingestion-pipeline.ts    # Full pipeline orchestrator
│   │   ├── metadata-enrichment.ts   # AI chunk summarisation
│   │   ├── query-analysis.ts        # Query type classification
│   │   ├── reranking.ts             # Cross-encoder re-ranking
│   │   └── self-critique.ts         # Answer validation
│   ├── openai/
│   │   ├── client.ts                # OpenAI client
│   │   ├── documentAnalyzer.ts      # Document type detection
│   │   └── embeddings.ts            # Batch embedding generation
│   ├── supabase/
│   │   ├── client.ts                # Browser client (SSR-safe)
│   │   └── server.ts                # Server client + admin client
│   └── utils/
│       ├── export.ts                # Markdown conversation export
│       └── trustScore.ts            # Confidence score utilities
├── proxy.ts                 # Next.js 16 auth proxy (middleware)
├── vercel.json              # Function timeout configuration
└── .env.example             # Environment variable template
```

---

## Deployment

PRISM is optimised for Vercel + Supabase.

```bash
npm install -g vercel
vercel --prod
```

Set these environment variables in your Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
NEXT_PUBLIC_SITE_URL        (your Vercel URL)
```

### Function timeouts

`vercel.json` configures extended timeouts for long-running operations:

| Route | Timeout | Reason |
|---|---|---|
| `/api/ingest` | 300s | 7-stage pipeline on large PDFs |
| `/api/upload` | 60s | 50MB file transfer to storage |
| `/api/chat` | 120s | 3 sequential OpenAI calls |

---

## Roadmap

- [ ] **5.1 Analytics dashboard** — cost tracking, feedback loop, search strategy metrics
- [ ] **Team workspaces** — shared document libraries with role-based access
- [ ] **Document collections** — group related documents, query across all of them
- [ ] **Webhook support** — trigger ingestion from external systems
- [ ] **OCR pipeline** — support for scanned PDFs via cloud OCR
- [ ] **Citation export** — export answers with formatted citations to Word/PDF

---

## Disclaimer

PRISM is a research and productivity tool. It is not legal advice. Always verify critical information with qualified professionals. AI answers may be incomplete or incorrect — use confidence scores and citations as guidance, not as authoritative sources.

---

*Built with Next.js 16, Supabase, OpenAI, and pgvector.*