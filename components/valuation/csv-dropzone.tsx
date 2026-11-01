"use client";

import Papa from "papaparse";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rowsToVehicles, type ParsedCsv } from "@/lib/csv/vehicle-csv";
import { cn } from "@/lib/utils/cn";
import { BULK_LIMIT } from "@/lib/valuation/request";

/**
 * Drag-and-drop CSV intake. Parses in the browser, shows which columns
 * were recognised and how many vehicles will be valued, then hands the
 * rows to the parent.
 */
export function CsvDropzone({ onReady, busy }: { onReady: (parsed: ParsedCsv, fileName: string) => void; busy: boolean }) {
  const [drag, setDrag] = useState(false);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        const out = rowsToVehicles(res.data, headers);
        if (!out.headerMap.fields.year && !headers.some((h) => /vehicle|description/i.test(h))) {
          setError(`Couldn't find a Year column. Headers seen: ${headers.slice(0, 8).join(", ")}${headers.length > 8 ? "…" : ""}`);
        }
        setParsed(out);
        setFileName(file.name);
      },
      error: (err) => setError(err.message),
    });
  }, []);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const count = parsed?.vehicles.length ?? 0;
  const overLimit = count > BULK_LIMIT;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-brand-lg border border-dashed p-10 text-center transition-colors",
          drag ? "border-accent/60 bg-accent/5" : "border-line/20 hover:border-line/40"
        )}
      >
        <span className="text-sm text-fg">Drop a Copart / IAA sale list or any CSV with Year, Make, Model</span>
        <span className="text-xs text-fg-subtle">Lot / stock numbers and VINs are carried through when present · up to {BULK_LIMIT} vehicles</span>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </div>

      {error ? <p className="text-sm text-accent-rust">{error}</p> : null}

      {parsed ? (
        <div className="flex flex-col gap-3 rounded-brand-md border border-line/10 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-fg">
              <span className="font-medium">{fileName}</span>
              <span className="text-fg-muted"> · {count} vehicle{count === 1 ? "" : "s"} ready</span>
              {parsed.skipped.length ? <span className="text-fg-subtle"> · {parsed.skipped.length} row{parsed.skipped.length === 1 ? "" : "s"} skipped</span> : null}
            </div>
            <Button variant="accent" size="md" disabled={busy || count === 0 || overLimit} onClick={() => onReady(parsed, fileName)}>
              {busy ? "Valuing…" : `Value ${count} vehicle${count === 1 ? "" : "s"}`}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(Object.entries(parsed.headerMap.fields) as Array<[string, string]>).map(([field, header]) => (
              <Badge key={field} tone="success">{field} ← {header}</Badge>
            ))}
            {parsed.headerMap.unmapped.slice(0, 6).map((h) => <Badge key={h} tone="neutral">{h}</Badge>)}
            {parsed.headerMap.unmapped.length > 6 ? <Badge tone="neutral">+{parsed.headerMap.unmapped.length - 6} more</Badge> : null}
          </div>
          {overLimit ? <p className="text-xs text-accent-rust">Split the file: at most {BULK_LIMIT} vehicles per upload.</p> : null}
          {parsed.skipped.length ? (
            <details className="text-xs text-fg-subtle">
              <summary className="cursor-pointer">Skipped rows</summary>
              <ul className="mt-1 list-inside list-disc">
                {parsed.skipped.slice(0, 20).map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
