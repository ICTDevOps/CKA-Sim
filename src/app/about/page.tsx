import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold">À propos & Roadmap</h1>

      <section className="space-y-4 text-sm leading-relaxed">
        <p>
          CKA-Sim est un simulateur de dextérité <strong>local-first</strong>{" "}
          pour préparer la certification CKA. La validation des commandes est
          déterministe (regex) ; un tuteur IA (Claude OAuth ou OpenRouter)
          arrivera en couche d'enrichissement, ancré sur la documentation
          officielle via RAG.
        </p>

        <h2 className="pt-4 text-lg font-semibold">Roadmap</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Sprint 1 (en cours)</strong> — Dextérité kubectl pure :
            scénario → commande → chrono. Validation regex. Pas d'IA, pas
            d'historique.
          </li>
          <li>
            <strong>Sprint 2</strong> — Persistance des runs et tableau de bord
            personnel (SQLite, schéma <code>users / runs / attempts</code>).
          </li>
          <li>
            <strong>Sprint 3</strong> — Tuteur IA (Claude OAuth + OpenRouter)
            avec feedback post-réponse, sans RAG (peut halluciner).
          </li>
          <li>
            <strong>Sprint 4</strong> — RAG ancré sur la doc officielle
            (sqlite-vec + embeddings locaux/OpenRouter), citations dans les
            réponses.
          </li>
          <li>
            <strong>Sprint 5</strong> — Extensions shell et vi
            (codemirror-vim), avec scoring keystroke-efficiency.
          </li>
          <li>
            <strong>Sprint 6</strong> — Sources web custom + UI admin
            d'ingestion.
          </li>
        </ol>

        <p className="pt-4">
          <Link
            href="/"
            className="text-terminal-accent underline hover:opacity-90"
          >
            ← Retour à l'accueil
          </Link>
        </p>
      </section>
    </main>
  );
}
