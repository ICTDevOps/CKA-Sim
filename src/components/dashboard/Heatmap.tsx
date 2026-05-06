import type { HeatmapCell } from "@/lib/db/repositories/stats";

interface HeatmapProps {
  cells: HeatmapCell[];
}

const DOMAINS = [
  ["cluster-architecture", "Architecture & RBAC"],
  ["workloads-scheduling", "Workloads"],
  ["services-networking", "Networking"],
  ["storage", "Storage"],
  ["troubleshooting", "Troubleshooting"]
] as const;

const DIFFICULTIES: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

/**
 * Tableau domain × difficulty avec gradient rouge → vert sur le taux de
 * réussite. Une cellule sans tentative reste neutre.
 */
export function Heatmap({ cells }: HeatmapProps) {
  const map = new Map(
    cells.map((c) => [`${c.domain}|${c.difficulty}`, c])
  );

  return (
    <div className="overflow-hidden rounded-lg border border-terminal-dim/40 bg-black/30">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-terminal-dim">
            <th className="px-2 py-2 text-left font-normal">Domaine</th>
            {DIFFICULTIES.map((d) => (
              <th key={d} className="px-2 py-2 text-center font-normal">
                ★{d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DOMAINS.map(([domain, label]) => (
            <tr key={domain} className="border-t border-terminal-dim/20">
              <td className="whitespace-nowrap px-2 py-2 text-terminal-fg">
                {label}
              </td>
              {DIFFICULTIES.map((d) => {
                const cell = map.get(`${domain}|${d}`);
                return (
                  <td key={d} className="px-1 py-1">
                    <Cell cell={cell} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ cell }: { cell: HeatmapCell | undefined }) {
  if (!cell || cell.total === 0) {
    return (
      <div
        className="flex h-7 items-center justify-center rounded bg-terminal-dim/10 text-[10px] text-terminal-dim"
        aria-label="aucune tentative"
      >
        —
      </div>
    );
  }
  const rate = cell.correct / cell.total; // 0..1
  // gradient rouge (0) → jaune (0.5) → vert (1)
  const hue = Math.round(rate * 120); // 0=red, 120=green
  const bg = `hsl(${hue}, 55%, 25%)`;
  const fg = rate >= 0.5 ? "#e5fbef" : "#ffe4e4";
  return (
    <div
      className="flex h-7 items-center justify-center rounded text-[10px] tabular-nums"
      style={{ backgroundColor: bg, color: fg }}
      title={`${cell.correct}/${cell.total} (${Math.round(rate * 100)}%)`}
    >
      {cell.correct}/{cell.total}
    </div>
  );
}
