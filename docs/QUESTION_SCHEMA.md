# Schéma des questions

Référence des champs et conventions à respecter pour ajouter ou modifier une
question.

## Emplacement

- `src/data/questions/kubectl.json` — questions kubectl
- `src/data/questions/shell.json` — questions shell (Sprint 5)
- `src/data/questions/vi.json` — questions vi (Sprint 5)

Les types TypeScript de référence sont dans `src/lib/questions/types.ts`.

## Structure d'une question commande

```jsonc
{
  // Identifiant stable, format : <category>-<topic>-<NNN>
  "id": "k-pods-001",

  // "kubectl" | "shell" | "vi"
  "category": "kubectl",

  // Domaine officiel CKA. Permet le filtrage et le scoring par domaine.
  // Valeurs : "cluster-architecture" | "workloads-scheduling"
  //         | "services-networking" | "storage" | "troubleshooting" | "other"
  "domain": "workloads-scheduling",

  // Énoncé tel qu'affiché à l'utilisateur. Contexte concret > formulation
  // abstraite. Précise le namespace, les noms de ressources, etc.
  "scenario": "Lister tous les pods du namespace 'web'.",

  // 1 (très facile) à 5 (expert).
  // 1-2 : commandes courtes, peu de flags
  // 3   : un flag tactique (--dry-run, --sort-by, JSONPath simple)
  // 4-5 : RBAC subtil, JSONPath avancé, drain/cordon, troubleshooting
  "difficulty": 1,

  // Tags libres pour filtrage. Facultatifs mais recommandés.
  "tags": ["pods", "get"],

  // Version K8s ciblée (informatif).
  "k8sVersion": "1.31",

  // Indices que l'utilisateur peut révéler. Pénalité au score (à venir).
  "hints": ["Pense à `--dry-run=client` et `-o yaml`."],

  // URLs de référence — utilisées plus tard par le RAG pour borner le
  // retrieve. Recommandé sur les questions non triviales.
  "docUrls": [
    "https://kubernetes.io/docs/reference/kubectl/cheatsheet/"
  ],

  // Cœur de la question.
  "challenge": {
    "type": "command",

    // Forme canonique attendue, affichée dans le feedback "commande
    // attendue". Doit être la commande la plus idiomatique.
    "expected": "kubectl get pods -n web",

    // Liste de regex acceptées. Une réponse est correcte si elle matche
    // AU MOINS un pattern. Voir conventions ci-dessous.
    "acceptedPatterns": [
      "^(kubectl|k)\\s+get\\s+(pods?|po)\\s+(-n\\s+web|--namespace[= ]web)$"
    ],

    // Affichée dans le feedback. Concis (1-2 phrases). Insiste sur
    // l'astuce d'examen pertinente.
    "explanation": "`get pods` ou `get po` (alias) acceptent `-n` ou `--namespace`."
  }
}
```

## Conventions pour `acceptedPatterns`

### Toujours ancrer

```jsonc
// ✅ ancré, refuse "kubectl get pods -n web && rm -rf /"
"^(kubectl|k)\\s+get\\s+pods?\\s+-n\\s+web$"

// ❌ pas ancré, faux positifs garantis
"(kubectl|k) get pods? -n web"
```

### Couvrir les variantes courantes

Pour chaque commande kubectl, prévoir au minimum :

- `kubectl` ET `k` (alias usuel) → `(kubectl|k)`
- formes pluriel/singulier des ressources → `pods?`
- alias officiels → `(deployment|deploy|deployments)`, `(serviceaccount|sa)`,
  `(persistentvolume|pv)`, `(endpoints|ep)`, `(namespaces?|ns)`
- `-n <ns>` ET `--namespace <ns>` ET `--namespace=<ns>` →
  `(-n\\s+<ns>|--namespace[= ]<ns>)`
- ordre des flags : si la position du namespace peut varier, prévoir plusieurs
  patterns

### Échappement JSON

Dans un fichier `.json`, chaque `\` doit être doublé :

```jsonc
// dans le JSON :  "^(kubectl|k)\\s+get\\s+pods?$"
// la regex finale : ^(kubectl|k)\s+get\s+pods?$
```

### Insensibilité à la casse

Le validateur compile avec le flag `i`. Pas besoin de `[Kk]ubectl`.

### Espaces

Le validateur normalise les espaces multiples en un seul, et trimme. Les
patterns peuvent supposer une saisie normalisée.

## Auto-test de cohérence

Avant de commit, vérifier que la commande `expected` matche au moins un
pattern :

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

(Ce check sera bientôt automatisé en CI.)

## Bons et mauvais énoncés

### ✅ Bon

> Créer un deployment `api` avec 3 réplicas, image `nginx`, dans le namespace
> `web`.

Précis : nom, image, replicas, namespace. L'utilisateur n'a pas à deviner.

### ❌ Mauvais

> Crée un deployment.

Trop ouvert : 50 commandes différentes seraient correctes.

### ✅ Bon (avec hint)

> Vérifier si le ServiceAccount `ci` du namespace `web` peut créer des
> deployments.
>
> Hints : `kubectl auth can-i ...`, `--as=system:serviceaccount:<ns>:<sa>`

Le scénario reste précis, les hints débloquent les concepts non évidents.

## Checklist avant de proposer une question

- [ ] L'énoncé est concret (noms, namespace, replicas spécifiés)
- [ ] La commande `expected` est l'idiomatique (alias `k`, flags courts)
- [ ] Au moins 2 patterns acceptés (variations classiques)
- [ ] Tous les patterns ancrés `^...$`
- [ ] Le `\\s+` est utilisé pour les espaces (pas un simple espace)
- [ ] Aucune backreference suspecte (les regex JS de base suffisent)
- [ ] `domain` est l'un des 5 domaines officiels CKA + `other`
- [ ] `difficulty` est cohérent avec la taille/complexité de la commande
- [ ] L'auto-test `expected matche un pattern` passe
