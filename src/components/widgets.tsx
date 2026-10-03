"use client";

// ─── KPI cards, health ring, grade badges ───────────────────────────────────

import React from "react";
import { motion } from "framer-motion";
import { Hourglass, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Card, InfoTip } from "./ui";
import {
  GRADE_COLORS, HEALTH_COLORS, MIN_MEASUREMENTS_FOR_GRADE,
  gradeExplanation, healthExplanation, type RateSpec,
} from "@/lib/grades";
import type { AccuracyGrade, HealthLabel, MovementType } from "@/lib/types";
import type { ConditionAnalysis } from "@/lib/stats";

export function StatCard({
  label, value, sub, trend, delay = 0, accent, className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  delay?: number;
  accent?: string;
  className?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className={cn("card relative overflow-hidden p-4", className)}
    >
      {accent && (
        <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
      )}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {(sub || trend) && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          {trend && <TrendIcon className="h-3.5 w-3.5" />}
          {sub}
        </p>
      )}
    </motion.div>
  );
}

export function HealthRing({
  score, label, size = 120,
}: {
  score: number;
  label: HealthLabel;
  size?: number;
}) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const color = HEALTH_COLORS[label];
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={9} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{score}</span>
        <span className="text-[10px] font-medium text-muted">/ 100</span>
      </div>
    </div>
  );
}

/**
 * Shown in place of a grade/health verdict until enough measurements exist.
 * `count` is the number of measurements recorded so far.
 */
export function PendingBadge({ count, explain = true }: { count: number; explain?: boolean }) {
  const badge = (
    <Badge color="var(--faint)">
      <Hourglass className="h-3 w-3" />
      {count}/{MIN_MEASUREMENTS_FOR_GRADE} measurements
    </Badge>
  );
  if (!explain) return badge;
  return (
    <InfoTip
      content={
        <>
          <p className="font-semibold">Not enough data yet</p>
          <p className="mt-1 text-muted">
            A rate needs at least {MIN_MEASUREMENTS_FOR_GRADE} measurements to mean anything — with
            fewer, a single early or late reading can swing the average by tens of seconds per day.
            {count > 0 && ` ${MIN_MEASUREMENTS_FOR_GRADE - count} to go.`}
          </p>
        </>
      }
    >
      {badge}
    </InfoTip>
  );
}

export function GradeBadge({
  grade, movement = "automatic", count, explain = true, spec, avgSpd, note,
}: {
  grade: AccuracyGrade | null;
  /** why there is no grade although there are enough readings */
  note?: string | null;
  movement?: MovementType;
  /** measurements recorded; enables the "collecting data" state */
  count?: number;
  explain?: boolean;
  /** manufacturer tolerance the grade was judged against */
  spec?: RateSpec | null;
  avgSpd?: number | null;
}) {
  if (!grade) {
    if (count != null && count < MIN_MEASUREMENTS_FOR_GRADE)
      return <PendingBadge count={count} explain={explain} />;
    if (note) {
      const unresolved = <Badge color="var(--muted)">Too fine to grade</Badge>;
      return explain ? (
        <InfoTip content={<p className="text-muted">{note}</p>}>{unresolved}</InfoTip>
      ) : unresolved;
    }
    return <Badge color="var(--faint)">No data</Badge>;
  }
  const badge = <Badge color={GRADE_COLORS[grade]}>{grade}</Badge>;
  if (!explain) return badge;
  return (
    <InfoTip
      content={
        <>
          <p className="font-semibold" style={{ color: GRADE_COLORS[grade] }}>
            {grade === "COSC" ? "COSC — chronometer spec" : `${grade} accuracy`}
          </p>
          <p className="mt-1 text-muted">{gradeExplanation(grade, movement, spec, avgSpd)}</p>
        </>
      }
    >
      {badge}
    </InfoTip>
  );
}

export function HealthBadge({
  label, count, explain = true, reason,
}: {
  label: HealthLabel | null;
  count?: number;
  explain?: boolean;
  /** the specific finding behind this verdict, preferred over the generic text */
  reason?: string;
}) {
  if (!label) {
    if (count != null && count < MIN_MEASUREMENTS_FOR_GRADE)
      return <PendingBadge count={count} explain={explain} />;
    return <Badge color="var(--faint)">No data</Badge>;
  }
  const badge = <Badge color={HEALTH_COLORS[label]}>{label}</Badge>;
  if (!explain) return badge;
  return (
    <InfoTip
      content={
        <>
          <p className="font-semibold" style={{ color: HEALTH_COLORS[label] }}>
            {label}
          </p>
          <p className="mt-1 text-muted">{reason ?? healthExplanation(label)}</p>
        </>
      }
    >
      {badge}
    </InfoTip>
  );
}

export function SectionTitle({
  children, action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between first:mt-0">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function ChartCard({
  title, sub, children, className,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4 md:p-5", className)}>
      <div className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      {children}
    </Card>
  );
}

