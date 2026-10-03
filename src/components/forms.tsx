"use client";

// ─── Entry forms: quick measurement, watch profile, service record ──────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Watch as WatchIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import type {
  Measurement, MovementType, ServiceRecord, ServiceType, Watch, WatchPosition,
  WishlistItem, WishlistPriority, WishlistStatus,
} from "@/lib/types";
import { Button, Dialog, DialogContent, DialogTrigger, Empty, Input, Label, Select, Switch, Textarea } from "./ui";
import {
  filterSuggestions, findMovement, modelsForBrand, specForCaliber, suggestModels, WATCH_BRANDS, type CatalogModel,
} from "@/lib/watch-catalog";
import { CURRENCIES } from "@/lib/utils";
import { checkClock, describeClockError, type ClockCheck } from "@/lib/clock";

// ── Autocomplete input ──────────────────────────────────────────────────────
interface Suggestion {
  label: string;
  sub?: string;
}

function AutocompleteInput({
  value, onChange, onPick, suggestions, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  /** called with the picked label after onChange */
  onPick?: (label: string) => void;
  suggestions: Suggestion[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const show = open && suggestions.length > 0;

  const pick = (label: string) => {
    onChange(label);
    onPick?.(label);
    setOpen(false);
    setHighlight(-1);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && highlight >= 0) {
            e.preventDefault();
            pick(suggestions[highlight].label);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
      />
      {show && (
        <ul
          ref={listRef}
          className="glass absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl p-1 shadow-2xl"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li key={s.label + i} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                // mousedown fires before the input's blur closes the list
                onMouseDown={(e) => { e.preventDefault(); pick(s.label); }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full cursor-pointer items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
                  i === highlight ? "bg-accent/15 text-accent" : "hover:bg-surface-2"
                }`}
              >
                <span className="truncate">{s.label}</span>
                {s.sub && <span className="shrink-0 text-[11px] text-muted">{s.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const POSITIONS: { value: WatchPosition; label: string }[] = [
  { value: "on-wrist", label: "On wrist" },
  { value: "dial-up", label: "Dial up" },
  { value: "dial-down", label: "Dial down" },
  { value: "crown-up", label: "Crown up" },
  { value: "crown-down", label: "Crown down" },
  { value: "crown-left", label: "Crown left" },
  { value: "crown-right", label: "Crown right" },
];

/**
 * Flexible time parser → [h, m, s] or null.
 * Accepts "10:01:31", "10:01", "10.01.31", "10 01 31", and bare digit runs:
 * "959" → 9:59:00, "0959" → 09:59:00, "100131" → 10:01:31.
 */
function parseTimeParts(input: string): [number, number, number] | null {
  const s = input.trim();
  if (!s) return null;
  let parts: number[];
  if (/^\d+$/.test(s)) {
    // bare digits — split from the left into H(H), MM, SS
    if (s.length > 6) return null;
    const p = s.length % 2 === 1 ? [s.slice(0, 1), s.slice(1, 3), s.slice(3, 5)] : [s.slice(0, 2), s.slice(2, 4), s.slice(4, 6)];
    parts = p.filter((x) => x !== "").map(Number);
  } else {
    const chunks = s.split(/[:.,\s]+/).filter(Boolean);
    if (chunks.length < 1 || chunks.length > 3 || chunks.some((c) => !/^\d{1,2}$/.test(c))) return null;
    parts = chunks.map(Number);
  }
  const [h, m = 0, sec = 0] = parts;
  if (h > 23 || m > 59 || sec > 59) return null;
  return [h, m, sec];
}

/** flexible time string → seconds since midnight */
function parseHms(s: string): number | null {
  const p = parseTimeParts(s);
  return p ? p[0] * 3600 + p[1] * 60 + p[2] : null;
}

/** canonical HH:MM:SS, or the input unchanged if unparseable */
function normalizeTime(s: string): string {
  const p = parseTimeParts(s);
  if (!p) return s;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${pad2(p[0])}:${pad2(p[1])}:${pad2(p[2])}`;
}

/**
 * Time-of-day input. Accepts any reasonable format while typing ("959",
 * "100131", "9:59", "9.59.6") — the flexible parser reads it live — and
 * normalizes the display to canonical HH:MM:SS on blur or Enter.
 */
function TimeInput({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const valid = parseTimeParts(value) !== null;
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onChange(normalizeTime(value))}
      onKeyDown={(e) => { if (e.key === "Enter") onChange(normalizeTime(value)); }}
      placeholder={placeholder}
      inputMode="numeric"
      className={`font-mono ${value && !valid ? "border-critical/60" : ""}`}
      aria-invalid={!!value && !valid}
    />
  );
}

/** HH:MM:SS now, on the device clock shifted by a measured correction. */
const nowHms = (offsetMs = 0) => {
  const d = new Date(Date.now() + offsetMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Where the check of the device clock against the server stands. */
type ClockState =
  | { status: "checking" }
  | { status: "unavailable" }
  | ({ status: "ok" } & ClockCheck);

function ClockStatus({ clock }: { clock: ClockState }) {
  if (clock.status === "checking") return <>Checking this device&apos;s clock…</>;
  if (clock.status === "unavailable")
    return (
      <>
        Couldn&apos;t check this device&apos;s clock (offline?), so it is used as it is —
        usually within a second of true time.
      </>
    );
  const error = describeClockError(clock);
  return error ? (
    <>This device&apos;s clock is {error}. The times here are corrected for it.</>
  ) : (
    <>
      This device&apos;s clock was checked against the server and is right to within{" "}
      {Math.max(50, Math.round(clock.uncertaintyMs))} ms.
    </>
  );
}

/**
 * Live reference clock.
 *
 * Every figure this app produces is a difference against a reference, so the
 * reference has to be visible and trustworthy. It shows the device's time
 * corrected by the check against the server, ticks in real time so the
 * seconds hand can be read against it directly, and tapping it stamps the field.
 */
function ReferenceClock({ onUse, clock }: { onUse: (t: string) => void; clock: ClockState }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const text = nowHms(clock.status === "ok" ? clock.offsetMs : 0);
  return (
    <button
      type="button"
      onClick={() => onUse(text)}
      className="w-full cursor-pointer rounded-xl border border-border-token bg-surface-2/60 p-3 text-center transition-colors hover:border-accent/40"
      title="Tap to stamp the reference field with this time"
    >
      <p className="text-[10px] uppercase tracking-wider text-muted">Or type the times — tap to stamp the reference</p>
      <p className="font-mono text-2xl font-bold tabular-nums">{text}</p>
      <p className="mt-0.5 text-[11px] text-faint"><ClockStatus clock={clock} /></p>
    </button>
  );
}

// ── Tap to capture ──────────────────────────────────────────────────────────
// Typing two times is the slow, error-prone part of a reading. Instead: watch
// the seconds hand, tap as it crosses a mark. The tap fixes the reference
// time to the millisecond, and the watch's own time at that instant is known
// — its seconds are the mark, and its minute is whichever one puts it nearest
// to where the watch was expected to be.

/** Seconds marks the hand can be read against; 12 is the easiest to judge. */
const MARKS = [
  { value: 0, label: "12" },
  { value: 15, label: "3" },
  { value: 30, label: "6" },
  { value: 45, label: "9" },
];

export interface Tap {
  /** device time of the tap, epoch ms */
  refMs: number;
  /** seconds the hand was pointing at */
  mark: number;
}

/**
 * The time the watch showed at a tap: the instant nearest to where the watch
 * was expected to be whose seconds equal the mark. Good for any watch within
 * half a minute of the expectation; beyond that the minute is one out, which
 * the −/+ minute controls correct.
 */
export function watchTimeAtTap(tapMs: number, expectedOffsetS: number, markSeconds: number): number {
  const expected = tapMs + expectedOffsetS * 1000;
  return Math.round((expected - markSeconds * 1000) / 60_000) * 60_000 + markSeconds * 1000;
}

/**
 * Turn a run of taps into one offset. The first tap is placed against the
 * expected offset; each later one against the tap before it, so they cannot
 * land in different minutes. Several taps average out reaction time.
 */
export function resolveTaps(taps: Tap[], expectedOffsetS: number, minuteShift: number) {
  if (!taps.length) return null;
  let expected = expectedOffsetS + minuteShift * 60;
  const offsets: number[] = [];
  let lastWatchMs = 0;
  for (const t of taps) {
    lastWatchMs = watchTimeAtTap(t.refMs, expected, t.mark);
    expected = (lastWatchMs - t.refMs) / 1000;
    offsets.push(expected);
  }
  const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  return {
    offset: Math.round(mean * 10) / 10,
    count: offsets.length,
    /** widest disagreement between taps, seconds — the reaction-time scatter */
    spread: offsets.length > 1 ? Math.max(...offsets) - Math.min(...offsets) : null,
    lastRefMs: taps[taps.length - 1].refMs,
    lastWatchMs,
  };
}

const hmsOfMs = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

function TapCapture({
  mark, onMark, onTap, captured, onShiftMinute, onReset,
}: {
  mark: number;
  onMark: (m: number) => void;
  onTap: (tapMs: number) => void;
  captured: ReturnType<typeof resolveTaps>;
  onShiftMinute: (by: number) => void;
  onReset: () => void;
}) {
  /** When the press happened, not when this handler got round to running. */
  const tapTime = (e: { timeStamp: number }) => Date.now() - Math.max(0, performance.now() - e.timeStamp);
  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">Tap to capture</p>
        <div className="flex items-center gap-1 text-[11px] text-muted" role="group" aria-label="Seconds mark to tap at">
          <span className="mr-1">hand at</span>
          {MARKS.map((m) => (
            <button
              key={m.value} type="button" onClick={() => onMark(m.value)}
              aria-pressed={mark === m.value}
              className={`h-7 min-w-7 cursor-pointer rounded-md px-1.5 text-xs font-semibold ${
                mark === m.value ? "bg-accent text-background" : "bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        // pointerdown, not click: a click fires on release, a tenth of a second late
        onPointerDown={(e) => { e.preventDefault(); onTap(tapTime(e)); }}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); onTap(tapTime(e)); }
        }}
        className="mt-2 h-16 w-full cursor-pointer touch-manipulation select-none rounded-xl bg-accent text-base font-bold text-background transition-transform active:scale-[0.98]"
      >
        Tap as the seconds hand crosses {MARKS.find((m) => m.value === mark)?.label}
      </button>
      {captured ? (
        <div className="mt-2 space-y-1.5 text-xs">
          <p className="text-muted">
            Watch read <span className="font-mono font-semibold text-foreground">{hmsOfMs(captured.lastWatchMs)}</span>{" "}
            when the reference read{" "}
            <span className="font-mono font-semibold text-foreground">
              {hmsOfMs(captured.lastRefMs)}.{Math.floor((captured.lastRefMs % 1000) / 100)}
            </span>
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* taps that disagree by more than a second were not all on the mark */}
            <span className={captured.spread != null && captured.spread > 1 ? "font-medium text-warning" : "text-muted"}>
              {captured.count === 1
                ? "Tap again at the next mark to average out reaction time."
                : captured.spread! > 1
                  ? `${captured.count} taps disagree by ${captured.spread!.toFixed(1)} s — one was mistimed. Start over.`
                  : `${captured.count} taps averaged · they agree within ${captured.spread!.toFixed(1)} s`}
            </span>
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => onShiftMinute(-1)}
                className="cursor-pointer rounded-md bg-surface-2 px-2 py-1 font-medium hover:text-accent">−1 min</button>
              <button type="button" onClick={() => onShiftMinute(1)}
                className="cursor-pointer rounded-md bg-surface-2 px-2 py-1 font-medium hover:text-accent">+1 min</button>
              <button type="button" onClick={onReset}
                className="cursor-pointer rounded-md px-2 py-1 font-medium text-muted hover:text-foreground">Start over</button>
            </span>
          </div>
          <p className="text-[11px] text-faint">
            Wrong minute? The minute is worked out from the last reading — nudge it if the watch has been reset since.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted">
          No typing: the tap records this device&apos;s time to the tenth of a second and works out what the watch showed.
        </p>
      )}
    </div>
  );
}

/** ISO instant → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function MeasurementDialog({
  watchId, trigger, existing, open: openProp, onOpenChange,
}: {
  watchId?: string;
  trigger?: React.ReactNode;
  /** when supplied the dialog edits this reading instead of creating one */
  existing?: Measurement | null;
  /** controlled mode — lets a table drive one shared dialog */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { watches, measurementsFor, analysisFor, addMeasurement, updateMeasurement } = useStore();
  const active = watches.filter((w) => !w.archived);
  // tap-to-capture: the taps so far, the mark being tapped at, and any minute correction
  const [taps, setTaps] = useState<Tap[]>([]);
  const [mark, setMark] = useState(0);
  const [minuteShift, setMinuteShift] = useState(0);
  // Whether the time fields were typed into. Until they are, the offset comes
  // from the capture (or, when editing, from the reading as stored) — both
  // are finer than the whole seconds the two fields can express.
  const [timesEdited, setTimesEdited] = useState(false);
  // The device clock, checked against the server each time the form opens.
  const [clock, setClock] = useState<ClockState>({ status: "checking" });
  const clockOffset = clock.status === "ok" ? clock.offsetMs : 0;
  // Whether the reference time came from the app's own (checked) clock rather
  // than being typed in from somewhere else.
  const [refFromApp, setRefFromApp] = useState(true);
  // anything entered since the form opened — the clock check must not overwrite it
  const touched = useRef(false);

  const runClockCheck = () => {
    setClock({ status: "checking" });
    void checkClock().then((c) => {
      setClock(c ? { status: "ok", ...c } : { status: "unavailable" });
      // nothing entered yet: restamp the prefilled times with the corrected clock
      if (c && !touched.current) {
        const t = nowHms(c.offsetMs);
        setForm((f) => ({
          ...f,
          referenceTime: t,
          watchTime: t,
          measuredAt: toLocalInput(new Date(Date.now() + c.offsetMs).toISOString()),
        }));
      }
    });
  };
  const [openState, setOpen] = useState(false);
  const open = openProp ?? openState;
  const editing = !!existing;

  const [form, setForm] = useState(() => ({
    watchId: watchId ?? active[0]?.id ?? "",
    measuredAt: toLocalInput(new Date().toISOString()),
    referenceTime: nowHms(),
    watchTime: nowHms(),
    temperatureC: "",
    position: "on-wrist" as WatchPosition,
    powerReservePct: "",
    wornToday: true,
    timeAdjusted: false,
    excludeFromRate: false,
    notes: "",
  }));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const clearCapture = () => {
    setTaps([]);
    setMinuteShift(0);
  };

  /** A time field was typed into: from here the fields are the truth. */
  const editTime = (k: "referenceTime" | "watchTime", v: string) => {
    if (v !== form[k]) {
      touched.current = true;
      clearCapture();
      setTimesEdited(true);
      // a typed reference could have come from anywhere
      if (k === "referenceTime") setRefFromApp(false);
    }
    set(k, v);
  };

  /** Stamp the reference field from the app's clock. */
  const stampReference = (t: string) => {
    touched.current = true;
    clearCapture();
    setTimesEdited(true);
    setRefFromApp(true);
    set("referenceTime", t);
  };

  /** Stamp both time fields with the current clock — on open and on demand. */
  const syncToNow = () => {
    const t = nowHms(clockOffset);
    touched.current = true;
    clearCapture();
    setTimesEdited(true);
    setRefFromApp(true);
    setForm((f) => ({ ...f, referenceTime: t, watchTime: t }));
  };

  /** Load an existing reading into the form, exactly as recorded. */
  const loadExisting = (m: Measurement) => {
    clearCapture();
    setTimesEdited(false);
    setRefFromApp(true);
    setForm({
      watchId: m.watchId,
      measuredAt: toLocalInput(m.measuredAt),
      referenceTime: m.referenceTime,
      watchTime: m.watchTime,
      temperatureC: m.temperatureC?.toString() ?? "",
      position: (m.position ?? "on-wrist") as WatchPosition,
      powerReservePct: m.powerReservePct?.toString() ?? "",
      wornToday: m.wornToday,
      timeAdjusted: !!m.timeAdjusted,
      excludeFromRate: !!m.excludeFromRate,
      notes: m.notes ?? "",
    });
  };

  // A parent can open this dialog by flipping `open` (the measurements table
  // does exactly that). Radix only reports its own interactions, so the form
  // has to be filled here or an edit would show blank defaults.
  useEffect(() => {
    if (open && existing) loadExisting(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      if (existing) {
        loadExisting(existing);
      } else {
        const t = nowHms(clockOffset);
        clearCapture();
        setTimesEdited(false);
        setRefFromApp(true);
        touched.current = false;
        runClockCheck();
        setForm((f) => ({
          ...f,
          // The dialog stays mounted while the page's selected watch changes, so
          // the target must be re-read on open — otherwise a measurement lands
          // on whichever watch happened to be selected when the page first rendered.
          watchId:
            watchId ??
            (active.some((w) => w.id === f.watchId) ? f.watchId : active[0]?.id ?? ""),
          // the clock must read "now" when you open the form, not at page load
          measuredAt: toLocalInput(new Date().toISOString()),
          referenceTime: t,
          watchTime: t,
          // per-reading flags must not carry over from the previous entry
          timeAdjusted: false,
          excludeFromRate: false,
          notes: "",
        }));
      }
    }
    onOpenChange?.(next);
    setOpen(next);
  };

  const prev = useMemo(() => {
    const ms = measurementsFor(form.watchId);
    return ms[ms.length - 1] ?? null;
  }, [form.watchId, measurementsFor]);

  // Where the watch should be by now: its last offset plus its usual rate
  // over the time since. Only used to pick the minute for a capture.
  const expectedOffsetAt = (tapMs: number) => {
    if (!prev) return 0;
    const rate = analysisFor(form.watchId)?.stats.avgSpd ?? 0;
    return prev.offsetSeconds + (rate * (tapMs - +new Date(prev.measuredAt))) / 86_400_000;
  };

  const resolve = (ts: Tap[], shift: number) =>
    ts.length ? resolveTaps(ts, expectedOffsetAt(ts[0].refMs), shift) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const captured = useMemo(() => resolve(taps, minuteShift), [taps, minuteShift, prev]);

  /** Record taps / a minute correction, and show the result in the time fields. */
  const applyCapture = (nextTaps: Tap[], nextShift: number) => {
    const r = resolve(nextTaps, nextShift);
    touched.current = true;
    setRefFromApp(true);
    setTaps(nextTaps);
    setMinuteShift(nextShift);
    setTimesEdited(false);
    if (r)
      setForm((f) => ({
        ...f,
        measuredAt: toLocalInput(new Date(r.lastRefMs).toISOString()),
        referenceTime: hmsOfMs(r.lastRefMs),
        watchTime: hmsOfMs(r.lastWatchMs),
      }));
  };

  const offset = useMemo(() => {
    if (captured) return captured.offset;
    // an untouched edit keeps the stored offset rather than re-deriving a
    // coarser one from the two whole-second fields
    if (existing && !timesEdited) return existing.offsetSeconds;
    const ref = parseHms(form.referenceTime);
    const wt = parseHms(form.watchTime);
    if (ref == null || wt == null) return null;
    let d = wt - ref;
    if (d > 43200) d -= 86400; // wrap midnight
    if (d < -43200) d += 86400;
    return Math.round(d * 10) / 10;
  }, [captured, existing, timesEdited, form.referenceTime, form.watchTime]);

  const projectedSpd = useMemo(() => {
    if (offset == null || !prev) return null;
    // when editing, the reading being edited is its own predecessor's successor
    if (editing && prev.id === existing?.id) return null;
    const at = form.measuredAt ? +new Date(form.measuredAt) : Date.now();
    const gapDays = (at - +new Date(prev.measuredAt)) / 86_400_000;
    if (gapDays < 0.04) return null;
    return (offset - prev.offsetSeconds) / gapDays;
  }, [offset, prev, editing, existing?.id, form.measuredAt]);

  const submit = () => {
    if (offset == null || !form.watchId) return;
    const measuredAt = form.measuredAt
      ? new Date(form.measuredAt).toISOString()
      : new Date().toISOString();
    const fields = {
      watchId: form.watchId,
      measuredAt,
      referenceTime: normalizeTime(form.referenceTime),
      watchTime: normalizeTime(form.watchTime),
      offsetSeconds: offset,
      temperatureC: form.temperatureC !== "" ? +form.temperatureC : undefined,
      position: form.position,
      powerReservePct:
        form.powerReservePct !== ""
          ? Math.max(0, Math.min(100, +form.powerReservePct))
          : undefined,
      wornToday: form.wornToday,
      timeAdjusted: form.timeAdjusted || undefined,
      excludeFromRate: form.excludeFromRate || undefined,
      notes: form.notes || undefined,
      // an edit keeps the flag unless a time was retyped; a new reading earns
      // it when its reference came from the app's clock and that was checked
      referenceChecked:
        (existing
          ? !timesEdited && existing.referenceChecked
          : refFromApp && clock.status === "ok") || undefined,
    };

    if (existing) {
      updateMeasurement(existing.id, fields);
      handleOpenChange(false);
      return;
    }

    addMeasurement(fields as Omit<Measurement, "id">);
    clearCapture();
    handleOpenChange(false);
    // clear the per-reading fields; timeAdjusted especially must not stick,
    // or every later measurement would be treated as a fresh baseline
    setForm((f) => ({
      ...f,
      referenceTime: nowHms(clockOffset), watchTime: nowHms(clockOffset),
      timeAdjusted: false, excludeFromRate: false, notes: "",
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <Plus className="h-4 w-4" /> Add measurement
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent title={editing ? "Edit measurement" : "New measurement"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Watch</Label>
              <Select value={form.watchId} onChange={(e) => { clearCapture(); set("watchId", e.target.value); }}>
                {active.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.brand} {w.model}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Measured at</Label>
              <Input
                type="datetime-local" step="1"
                value={form.measuredAt}
                onChange={(e) => set("measuredAt", e.target.value)}
              />
            </div>
          </div>
          {!editing && (
            <TapCapture
              mark={mark}
              onMark={setMark}
              captured={captured}
              onTap={(deviceMs) => {
                // the tap is timed on the device; correct it to true time
                const refMs = deviceMs + clockOffset;
                // a second press within two seconds is a bounce, not a reading
                const last = taps[taps.length - 1];
                if (last && refMs - last.refMs < 2000) return;
                applyCapture([...taps, { refMs, mark }], minuteShift);
              }}
              onShiftMinute={(by) => applyCapture(taps, minuteShift + by)}
              onReset={clearCapture}
            />
          )}
          {!editing && (
            <ReferenceClock onUse={stampReference} clock={clock} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-baseline justify-between">
                <Label>Reference time</Label>
                <button
                  type="button"
                  onClick={syncToNow}
                  className="mb-1.5 cursor-pointer text-[11px] font-medium text-accent hover:underline"
                >
                  Now
                </button>
              </div>
              <TimeInput
                value={form.referenceTime}
                onChange={(v) => editTime("referenceTime", v)}
                placeholder="14:30:00"
              />
            </div>
            <div>
              <Label>Watch time</Label>
              <TimeInput
                value={form.watchTime}
                onChange={(v) => editTime("watchTime", v)}
                placeholder="14:30:04"
              />
            </div>
          </div>

          {/* live computed offset */}
          <div className="rounded-xl border border-border-token bg-surface-2/60 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted">Computed offset</p>
            <p className="text-2xl font-bold tabular-nums" style={{
              color: offset == null ? "var(--faint)" : Math.abs(offset) <= 5 ? "var(--positive)" : Math.abs(offset) <= 15 ? "var(--warning)" : "var(--critical)",
            }}>
              {offset == null ? "—" : `${offset > 0 ? "+" : ""}${offset.toFixed(1)}s`}
            </p>
            {form.timeAdjusted ? (
              <p className="text-xs text-warning">New baseline — no rate calculated across the correction</p>
            ) : projectedSpd != null && Math.abs(projectedSpd) < 120 ? (
              <p className="text-xs text-muted">
                ≈ {projectedSpd > 0 ? "+" : ""}{projectedSpd.toFixed(1)} s/d since last measurement
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Position</Label>
              <Select value={form.position} onChange={(e) => set("position", e.target.value as WatchPosition)}>
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Temperature (°C)</Label>
              <Input type="number" value={form.temperatureC}
                onChange={(e) => set("temperatureC", e.target.value)} placeholder="22" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Power reserve (%)</Label>
              <Input type="number" min={0} max={100} value={form.powerReservePct}
                onChange={(e) => set("powerReservePct", e.target.value)} placeholder="80" />
            </div>
            <div className="flex items-end gap-2 pb-1.5">
              <Switch checked={form.wornToday} onCheckedChange={(v) => set("wornToday", v)} />
              <span className="text-sm text-muted">Worn today</span>
            </div>
          </div>
          {/* Time correction — breaks the drift chain so a reset isn't read
              as an enormous rate. */}
          <div className={`rounded-xl border p-3 transition-colors ${
            form.timeAdjusted ? "border-warning/40 bg-warning/5" : "border-border-token"
          }`}>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.timeAdjusted}
                onCheckedChange={(v) => set("timeAdjusted", v)}
              />
              <span className="text-sm font-medium">
                {editing ? "Time was corrected before this reading" : "I corrected the time since the last reading"}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              {form.timeAdjusted
                ? "This reading starts a fresh baseline. The jump caused by your correction won't be counted as drift, and no rate is calculated across it."
                : "Tick this if you reset the hands, hacked the seconds, or adjusted the watch — otherwise the correction would look like a huge gain or loss."}
            </p>
          </div>

          {/* Let the wearer decide what counts. The reading is always kept —
              only the period leading up to it is left out of the maths. */}
          <div className={`rounded-xl border p-3 transition-colors ${
            form.excludeFromRate ? "border-info/40 bg-info/5" : "border-border-token"
          }`}>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.excludeFromRate}
                onCheckedChange={(v) => set("excludeFromRate", v)}
              />
              <span className="text-sm font-medium">
                Don&apos;t count the period since the last reading
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              {form.excludeFromRate
                ? "This reading is still recorded and still plotted — the stretch of time before it just won't count toward the rate, average or health."
                : "For a stretch that isn't representative: a night on the nightstand you'd rather not average in, a knock, a demagnetising, or a spell you weren't wearing it."}
            </p>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes…" className="min-h-14" />
          </div>
          <Button className="w-full" onClick={submit} disabled={offset == null || !form.watchId}>
            {editing ? "Save changes" : "Save measurement"}
          </Button>
          {editing && (
            <p className="text-center text-[11px] text-faint">
              Rates either side of this reading are recalculated from the new values.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Watch profile form ──────────────────────────────────────────────────────
const ACCENTS = ["#059669", "#3b82f6", "#d97706", "#8b5cf6", "#ec4899"];

export function WatchDialog({
  existing, trigger,
}: {
  existing?: Watch;
  trigger: React.ReactNode;
}) {
  const { addWatch, updateWatch, watches, settings } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    brand: existing?.brand ?? "",
    model: existing?.model ?? "",
    reference: existing?.reference ?? "",
    serial: existing?.serial ?? "",
    movementType: (existing?.movementType ?? "automatic") as MovementType,
    caliber: existing?.caliber ?? "",
    beatRate: existing?.beatRate?.toString() ?? "",
    powerReserveHours: existing?.powerReserveHours?.toString() ?? "",
    jewels: existing?.jewels?.toString() ?? "",
    coscCertified: existing?.coscCertified ?? false,
    rateSpecMin: existing?.rateSpecMin?.toString() ?? "",
    rateSpecMax: existing?.rateSpecMax?.toString() ?? "",
    currency: existing?.currency ?? settings.currency,
    purchaseDate: existing?.purchaseDate ?? "",
    purchasePrice: existing?.purchasePrice?.toString() ?? "",
    currentValue: existing?.currentValue?.toString() ?? "",
    batteryInstalledAt: existing?.batteryInstalledAt ?? "",
    batteryLifeMonths: existing?.batteryLifeMonths?.toString() ?? "",
    warrantyUntil: existing?.warrantyUntil ?? "",
    insured: existing?.insured ?? false,
    notes: existing?.notes ?? "",
  }));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // brand suggestions: built-in catalog + brands already in the collection
  const brandOptions = useMemo(() => {
    const own = watches.map((w) => w.brand);
    return [...new Set([...WATCH_BRANDS, ...own])].sort((a, b) => a.localeCompare(b));
  }, [watches]);
  const brandSuggestions = useMemo(
    () => filterSuggestions(form.brand, brandOptions).map((label) => ({ label })),
    [form.brand, brandOptions]
  );

  const brandModels = useMemo(() => modelsForBrand(form.brand), [form.brand]);
  const modelSuggestions = useMemo(
    () =>
      suggestModels(form.brand, form.model).map((m) => ({
        label: m.model, sub: m.reference ?? m.caliber,
      })),
    [form.brand, form.model]
  );

  // Spec implied by the caliber the user has typed/picked — shown as the
  // placeholder so it's clear what the watch will be graded against.
  const detectedSpec = useMemo(
    () => specForCaliber(form.caliber, form.coscCertified, form.brand),
    [form.caliber, form.coscCertified, form.brand]
  );

  // The movement the typed caliber refers to, when the catalog knows it.
  const knownMovement = useMemo(
    () => (form.caliber.trim() ? findMovement(form.brand, form.caliber) : undefined),
    [form.brand, form.caliber]
  );
  /** Typing a known caliber fills in its figures — only into fields still empty. */
  const applyMovement = () => {
    if (!knownMovement) return;
    setForm((f) => ({
      ...f,
      movementType: f.beatRate || f.powerReserveHours ? f.movementType : knownMovement.type,
      beatRate: f.beatRate || (knownMovement.beatRate?.toString() ?? ""),
      powerReserveHours: f.powerReserveHours || (knownMovement.powerReserveHours?.toString() ?? ""),
    }));
  };

  /** Prefill specs from the catalog, only into fields the user hasn't filled. */
  const applyModel = (label: string) => {
    const m: CatalogModel | undefined = brandModels.find((x) => x.model === label);
    if (!m) return;
    setForm((f) => ({
      ...f,
      model: label,
      reference: f.reference || (m.reference ?? ""),
      movementType: m.movementType,
      caliber: f.caliber || (m.caliber ?? ""),
      beatRate: f.beatRate || (m.beatRate?.toString() ?? ""),
      powerReserveHours: f.powerReserveHours || (m.powerReserveHours?.toString() ?? ""),
      coscCertified: f.coscCertified || (m.cosc ?? false),
    }));
  };

  const submit = () => {
    if (!form.brand || !form.model) return;
    const payload = {
      brand: form.brand, model: form.model,
      reference: form.reference || undefined,
      serial: form.serial || undefined,
      movementType: form.movementType,
      caliber: form.caliber || undefined,
      beatRate: form.beatRate ? +form.beatRate : undefined,
      powerReserveHours: form.powerReserveHours ? +form.powerReserveHours : undefined,
      jewels: form.jewels ? +form.jewels : undefined,
      coscCertified: form.coscCertified,
      rateSpecMin: form.rateSpecMin === "" ? undefined : +form.rateSpecMin,
      rateSpecMax: form.rateSpecMax === "" ? undefined : +form.rateSpecMax,
      rateSpecSource: form.rateSpecMin !== "" && form.rateSpecMax !== ""
        ? (existing?.rateSpecSource ?? "Custom specification")
        : undefined,
      purchaseDate: form.purchaseDate || undefined,
      purchasePrice: form.purchasePrice ? +form.purchasePrice : undefined,
      currentValue: form.currentValue ? +form.currentValue : undefined,
      currency: form.currency,
      accentColor: existing?.accentColor ?? ACCENTS[watches.length % ACCENTS.length],
      batteryInstalledAt: form.batteryInstalledAt || undefined,
      batteryLifeMonths: form.batteryLifeMonths ? +form.batteryLifeMonths : undefined,
      warrantyUntil: form.warrantyUntil || undefined,
      insured: form.insured,
      notes: form.notes || undefined,
    };
    if (existing) updateWatch(existing.id, payload);
    else addWatch(payload);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={existing ? "Edit watch" : "Add watch"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Brand *</Label>
              <AutocompleteInput
                value={form.brand}
                onChange={(v) => set("brand", v)}
                suggestions={brandSuggestions}
                placeholder="Omega"
              />
            </div>
            <div>
              <Label>Model *</Label>
              <AutocompleteInput
                value={form.model}
                onChange={(v) => set("model", v)}
                onPick={applyModel}
                suggestions={modelSuggestions}
                placeholder="Speedmaster"
              />
            </div>
          </div>
          {brandModels.length > 0 && !form.model && (
            <p className="-mt-2 text-[11px] text-faint">
              {brandModels.length} known {form.brand.trim()} models — picking one prefills its specs.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} /></div>
            <div><Label>Serial</Label><Input value={form.serial} onChange={(e) => set("serial", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Movement</Label>
              <Select value={form.movementType} onChange={(e) => set("movementType", e.target.value as MovementType)}>
                <option value="automatic">Automatic</option>
                <option value="manual">Manual wind</option>
                <option value="quartz">Quartz</option>
              </Select>
            </div>
            <div><Label>Caliber</Label><Input value={form.caliber} onChange={(e) => set("caliber", e.target.value)} onBlur={applyMovement} placeholder="3861" /></div>
          </div>
          {knownMovement && (
            <p className="-mt-2 text-[11px] text-faint">
              Recognised as the {knownMovement.maker} {knownMovement.caliber}
              {knownMovement.checked
                ? " — its figures are filled in below where the fields were empty."
                : " — its figures aren't in the catalog yet, so enter them if you know them."}
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Beat rate (vph)</Label><Input type="number" value={form.beatRate} onChange={(e) => set("beatRate", e.target.value)} placeholder="28800" /></div>
            <div><Label>Reserve (h)</Label><Input type="number" value={form.powerReserveHours} onChange={(e) => set("powerReserveHours", e.target.value)} placeholder="70" /></div>
            <div><Label>Jewels</Label><Input type="number" value={form.jewels} onChange={(e) => set("jewels", e.target.value)} placeholder="26" /></div>
          </div>
          {/* Manufacturer rate tolerance — what the movement is graded against */}
          <div>
            <div className="flex items-baseline justify-between">
              <Label>Rate specification (s/day)</Label>
              {detectedSpec && (
                <span className="mb-1.5 text-[11px] text-faint">
                  {form.rateSpecMin === "" && form.rateSpecMax === ""
                    ? `Using ${detectedSpec.source}`
                    : "Overriding detected spec"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number" value={form.rateSpecMin}
                onChange={(e) => set("rateSpecMin", e.target.value)}
                placeholder={detectedSpec ? `${detectedSpec.min} (min)` : "-35 (min)"}
              />
              <Input
                type="number" value={form.rateSpecMax}
                onChange={(e) => set("rateSpecMax", e.target.value)}
                placeholder={detectedSpec ? `${detectedSpec.max} (max)` : "+45 (max)"}
              />
            </div>
            <p className="mt-1 text-[11px] text-faint">
              {detectedSpec
                ? `Detected from the caliber — leave blank to use it. Accuracy grading is judged against this band, not a universal scale.`
                : `Optional. Your movement's published tolerance (e.g. Seiko 4R34 is −35/+45). Without it a generic scale is used.`}
            </p>
          </div>

          {form.movementType === "quartz" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Battery installed</Label><Input type="date" value={form.batteryInstalledAt} onChange={(e) => set("batteryInstalledAt", e.target.value)} /></div>
              <div><Label>Battery life (months)</Label><Input type="number" value={form.batteryLifeMonths} onChange={(e) => set("batteryLifeMonths", e.target.value)} placeholder="24" /></div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2"><Label>Purchased</Label><Input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></div>
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
                {/* keep an unusual existing code selectable */}
                {!CURRENCIES.some((c) => c.code === form.currency) && (
                  <option value={form.currency}>{form.currency}</option>
                )}
              </Select>
            </div>
            <div><Label>Price paid</Label><Input type="number" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Value now</Label><Input type="number" value={form.currentValue} onChange={(e) => set("currentValue", e.target.value)} /></div>
            <div><Label>Warranty until</Label><Input type="date" value={form.warrantyUntil} onChange={(e) => set("warrantyUntil", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-end gap-4 pb-1.5">
              <span className="flex items-center gap-2 text-sm text-muted">
                <Switch checked={form.coscCertified} onCheckedChange={(v) => set("coscCertified", v)} /> COSC
              </span>
              <span className="flex items-center gap-2 text-sm text-muted">
                <Switch checked={form.insured} onCheckedChange={(v) => set("insured", v)} /> Insured
              </span>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-14" /></div>
          <Button className="w-full" onClick={submit} disabled={!form.brand || !form.model}>
            {existing ? "Save changes" : "Add watch"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shown by pages that analyse a watch when the collection has none. */
export function NoWatches() {
  return (
    <Empty icon={<WatchIcon className="h-8 w-8" />} title="No watches yet">
      <p>Add your first watch to start tracking how it keeps time.</p>
      <div className="mt-4">
        <WatchDialog trigger={<Button><Plus className="h-4 w-4" /> Add watch</Button>} />
      </div>
    </Empty>
  );
}

// ── Wishlist form ───────────────────────────────────────────────────────────
const WISHLIST_STATUSES: { value: WishlistStatus; label: string }[] = [
  { value: "wanted", label: "Wanted" },
  { value: "watching", label: "Watching the market" },
  { value: "reserved", label: "Reserved / on hold" },
  { value: "passed", label: "Passed on it" },
];

export function WishlistDialog({
  existing, trigger, open: openProp, onOpenChange,
}: {
  existing?: WishlistItem | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { addWishlistItem, updateWishlistItem, settings, watches } = useStore();
  const [openState, setOpen] = useState(false);
  const open = openProp ?? openState;
  const editing = !!existing;

  const blank = () => ({
    brand: "", model: "", reference: "",
    movementType: "" as MovementType | "",
    caliber: "",
    targetPrice: "",
    currency: settings.currency,
    priority: "medium" as WishlistPriority,
    status: "wanted" as WishlistStatus,
    url: "", notes: "",
  });
  const [form, setForm] = useState(blank);
  const set = <K extends keyof ReturnType<typeof blank>>(
    k: K, v: ReturnType<typeof blank>[K]
  ) => setForm((f) => ({ ...f, [k]: v }));

  const load = (w: WishlistItem) =>
    setForm({
      brand: w.brand, model: w.model, reference: w.reference ?? "",
      movementType: w.movementType ?? "", caliber: w.caliber ?? "",
      targetPrice: w.targetPrice?.toString() ?? "",
      currency: w.currency, priority: w.priority, status: w.status,
      url: w.url ?? "", notes: w.notes ?? "",
    });

  useEffect(() => {
    if (!open) return;
    if (existing) load(existing);
    else setForm(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange?.(next);
    setOpen(next);
  };

  // suggestions, same catalog the collection uses
  const brandOptions = useMemo(() => {
    const own = watches.map((w) => w.brand);
    return [...new Set([...WATCH_BRANDS, ...own])].sort((a, b) => a.localeCompare(b));
  }, [watches]);
  const brandSuggestions = useMemo(
    () => filterSuggestions(form.brand, brandOptions).map((label) => ({ label })),
    [form.brand, brandOptions]
  );
  const brandModels = useMemo(() => modelsForBrand(form.brand), [form.brand]);
  const modelSuggestions = useMemo(
    () =>
      suggestModels(form.brand, form.model).map((m) => ({
        label: m.model, sub: m.reference ?? m.caliber,
      })),
    [form.brand, form.model]
  );

  const applyModel = (label: string) => {
    const m = brandModels.find((x) => x.model === label);
    if (!m) return;
    setForm((f) => ({
      ...f,
      model: label,
      reference: f.reference || (m.reference ?? ""),
      movementType: f.movementType || m.movementType,
      caliber: f.caliber || (m.caliber ?? ""),
    }));
  };

  // what this movement is built to, so you know before you buy
  const spec = useMemo(
    () => specForCaliber(form.caliber || undefined, false, form.brand),
    [form.caliber, form.brand]
  );

  const submit = () => {
    if (!form.brand || !form.model) return;
    const payload = {
      brand: form.brand,
      model: form.model,
      reference: form.reference || undefined,
      movementType: (form.movementType || undefined) as MovementType | undefined,
      caliber: form.caliber || undefined,
      targetPrice: form.targetPrice ? +form.targetPrice : undefined,
      currency: form.currency,
      priority: form.priority,
      status: form.status,
      url: form.url || undefined,
      notes: form.notes || undefined,
    };
    if (existing) updateWishlistItem(existing.id, payload);
    else addWishlistItem(payload);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button><Plus className="h-4 w-4" /> Add to wishlist</Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent title={editing ? "Edit wishlist item" : "Add to wishlist"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Brand *</Label>
              <AutocompleteInput
                value={form.brand} onChange={(v) => set("brand", v)}
                suggestions={brandSuggestions} placeholder="Tudor"
              />
            </div>
            <div>
              <Label>Model *</Label>
              <AutocompleteInput
                value={form.model} onChange={(v) => set("model", v)}
                onPick={applyModel} suggestions={modelSuggestions}
                placeholder="Black Bay 58"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} /></div>
            <div><Label>Caliber</Label><Input value={form.caliber} onChange={(e) => set("caliber", e.target.value)} /></div>
          </div>
          {spec && (
            <p className="-mt-2 text-[11px] text-faint">
              This movement is built to {spec.min > 0 ? "+" : ""}{spec.min}/{spec.max > 0 ? "+" : ""}{spec.max} s/d
              {" "}({spec.source}) — what you should expect once it&apos;s yours.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </div>
            <div><Label>Target price</Label><Input type="number" value={form.targetPrice} onChange={(e) => set("targetPrice", e.target.value)} /></div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onChange={(e) => set("priority", e.target.value as WishlistPriority)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => set("status", e.target.value as WishlistStatus)}>
              {WISHLIST_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          <div>
            <Label>Link</Label>
            <Input value={form.url} onChange={(e) => set("url", e.target.value)}
              placeholder="https://… a listing or reference page" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Condition wanted, where you saw it, what you're waiting for…"
              className="min-h-14" />
          </div>
          <Button className="w-full" onClick={submit} disabled={!form.brand || !form.model}>
            {editing ? "Save changes" : "Add to wishlist"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Service record form ─────────────────────────────────────────────────────
const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "full-service", label: "Full service" },
  { value: "regulation", label: "Regulation" },
  { value: "pressure-test", label: "Pressure test" },
  { value: "battery", label: "Battery change" },
  { value: "oil-service", label: "Oil service" },
  { value: "polishing", label: "Polishing" },
  { value: "parts-replacement", label: "Parts replacement" },
  { value: "water-resistance", label: "Water resistance" },
];

export function ServiceDialog({
  watchId, trigger,
}: {
  watchId?: string;
  trigger: React.ReactNode;
}) {
  const { watches, addService, settings } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    watchId: watchId ?? watches[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    type: "regulation" as ServiceType,
    watchmaker: "",
    cost: "",
    notes: "",
    partsReplaced: "",
    pressureTestPassed: false,
    waterResistanceRating: "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.watchId || !form.date) return;
    const s: Omit<ServiceRecord, "id"> = {
      watchId: form.watchId,
      date: form.date,
      type: form.type,
      watchmaker: form.watchmaker || "—",
      cost: form.cost ? +form.cost : 0,
      currency: watches.find((w) => w.id === form.watchId)?.currency ?? settings.currency,
      notes: form.notes || undefined,
      partsReplaced: form.partsReplaced
        ? form.partsReplaced.split(",").map((x) => x.trim()).filter(Boolean)
        : undefined,
      pressureTestPassed: form.type === "pressure-test" ? form.pressureTestPassed : undefined,
      waterResistanceRating: form.waterResistanceRating || undefined,
    };
    addService(s);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Log service">
        <div className="space-y-4">
          <div>
            <Label>Watch</Label>
            <Select value={form.watchId} onChange={(e) => set("watchId", e.target.value)}>
              {watches.map((w) => (
                <option key={w.id} value={w.id}>{w.brand} {w.model}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onChange={(e) => set("type", e.target.value as ServiceType)}>
                {SERVICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Watchmaker</Label><Input value={form.watchmaker} onChange={(e) => set("watchmaker", e.target.value)} /></div>
            <div><Label>Cost ({watches.find((w) => w.id === form.watchId)?.currency ?? settings.currency})</Label><Input type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)} /></div>
          </div>
          <div><Label>Parts replaced (comma separated)</Label><Input value={form.partsReplaced} onChange={(e) => set("partsReplaced", e.target.value)} placeholder="mainspring, gaskets" /></div>
          {form.type === "pressure-test" && (
            <div className="flex items-center gap-3">
              <Switch checked={form.pressureTestPassed} onCheckedChange={(v) => set("pressureTestPassed", v)} />
              <span className="text-sm text-muted">Passed</span>
              <Input className="flex-1" value={form.waterResistanceRating} onChange={(e) => set("waterResistanceRating", e.target.value)} placeholder="10 bar" />
            </div>
          )}
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-14" /></div>
          <Button className="w-full" onClick={submit}>Save service record</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
