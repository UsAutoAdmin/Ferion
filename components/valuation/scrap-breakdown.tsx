import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatInteger } from "@/lib/utils/format";
import type { ScrapValuation } from "@/lib/valuation/types";

const SOURCE_LABEL: Record<ScrapValuation["profileSource"], { text: string; tone: "success" | "accent" | "warning" | "neutral" }> = {
  cache: { text: "Known profile", tone: "success" },
  llm: { text: "Resolved profile", tone: "success" },
  heuristic: { text: "Class estimate", tone: "warning" },
  unavailable: { text: "No profile", tone: "neutral" },
};

/** Material-by-material scrap table with the profile provenance. */
export function ScrapBreakdown({ scrap, compact = false }: { scrap: ScrapValuation; compact?: boolean }) {
  const src = SOURCE_LABEL[scrap.profileSource];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-fg">Scrap metal</h3>
          <Badge tone={src.tone}>{src.text}</Badge>
        </div>
        <span className="text-lg font-medium text-accent">{formatCurrency(scrap.totalValueUsd)}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-eyebrow text-fg-subtle">
          <tr>
            <th className="py-2 font-medium">Component</th>
            {!compact ? <th className="py-2 font-medium">Material</th> : null}
            <th className="py-2 text-right font-medium">Lbs</th>
            <th className="py-2 text-right font-medium">$/lb</th>
            <th className="py-2 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/10">
          {scrap.lineItems.map((li) => (
            <tr key={li.key}>
              <td className="py-2 text-fg">{li.label}</td>
              {!compact ? <td className="py-2 text-fg-muted">{li.materialLabel}</td> : null}
              <td className="py-2 text-right tabular-nums text-fg-muted">{li.weightLbs === null ? "—" : formatInteger(li.weightLbs)}</td>
              <td className="py-2 text-right tabular-nums text-fg-muted">{li.pricePerLb === null ? "—" : `$${li.pricePerLb.toFixed(2)}`}</td>
              <td className="py-2 text-right tabular-nums text-fg">{li.valueUsd === null ? "—" : formatCurrency(li.valueUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {scrap.profileSource === "heuristic" ? (
        <p className="mt-2 text-xs text-fg-subtle">Weights estimated from vehicle class. Add an LLM key or a cached profile for a vehicle-specific breakdown.</p>
      ) : null}
    </div>
  );
}
