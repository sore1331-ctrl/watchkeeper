"use client";

// ─── Entry forms: quick measurement, watch profile, service record ──────────

import React, { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Measurement, MovementType, ServiceRecord, ServiceType, Watch, WatchPosition } from "@/lib/types";
import { Button, Dialog, DialogContent, DialogTrigger, Input, Label, Select, Switch, Textarea } from "./ui";
import { filterSuggestions, modelsForBrand, WATCH_BRANDS, type CatalogModel } from "@/lib/watch-catalog";

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

/** hh:mm:ss → seconds since midnight; supports hh:mm too */
function parseHms(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/);
  if (!m) return null;
  return +m[1] * 3600 + +m[2] * 60 + (m[3] ? +m[3] : 0);
}

const nowHms = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export function MeasurementDialog({
  watchId, trigger,
}: {
  watchId?: string;
  trigger?: React.ReactNode;
}) {
  const { watches, measurementsFor, addMeasurement } = useStore();
  const active = watches.filter((w) => !w.archived);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    watchId: watchId ?? active[0]?.id ?? "",
    referenceTime: nowHms(),
    watchTime: nowHms(),
    temperatureC: "",
    position: "on-wrist" as WatchPosition,
    powerReservePct: "",
    wornToday: true,
    notes: "",
  }));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const offset = useMemo(() => {
    const ref = parseHms(form.referenceTime);
    const wt = parseHms(form.watchTime);
    if (ref == null || wt == null) return null;
    let d = wt - ref;
    if (d > 43200) d -= 86400; // wrap midnight
    if (d < -43200) d += 86400;
    return Math.round(d * 10) / 10;
  }, [form.referenceTime, form.watchTime]);

  const prev = useMemo(() => {
    const ms = measurementsFor(form.watchId);
    return ms[ms.length - 1] ?? null;
  }, [form.watchId, measurementsFor]);

  const projectedSpd = useMemo(() => {
    if (offset == null || !prev) return null;
    const gapDays = (Date.now() - +new Date(prev.measuredAt)) / 86_400_000;
    if (gapDays < 0.04) return null;
    return (offset - prev.offsetSeconds) / gapDays;
  }, [offset, prev]);

  const submit = () => {
    if (offset == null || !form.watchId) return;
    const m: Omit<Measurement, "id"> = {
      watchId: form.watchId,
      measuredAt: new Date().toISOString(),
      referenceTime: form.referenceTime,
      watchTime: form.watchTime,
      offsetSeconds: offset,
      temperatureC: form.temperatureC ? +form.temperatureC : undefined,
      position: form.position,
      powerReservePct: form.powerReservePct ? +form.powerReservePct : undefined,
      wornToday: form.wornToday,
      notes: form.notes || undefined,
    };
    addMeasurement(m);
    setOpen(false);
    setForm((f) => ({ ...f, referenceTime: nowHms(), watchTime: nowHms(), notes: "" }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" /> Add measurement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title="New measurement">
        <div className="space-y-4">
          <div>
            <Label>Watch</Label>
            <Select value={form.watchId} onChange={(e) => set("watchId", e.target.value)}>
              {active.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.brand} {w.model}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reference time (atomic)</Label>
              <Input
                value={form.referenceTime}
                onChange={(e) => set("referenceTime", e.target.value)}
                placeholder="14:30:00" className="font-mono"
              />
            </div>
            <div>
              <Label>Watch time</Label>
              <Input
                value={form.watchTime}
                onChange={(e) => set("watchTime", e.target.value)}
                placeholder="14:30:04" className="font-mono"
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
            {projectedSpd != null && Math.abs(projectedSpd) < 120 && (
              <p className="text-xs text-muted">
                ≈ {projectedSpd > 0 ? "+" : ""}{projectedSpd.toFixed(1)} s/d since last measurement
              </p>
            )}
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
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes…" className="min-h-14" />
          </div>
          <Button className="w-full" onClick={submit} disabled={offset == null || !form.watchId}>
            Save measurement
          </Button>
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
  const { addWatch, updateWatch, watches } = useStore();
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
      filterSuggestions(form.model, brandModels.map((m) => m.model)).map((label) => {
        const m = brandModels.find((x) => x.model === label);
        return { label, sub: m?.reference ?? m?.caliber };
      }),
    [form.model, brandModels]
  );

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
      jewels: f.jewels || (m.jewels?.toString() ?? ""),
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
      purchaseDate: form.purchaseDate || undefined,
      purchasePrice: form.purchasePrice ? +form.purchasePrice : undefined,
      currentValue: form.currentValue ? +form.currentValue : undefined,
      currency: existing?.currency ?? "EUR",
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
            <div><Label>Caliber</Label><Input value={form.caliber} onChange={(e) => set("caliber", e.target.value)} placeholder="3861" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Beat rate (vph)</Label><Input type="number" value={form.beatRate} onChange={(e) => set("beatRate", e.target.value)} placeholder="28800" /></div>
            <div><Label>Reserve (h)</Label><Input type="number" value={form.powerReserveHours} onChange={(e) => set("powerReserveHours", e.target.value)} placeholder="70" /></div>
            <div><Label>Jewels</Label><Input type="number" value={form.jewels} onChange={(e) => set("jewels", e.target.value)} placeholder="26" /></div>
          </div>
          {form.movementType === "quartz" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Battery installed</Label><Input type="date" value={form.batteryInstalledAt} onChange={(e) => set("batteryInstalledAt", e.target.value)} /></div>
              <div><Label>Battery life (months)</Label><Input type="number" value={form.batteryLifeMonths} onChange={(e) => set("batteryLifeMonths", e.target.value)} placeholder="24" /></div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Purchased</Label><Input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></div>
            <div><Label>Price</Label><Input type="number" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} /></div>
            <div><Label>Value now</Label><Input type="number" value={form.currentValue} onChange={(e) => set("currentValue", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Warranty until</Label><Input type="date" value={form.warrantyUntil} onChange={(e) => set("warrantyUntil", e.target.value)} /></div>
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
  const { watches, addService } = useStore();
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
      currency: "EUR",
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
            <div><Label>Cost (€)</Label><Input type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)} /></div>
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
