"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, ChartSpline, Cloud, CloudOff, FileText, GitCompareArrows, LayoutDashboard,
  Lightbulb, Moon, Settings, Sun, Watch as WatchIcon, Wrench, X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { Badge } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/watches", label: "Watches", icon: WatchIcon },
  { href: "/analytics", label: "Analytics", icon: ChartSpline },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/services", label: "Service", icon: Wrench },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const stored = window.localStorage.getItem("wk-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("wk-theme", next ? "dark" : "light");
      return next;
    });
  };
  return { dark, toggle };
}

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { notifications, dismissNotification, watches } = useStore();
  const sevColor = { info: "var(--info)", warning: "var(--warning)", critical: "var(--critical)" };
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass absolute right-0 top-12 z-50 max-h-[70vh] w-80 overflow-y-auto rounded-2xl p-3 shadow-2xl"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-sm font-semibold">Notifications</p>
        <button onClick={onClose} className="cursor-pointer rounded p-1 text-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      {notifications.length === 0 && (
        <p className="px-1 py-6 text-center text-xs text-muted">All clear — nothing needs attention.</p>
      )}
      <div className="space-y-2">
        {notifications.map((n) => {
          const w = watches.find((x) => x.id === n.watchId);
          return (
            <div key={n.id} className="rounded-xl border border-border-token bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: sevColor[n.severity] }} />
                    {n.title}
                  </p>
                  <p className="mt-1 text-xs text-muted">{n.body}</p>
                  {w && (
                    <Link href={`/watches/${w.id}`} onClick={onClose}
                      className="mt-1.5 inline-block text-[11px] font-medium text-accent hover:underline">
                      View {w.model} →
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => dismissNotification(`${n.kind}:${n.watchId}`)}
                  className="shrink-0 cursor-pointer rounded p-0.5 text-faint hover:text-foreground"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const { notifications, demo, cloudSynced, ready } = useStore();
  const [showNotifs, setShowNotifs] = useState(false);

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border-token bg-surface/60 backdrop-blur-xl md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <WatchIcon className="h-4.5 w-4.5" />
          </span>
          <span className="text-[15px] font-bold tracking-tight">
            Watch<span className="text-accent">Keeper</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/12 text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 text-[11px] text-faint">
          {ready && (demo ? (
            <Badge color="var(--info)">Demo data</Badge>
          ) : cloudSynced ? (
            <span className="flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" /> Cloud synced</span>
          ) : (
            <span className="flex items-center gap-1.5"><CloudOff className="h-3.5 w-3.5" /> Local mode</span>
          ))}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-56">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border-token bg-background/70 px-4 backdrop-blur-xl md:px-8">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <WatchIcon className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold">WatchKeeper</span>
          </Link>
          <div className="hidden text-xs text-muted md:block">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="relative flex items-center gap-1">
            <button
              onClick={toggle}
              className="cursor-pointer rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              title="Toggle theme"
            >
              {dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
            <button
              onClick={() => setShowNotifs((s) => !s)}
              className="relative cursor-pointer rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {notifications.length > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white">
                  {notifications.length}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
            </AnimatePresence>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">{children}</main>

        {/* Bottom nav — mobile */}
        <nav className="glass fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border-token py-1.5 md:hidden">
          {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
                  active ? "text-accent" : "text-muted"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
