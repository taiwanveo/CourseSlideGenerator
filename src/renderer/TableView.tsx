import type { TableConfig } from "../model/types";

interface Props {
  config: TableConfig;
}

export function TableView({ config }: Props) {
  const pad = config.density === "compact" ? "10px 16px" : "18px 24px";
  return (
    <table
      style={{
        width: "100%",
        height: "100%",
        borderCollapse: "collapse",
        color: "var(--text)",
        fontFamily: "var(--font-body)",
        fontSize: 28,
        tableLayout: "fixed",
      }}
    >
      <thead>
        <tr>
          {config.columns.map((c) => (
            <th
              key={c.key}
              style={{
                textAlign: c.format === "number" || c.format === "percent" ? "right" : "left",
                padding: pad,
                borderBottom: "2px solid var(--accent)",
                color: "var(--accent)",
                fontWeight: 700,
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {config.rows.map((row, ri) => (
          <tr
            key={ri}
            style={{
              background: ri === config.highlightRowIndex ? "var(--accent-soft)" : "transparent",
            }}
          >
            {config.columns.map((c) => {
              const v = row[c.key];
              const text =
                c.format === "percent" && typeof v === "number" ? `${v}%` : v ?? "";
              return (
                <td
                  key={c.key}
                  style={{
                    textAlign:
                      c.format === "number" || c.format === "percent" ? "right" : "left",
                    padding: pad,
                    borderBottom: "1px solid var(--rule)",
                  }}
                >
                  {text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
