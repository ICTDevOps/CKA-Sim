import type { ScorePoint } from "@/lib/db/repositories/stats";

interface ScoreCurveProps {
  points: ScorePoint[];
}

/**
 * Tiny dependency-free SVG line chart of score% over time.
 * X = run index (oldest → newest, left → right). Y = score%.
 */
export function ScoreCurve({ points }: ScoreCurveProps) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-terminal-dim/40 bg-black/30 p-4 text-sm text-terminal-dim">
        Pas encore de données.
      </div>
    );
  }

  const W = 800;
  const H = 180;
  const PAD = 28;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const toY = (v: number) => PAD + innerH - (v / 100) * innerH;

  const path = points
    .map((p, i) => {
      const x = PAD + i * stepX;
      const y = toY(p.scorePercent);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-lg border border-terminal-dim/40 bg-black/30 p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full"
        role="img"
        aria-label="Courbe de score sur les sessions récentes"
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD}
              x2={W - PAD}
              y1={toY(v)}
              y2={toY(v)}
              stroke="currentColor"
              strokeOpacity={v === 50 ? 0.2 : 0.08}
              strokeDasharray={v === 50 ? "2 2" : undefined}
              className="text-terminal-dim"
            />
            <text
              x={PAD - 6}
              y={toY(v) + 3}
              textAnchor="end"
              className="fill-terminal-dim text-[10px]"
            >
              {v}%
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-terminal-accent"
        />
        {points.map((p, i) => (
          <circle
            key={p.runId}
            cx={PAD + i * stepX}
            cy={toY(p.scorePercent)}
            r={2.5}
            className="fill-terminal-accent"
          >
            <title>
              {new Date(p.startedAt).toLocaleString("fr-FR")} —{" "}
              {p.scorePercent}% ({p.correctCount}/{p.totalQuestions})
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
