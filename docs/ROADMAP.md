# Roadmap

> 🇬🇧 English version · [🇫🇷 Version française](./ROADMAP.fr.md)

Each sprint ships something **usable on its own**. We don't move on to the
next one unless the current one delivers real value as-is.

## Sprint 1 — Skeleton + pure kubectl dexterity ✅

**Goal:** "type the command, get yes/no, with a chrono."

- [x] Bootstrap Next.js + TypeScript + Tailwind
- [x] Question schema (`Question`, `CommandQuestion`, `ViQuestion`)
- [x] Deterministic `RegexValidator`
- [x] 20 seed questions across the 5 CKA domains
- [x] Pure session engine (state machine)
- [x] UI: home, prompt, timer, question card, feedback, score summary
- [x] Initial documentation (README, ARCHITECTURE, QUESTION_SCHEMA)

**Deliverable:** an app you can use to drill kubectl commands.

---

## Sprint 2 — Persistence & personal dashboard ✅

**Goal:** keep session history and identify weak spots.

- [x] SQLite setup (`better-sqlite3` server-side, WAL, lazy migrations)
- [x] `users / runs / attempts` schema
- [x] API routes: `POST /api/runs`, `POST /api/runs/:id/attempts`,
      `PATCH /api/runs/:id/end`, `GET /api/me/export`
- [x] Cookie-based local user (anonymous, persisted via Next.js middleware)
- [x] `/dashboard` page: score curve, domain × difficulty heatmap, streak,
      top 10 most-missed questions, recent runs
- [x] JSON export of history (`GET /api/me/export`)
- [ ] Light anti-cheat (server-side re-validation) — deferred to when
      Niveau 2 (multi-user / leaderboard) lands; not needed for the local
      single-user MVP

**Deliverable:** the user sees their progress over time.

---

## Sprint 3 — AI tutor (without RAG)

**Goal:** post-answer explanation, without requiring RAG up front.

- [ ] `LLMProvider` interface with capability flags
- [ ] `ClaudeOAuthProvider` (claude.ai OAuth flow)
- [ ] `OpenRouterProvider` (user API key, model selection)
- [ ] Settings page: provider choice, key management (local encryption)
- [ ] "Training" mode that calls the tutor after every answer
- [ ] "Exam" mode that disables AI (strict chrono)
- [ ] Hallucination mitigation: strict system prompt, "don't answer if
      unsure"

**Acknowledged limitation:** explanations may be imprecise until RAG is
plugged in. This is documented in the UI.

**Deliverable:** the tutor explains why a command is wrong and proposes
idiomatic alternatives.

---

## Sprint 4 — Doc-grounded RAG ✅

**Goal:** zero hallucinations, clickable citations.

- [x] Ingestion pipeline: local Markdown files (`kb/*.md`)
- [x] Chunking by H2 sections (each `## ...` becomes one chunk)
- [x] `EmbeddingProvider` interface
  - [x] `LocalBgeProvider` (`@huggingface/transformers`, bge-small-en, 384 d)
  - [x] `OpenRouterEmbeddingProvider` (text-embedding-3-small/large, qwen3)
- [x] Multi-model indexes: `npm run kb:build` produces a `kb.db` keyed
      to a specific provider; `EMBEDDING_PROVIDER` + `KB_OUT` env vars
      let you generate one per provider
- [x] Boot validation: retrieval refuses to query an index built with
      a different provider (clear `KbProviderMismatchError`)
- [x] Retrieval via `sqlite-vec` virtual table (`vec0`, top-K cosine)
- [x] Tutor system prompt updated to require `[N]` citation markers
      tied to the retrieved chunks
- [x] SSE pipeline: `sources` event before deltas; `warning` event for
      non-fatal RAG issues (KB not built, mismatch); always falls back
      gracefully if the KB is unavailable
- [x] UI: clickable citation chips above the streamed answer; inline
      `[N]` markers turned into hyperlinks to the matching source

**Deliverable:** the tutor never says anything it can't source from the docs.

> Future iterations: ingest more sources (kubernetes/website git clone),
> add reranking, allow user-added custom web sources (Sprint 6).

---

## Sprint 5 — Shell + vi extensions

**Goal:** extend dexterity to the two other CKA bottlenecks.

- [ ] `shell` category: 30 questions on grep/awk/sed/jq/yq/systemctl/...
- [ ] `vi` category: integrated codemirror-vim editor
- [ ] `vi` validation: target buffer comparison (with multi-targets)
- [ ] **Keystroke-efficiency scoring** (`optimalKeystrokes / actual` ratio)
- [ ] Per-category session filters

**Deliverable:** complete training across kubectl + shell + vi.

---

## Sprint 6 — Custom web sources + admin UI

**Goal:** let users enrich the knowledge base with their own sources.

- [ ] DB `sources` schema
- [ ] Crawler with `robots.txt` compliance, identifiable User-Agent, rate
      limiting
- [ ] Incremental detection via `etag` / `If-Modified-Since` /
      `content_hash`
- [ ] Clean extraction via Mozilla Readability + turndown
- [ ] `Settings → Knowledge sources` page
- [ ] Split `kb-bundled.db` (image) + `kb-user.db` (volume)
- [ ] In-container scheduler (`node-cron`)

**Deliverable:** the user can index their blog, team docs, etc.

---

## Beyond

Backlog ideas, prioritized based on feedback:

- **Lab mode**: real execution in an ephemeral `kind` cluster
- **Multi-user + leaderboard** (Level 2 of the persistence schema)
- **Auth**: email magic link or GitHub OAuth
- **AI-assisted question generation** validated in CI on a `kind` cluster
  (auto PRs)
- **Extensions**: CKAD, CKS, Linux, Git, Terraform, AWS CLI (same engine)
- **Mobile-friendly**: export a "flashcards" mode for commuting
