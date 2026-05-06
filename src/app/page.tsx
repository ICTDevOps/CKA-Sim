import Link from "next/link";
import { loadAllQuestions } from "@/lib/questions";

export default function HomePage() {
  const total = loadAllQuestions().length;
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-4xl font-bold text-terminal-fg">CKA-Sim</h1>
      <p className="mb-8 text-terminal-dim">
        Simulateur de dextérité pour la certification{" "}
        <abbr title="Certified Kubernetes Administrator">CKA</abbr>. Pas de
        cluster à monter, pas d'examen blanc à 50€. Juste : un scénario, une
        commande, un chrono.
      </p>

      <section className="mb-8 space-y-3 rounded-lg border border-terminal-dim/40 bg-black/30 p-5 text-sm">
        <h2 className="text-base font-semibold text-terminal-fg">
          Pourquoi un simulateur de dextérité ?
        </h2>
        <p>
          Au CKA, tu as 2h pour ~15-20 tâches sur cluster réel. La{" "}
          <strong>vitesse de frappe kubectl</strong> (alias{" "}
          <code className="text-terminal-accent">k</code>,{" "}
          <code className="text-terminal-accent">--dry-run=client -o yaml</code>
          , <code className="text-terminal-accent">-n</code>, JSONPath…) fait la
          différence entre réussir et tomber à court de temps.
        </p>
        <p>
          Cet outil entraîne ce réflexe précis. Plus tard, il s'étendra à shell
          et vi (les autres goulots silencieux du CKA).
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/session"
          className="rounded bg-terminal-accent px-5 py-3 font-semibold text-terminal-bg hover:opacity-90"
        >
          Démarrer une session
        </Link>
        <p className="text-sm text-terminal-dim">
          {total} questions disponibles · 60s par question
        </p>
      </div>

      <footer className="mt-16 text-xs text-terminal-dim">
        <p>
          Statut : MVP Sprint 1 (dextérité kubectl).{" "}
          <a
            href="https://github.com/ictdevops/cka-sim"
            className="underline hover:text-terminal-fg"
          >
            Code source
          </a>{" "}
          ·{" "}
          <Link
            href="/about"
            className="underline hover:text-terminal-fg"
          >
            Roadmap
          </Link>
        </p>
      </footer>
    </main>
  );
}
