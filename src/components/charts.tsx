"use client";

// ─── Chart components (Recharts 3) ──────────────────────────────────────────

import React from "react";
import {
  Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, ComposedChart,
  Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";

const GRID = "var(--chart-grid)";
const AXIS = { stroke: "transparent", tickLine: false as const };

export const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// Shared tooltip
export function ChartTip({
  active, payload, label, unit = " s/d", labelFormatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; stroke?: string; fill?: string }[];
  label?: string | number;
  unit?: string;
  labelFormatter?: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-muted">
        {labelFormatter ? labelFormatter(label!) : String(label)}
      </p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color ?? p.stroke ?? p.fill }}
          />
          <span className="text-muted">{p.name}:</span>
          <span className="font-semibold tabular-nums">
            {typeof p.value === "number"
              ? `${p.value > 0 ? "+" : ""}${p.value.toFixed(1)}${unit}`
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export interface SeriesPoint {
  date: string;
  [k: string]: number | string | null;
}

/** Daily rate line with optional rolling average overlay + brush zoom. */
export function RateChart({
  data, color, showRolling = true, height = 260, coscBand = false, zoom = true,
}: {
  data: SeriesPoint[];
  color: string;
  showRolling?: boolean;
  height?: number;
  coscBand?: boolean;
  zoom?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDay} {...AXIS} minTickGap={40} />
        <YAxis {...AXIS} width={46} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}`} />
        {coscBand && (
          <ReferenceArea y1={-4} y2={6} fill="var(--positive)" fillOpacity={0.06} />
        )}
        <ReferenceLine y={0} stroke="var(--faint)" strokeDasharray="4 4" />
        <Tooltip content={<ChartTip labelFormatter={(l) => fmtDay(String(l))} />} />
        <Line
          name="Daily rate" type="monotone" dataKey="spd" stroke={color}
          strokeWidth={1.5} dot={false} strokeOpacity={0.55} isAnimationActive={false}
        />
        {showRolling && (
          <Line
            name="7-day avg" type="monotone" dataKey="rolling7" stroke={color}
            strokeWidth={2.5} dot={false} isAnimationActive={false}
          />
        )}
        {zoom && data.length > 20 && (
          <Brush
            dataKey="date" height={22} travellerWidth={8} tickFormatter={fmtDay}
            stroke="var(--faint)" fill="var(--surface-2)"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Cumulative offset history area chart. */
export function OffsetChart({
  data, color, height = 240, zoom = true,
}: {
  data: SeriesPoint[];
  color: string;
  height?: number;
  zoom?: boolean;
}) {
  const id = React.useId();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDay} {...AXIS} minTickGap={40} />
        <YAxis {...AXIS} width={46} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}s`} />
        <ReferenceLine y={0} stroke="var(--faint)" strokeDasharray="4 4" />
        <Tooltip content={<ChartTip unit="s" labelFormatter={(l) => fmtDay(String(l))} />} />
        <Area
          name="Offset" type="monotone" dataKey="offset" stroke={color}
          strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false}
        />
        {zoom && data.length > 20 && (
          <Brush dataKey="date" height={22} travellerWidth={8} tickFormatter={fmtDay}
            stroke="var(--faint)" fill="var(--surface-2)" />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Weekly / monthly aggregate bars. */
export function PeriodBars({
  data, color, dataKey = "avgSpd", name = "Avg s/d", height = 220, unit = " s/d",
}: {
  data: { label: string }[];
  color: string;
  dataKey?: string;
  name?: string;
  height?: number;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} minTickGap={30} />
        <YAxis {...AXIS} width={46} />
        <ReferenceLine y={0} stroke="var(--faint)" />
        <Tooltip content={<ChartTip unit={unit} />} cursor={{ fill: "var(--chart-grid)" }} />
        <Bar name={name} dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d, i) => (
            <Cell key={i} fill={color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Prediction curve: history + forecast with confidence band. */
export function PredictionChart({
  history, forecast, color, height = 260,
}: {
  history: { date: string; offset: number }[];
  forecast: { date: string; predicted: number; lo: number; hi: number }[];
  color: string;
  height?: number;
}) {
  const id = React.useId();
  const merged: Record<string, number | string | null>[] = [
    ...history.map((h) => ({ ...h, predicted: null, lo: null, hi: null })),
    ...forecast.map((f) => ({ ...f, offset: null, band: f.hi - f.lo })),
  ];
  // band area needs baseline stacking: draw lo (transparent) + band
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDay} {...AXIS} minTickGap={40} />
        <YAxis {...AXIS} width={46} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}s`} />
        <ReferenceLine y={0} stroke="var(--faint)" strokeDasharray="4 4" />
        <Tooltip content={<ChartTip unit="s" labelFormatter={(l) => fmtDay(String(l))} />} />
        <Area name="Range low" type="monotone" dataKey="lo" stroke="none" fill="none" stackId="band" legendType="none" tooltipType="none" isAnimationActive={false} />
        <Area name="Confidence" type="monotone" dataKey="band" stroke="none" fill={`url(#${id})`} stackId="band" legendType="none" tooltipType="none" isAnimationActive={false} />
        <Line name="Measured" type="monotone" dataKey="offset" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line name="Predicted" type="monotone" dataKey="predicted" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Multi-watch comparison of rolling rate. */
export function CompareChart({
  data, series, height = 300, unit = " s/d", xFormatter = fmtDay,
}: {
  data: SeriesPoint[];
  series: { key: string; name: string; color: string }[];
  height?: number;
  unit?: string;
  /** x-axis label formatter; defaults to date formatting */
  xFormatter?: (v: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={xFormatter} {...AXIS} minTickGap={40} />
        <YAxis {...AXIS} width={46} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}`} />
        <ReferenceLine y={0} stroke="var(--faint)" strokeDasharray="4 4" />
        <Tooltip content={<ChartTip unit={unit} labelFormatter={(l) => xFormatter(String(l))} />} />
        {series.map((s) => (
          <Line
            key={s.key} name={s.name} dataKey={s.key} type="monotone"
            stroke={s.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false}
          />
        ))}
        {data.length > 20 && (
          <Brush dataKey="date" height={22} travellerWidth={8} tickFormatter={xFormatter}
            stroke="var(--faint)" fill="var(--surface-2)" />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Wear-frequency dot strip by weekday. */
export function WearFrequencyChart({
  data, color, height = 200,
}: {
  data: { weekday: string; count: number }[];
  color: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="weekday" {...AXIS} />
        <YAxis {...AXIS} width={40} allowDecimals={false} />
        <Tooltip content={<ChartTip unit=" days" />} cursor={{ fill: "var(--chart-grid)" }} />
        <Bar name="Worn" dataKey="count" fill={color} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Accuracy heatmap — calendar-style grid of daily rate. */
export function AccuracyHeatmap({
  samples, weeks = 20,
}: {
  samples: { date: string; spd: number }[];
  weeks?: number;
}) {
  const DAY = 86_400_000;
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byDay = new Map<string, number>();
  for (const s of samples) byDay.set(new Date(s.date).toDateString(), s.spd);
  // grid columns = weeks, rows = weekday (Mon first)
  const endDow = (end.getDay() + 6) % 7;
  const cells: { date: Date; spd: number | undefined }[][] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const col: { date: Date; spd: number | undefined }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(+end - (endDow - d) * DAY - w * 7 * DAY);
      col.push({ date, spd: byDay.get(date.toDateString()) });
    }
    cells.push(col);
  }
  const colorFor = (spd: number | undefined) => {
    if (spd === undefined) return "var(--surface-2)";
    const a = Math.abs(spd);
    if (a <= 2) return "var(--positive)";
    if (a <= 6) return "color-mix(in oklab, var(--positive) 55%, var(--warning))";
    if (a <= 12) return "var(--warning)";
    return "var(--critical)";
  };
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {cells.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((c, j) => (
              <div
                key={j}
                title={`${c.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${c.spd !== undefined ? ` · ${c.spd > 0 ? "+" : ""}${c.spd.toFixed(1)} s/d` : " · no data"}`}
                className="h-3.5 w-3.5 rounded-[3px]"
                style={{
                  background: colorFor(c.spd),
                  opacity: c.spd === undefined ? 0.5 : 0.9,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "var(--positive)" }} /> ≤2 s/d</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "color-mix(in oklab, var(--positive) 55%, var(--warning))" }} /> ≤6</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "var(--warning)" }} /> ≤12</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "var(--critical)" }} /> &gt;12</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[2px] bg-surface-2" /> no data</span>
      </div>
    </div>
  );
}

/** Temperature vs rate scatter. */
export function TempScatter({
  data, color, height = 240,
}: {
  data: { temperatureC: number; spd: number }[];
  color: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="temperatureC" name="Temp" type="number" unit="°C" domain={["auto", "auto"]} {...AXIS} />
        <YAxis dataKey="spd" name="Rate" type="number" {...AXIS} width={46}
          tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}`} />
        <ZAxis range={[40, 40]} />
        <Tooltip content={<ChartTip />} cursor={{ strokeDasharray: "4 4" }} />
        <Scatter name="Measurements" data={data} fill={color} fillOpacity={0.7} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
