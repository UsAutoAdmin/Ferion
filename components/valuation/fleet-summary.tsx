import { Card, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { formatCurrency, formatInteger } from "@/lib/utils/format";
import type { FleetSummary } from "@/lib/valuation/summary";

/** Headline numbers and the breakdowns that matter for a bid list. */
export function FleetSummaryView({ summary: s }: { summary: FleetSummary }) {
  const maxType = s.topTypes[0]?.expectedValue ?? 1;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-5">
        <Stat label="Total recoverable" value={formatCurrency(s.totalExpected)} hint={`Ceiling ${formatCurrency(s.totalGross)}`} />
        <Stat label="Per vehicle" value={formatCurrency(s.avgExpectedPerVehicle)} tone="fg" hint={`Median ${formatCurrency(s.medianExpectedPerVehicle)}`} />
        <Stat label="Scrap metal" value={formatCurrency(s.scrapTotal)} tone="fg" />
        <Stat label="Parts (expected)" value={formatCurrency(s.partsExpected)} tone="fg" />
        <Stat label="Vehicles" value={formatInteger(s.vehicles)} tone="fg" hint={`${s.matched} with part data`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardTitle>Part types by expected value</CardTitle>
          <ul className="mt-4 flex flex-col gap-2.5">
            {s.topTypes.map((t) => (
              <li key={t.typeKey} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-fg">{t.label}</span>
                    <span className="text-xs text-fg-subtle">{t.vehicles} vehicle{t.vehicles === 1 ? "" : "s"} · avg {formatCurrency(t.avgUnitPrice)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line/10">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (t.expectedValue / maxType) * 100)}%` }} />
                  </div>
                </div>
                <span className="w-20 text-right tabular-nums text-fg">{formatCurrency(t.expectedValue)}</span>
              </li>
            ))}
            {s.topTypes.length === 0 ? <li className="text-sm text-fg-subtle">—</li> : null}
          </ul>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>By make</CardTitle>
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-line/10">
                {s.byMake.slice(0, 8).map((m) => (
                  <tr key={m.make}>
                    <td className="py-1.5 text-fg">{m.make}</td>
                    <td className="py-1.5 text-right tabular-nums text-fg-subtle">{m.vehicles}</td>
                    <td className="py-1.5 text-right tabular-nums text-fg-muted">{formatCurrency(m.avgExpected)} avg</td>
                    <td className="py-1.5 text-right tabular-nums text-fg">{formatCurrency(m.expectedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <CardTitle>By vehicle age</CardTitle>
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-line/10">
                {s.byAge.map((a) => (
                  <tr key={a.bucket}>
                    <td className="py-1.5 text-fg">{a.bucket}</td>
                    <td className="py-1.5 text-right tabular-nums text-fg-subtle">{a.vehicles}</td>
                    <td className="py-1.5 text-right tabular-nums text-fg-muted">{formatCurrency(a.expectedValue / a.vehicles)} avg</td>
                    <td className="py-1.5 text-right tabular-nums text-fg">{formatCurrency(a.expectedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
