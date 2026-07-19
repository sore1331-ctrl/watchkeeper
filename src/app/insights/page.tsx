"use client";

// ─── Smart insights feed ────────────────────────────────────────────────────

import React, { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, OctagonAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Empty, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

const SEV = {
  positive: { icon: CheckCircle2, color: "var(--positive)", label: "Positive" },
  neutral: { icon: Info, color: "var(--info)", label: "Observation" },
  warning: { icon: AlertTriangle, color: "var(--warning)", label: "Warning" },
  critical: { icon: OctagonAlert, color: "var(--critical)", label: "Critical" },
} as const;

export default function InsightsPage() {
  const { ready, insights, watches } = useStore();
  const [filter, setFilter] = useState<string>("all");

  if (!ready) return <Skeleton className="h-96" />;

  const filtered = insights.filter(
    (i) => filter === "all" || i.watchId === filter
  );
  const order = { critical: 0, warning: 1, neutral: 2, positive: 3 };
  const sorted = [...filtered].sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <div className="fade-up">
      <div className="mb-1 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-accent" />
        <h1 className="text-2xl font-bold tracking-tight">Smart insights</h1>
      </div>
      <p className="mb-5 text-sm text-muted">
        Automatic analysis of stability, drift, positions, wear patterns and service needs.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium",
            filter === "all"
              ? "border-transparent bg-accent/15 text-accent"
              : "border-border-token text-muted hover:text-foreground"
          )}
        >
          All watches
        </button>
        {watches.filter((w) => !w.archived).map((w) => (
          <button
            key={w.id}
            onClick={() => setFilter(w.id)}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium",
              filter === w.id ? "border-transparent" : "border-border-token text-muted hover:text-foreground"
            )}
            style={filter === w.id ? {
              background: `color-mix(in oklab, ${w.accentColor} 15%, transparent)`,
              color: w.accentColor,
            } : undefined}
          >
            {w.brand} {w.model}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <Empty icon={<Lightbulb className="h-8 w-8" />} title="No insights yet">
          Add more measurements to unlock automatic analysis.
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sorted.map((ins) => {
            const s = SEV[ins.severity];
            const w = watches.find((x) => x.id === ins.watchId);
            const Icon = s.icon;
            return (
              <Card key={ins.id} className="relative overflow-hidden p-4">
                <span className="absolute inset-y-0 left-0 w-0.5" style={{ background: s.color }} />
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" style={{ color: s.color }} />
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed">{ins.text}</p>
                    {ins.detail && <p className="mt-1 text-xs text-muted">{ins.detail}</p>}
                    {w && (
                      <Link href={`/watches/${w.id}`}
                        className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
                        View {w.model} →
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
