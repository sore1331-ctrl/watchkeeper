"use client";

// ─── Settings ───────────────────────────────────────────────────────────────

import React from "react";
import { Cloud, Database, RefreshCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Card, Input, Label, Select, Skeleton } from "@/components/ui";
import { SectionTitle } from "@/components/widgets";
import { getSupabase } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { ready, settings, updateSettings, resetDemoData, demo, cloudSynced } = useStore();
  if (!ready) return <Skeleton className="h-96" />;

  const supabaseConfigured = !!getSupabase();

  return (
    <div className="fade-up max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>

      <Card className="space-y-4 p-5">
        <div>
          <Label>Display name</Label>
          <Input
            value={settings.displayName}
            onChange={(e) => updateSettings({ displayName: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Temperature unit</Label>
            <Select
              value={settings.temperatureUnit}
              onChange={(e) => updateSettings({ temperatureUnit: e.target.value as "C" | "F" })}
            >
              <option value="C">Celsius</option>
              <option value="F">Fahrenheit</option>
            </Select>
          </div>
          <div>
            <Label>Measurement reminder (days)</Label>
            <Input
              type="number" min={1} max={30}
              value={settings.measurementReminderDays}
              onChange={(e) => updateSettings({ measurementReminderDays: +e.target.value || 3 })}
            />
          </div>
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
                  ? "Connected and mirroring changes to your Supabase project."
                  : "Supabase is configured — sign in to enable sync."
                : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable optional cloud sync."}
            </p>
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
