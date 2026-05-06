# Architecture

> 🇬🇧 English version · [🇫🇷 Version française](./ARCHITECTURE.fr.md)

This document consolidates the **design decisions** made at the project's
genesis. It is meant to evolve; every structural change should be reflected
here.

## Guiding principles

1. **Local-first.** The app runs entirely on the user's machine. No data is
   exposed to third parties without an explicit action. Deployment target:
   self-hosted Docker (single container).
2. **Deterministic validation at the core, AI as an enrichment layer.** The
   score and the chrono never depend on an LLM call. AI provides explanations
   and help, never the verdict.
3. **Any generative AI must be sourced.** The (upcoming) AI tutor only
   answers from retrieved documentation chunks (RAG), with URL citation. No
   answer "from memory".
4. **BYOK for paid providers.** The user supplies their own OpenRouter key or
   uses their Claude OAuth subscription. Zero inference cost on the project's
   side.
5. **Code stays simple until complexity is justified.** No speculative
   abstractions, no premature turborepo monorepo, no microservices for a
   single-user tool.

## Tech stack

| Layer                 | Choice                                           | Why                                                                                                |
| --------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Framework             | Next.js 16 (App Router)                          | Simple SSR/SSG, mature ecosystem, trivial Docker deployment                                        |
| Language              | TypeScript strict                                | Type safety on questions/validators                                                                |
| UI                    | React 19 + Tailwind 3                            | Fast to build, easy to style as a terminal                                                         |
| User input            | Controlled monospace input (no xterm.js in MVP)  | xterm.js emulates a full PTY — overkill for typing-and-validating. Door open for Sprint 5         |
| Vi (future)           | codemirror-vim                                   | Real vi mode in the browser, enables keystroke-efficiency scoring                                  |
| Persistence           | SQLite (Sprint 2+)                               | Zero infra, sufficient up to a few hundred users                                                   |
| Vector store (RAG)    | sqlite-vec (Sprint 4)                            | Stays consistent with SQLite, no Postgres to host                                                  |
| Embeddings            | `bge-small-en` local OR OpenRouter               | User choice; pre-built indexes per model                                                           |
| LLM                   | Claude OAuth OR OpenRouter                       | Multi-provider via the `LLMProvider` interface                                                     |

## Command validation

### Sprint 1 — RegexValidator (current)

Each question defines an `acceptedPatterns: string[]` list. The user's input
is:

1. trimmed
2. normalized (collapsing multiple spaces into one)
3. tested against each pattern with the `i` flag

A response is correct as soon as **any** single pattern matches. Patterns
must be anchored (`^...$`) on the data side to prevent false positives.

**Known limitation.** Covering every valid variant (flag order, long/short
forms, aliases) explodes the regex set quickly. Workable for 20 questions,
not for 1,000.

### Sprint 4+ — SemanticValidator (planned)

Parse the command into an AST (`{ verb, resource, name, flags: { ... } }`),
normalize, compare against an expected AST. More reliable, more work. Will
be introduced when the maintenance cost of regex becomes unsustainable.

### Later — ExecutionValidator (planned)

Ephemeral `kind` sandbox, real command execution, comparison of cluster
state. Killer.sh model. Reserved for an optional "lab" mode.

## AI tutor (Sprint 3-4, planned)

Pipeline runs after validation, never before:

```
[user types]
      ↓
[RegexValidator]  ← determines OK / KO instantly
      ↓
[result shown]
      ↓
[Tutor.explain(question, userInput, result)]  ← async, optional
   ├─ retrieve top-k chunks via RAG
   └─ LLMProvider.complete(prompt with citations)
```

User modes:

- **Exam** — AI disabled, pure dexterity, like the real exam day
- **Training** — AI feedback after every answer
- **Review** — end-of-session analysis, tailored study plan

## RAG (Sprint 4, planned)

Three source types, ingested by the same pipeline:

1. **Local files** (Markdown, txt, PDF) bundled into the Docker image
2. **"Official" web sources** (kubernetes.io/docs from the
   `kubernetes/website` git repo, kubernetes.io/blog, bash man pages, vim
   docs) ingested in CI at image build time
3. **Custom web sources** added by the user via an admin UI, ingested by an
   in-container scheduler

Multi-embedding-model index strategy: one `.db` file per model
(`kb-bge-small.db`, `kb-openai-3-small.db`, `kb-qwen3.db`). The app loads
the index matching the user config. Boot validation prevents dimension
mismatches.

Split between `kb-bundled.db` (read-only, from the image) and `kb-user.db`
(persistent volume) preserves custom sources across container upgrades.

Mandatory chunk metadata: `{ source_id, source_url, source_section,
content_hash, license }`. Enables citations + incremental detection +
license compliance.

## Persistence (Sprint 2, planned)

SQLite schema designed to evolve from single-user (Level 1) to multi-user
with leaderboard (Level 2) without a refactor:

```sql
users (id, display_name, created_at, is_anonymous)
runs (id, user_id, mode, started_at, ended_at, total_questions,
      correct_count, total_time_ms, score, k8s_version)
attempts (id, run_id, question_id, category, subcategory, user_input,
          is_correct, time_ms, keystrokes, optimal_keystrokes,
          hints_used, ai_feedback, created_at)
```

In the Sprint 2 MVP, `is_anonymous = 1` and `users` only contains a local
user. Auth (magic link / GitHub OAuth) will be additive.

## Automatic updates (Sprint 4+)

Monthly GitHub Action:

1. Check the latest `kubernetes/kubernetes` release
2. Regenerate `kubectl-flags-vX.Y.json` from `kubectl <verb> --help`
3. Reindex the RAG against the latest `kubernetes/website` branch
4. Run the existing question suite against a `kind` v1.X+1 cluster
5. Open a PR with a diff report (broken questions, new flags)

The user sees in the UI which K8s version their question bank covers.
