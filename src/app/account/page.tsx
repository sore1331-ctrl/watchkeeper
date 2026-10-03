"use client";

// ─── Account: sign in / sign up, sync status, backup ────────────────────────

import React, { useRef, useState } from "react";
import {
  AlertTriangle, Check, Cloud, CloudOff, Download, LogOut, RefreshCw, ShieldCheck, Upload,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Card, Input, Label, Skeleton } from "@/components/ui";
import { SectionTitle } from "@/components/widgets";
import { relTime } from "@/lib/utils";

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountPage() {
  const {
    ready, supabaseConfigured, user, sync, signIn, signUp, signOut, syncNow,
    exportBackup, importBackup, watches, measurements, services, demo,
  } = useStore();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const [restoreNote, setRestoreNote] = useState<{ ok: boolean; text: string } | null>(null);

  if (!ready) return <Skeleton className="h-96" />;

  const restore = async (file: File) => {
    try {
      const n = importBackup(await file.text());
      setRestoreNote({
        ok: true,
        text: `Restored ${n.watches} watches, ${n.measurements} measurements, ${n.services} service records and ${n.wishlist} wishlist items. Nothing already on this device was removed.`,
      });
    } catch (err) {
      setRestoreNote({ ok: false, text: err instanceof Error ? err.message : "Could not read that file." });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "up") {
        const { needsConfirmation } = await signUp(email, password);
        setNotice(
          needsConfirmation
            ? `Account created. Check ${email} for a confirmation link, then sign in — your data stays on this device until you do.`
            : "Account created and signed in. Your data is uploading now."
        );
        if (needsConfirmation) setMode("in");
      } else {
        await signIn(email, password);
        setNotice("Signed in. Merging this device with your account…");
      }
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const backupNow = () =>
    download(
      `watchkeeper-backup-${new Date().toISOString().slice(0, 10)}.json`,
      exportBackup()
    );

  return (
    <div className="fade-up max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Account</h1>
      <p className="mb-6 text-sm text-muted">
        Sign in to use WatchKeeper on your phone and other browsers. Everything keeps
        working signed out — an account only adds sync.
      </p>

      {/* Always-available safety net */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
          <div className="text-xs">
            <p className="font-semibold">Your data on this device</p>
            <p className="text-muted">
              {watches.length} watches · {measurements.length} measurements ·{" "}
              {services.length} service records. A snapshot is saved automatically
              before any sync that changes what is on this device.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={backupNow}>
            <Download className="h-3.5 w-3.5" /> Download backup
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Restore
          </Button>
          <input
            ref={fileInput} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void restore(file);
            }}
          />
        </div>
        {restoreNote && (
          <p className={`w-full rounded-lg px-3 py-2 text-xs ${
            restoreNote.ok ? "bg-positive/10 text-positive" : "bg-critical/10 text-critical"
          }`}>
            {restoreNote.text}
          </p>
        )}
      </Card>

      {!supabaseConfigured ? (
        <Card className="flex items-start gap-3 p-4">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <p className="text-xs text-muted">
            Cloud sync isn&apos;t configured for this deployment. Set{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable accounts.
          </p>
        </Card>
      ) : user ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Cloud className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{user.email}</p>
                <p className="text-xs text-muted">
                  {sync.status === "syncing" && "Syncing…"}
                  {sync.status === "synced" &&
                    `Last synced ${sync.at ? relTime(sync.at) : "just now"}`}
                  {sync.status === "error" && (
                    <span className="text-critical">Sync failed: {sync.message}</span>
                  )}
                  {sync.status === "signed-out" && "Signed in — waiting to sync"}
                  {sync.status === "off" && "Cloud sync unavailable"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary" size="sm"
                onClick={() => void syncNow()}
                disabled={sync.status === "syncing"}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${sync.status === "syncing" ? "animate-spin" : ""}`} />
                Sync now
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
            </div>
          </div>

          {sync.status === "synced" && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-positive/10 px-3 py-2 text-xs text-positive">
              <Check className="h-3.5 w-3.5" />
              {demo
                ? "Signed in. This device is showing the sample collection, which is not uploaded — add a watch or a reading and your own data will sync."
                : "This device and your account hold the same data. Open the same address on your phone and sign in to see it there."}
            </p>
          )}
          {sync.status === "error" && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-critical/10 px-3 py-2 text-xs text-critical">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Nothing was changed on this device — your local data is intact. Try
              &ldquo;Sync now&rdquo; again, or download a backup first if you&apos;d rather be safe.
            </p>
          )}

          <p className="mt-4 text-xs text-muted">
            Signing out leaves everything on this device; it does not delete anything.
          </p>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="mb-4 flex gap-1 rounded-lg bg-surface-2 p-1">
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setNotice(null); }}
                className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === m ? "bg-surface text-foreground shadow-sm" : "text-muted"
                }`}
              >
                {m === "in" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input
                type="email" value={email} required autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                // the length rule applies to new passwords only, so an existing
                // shorter one can still sign in
                type="password" value={password} required minLength={mode === "up" ? 10 : undefined}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "up" ? "At least 10 characters" : "Your password"}
              />
            </div>
            {error && (
              <p className="rounded-lg bg-critical/10 px-3 py-2 text-xs text-critical">{error}</p>
            )}
            {notice && (
              <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">{notice}</p>
            )}
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-4 rounded-lg border border-border-token bg-surface-2/50 p-3">
            <p className="text-xs font-semibold">What happens to the data already here?</p>
            <p className="mt-1 text-xs text-muted">
              {demo
                ? "This device is still showing the sample collection, which is never uploaded. Signing in brings down whatever your account holds."
                : "It is kept and uploaded to your account on first sign-in. Nothing is overwritten or deleted: where the same record exists in both places the more recently edited one wins, and a snapshot of this device is saved beforehand."}
            </p>
          </div>
        </Card>
      )}

      <SectionTitle>How sync behaves</SectionTitle>
      <Card className="space-y-2 p-5 text-xs text-muted">
        <p>• Data syncs when you sign in, when the app regains focus, and on demand.</p>
        <p>• Each record is stamped when you change it; the newest edit wins on conflict.</p>
        <p>• Deleting on one device removes it from the others once they sync.</p>
        <p>• Signed out, the app is fully usable and stores everything locally.</p>
        <p>• Your rows are protected by row-level security — only your account can read them.</p>
      </Card>
    </div>
  );
}
