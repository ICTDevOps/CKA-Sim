# Roadmap

> 🇫🇷 Version française · [🇬🇧 English](./ROADMAP.md)

Chaque sprint produit quelque chose d'**utilisable seul**. On n'attaque pas le
suivant tant que le précédent n'apporte pas une vraie valeur en l'état.

## Sprint 1 — Squelette + dextérité kubectl pure ✅

**Objectif :** "tape la commande, ça te dit oui/non, chrono".

- [x] Bootstrap Next.js + TypeScript + Tailwind
- [x] Schéma de question (`Question`, `CommandQuestion`, `ViQuestion`)
- [x] `RegexValidator` déterministe
- [x] 20 questions seed couvrant les 5 domaines CKA
- [x] Moteur de session pur (state machine)
- [x] UI : home, prompt, timer, question card, feedback, score summary
- [x] Documentation initiale (README, ARCHITECTURE, QUESTION_SCHEMA)

**Livrable :** une app utilisable pour s'entraîner aux commandes kubectl.

---

## Sprint 2 — Persistance & dashboard perso ✅

**Objectif :** garder un historique des sessions et identifier les points
faibles.

- [x] Setup SQLite (`better-sqlite3` côté serveur, WAL, migrations lazy)
- [x] Schéma `users / runs / attempts`
- [x] API routes : `POST /api/runs`, `POST /api/runs/:id/attempts`,
      `PATCH /api/runs/:id/end`, `GET /api/me/export`
- [x] Utilisateur local anonyme via cookie (middleware Next.js)
- [x] Page `/dashboard` : courbe de score, heatmap domaine × difficulté,
      streak, top 10 questions ratées, sessions récentes
- [x] Export JSON de l'historique (`GET /api/me/export`)
- [ ] Anti-cheat léger (re-validation server-side) — repoussé au moment
      où le Niveau 2 (multi-utilisateur / leaderboard) arrivera ; inutile
      pour le MVP mono-utilisateur local

**Livrable :** l'utilisateur voit sa progression dans le temps.

---

## Sprint 3 — Tuteur IA (sans RAG)

**Objectif :** explication post-réponse, sans pour autant exiger le RAG dès
le départ.

- [ ] Interface `LLMProvider` avec capability flags
- [ ] `ClaudeOAuthProvider` (flow OAuth claude.ai)
- [ ] `OpenRouterProvider` (clé API utilisateur, sélection du modèle)
- [ ] Settings page : choix du provider, gestion des clés (chiffrement local)
- [ ] Mode "Entraînement" qui appelle le tuteur après chaque réponse
- [ ] Mode "Examen" qui désactive l'IA (chrono strict)
- [ ] Limitation hallucination : prompt système strict, "ne réponds pas si tu
      n'es pas sûr"

**Limitation assumée :** les explications peuvent être imprécises tant que le
RAG n'est pas branché. C'est documenté dans l'UI.

**Livrable :** le tuteur explique pourquoi une commande est fausse et propose
des alternatives idiomatiques.

---

## Sprint 4 — RAG ancré sur la doc officielle ✅

**Objectif :** zéro hallucination, citations cliquables.

- [x] Pipeline d'ingestion : fichiers Markdown locaux (`kb/*.md`)
- [x] Chunking par sections H2 (chaque `## ...` devient un chunk)
- [x] Interface `EmbeddingProvider`
  - [x] `LocalBgeProvider` (`@huggingface/transformers`, bge-small-en, 384 d)
  - [x] `OpenRouterEmbeddingProvider` (text-embedding-3-small/large, qwen3)
- [x] Index multi-modèles : `npm run kb:build` produit un `kb.db` clé
      à un provider précis ; `EMBEDDING_PROVIDER` + `KB_OUT` env vars
      permettent d'en générer un par provider
- [x] Validation au boot : la retrieval refuse de query un index
      construit avec un provider différent (`KbProviderMismatchError`
      clair)
- [x] Retrieval via `sqlite-vec` virtual table (`vec0`, top-K cosine)
- [x] System prompt du tuteur mis à jour : citations `[N]` obligatoires
      référençant les chunks récupérés
- [x] Pipeline SSE : event `sources` avant les deltas ; event
      `warning` pour les problèmes non-fatals (KB non built, mismatch) ;
      fallback gracieux si la KB est indisponible
- [x] UI : badges de citation cliquables au-dessus du streaming ;
      les marqueurs `[N]` inline deviennent des liens vers leurs sources

**Livrable :** le tuteur ne dit plus rien qu'il ne puisse sourcer dans la doc.

> Itérations futures : ingérer plus de sources (clone git
> kubernetes/website), ajouter du reranking, permettre à l'utilisateur
> d'ajouter ses sources web custom (Sprint 6).

---

## Sprint 5 — Extensions shell + vi

**Objectif :** étendre la dextérité aux deux autres goulots du CKA.

- [ ] Catégorie `shell` : 30 questions sur grep/awk/sed/jq/yq/systemctl/...
- [ ] Catégorie `vi` : éditeur codemirror-vim intégré
- [ ] Validation `vi` : comparaison de buffer attendu (avec multi-cibles)
- [ ] **Scoring keystroke-efficiency** (ratio `optimalKeystrokes / actual`)
- [ ] Filtres de session par catégorie

**Livrable :** un entraînement complet qui couvre kubectl + shell + vi.

---

## Sprint 6 — Sources web custom + UI admin

**Objectif :** que l'utilisateur puisse enrichir la base de connaissance avec
ses propres sources.

- [ ] Schéma `sources` en DB
- [ ] Crawler avec respect de `robots.txt`, User-Agent identifiable, rate
      limiting
- [ ] Détection incrémentale via `etag` / `If-Modified-Since` / `content_hash`
- [ ] Extraction propre via Mozilla Readability + turndown
- [ ] Page `Settings → Sources de connaissance`
- [ ] Séparation `kb-bundled.db` (image) + `kb-user.db` (volume)
- [ ] Scheduler interne au container (`node-cron`)

**Livrable :** l'utilisateur peut indexer son blog, sa doc d'équipe, etc.

---

## Au-delà

Idées en file d'attente, à prioriser selon les retours :

- **Mode lab** : exécution réelle dans un cluster `kind` éphémère
- **Multi-utilisateur + leaderboard** (Niveau 2 du schéma persistance)
- **Auth** : magic link email ou OAuth GitHub
- **Génération de questions assistée par LLM** validées en CI sur cluster
  `kind` (PR auto)
- **Extensions** : CKAD, CKS, Linux, Git, Terraform, AWS CLI (même mécanique)
- **Mobile-friendly** : exporter le mode "flashcards" pour les transports
