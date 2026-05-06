# Question schema

> 🇬🇧 English version · [🇫🇷 Version française](./QUESTION_SCHEMA.fr.md)

Reference for the fields and conventions to respect when adding or editing a
question.

## Location

- `src/data/questions/kubectl.json` — kubectl questions
- `src/data/questions/shell.json` — shell questions (Sprint 5)
- `src/data/questions/vi.json` — vi questions (Sprint 5)

The TypeScript reference types live in `src/lib/questions/types.ts`.

## Structure of a command question

```jsonc
{
  // Stable identifier, format: <category>-<topic>-<NNN>
  "id": "k-pods-001",

  // "kubectl" | "shell" | "vi"
  "category": "kubectl",

  // Official CKA domain. Enables filtering and per-domain scoring.
  // Values: "cluster-architecture" | "workloads-scheduling"
  //       | "services-networking" | "storage" | "troubleshooting" | "other"
  "domain": "workloads-scheduling",

  // Statement as shown to the user. Concrete context > abstract phrasing.
  // Always specify the namespace, resource names, etc.
  "scenario": "List all pods in the 'web' namespace.",

  // 1 (very easy) to 5 (expert).
  // 1-2: short commands, few flags
  // 3  : one tactical flag (--dry-run, --sort-by, simple JSONPath)
  // 4-5: subtle RBAC, advanced JSONPath, drain/cordon, troubleshooting
  "difficulty": 1,

  // Free-form tags for filtering. Optional but recommended.
  "tags": ["pods", "get"],

  // Targeted K8s version (informational).
  "k8sVersion": "1.31",

  // Hints the user can reveal. Score penalty (upcoming).
  "hints": ["Think `--dry-run=client` and `-o yaml`."],

  // Reference URLs — used later by RAG to scope retrieve. Recommended on
  // non-trivial questions.
  "docUrls": [
    "https://kubernetes.io/docs/reference/kubectl/cheatsheet/"
  ],

  // The challenge itself.
  "challenge": {
    "type": "command",

    // Canonical expected form, shown in the "expected command" feedback.
    // Must be the most idiomatic command.
    "expected": "kubectl get pods -n web",

    // List of accepted regex. A response is correct if it matches AT LEAST
    // one pattern. See conventions below.
    "acceptedPatterns": [
      "^(kubectl|k)\\s+get\\s+(pods?|po)\\s+(-n\\s+web|--namespace[= ]web)$"
    ],

    // Shown in the feedback. Concise (1-2 sentences). Highlights the
    // relevant exam trick.
    "explanation": "`get pods` or `get po` (alias) accept `-n` or `--namespace`."
  }
}
```

## Conventions for `acceptedPatterns`

### Always anchor

```jsonc
// ✅ anchored, rejects "kubectl get pods -n web && rm -rf /"
"^(kubectl|k)\\s+get\\s+pods?\\s+-n\\s+web$"

// ❌ not anchored, false positives guaranteed
"(kubectl|k) get pods? -n web"
```

### Cover common variants

For every kubectl command, plan at minimum:

- `kubectl` AND `k` (the usual alias) → `(kubectl|k)`
- plural/singular resource forms → `pods?`
- official aliases → `(deployment|deploy|deployments)`,
  `(serviceaccount|sa)`, `(persistentvolume|pv)`, `(endpoints|ep)`,
  `(namespaces?|ns)`
- `-n <ns>` AND `--namespace <ns>` AND `--namespace=<ns>` →
  `(-n\\s+<ns>|--namespace[= ]<ns>)`
- flag order: if the namespace position can vary, provide multiple
  patterns

### JSON escaping

In a `.json` file every `\` must be doubled:

```jsonc
// in JSON:        "^(kubectl|k)\\s+get\\s+pods?$"
// final regex:    ^(kubectl|k)\s+get\s+pods?$
```

### Case insensitivity

The validator compiles patterns with the `i` flag. No need for
`[Kk]ubectl`.

### Whitespace

The validator collapses multiple whitespace characters into one and trims.
Patterns can assume normalized input.

## Self-test for consistency

Before committing, check that the `expected` command matches at least one
pattern:

```bash
node -e '
const qs = require("./src/data/questions/kubectl.json");
let fail = 0;
for (const q of qs) {
  const e = q.challenge.expected.trim().replace(/\s+/g, " ");
  const ok = q.challenge.acceptedPatterns.some(p => new RegExp(p, "i").test(e));
  if (!ok) { console.log("FAIL", q.id, e); fail++; }
}
process.exit(fail);'
```

(This check will be automated in CI soon.)

## Good and bad statements

### ✅ Good

> Create an `api` deployment with 3 replicas, image `nginx`, in the `web`
> namespace.

Precise: name, image, replicas, namespace. The user has nothing to guess.

### ❌ Bad

> Create a deployment.

Too open-ended: 50 different commands would be "correct".

### ✅ Good (with hint)

> Check whether the `ci` ServiceAccount in the `web` namespace can create
> deployments.
>
> Hints: `kubectl auth can-i ...`, `--as=system:serviceaccount:<ns>:<sa>`

The scenario stays precise; hints unlock non-obvious concepts.

## Checklist before proposing a question

- [ ] The statement is concrete (names, namespace, replicas specified)
- [ ] The `expected` command is the idiomatic one (`k` alias, short flags)
- [ ] At least 2 accepted patterns (classic variants)
- [ ] All patterns anchored `^...$`
- [ ] `\\s+` is used for whitespace (not a plain space)
- [ ] No suspicious backreferences (basic JS regex is enough)
- [ ] `domain` is one of the 5 official CKA domains + `other`
- [ ] `difficulty` is consistent with command size/complexity
- [ ] The `expected matches a pattern` self-test passes
