/**
 * Types décrivant une question du simulateur.
 *
 * Le schéma est conçu pour évoluer : au MVP on n'utilise que `kubectl` avec une
 * validation par patterns regex (`acceptedPatterns`). Les catégories `shell` et
 * `vi` sont déjà prévues dans le type pour préparer les sprints suivants sans
 * casser la compatibilité.
 */

export type QuestionCategory = "kubectl" | "shell" | "vi";

export type CkaDomain =
  | "cluster-architecture"
  | "workloads-scheduling"
  | "services-networking"
  | "storage"
  | "troubleshooting"
  | "other";

export interface BaseQuestion {
  id: string;
  category: QuestionCategory;
  domain: CkaDomain;
  /** Énoncé affiché à l'utilisateur. */
  scenario: string;
  /** Difficulté indicative de 1 (très facile) à 5 (expert). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Indices que l'utilisateur peut révéler (pénalité au score). */
  hints?: string[];
  /** Référence(s) documentaire(s) — utilisé plus tard par le RAG. */
  docUrls?: string[];
  /** Version de Kubernetes ciblée (informatif). */
  k8sVersion?: string;
  /** Tags libres pour filtrer (`rbac`, `pods`, `networking`, ...). */
  tags?: string[];
}

export interface CommandQuestion extends BaseQuestion {
  category: "kubectl" | "shell";
  challenge: {
    type: "command";
    /**
     * Liste de regex (en string, compilées au runtime avec le flag `i` par
     * défaut). Une réponse est correcte si elle matche AU MOINS un pattern.
     * Toujours ancrer avec `^...$` pour éviter les faux positifs.
     */
    acceptedPatterns: string[];
    /** Commande "canonique" à afficher dans la correction. */
    expected: string;
    /** Explication courte montrée après réponse. */
    explanation?: string;
  };
}

export interface ViQuestion extends BaseQuestion {
  category: "vi";
  challenge: {
    type: "vi";
    initialBuffer: string;
    /** Buffer(s) considéré(s) comme correct(s) après édition. */
    expectedBuffer: string | string[];
    /** Nombre minimal de keystrokes pour le scoring d'efficacité. */
    optimalKeystrokes?: number;
    explanation?: string;
  };
}

export type Question = CommandQuestion | ViQuestion;

/** Garde de type pratique pour la phase MVP. */
export function isCommandQuestion(q: Question): q is CommandQuestion {
  return q.challenge.type === "command";
}
