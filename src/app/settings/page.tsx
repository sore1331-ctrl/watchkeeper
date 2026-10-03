"use client";

// ─── Settings ───────────────────────────────────────────────────────────────

import React from "react";
import Link from "next/link";
import { Cloud, Database, RefreshCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Card, Input, Label, Select, Skeleton } from "@/components/ui";
import { SectionTitle } from "@/components/widgets";
import { getSupabase } from "@/lib/supabase/client";
import { CURRENCIES } from "@/lib/utils";
import type { RestingHandling } from "@/lib/types";

export default function SettingsPage() {
  const { ready, settings, updateSettings, resetDemoData, demo, cloudSynced } = useStore();
  if (!ready) return <Skeleton className="h-96" />;

  const supabaseConfigured = !!getSupabase();

  return (
    <div className="fade-up max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>

      <Card className="space-y-4 p-5">
        <div>
          <Label>Currency</Label>
          <Select
            value={settings.currency}
            onChange={(e) => updateSettings({ currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </Select>
          <p className="mt-1 text-[11px] text-faint">
            Used for new watches and collection totals. Changing it re-labels watches
            that use your current currency — amounts are never converted, so the figures
            you entered stay exactly as you typed them. A watch can also be set to its
            own currency in its profile.
          </p>
        </div>
        <div>
          <Label>Overnight / resting readings</Label>
          <Select
            value={settings.restingReadings}
            onChange={(e) =>
              updateSettings({ restingReadings: e.target.value as RestingHandling })
            }
          >
            <option value="separate">Keep separate from the headline rate (recommended)</option>
            <option value="include">Count them the same as worn time</option>
            <option value="exclude">Ignore them entirely</option>
          </Select>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            An interval where the watch sat on the nightstand measures one position at
            room temperature; worn, it measures a mix of positions at body heat. Those
            answer different questions, so averaging them together serves neither.
            Separating them means your average rate, grade and health describe the watch
            in use, while resting readings still appear in the charts and in the
            rate-by-position breakdown, where they are most useful. If you mostly
            measure overnight, everything is counted anyway — there has to be enough
            worn data to leave any out.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Measurement reminder (days)</Label>
            <Input
              type="number" min={1} max={30}
              value={settings.measurementReminderDays}
              onChange={(e) => updateSettings({ measurementReminderDays: +e.target.value || 3 })}
            />
          </div>
        </div>
        <div>
          <Label>Service interval for mechanical watches (years)</Label>
          <Input
            type="number" min={2} max={15}
            value={settings.serviceIntervalYears}
            onChange={(e) =>
              updateSettings({
                serviceIntervalYears: Math.max(2, Math.min(15, +e.target.value || 5)),
              })
            }
          />
          <p className="mt-1 text-[11px] text-faint">
            Used everywhere a service date is estimated: the health score, the next-service
            date and the reminders. Quartz watches use 8 years.
          </p>
        </div>
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-3 text-sm">
          <Database className="h-4 w-4 text-muted" />
          <div>
            <p className="font-medium">Privacy-first local mode</p>
            <p className="text-xs text-muted">
              All data lives in this browser (localStorage). {demo ? "Currently showing demo data." : "Tracking your own data."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Cloud className="h-4 w-4 text-muted" />
          <div>
            <p className="font-medium">Cloud sync (Supabase)</p>
            <p className="text-xs text-muted">
              {supabaseConfigured
                ? cloudSynced
                  ? "Signed in — your watches sync across devices."
                  : "Create an account to use WatchKeeper on your phone and other browsers."
                : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable optional cloud sync."}
            </p>
            {supabaseConfigured && (
              <Link href="/account" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
                {cloudSynced ? "Manage account →" : "Set up an account →"}
              </Link>
            )}
          </div>
        </div>
        <div className="border-t border-border-token pt-4">
          <Button variant="destructive" size="sm" onClick={() => {
            if (window.confirm("Reset all local data back to the demo dataset?")) resetDemoData();
          }}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset to demo data
          </Button>
        </div>
      </Card>
    </div>
  );
}