/**
 * Rate per wearing condition. Makes the watch's positional behaviour visible
 * and explains why the spread between positions is not counted as instability.
 */
export function ConditionBreakdown({
  conditions, color, spec,
}: {
  conditions: ConditionAnalysis | null;
  color: string;
  spec?: { min: number; max: number; source: string } | null;
}) {
  if (!conditions || conditions.groups.length === 0)
    return (
      <p className="py-6 text-center text-xs text-muted">
        Record the position the watch rests in (or that you wore it) with each
        measurement to see how its rate changes by position.
      </p>
    );

  const shown = conditions.groups.filter((g) => g.n >= 2);
  if (!shown.length)
    return (
      <p className="py-6 text-center text-xs text-muted">
        Not enough repeats of any one position yet — a couple more measurements
        in the same position will unlock this.
      </p>
    );

  const lo = Math.min(...shown.map((g) => g.mean - g.sd));
  const hi = Math.max(...shown.map((g) => g.mean + g.sd));
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;

  return (
    <div className="space-y-3">
      {shown.map((g) => (
        <div key={g.key} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs text-muted">{g.label}</span>
          <div className="relative h-5 flex-1">
            {/* in-spec zone */}
            {spec && (
              <span
                className="absolute inset-y-1.5 rounded-sm bg-positive/10"
                style={{
                  left: `${Math.max(0, pos(spec.min))}%`,
                  width: `${Math.max(0, Math.min(100, pos(spec.max)) - Math.max(0, pos(spec.min)))}%`,
                }}
              />
            )}
            {/* ±1σ range within this position */}
            <span
              className="absolute top-2 h-1 rounded-full opacity-40"
              style={{
                background: color,
                left: `${pos(g.mean - g.sd)}%`,
                width: `${(2 * g.sd / span) * 100}%`,
              }}
            />
            {/* mean marker */}
            <span
              className="absolute top-0.5 h-4 w-1 -translate-x-1/2 rounded-full"
              style={{ background: color, left: `${pos(g.mean)}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">
            {g.mean > 0 ? "+" : ""}{g.mean.toFixed(1)}
          </span>
          <span className="w-8 shrink-0 text-right text-[10px] text-faint">n={g.n}</span>
        </div>
      ))}
      <p className="pt-1 text-xs text-muted">
        Spread between positions is{" "}
        <span className="font-semibold text-foreground">
          {conditions.betweenSpread.toFixed(1)} s/d
        </span>{" "}
        — normal mechanical behaviour, not instability, so it is excluded from the
        stability score. Within a single position the watch varies by ±
        {conditions.withinSd.toFixed(1)} s/d.
        {conditions.explained > 0.25 &&
          ` Position alone explains ${Math.round(conditions.explained * 100)}% of the total variance.`}
      </p>

      <details className="group rounded-lg border border-border-token bg-surface-2/40 p-3">
        <summary className="cursor-pointer list-none text-xs font-semibold text-muted hover:text-foreground">
          Why does position change the rate?
          <span className="ml-1 text-faint group-open:hidden">Show</span>
        </summary>
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-muted">
          <p>
            Gravity acts on the balance wheel, so a mechanical watch keeps a different
            rate in every orientation. Lying flat (dial up or dial down) the balance
            staff turns on the tip of its pivot against a flat cap jewel — very little
            friction, so amplitude is high and the watch usually runs faster. Stood on
            edge (any crown position) the pivot rests against the side of its jewel
            hole, friction rises, amplitude falls, and any tiny imbalance in the balance
            rim now works with or against gravity on every swing.
          </p>
          <p>
            A difference of several seconds a day between positions is entirely normal
            and is <span className="font-medium text-foreground">not</span> a fault.
            Minimising it is precisely the work described by &ldquo;adjusted in five
            positions&rdquo;: a chronometer has had that attention, a workhorse movement
            typically has not, so a wider spread is expected of it by design.
          </p>
          <p>
            This is also why resting a watch in a chosen position overnight is a real
            technique — parking a fast watch in whichever position runs slowest can
            cancel out much of the daily gain.
          </p>
          <p className="text-faint">
            WatchKeeper groups your readings by the position each interval was spent in,
            so this spread never counts against stability or triggers a warning. Only
            scatter <span className="font-medium">within</span> one position does.
          </p>
        </div>
      </details>
    </div>
  );
}

export function ScoreBar({
  name, score, weight, note,
}: {
  name: string;
  score: number;
  weight?: number;
  /** the measurement behind the number, so a low bar explains itself */
  note?: string;
}) {
  const color =
    score >= 75 ? "var(--positive)" : score >= 50 ? "var(--warning)" : "var(--critical)";
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-muted">
        {name}
        {note && <span className="block text-[10px] leading-tight text-faint">{note}</span>}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums">{Math.round(score)}</span>
      {weight != null && (
        <span className="w-10 shrink-0 text-right text-[10px] text-faint">×{weight.toFixed(2)}</span>
      )}
    </div>
  );
}
