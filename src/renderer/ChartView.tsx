import type { ChartConfig } from "../model/types";

interface Props {
  config: ChartConfig;
}

/** 輕量 SVG 圖表 — bar / line / area / pie / kpi。使用主題 accent 色。 */
export function ChartView({ config }: Props) {
  const { chartType, data } = config;
  if (chartType === "kpi") {
    const first = data[0];
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text)",
        }}
      >
        <div style={{ fontSize: 180, fontWeight: 800, fontFamily: "var(--font-display)" }}>
          {first ? first.value : 0}
          {config.unit ?? ""}
        </div>
        {first && <div style={{ fontSize: 32, color: "var(--text-mute)" }}>{first.label}</div>}
      </div>
    );
  }

  const W = 1000;
  const Hh = 600;
  const pad = 60;
  const max = Math.max(...data.map((d) => d.value), 1);
  const innerW = W - pad * 2;
  const innerH = Hh - pad * 2;

  if (chartType === "pie") {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let acc = 0;
    const cx = W / 2;
    const cy = Hh / 2;
    const r = Math.min(innerW, innerH) / 2;
    return (
      <svg viewBox={`0 0 ${W} ${Hh}`} style={{ width: "100%", height: "100%" }}>
        {data.map((d, i) => {
          const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
          acc += d.value;
          const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + r * Math.cos(start);
          const y1 = cy + r * Math.sin(start);
          const x2 = cx + r * Math.cos(end);
          const y2 = cy + r * Math.sin(end);
          const large = end - start > Math.PI ? 1 : 0;
          const opacity = 1 - (i / Math.max(data.length, 1)) * 0.6;
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
              fill="var(--accent)"
              opacity={opacity}
            />
          );
        })}
      </svg>
    );
  }

  const barGap = 24;
  const barW = innerW / data.length - barGap;

  if (chartType === "line" || chartType === "area") {
    const pts = data.map((d, i) => {
      const x = pad + (innerW / Math.max(data.length - 1, 1)) * i;
      const y = pad + innerH - (d.value / max) * innerH;
      return `${x},${y}`;
    });
    const areaPath = `M ${pad},${pad + innerH} L ${pts.join(" L ")} L ${pad + innerW},${pad + innerH} Z`;
    return (
      <svg viewBox={`0 0 ${W} ${Hh}`} style={{ width: "100%", height: "100%" }}>
        {chartType === "area" && <path d={areaPath} fill="var(--accent-soft)" />}
        <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth={6} />
        {data.map((d, i) => {
          const x = pad + (innerW / Math.max(data.length - 1, 1)) * i;
          const y = pad + innerH - (d.value / max) * innerH;
          return <circle key={i} cx={x} cy={y} r={8} fill="var(--accent)" />;
        })}
      </svg>
    );
  }

  // bar
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} style={{ width: "100%", height: "100%" }}>
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = pad + (barW + barGap) * i;
        const y = pad + innerH - h;
        const highlight = config.highlightIndex === i;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={6}
              fill="var(--accent)"
              opacity={highlight ? 1 : 0.65}
            />
            <text
              x={x + barW / 2}
              y={pad + innerH + 32}
              textAnchor="middle"
              fontSize={24}
              fill="var(--text-mute)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
