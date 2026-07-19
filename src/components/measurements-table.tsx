"use client";

// ─── Measurements data table (TanStack Table) ───────────────────────────────

import React, { useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react";
import type { Measurement, Watch } from "@/lib/types";
import { useStore } from "@/lib/store";
import { rateSamples } from "@/lib/stats";
import { fmtDateTime } from "@/lib/utils";
import { Badge, Button, Card } from "./ui";

type Row = Measurement & { spd: number | null };

function downloadFile(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMeasurementsCsv(watch: Watch, ms: Measurement[]) {
  const samples = rateSamples(ms);
  const spdByDate = new Map(samples.map((s) => [s.date, s.spd]));
  const header = "date,reference_time,watch_time,offset_s,rate_spd,temperature_c,position,power_reserve_pct,worn,notes";
  const rows = ms.map((m) =>
    [
      m.measuredAt, m.referenceTime, m.watchTime, m.offsetSeconds,
      spdByDate.get(m.measuredAt)?.toFixed(2) ?? "",
      m.temperatureC ?? "", m.position ?? "", m.powerReservePct ?? "",
      m.wornToday ? 1 : 0,
      m.notes ? `"${m.notes.replace(/"/g, '""')}"` : "",
    ].join(",")
  );
  downloadFile(
    `${watch.brand}-${watch.model}-measurements.csv`.replace(/\s+/g, "_"),
    "text/csv",
    [header, ...rows].join("\n")
  );
}

export function MeasurementsTable({
  watch, measurements,
}: {
  watch: Watch;
  measurements: Measurement[];
}) {
  const { deleteMeasurement } = useStore();
  const [sorting, setSorting] = useState<SortingState>([{ id: "measuredAt", desc: true }]);

  const rows = useMemo<Row[]>(() => {
    const samples = rateSamples(measurements);
    const spdByDate = new Map(samples.map((s) => [s.date, s.spd]));
    return measurements.map((m) => ({ ...m, spd: spdByDate.get(m.measuredAt) ?? null }));
  }, [measurements]);

  const col = createColumnHelper<Row>();
  const columns = useMemo(
    () => [
      col.accessor("measuredAt", {
        header: "Date",
        cell: (c) => <span className="whitespace-nowrap">{fmtDateTime(c.getValue())}</span>,
      }),
      col.accessor("referenceTime", {
        header: "Reference",
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      col.accessor("watchTime", {
        header: "Watch",
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      col.accessor("offsetSeconds", {
        header: "Offset",
        cell: (c) => {
          const v = c.getValue();
          return (
            <span className="font-semibold tabular-nums">
              {v > 0 ? "+" : ""}{v.toFixed(1)}s
            </span>
          );
        },
      }),
      col.accessor("spd", {
        header: "Rate",
        cell: (c) => {
          const v = c.getValue();
          if (v == null) return <span className="text-faint">—</span>;
          const color = Math.abs(v) <= 5 ? "var(--positive)" : Math.abs(v) <= 12 ? "var(--warning)" : "var(--critical)";
          return (
            <span className="tabular-nums" style={{ color }}>
              {v > 0 ? "+" : ""}{v.toFixed(1)} s/d
            </span>
          );
        },
      }),
      col.accessor("position", {
        header: "Position",
        cell: (c) => c.getValue() ? <Badge color="var(--faint)">{c.getValue()!.replace("-", " ")}</Badge> : null,
      }),
      col.accessor("temperatureC", {
        header: "Temp",
        cell: (c) => (c.getValue() != null ? `${c.getValue()}°C` : "—"),
      }),
      col.accessor("powerReservePct", {
        header: "Reserve",
        cell: (c) => (c.getValue() != null ? `${c.getValue()}%` : "—"),
      }),
      col.accessor("wornToday", {
        header: "Worn",
        cell: (c) => (c.getValue() ? "✓" : ""),
      }),
      col.display({
        id: "actions",
        cell: (c) => (
          <button
            onClick={() => deleteMeasurement(c.row.original.id)}
            className="cursor-pointer rounded p-1 text-faint hover:text-critical"
            title="Delete measurement"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleteMeasurement]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border-token px-4 py-3">
        <p className="text-sm font-semibold">{rows.length} measurements</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => exportMeasurementsCsv(watch, measurements)}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() =>
            downloadFile(
              `${watch.brand}-${watch.model}-measurements.json`.replace(/\s+/g, "_"),
              "application/json",
              JSON.stringify(measurements, null, 2)
            )
          }>
            <Download className="h-3.5 w-3.5" /> JSON
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border-token text-left">
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-2.5 text-xs font-semibold text-muted">
                    {h.isPlaceholder ? null : (
                      <button
                        className="flex cursor-pointer items-center gap-1 hover:text-foreground"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanSort() && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-b border-border-token/50 hover:bg-surface-2/50">
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="px-4 py-2.5">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs text-muted">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
