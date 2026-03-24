# QMD Research (Query Markup Documents)

**Source**: https://github.com/tobi/qmd
**Package**: `@tobilu/qmd`
**License**: MIT
**Date**: 2026-03-23

## What QMD Does

QMD is an on-device search engine for markdown documents and knowledge bases. It is **not** an OCR tool -- it indexes markdown files, meeting transcripts, documentation, and notes, then provides keyword, semantic, and hybrid search across them.

It combines three search strategies:
1. **BM25 full-text search** (SQLite FTS5) -- fast keyword matching
2. **Vector semantic search** -- cosine similarity via local GGUF embedding models
3. **LLM re-ranking** -- cross-encoder reranking for best quality results

All inference runs locally via `node-llama-cpp` with GGUF models. No external API calls required.

## Architecture

### Search Pipeline

The hybrid `query` command works as follows:
1. **Query Expansion**: LLM generates 2 alternative phrasings of the user query
2. **Parallel Retrieval**: Each query variant runs through both BM25 and vector search
3. **RRF Fusion**: Results combined via Reciprocal Rank Fusion (k=60), original query weighted x2
4. **Top-K Selection**: Top 30 candidates selected for reranking
5. **LLM Re-ranking**: Qwen3-Reranker scores each doc (yes/no + logprob confidence)
6. **Position-Aware Blending**: Weighted blend of RRF and reranker scores (75/25 for top 3, 60/40 for 4-10, 40/60 for 11+)

### GGUF Models (auto-downloaded, ~2GB total)

| Model | Purpose | Size |
|-------|---------|------|
| embeddinggemma-300M-Q8_0 | Vector embeddings | ~300MB |
| qwen3-reranker-0.6b-q8_0 | Re-ranking | ~640MB |
| qmd-query-expansion-1.7B-q4_k_m | Query expansion (fine-tuned) | ~1.1GB |

### Data Storage

- SQLite database at `~/.cache/qmd/index.sqlite`
- Uses SQLite FTS5 for full-text indexing
- Uses `sqlite-vec` extension for vector similarity
- Smart chunking: ~900-token chunks with 15% overlap, respecting markdown structure (headings, code fences, paragraphs)

### Dependencies

- **Runtime**: Node.js >= 22 or Bun >= 1.0
- **macOS**: Requires Homebrew SQLite (`brew install sqlite`) for extension support
- **Models**: Downloaded from HuggingFace, cached in `~/.cache/qmd/models/`

## Supported Formats

- **Primary**: Markdown files (`*.md`)
- **Configurable**: Any text files via glob patterns (e.g., `**/*.txt`, `**/*.ts`)
- **Not supported**: Binary documents (PDF, DOCX, images). This is a markdown/text indexer, not an OCR or document conversion tool.

## Integration Options

### 1. SDK / Library (recommended for Bun/Hono)

QMD exports `createStore()` for direct programmatic use:

```typescript
import { createStore } from '@tobilu/qmd'

const store = await createStore({
  dbPath: './my-index.sqlite',
  config: {
    collections: {
      docs: { path: '/path/to/docs', pattern: '**/*.md' },
    },
  },
})

// Search
const results = await store.search({ query: "authentication flow" })

// Retrieve
const doc = await store.get("docs/readme.md")

// Batch retrieve
const { docs, errors } = await store.multiGet("docs/**/*.md")

await store.close()
```

Key SDK methods:
- `store.search()` -- hybrid search with optional reranking
- `store.searchLex()` -- BM25 only (fast, no LLM)
- `store.searchVector()` -- vector only (embedding model, no reranking)
- `store.get()` / `store.multiGet()` -- document retrieval
- `store.update()` -- re-index collections
- `store.embed()` -- generate vector embeddings
- `store.addCollection()` / `store.removeCollection()` -- manage collections
- `store.addContext()` -- add descriptive metadata for better search

### 2. MCP Server

QMD exposes an MCP server with tools: `query`, `get`, `multi_get`, `status`. Supports both stdio and HTTP transport.

HTTP mode (`qmd mcp --http`) runs a long-lived server on port 8181 with endpoints:
- `POST /mcp` -- MCP Streamable HTTP
- `GET /health` -- liveness check

### 3. CLI

Can be invoked via `qmd search`, `qmd vsearch`, `qmd query` with `--json` output for programmatic consumption.

## Bun/Hono Integration Plan

### Direct SDK Approach

```typescript
// server/routes/search.ts
import { Hono } from 'hono'
import { createStore } from '@tobilu/qmd'

const app = new Hono()
let store: Awaited<ReturnType<typeof createStore>>

// Initialize on startup
async function initQMD() {
  store = await createStore({
    dbPath: './data/qmd-index.sqlite',
    config: {
      collections: {
        knowledge: { path: './knowledge-base', pattern: '**/*.md' },
      },
    },
  })
}

app.get('/api/search', async (c) => {
  const q = c.req.query('q')
  const results = await store.search({ query: q, limit: 10 })
  return c.json(results)
})

app.get('/api/doc/:path', async (c) => {
  const doc = await store.get(c.req.param('path'))
  return c.json(doc)
})
```

### Considerations

- **Bun compatibility**: Package explicitly supports Bun >= 1.0. Install via `bun install @tobilu/qmd`.
- **Model loading**: First run downloads ~2GB of models. Models stay loaded in VRAM across requests when using SDK or HTTP MCP.
- **Memory**: Three GGUF models loaded simultaneously. Expect ~2-3GB RAM usage.
- **Cold start**: Model loading takes several seconds on first request. Use `store.searchLex()` for fast BM25-only queries that skip LLM.
- **SQLite**: Uses `sqlite-vec` extension which may need Homebrew SQLite on macOS. Verify compatibility with Bun's built-in `bun:sqlite`.
- **Lifecycle**: Call `store.close()` on server shutdown to dispose models and DB connections. Embedding/reranking contexts are disposed after 5 min idle and recreated on next request (~1s penalty).

### Potential Issues

1. **`node-llama-cpp` + Bun**: The `node-llama-cpp` dependency may have native addon compatibility issues with Bun. Test thoroughly.
2. **SQLite extensions**: QMD uses `sqlite-vec` for vector search. This may conflict with Bun's built-in SQLite. The package may need system SQLite (`brew install sqlite`).
3. **Not an OCR/document processor**: If you need PDF/DOCX/image processing, QMD is the wrong tool. It only handles text/markdown files. Pair it with a separate document conversion step if needed.
