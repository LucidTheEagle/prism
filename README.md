# PRISM — Precision Document Intelligence

> Secure legal document intelligence. Upload any PDF, ask questions in plain English, and receive verified answers pinned to the exact paragraph they came from — with forensic citations and a confidence score on every response.

Built for legal professionals, compliance officers, and researchers who need verifiable answers from complex documents.

---

## Live

🔗 **[prism-mu-one.vercel.app](https://prism-mu-one.vercel.app)**

---

## What Makes PRISM Different

Most AI document tools give you summaries. PRISM gives you **verified answers from a secure enclave**.

| Feature | PRISM | Typical RAG tool |
|---|---|---|
| Search method | Hybrid (Vector + BM25 + RRF) | Vector only |
| Answer validation | Multi-pass self-critique | Single pass |
| Citation accuracy | Exact paragraph, clickable | Page reference only |
| Confidence scoring | Per-answer with three tiers | None |
| AI infrastructure | Microsoft Azure Enterprise | Public API |
| Data retention | Zero — content logging disabled | Varies |
| Deletion proof | Cryptographic Destruction Receipt | None |
| Document isolation | RLS + ownership validation | Rarely enforced |

---

## Security Architecture

PRISM is engineered as a **Secure Enclave**. In the legal sector, ambiguity is a liability.

**Cryptographic Document Isolation**
Every document is mathematically locked to your user identity using Row Level Security (RLS). It is architecturally impossible for another user, firm, or tenant to access your files.

**Zero-Knowledge Training Policy**
Your documents are never used to train any AI model. PRISM is powered by Microsoft Azure Enterprise AI infrastructure with Content Logging disabled. Azure cannot see your data. Neither can we.

**Military-Grade Encryption**
All data in transit over TLS 1.3. All files and vector embeddings at rest with AES-256.

**Verifiable Destruction**
Delete any document with one click — purges the original PDF, all vector embeddings, text chunks, and chat history immediately. A timestamped **Destruction Receipt PDF** is generated as cryptographic proof.

**Forensic Traceability**
Every answer is accompanied by a direct citation to the exact page and paragraph. You never have to trust the system blindly.

---

## The PRISM Pipeline

Every query runs through a four-stage pipeline:
```
PDF Upload
    │
    ▼
┌─────────────────────────────────────┐
│  Stage 1: Adaptive Ingestion        │
│  • SHA-256 duplicate detection      │
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
│  Stage 3: Glass Box Reasoning       │
│  • Cross-encoder re-ranking         │
│  • Answer generation (GPT-4o)       │
│  • Self-critique validation         │
│  • Confidence scoring               │
│  • Silent auto-retry on failure     │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Stage 4: Verified Answer           │
│  • Answer + confidence score        │
│  • Clickable forensic citations     │
│  • PDF viewer jump-to-page          │
│  • Forensic PDF export              │
└─────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 + Turbopack |
| UI | React 19, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + pgvector) |
| Vector search | pgvector (HNSW index) |
| Full-text search | PostgreSQL tsvector (GIN index) |
| AI — Chat | Microsoft Azure OpenAI (GPT-4o) |
| AI — Embeddings | Microsoft Azure OpenAI (text-embedding-3-small) |
| Auth | Supabase Auth |
| Storage | Supabase Storage (private bucket, AES-256) |
| Billing | Stripe |
| Deployment | Vercel |
| PDF parsing | pdf-parse (server), react-pdf (client) |
| Chunking | LangChain RecursiveCharacterTextSplitter |

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 18+
- A Supabase project
- A Microsoft Azure OpenAI resource with two deployments:
  - `prism-gpt4o` — GPT-4o
  - `prism-embeddings` — text-embedding-3-small
- A Stripe account with two products (Solo Lawyer $29/mo, Small Firm $99/mo)

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
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Azure OpenAI
AI_API_KEY=your-azure-api-key
AI_BASE_URL=https://YOUR-RESOURCE.cognitiveservices.azure.com/
AZURE_DEPLOYMENT_NAME=prism-gpt4o
AZURE_EMBEDDINGS_DEPLOYMENT_NAME=prism-embeddings

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database setup

Run the migrations in order in your Supabase SQL editor:
```
supabase/migrations/001_rls_hardening.sql
supabase/migrations/002_file_hash.sql
```

### 4. Run
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure
```
prism/
├── app/
│   ├── (auth)/              # Login, register
│   ├── api/                 # API routes
│   │   ├── billing/         # Stripe checkout + portal
│   │   ├── chat/            # Q&A pipeline + message history
│   │   ├── documents/       # Document CRUD + cascading delete
│   │   ├── ingest/          # Ingestion trigger
│   │   ├── keep-alive/      # Vercel cold start prevention
│   │   ├── search/          # Hybrid search endpoint
│   │   ├── upload/          # File upload + SHA-256 dedup
│   │   └── webhooks/        # Stripe webhook handler
│   ├── auth/callback/       # OAuth callback
│   ├── billing/             # Billing management page
│   ├── chat/                # Split-screen workspace
│   ├── documents/           # Document management page
│   ├── privacy/             # Privacy policy
│   ├── security/            # Security architecture page
│   ├── layout.tsx
│   └── page.tsx             # Landing page
├── components/
│   ├── chat/                # ChatHeader, ChatMessages, ChatInput, CitationCard
│   ├── ChatInterface.tsx    # Q&A state orchestrator
│   ├── ConditionalShell.tsx # Header + footer chrome
│   ├── DocumentUploader.tsx # Drag-and-drop upload
│   ├── DocumentStatus.tsx   # Processing status poller
│   ├── PDFViewer.tsx        # PDF renderer
│   ├── SplitLayout.tsx      # Two-panel orchestrator
│   └── UpgradeModal.tsx     # Paywall modal
├── lib/
│   ├── ai/                  # Pipeline: chunking, search, generation, critique
│   ├── billing/             # checkAccess, getSubscription, trackUsage, logAudit
│   ├── openai/              # Azure client, embeddings, documentAnalyzer
│   ├── supabase/            # Browser + server + admin clients
│   ├── types/               # Full type system + TIER_LIMITS
│   └── utils/
│       ├── deleteDocument.ts          # 7-step cascading delete
│       ├── export.ts                  # Forensic PDF export
│       ├── validateDocumentOwnership.ts  # Ownership utility
│       └── trustScore.ts
├── supabase/
│   ├── functions/           # Edge functions (Stripe sync)
│   └── migrations/          # Versioned SQL migrations
├── public/fonts/            # Local Inter font files
├── proxy.ts                 # Auth middleware
└── vercel.json              # Function timeouts + keep-alive cron
```

---

## Deployment
```bash
vercel --prod
```

Set all environment variables from `.env.local` in your Vercel project settings.

### Function timeouts

| Route | Timeout | Reason |
|---|---|---|
| `/api/ingest` | 300s | 7-stage pipeline |
| `/api/upload` | 300s | File transfer + ingestion |
| `/api/chat` | 120s | 3 sequential Azure OpenAI calls |

### Keep-alive cron

`vercel.json` pings `/api/keep-alive` every 5 minutes to prevent cold starts on the chat route.

---

## Subscription Tiers

| Plan | Documents | Queries | Storage | Price |
|---|---|---|---|---|
| Beta Free | 3 | 10/period | 10MB | Free |
| Solo Lawyer | 20 | 200/period | 100MB | $29/mo |
| Small Firm | 100 | Unlimited | 500MB | $99/mo |

---

## Disclaimer

PRISM is a research and productivity tool, not legal advice. Always verify critical information with qualified professionals. AI answers may be incomplete or incorrect — use confidence scores and citations as guidance, not as authoritative sources.

---

*Built by [Epopteia](https://epopteia.com) — AI Systems Infrastructure.*