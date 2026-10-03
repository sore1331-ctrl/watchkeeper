"use client";

// ─── Wishlist: watches not owned yet ────────────────────────────────────────

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Check, ExternalLink, Heart, Pencil, Plus, Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { WishlistItem, WishlistStatus } from "@/lib/types";
import { specForCaliber, findCatalogModel } from "@/lib/watch-catalog";
import { fmtDate, fmtMoney, fmtTotal, safeHttpUrl } from "@/lib/utils";
import { WishlistDialog } from "@/components/forms";
import { SectionTitle, StatCard } from "@/components/widgets";
import { Badge, Button, Card, Empty, Skeleton } from "@/components/ui";

const STATUS_META: Record<WishlistStatus, { label: string; color: string }> = {
  wanted: { label: "Wanted", color: "var(--info)" },
  watching: { label: "Watching", color: "var(--accent)" },
  reserved: { label: "Reserved", color: "var(--warning)" },
  acquired: { label: "Acquired", color: "var(--positive)" },
  passed: { label: "Passed", color: "var(--faint)" },
};

const PRIORITY_META = {
  high: { label: "High", color: "var(--critical)", rank: 0 },
  medium: { label: "Medium", color: "var(--warning)", rank: 1 },
  low: { label: "Low", color: "var(--faint)", rank: 2 },
} as const;

export default function WishlistPage() {
  const {
    ready, wishlist, watches, settings,
    deleteWishlistItem, moveWishlistToCollection,
  } = useStore();

  const [editing, setEditing] = useState<WishlistItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const { open, closed, totals } = useMemo(() => {
    const openItems = wishlist
      .filter((w) => w.status !== "acquired" && w.status !== "passed")
      .sort(
        (a, b) =>
          PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank ||
          a.addedAt.localeCompare(b.addedAt)
      );
    return {
      open: openItems,
      closed: wishlist
        .filter((w) => w.status === "acquired" || w.status === "passed")
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
      totals: fmtTotal(
        openItems.map((w) => ({ amount: w.targetPrice, currency: w.currency })),
        settings.currency
      ),
    };
  }, [wishlist, settings.currency]);

  if (!ready) return <Skeleton className="h-96" />;

  const acquire = (item: WishlistItem) => {
    const created = moveWishlistToCollection(item.id);
    if (created) setJustAdded(created.id);
  };

  const renderCard = (item: WishlistItem, muted = false) => {
    const known = findCatalogModel(item.brand, item.model);
    const spec = specForCaliber(item.caliber ?? known?.caliber, known?.cosc, item.brand);
    const status = STATUS_META[item.status];
    const linkedWatch = item.acquiredWatchId
      ? watches.find((w) => w.id === item.acquiredWatchId)
      : undefined;

    return (
      <Card key={item.id} className={`p-5 ${muted ? "opacity-70" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">
              {item.brand} <span className="text-muted">{item.model}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {[item.reference, item.caliber ?? known?.caliber, item.movementType]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge color={status.color}>{status.label}</Badge>
            {item.status !== "acquired" && item.status !== "passed" && (
              <Badge color={PRIORITY_META[item.priority].color}>
                {PRIORITY_META[item.priority].label} priority
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Target</p>
            <p className="text-lg font-bold tabular-nums">
              {fmtMoney(item.targetPrice, item.currency)}
            </p>
          </div>
          {spec && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted">Expected rate</p>
              <p className="text-sm font-semibold tabular-nums">
                {spec.min > 0 ? "+" : ""}{spec.min} / {spec.max > 0 ? "+" : ""}{spec.max} s/d
              </p>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Added</p>
            <p className="text-sm">{fmtDate(item.addedAt)}</p>
          </div>
        </div>

        {item.notes && <p className="mt-3 text-xs text-muted">{item.notes}</p>}

        {linkedWatch && (
          <Link
            href={`/watches/${linkedWatch.id}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            In your collection <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-token pt-3">
          {item.status !== "acquired" && (
            <Button size="sm" onClick={() => acquire(item)}>
              <Check className="h-3.5 w-3.5" /> I bought it
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setEditing(item)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          {safeHttpUrl(item.url) && (
            <a href={safeHttpUrl(item.url)!} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3.5 w-3.5" /> Listing
              </Button>
            </a>
          )}
          <Button
            variant={confirmDelete === item.id ? "destructive" : "ghost"}
            size="sm"
            onClick={() =>
              confirmDelete === item.id
                ? deleteWishlistItem(item.id)
                : setConfirmDelete(item.id)
            }
            onBlur={() => setConfirmDelete(null)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmDelete === item.id ? "Confirm" : ""}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="fade-up">
      {/* one dialog shared by every card */}
      <WishlistDialog
        existing={editing}
        trigger={null}
        open={editing !== null}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Heart className="h-5 w-5 text-accent" /> Wishlist
          </h1>
          <p className="mt-1 text-sm text-muted">
            Watches you don&apos;t own yet. Kept out of your accuracy analytics until you buy one.
          </p>
        </div>
        <WishlistDialog />
      </div>

      {justAdded && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-positive/30 p-4">
          <p className="text-xs">
            Added to your collection with its specs filled in — log a first measurement
            whenever you&apos;re ready.
          </p>
          <Link href={`/watches/${justAdded}`}>
            <Button size="sm" variant="secondary">
              Open watch <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="On the list" value={open.length} />
        <StatCard label="Target spend" value={totals}
          className="[&>p:nth-child(2)]:text-xl" delay={0.05} />
        <StatCard label="High priority"
          value={open.filter((w) => w.priority === "high").length} delay={0.1} />
        <StatCard label="Acquired"
          value={wishlist.filter((w) => w.status === "acquired").length} delay={0.15} />
      </div>

      <SectionTitle>Wanted</SectionTitle>
      {open.length === 0 ? (
        <Empty icon={<Heart className="h-8 w-8" />} title="Nothing on the wishlist yet">
          Add a watch you&apos;re saving for — WatchKeeper will show what accuracy to expect
          from its movement before you buy.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{open.map((i) => renderCard(i))}</div>
      )}

      {closed.length > 0 && (
        <>
          <SectionTitle>Bought &amp; passed</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {closed.map((i) => renderCard(i, true))}
          </div>
        </>
      )}
    </div>
  );
}
