"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface MakeOption { value: string; label: string }
interface ModelOption { value: string; label: string; years: [number, number] }

export interface VehicleFormValue { year: number; make: string; model: string }

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR + 1 - 1990 + 1 }, (_, i) => THIS_YEAR + 1 - i);

const field = "h-11 w-full rounded-brand-md border border-line/15 bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent/60";

/**
 * Year / make / model picker. Makes and models come from the catalog so
 * users see what has data; the model field also accepts free text for
 * anything the catalog spells differently.
 */
export function VehicleForm({ onSubmit, busy, initial }: { onSubmit: (v: VehicleFormValue) => void; busy: boolean; initial?: VehicleFormValue }) {
  const [year, setYear] = useState<number>(initial?.year ?? 2015);
  const [make, setMake] = useState<string>(initial?.make ?? "");
  const [model, setModel] = useState<string>(initial?.model ?? "");
  const [makes, setMakes] = useState<MakeOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);

  useEffect(() => {
    fetch("/api/catalog/options").then((r) => r.json()).then((d) => setMakes(d.makes ?? [])).catch(() => setMakes([]));
  }, []);

  useEffect(() => {
    if (!make) { setModels([]); return; }
    const ctrl = new AbortController();
    fetch(`/api/catalog/options?make=${encodeURIComponent(make)}`, { signal: ctrl.signal })
      .then((r) => r.json()).then((d) => setModels(d.models ?? [])).catch(() => {});
    return () => ctrl.abort();
  }, [make]);

  const modelsForYear = useMemo(
    () => models.filter((m) => m.years[0] - 2 <= year && year <= m.years[1] + 2),
    [models, year]
  );

  const makeLabel = makes.find((m) => m.value === make)?.label ?? make;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!make || !model.trim()) return;
    onSubmit({ year, make: makeLabel, model: model.trim() });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-end">
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-eyebrow text-fg-subtle">
        Year
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={field}>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-eyebrow text-fg-subtle">
        Make
        <select value={make} onChange={(e) => { setMake(e.target.value); setModel(""); }} className={cn(field, !make && "text-fg-subtle")} required>
          <option value="">Make</option>
          {makes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-eyebrow text-fg-subtle">
        Model
        <input
          list="ferion-models"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model"
          disabled={!make}
          className={field}
          required
        />
        <datalist id="ferion-models">
          {modelsForYear.map((m) => <option key={m.value} value={m.label}>{`${m.years[0]}–${m.years[1]}`}</option>)}
        </datalist>
      </label>
      <Button type="submit" variant="accent" disabled={busy || !make || !model.trim()} className="sm:w-auto">
        {busy ? "Running…" : "Value"}
      </Button>
    </form>
  );
}
