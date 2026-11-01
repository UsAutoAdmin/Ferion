import { Badge } from "@/components/ui/badge";
import type { MatchTier } from "@/lib/valuation/types";

const LABEL: Record<MatchTier, string> = { exact: "Exact year", generation: "Generation", nearby: "±3 yrs" };
const TONE: Record<MatchTier, "success" | "accent" | "neutral"> = { exact: "success", generation: "accent", nearby: "neutral" };

/** Shows how close the price data was to the requested model year. */
export function TierBadge({ tier }: { tier: MatchTier }) {
  return <Badge tone={TONE[tier]}>{LABEL[tier]}</Badge>;
}
