"use client";

// ─── KPI cards, health ring, grade badges ───────────────────────────────────

import React from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Card } from "./ui";
import { GRADE_COLORS, HEALTH_COLORS } from "@/lib/grades";
import type { AccuracyGrade, HealthLabel } from "@/lib/types";

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

export function GradeBadge({ grade }: { grade: AccuracyGrade | null }) {
  if (!grade) return <Badge color="var(--faint)">No data</Badge>;
  return <Badge color={GRADE_COLORS[grade]}>{grade}</Badge>;
}

export function HealthBadge({ label }: { label: HealthLabel | null }) {
  if (!label) return <Badge color="var(--faint)">No data</Badge>;
  return <Badge color={HEALTH_COLORS[label]}>{label}</Badge>;
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

export function ScoreBar({
  name, score, weight,
}: {
  name: string;
  score: number;
  weight?: number;
}) {
  const color =
    score >= 75 ? "var(--positive)" : score >= 50 ? "var(--warning)" : "var(--critical)";
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-muted">{name}</span>
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
