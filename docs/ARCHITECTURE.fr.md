# Architecture

> 🇫🇷 Version française · [🇬🇧 English](./ARCHITECTURE.md)

Ce document consolide les **décisions de conception** prises au moment de la
genèse du projet. Il a vocation à évoluer ; chaque modification structurelle
doit être traduite ici.

## Principes directeurs

1. **Local-first.** L'app tourne entièrement chez l'utilisateur. Aucune donnée
   n'est exposée à des tiers sans action explicite. Cible de déploiement :
   self-host Docker (single container).
2. **Validation déterministe au cœur, IA en couche d'enrichissement.** Le score
   et le chrono ne dépendent jamais d'un appel LLM. L'IA apporte de
   l'explication et de l'aide, jamais le verdict.
3. **Toute IA générative doit être sourcée.** Le tuteur IA (à venir) répond
   uniquement à partir de chunks documentaires retrouvés (RAG), avec citation
   d'URL. Pas de réponse "de mémoire".
4. **BYOK pour les providers payants.** L'utilisateur fournit sa clé OpenRouter
   ou utilise son abonnement Claude via OAuth. Aucun coût d'inférence côté
   serveur du projet.
5. **Le code reste simple tant que la complexité n'est pas justifiée.** Pas
   d'abstractions spéculatives, pas de monorepo turborepo prématuré, pas de
   micro-services pour un outil mono-utilisateur.

## Stack technique

| Couche                | Choix                                          | Pourquoi                                                                                         |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Framework             | Next.js 16 (App Router)                        | SSR/SSG simple, écosystème mature, déploiement Docker trivial                                    |
| Langage               | TypeScript strict                              | Robustesse sur les types de questions/validateurs                                                |
| UI                    | React 19 + Tailwind 3                          | Vitesse de dev, look terminal facile à styliser                                                  |
| Saisie utilisateur    | Input contrôlé monospace (pas xterm.js au MVP) | xterm.js émule un PTY complet, surdimensionné pour un input. Garde la porte ouverte pour Sprint 5 |
| Vi (futur)            | codemirror-vim                                 | Vrai mode vi navigateur, scoring keystroke-efficiency possible                                   |
| Persistance           | SQLite (Sprint 2+)                             | Zéro infra, suffisant jusqu'à plusieurs centaines d'utilisateurs                                 |
| Vector store (RAG)    | sqlite-vec (Sprint 4)                          | Cohérent avec SQLite, pas de Postgres à host                                                     |
| Embeddings            | `bge-small-en` local OU OpenRouter             | Choix utilisateur ; index pré-construits multi-modèles                                           |
| LLM                   | Claude OAuth OU OpenRouter                     | Pattern multi-provider via interface `LLMProvider`                                               |

## Validation des commandes

### Sprint 1 — RegexValidator (actuel)

Chaque question définit une liste `acceptedPatterns: string[]`. La saisie
utilisateur est :

1. trimmée
2. normalisée (espaces multiples → un seul)
3. testée contre chaque pattern avec le flag `i`

Une réponse est correcte dès qu'**un seul** pattern matche. Les patterns
doivent être ancrés (`^...$`) côté données pour éviter les faux positifs.

**Limitation connue.** Couvrir toutes les variantes valides (ordre des flags,
formes longues/courtes, alias) explose vite côté regex. C'est viable pour 20
questions, ça ne le sera pas pour 1 000.

### Sprint 4+ — SemanticValidator (prévu)

Parser la commande en AST (`{ verb, resource, name, flags: { ... } }`),
normaliser, comparer à un AST attendu. Plus fiable, plus de boulot. Sera
introduit quand le coût de maintenance des regex deviendra insupportable.

### Plus tard — ExecutionValidator (prévu)

Sandbox `kind` éphémère, exécution réelle de la commande, comparaison de
l'état du cluster. Modèle Killer.sh. Réservé à un mode "lab" optionnel.

## Tuteur IA (Sprint 3-4, prévu)

Pipeline en post-validation, jamais en amont :

```
[utilisateur tape]
      ↓
[RegexValidator]  ← détermine OK / KO instantanément
      ↓
[résultat affiché]
      ↓
[Tutor.explain(question, userInput, result)]  ← async, optionnel
   ├─ retrieve top-k chunks via RAG
   └─ LLMProvider.complete(prompt avec citations)
```

Modes utilisateur :

- **Examen** : IA désactivée, pure dextérité, comme le vrai jour J
- **Entraînement** : feedback IA après chaque réponse
- **Revue** : analyse de fin de session, plan de révision personnalisé

## RAG (Sprint 4, prévu)

Trois types de sources, ingérées par le même pipeline :

1. **Fichiers locaux** (Markdown, txt, PDF) bundlés dans l'image Docker
2. **Sources web "officielles"** (kubernetes.io/docs depuis le repo git
   `kubernetes/website`, kubernetes.io/blog, man pages bash, docs vim) ingérées
   en CI au moment du build
3. **Sources web custom** ajoutées par l'utilisateur via UI admin, ingérées par
   un scheduler interne au container

Stratégie d'index multi-modèles d'embedding : un fichier `.db` par modèle
(`kb-bge-small.db`, `kb-openai-3-small.db`, `kb-qwen3.db`). L'app charge
l'index correspondant à la config utilisateur. Validation au boot pour éviter
les mismatchs de dimensions.

Séparation `kb-bundled.db` (read-only, vient de l'image) + `kb-user.db`
(volume persistant) pour préserver les sources custom à l'upgrade du
container.

Métadonnées de chunk obligatoires : `{ source_id, source_url, source_section,
content_hash, license }`. Permet citations + détection incrémentale + respect
des licences.

## Persistance (Sprint 2, prévu)

Schéma SQLite pensé pour évoluer du mono-utilisateur (Niveau 1) au
multi-utilisateur avec leaderboard (Niveau 2) sans refactor :

```sql
users (id, display_name, created_at, is_anonymous)
runs (id, user_id, mode, started_at, ended_at, total_questions,
      correct_count, total_time_ms, score, k8s_version)
attempts (id, run_id, question_id, category, subcategory, user_input,
          is_correct, time_ms, keystrokes, optimal_keystrokes,
          hints_used, ai_feedback, created_at)
```

Au MVP du Sprint 2, `is_anonymous = 1` et `users` ne contient qu'un user
local. L'auth (magic link / OAuth GitHub) sera additive.

## Mises à jour automatiques (Sprint 4+)

GitHub Action mensuelle :

1. Vérifier la dernière release `kubernetes/kubernetes`
2. Régénérer `kubectl-flags-vX.Y.json` à partir de `kubectl <verb> --help`
3. Réindexer le RAG sur la nouvelle branche de `kubernetes/website`
4. Lancer la suite de questions existantes contre un cluster `kind` v1.X+1
5. Ouvrir une PR avec un rapport de diff (questions cassées, nouveaux flags)

L'utilisateur voit dans l'UI la version K8s couverte par sa base de questions.
