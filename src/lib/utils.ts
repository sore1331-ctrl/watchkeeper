import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Currency ───────────────────────────────────────────────────────────────

/** Currencies offered in the pickers. Any ISO 4217 code still formats fine. */
export const CURRENCIES: { code: string; label: string }[] = [
  { code: "GBP", label: "British pound (£)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "USD", label: "US dollar ($)" },
  { code: "PLN", label: "Polish złoty (zł)" },
  { code: "CHF", label: "Swiss franc (CHF)" },
  { code: "JPY", label: "Japanese yen (¥)" },
  { code: "AUD", label: "Australian dollar (A$)" },
  { code: "CAD", label: "Canadian dollar (C$)" },
  { code: "SEK", label: "Swedish krona (kr)" },
  { code: "NOK", label: "Norwegian krone (kr)" },
  { code: "DKK", label: "Danish krone (kr)" },
  { code: "CZK", label: "Czech koruna (Kč)" },
  { code: "SGD", label: "Singapore dollar (S$)" },
  { code: "HKD", label: "Hong Kong dollar (HK$)" },
  { code: "NZD", label: "New Zealand dollar (NZ$)" },
  { code: "ZAR", label: "South African rand (R)" },
  { code: "INR", label: "Indian rupee (₹)" },
  { code: "AED", label: "UAE dirham (AED)" },
];

const REGION_CURRENCY: Record<string, string> = {
  GB: "GBP", IE: "EUR", US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD",
  PL: "PLN", CZ: "CZK", SE: "SEK", NO: "NOK", DK: "DKK", CH: "CHF",
  JP: "JPY", SG: "SGD", HK: "HKD", ZA: "ZAR", IN: "INR", AE: "AED",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", SK: "EUR", SI: "EUR",
  EE: "EUR", LV: "EUR", LT: "EUR", LU: "EUR", CY: "EUR", MT: "EUR", HR: "EUR",
};

/** Currency implied by the browser's locale — a sane default, not a guess to live with. */
export function detectCurrency(): string {
  if (typeof navigator === "undefined") return "GBP";
  for (const loc of navigator.languages ?? [navigator.language]) {
    const region = new Intl.Locale(loc).maximize().region;
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return "GBP";
}

export function fmtMoney(
  v: number | null | undefined,
  currency = "GBP"
): string {
  if (v == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    // unknown code — show the number with the code alongside
    return `${new Intl.NumberFormat().format(v)} ${currency}`;
  }
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - +new Date(iso);
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 31) return `${d}d ago`;
  const m = Math.floor(d / 30.44);
  if (m < 12) return `${m}mo ago`;
  return `${Math.floor(m / 12)}y ago`;
}

/**
 * Total a set of amounts that may be in different currencies. No exchange
 * rates are invented — each currency is totalled separately and shown as
 * such, so a mixed collection is reported honestly rather than added up wrong.
 */
export function fmtTotal(
  items: { amount: number | null | undefined; currency?: string }[],
  fallbackCurrency: string
): string {
  const byCurrency = new Map<string, number>();
  for (const { amount, currency } of items) {
    if (amount == null) continue;
    const code = currency || fallbackCurrency;
    byCurrency.set(code, (byCurrency.get(code) ?? 0) + amount);
  }
  if (byCurrency.size === 0) return "—";
  return [...byCurrency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, total]) => fmtMoney(total, code))
    .join(" + ");
}

/**
 * Record id. These are primary keys in a table shared by every account, so
 * they must be unguessable and never repeat between users.
 */
export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/** A link the user typed, if it is an ordinary web address — otherwise null. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
