"use client";

// ─── Service module: all records + upcoming estimates ───────────────────────

import React, { useMemo } from "react";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import { useStore } from "@/lib/store";
import { nextServiceEstimate, daysSince, lastServiceDate } from "@/lib/grades";
import { ServiceDialog } from "@/components/forms";
import { SectionTitle, StatCard } from "@/components/widgets";
import { Badge, Button, Card, Empty, Skeleton } from "@/components/ui";
import { fmtDate, fmtMoney } from "@/lib/utils";

export default function ServicesPage() {
  const { ready, watches, services, servicesFor, deleteService } = useStore();
  const active = watches.filter((w) => !w.archived);

  const upcoming = useMemo(
    () =>
      active
        .map((w) => ({
          watch: w,
          next: nextServiceEstimate(w, servicesFor(w.id)),
          sinceDays: daysSince(lastServiceDate(servicesFor(w.id)) ?? w.purchaseDate ?? null),
        }))
        .filter((x) => x.next)
        .sort((a, b) => a.next!.localeCompare(b.next!)),
    [active, servicesFor]
  );

  if (!ready) return <Skeleton className="h-96" />;

  const totalSpent = services.reduce((a, s) => a + s.cost, 0);
  const sorted = [...services].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="fade-up">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Service</h1>
        <ServiceDialog trigger={<Button><Plus className="h-4 w-4" /> Log service</Button>} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Records" value={services.length} />
        <StatCard label="Total spent" value={fmtMoney(totalSpent)} delay={0.05} />
        <StatCard label="Watches tracked" value={active.length} delay={0.1} />
        <StatCard label="Due within 90 days"
          value={upcoming.filter((u) => +new Date(u.next!) - Date.now() < 90 * 86_400_000).length}
          delay={0.15} />
      </div>

      <SectionTitle>Upcoming service estimates</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {upcoming.map(({ watch: w, next, sinceDays }) => {
          const overdue = +new Date(next!) < Date.now();
          const soon = +new Date(next!) - Date.now() < 90 * 86_400_000;
          return (
            <Card key={w.id} className="p-4">
              <div className="flex items-center justify-between">
                <Link href={`/watches/${w.id}`} className="text-sm font-semibold hover:text-accent">
                  {w.brand} {w.model}
                </Link>
                <Badge color={overdue ? "var(--critical)" : soon ? "var(--warning)" : "var(--positive)"}>
                  {overdue ? "Overdue" : soon ? "Due soon" : "OK"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted">
                Estimated next service <span className="font-semibold text-foreground">{fmtDate(next)}</span>
              </p>
              {sinceDays != null && (
                <p className="text-xs text-muted">{sinceDays} days since last major service / purchase</p>
              )}
            </Card>
          );
        })}
      </div>

      <SectionTitle>History</SectionTitle>
      {sorted.length === 0 ? (
        <Empty icon={<Wrench className="h-8 w-8" />} title="No service records yet" />
      ) : (
        <div className="space-y-3">
          {sorted.map((s) => {
            const w = watches.find((x) => x.id === s.watchId);
            return (
              <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize">
                    {s.type.replace("-", " ")}
                    {w && <span className="ml-2 font-normal text-muted">· {w.brand} {w.model}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {fmtDate(s.date)} · {s.watchmaker} · {fmtMoney(s.cost, s.currency)}
                  </p>
                  {s.notes && <p className="mt-1 text-xs">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {s.partsReplaced?.map((p) => <Badge key={p} color="var(--faint)">{p}</Badge>)}
                  <Button variant="ghost" size="sm" onClick={() => deleteService(s.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
