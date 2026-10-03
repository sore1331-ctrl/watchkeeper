// ─── Built-in catalog: movements, and the models that use them ──────────────
// Picking a known model, or typing a known caliber, prefills the movement's
// figures in the watch form and tells the analysis what tolerance to judge the
// watch against. Free-text entry always remains possible.

import type { MovementType } from "./types";

export interface CatalogModel {
  model: string;
  /** what collectors actually call it — "BB58", "Speedy" */
  aliases?: string[];
  reference?: string;
  movementType: MovementType;
  caliber?: string;
  beatRate?: number;
  powerReserveHours?: number;
  /** not supplied by the catalog (see MOVEMENTS); kept for watches that record it */
  jewels?: number;
  cosc?: boolean;
  /** the movement's figures were looked up against a published source */
  checked?: boolean;
}

// ─── Manufacturer daily-rate specifications ─────────────────────────────────
// A movement should be judged against the tolerance its maker built it to, not
// against a single universal scale. A Seiko 4R34 at −28 s/d is inside spec and
// healthy; a Rolex 3235 at −28 s/d is badly out. Only specs that manufacturers
// actually publish are listed — anything unknown falls back to a generic scale
// and can be overridden per watch in the watch profile.

export interface RateSpec {
  min: number; // s/d
  max: number; // s/d
  source: string;
}

// `brands` limits a pattern to the makers that use that numbering: "3120" is
// an Audemars Piguet caliber, not a Rolex, whatever the digits look like.
// Patterns without it are movements sold to many brands, and match anywhere
// in what was typed ("Oris 733 (SW200-1)", "TMI NH35A").
//
// Brand-specific patterns come first so a bare number is claimed by its own
// maker before a generic family can match it.
const CALIBER_SPECS: { match: RegExp; brands?: string[]; spec: RateSpec }[] = [
  // Rolex — Superlative Chronometer (after casing)
  { match: /^(31\d\d|32\d\d|41\d\d|21\d\d|900[12])$/i, brands: ["rolex"], spec: { min: -2, max: 2, source: "Rolex Superlative Chronometer" } },
  // Omega — METAS Master Chronometer
  { match: /^(88\d\d|89\d\d|3861)$/i, brands: ["omega"], spec: { min: 0, max: 5, source: "METAS Master Chronometer" } },
  // Tudor Master Chronometer ("-U" calibers) — METAS, tighter than plain COSC
  { match: /^MT\d{4}.*U$/i, brands: ["tudor"], spec: { min: 0, max: 5, source: "Tudor Master Chronometer (METAS)" } },
  // Tudor Manufacture
  { match: /^MT\d{4}/i, brands: ["tudor"], spec: { min: -2, max: 4, source: "Tudor Manufacture (COSC)" } },
  // Grand Seiko 9F quartz — ±10 s/year
  { match: /^9F\d\d$/i, brands: ["grand seiko", "seiko"], spec: { min: -0.03, max: 0.03, source: "Grand Seiko 9F (±10 s/year)" } },
  // Grand Seiko Spring Drive — ±15 s/month; no escapement, so no beat rate
  { match: /^9R/i, brands: ["grand seiko", "seiko"], spec: { min: -1, max: 1, source: "Grand Seiko Spring Drive (±1 s/day)" } },
  // Grand Seiko mechanical 9S — static rate
  { match: /^9S/i, brands: ["grand seiko", "seiko"], spec: { min: -3, max: 5, source: "Grand Seiko 9S standard" } },
  // Oris Calibre 400 series — Oris's own stated tolerance
  { match: /^(400|401|403|473)\b/, brands: ["oris"], spec: { min: -3, max: 5, source: "Oris Calibre 400 series" } },
  // Citizen — each figure is Citizen's own published one. Quartz tolerances
  // are stated per month or per year; here they are per day like the rest.
  { match: /^82\d\d\b/, brands: ["citizen"], spec: { min: -20, max: 40, source: "Citizen/Miyota 82xx specification" } },
  { match: /^90\d\d\b/, brands: ["citizen"], spec: { min: -10, max: 20, source: "Citizen 90xx specification" } },
  { match: /^0950\b/, brands: ["citizen"], spec: { min: -5, max: 10, source: "Citizen Caliber 0950" } },
  { match: /^0200\b/, brands: ["citizen"], spec: { min: -3, max: 5, source: "The Citizen Caliber 0200" } },
  { match: /^0100\b/, brands: ["citizen"], spec: { min: -0.003, max: 0.003, source: "The Citizen Caliber 0100 (±1 s/year)" } },
  { match: /^A060\b/i, brands: ["citizen"], spec: { min: -0.014, max: 0.014, source: "The Citizen A060 (±5 s/year)" } },
  { match: /^F9\d\d\b/i, brands: ["citizen"], spec: { min: -0.16, max: 0.16, source: "Citizen Satellite Wave F9xx (±5 s/month)" } },
  // every other Eco-Drive / radio-controlled quartz: a letter and three digits, or the Eco-Drive One
  { match: /^(eco[\s-]?drive\s*)?([A-Z]\d{3}|8826)\b/i, brands: ["citizen"], spec: { min: -0.5, max: 0.5, source: "Citizen Eco-Drive quartz (±15 s/month)" } },
  // quartz, stated per month by the maker
  { match: /^V15[78]\b/i, brands: ["seiko"], spec: { min: -0.5, max: 0.5, source: "Seiko solar V157/V158 (±15 s/month)" } },
  { match: /\b3229\b/, brands: ["casio", "g-shock"], spec: { min: -0.5, max: 0.5, source: "Casio module 3229 (±15 s/month)" } },
  // Seiko workhorses, also sold to other brands as the NH series
  { match: /\b4R\d\d/i, spec: { min: -35, max: 45, source: "Seiko 4R3x specification" } },
  { match: /\b6R\d\d/i, spec: { min: -15, max: 25, source: "Seiko 6R3x specification" } },
  { match: /\b7S\d\d/i, spec: { min: -20, max: 40, source: "Seiko 7S2x specification" } },
  { match: /\bNH\d\d/i, spec: { min: -20, max: 40, source: "Seiko NH3x specification" } },
  { match: /\b8L\d\d/i, spec: { min: -10, max: 15, source: "Seiko 8L3x specification" } },
  { match: /\b6L\d\d/i, spec: { min: -10, max: 15, source: "Seiko 6L3x specification" } },
  // Miyota
  { match: /Miyota\s*(90\d\d)/i, spec: { min: -10, max: 30, source: "Miyota 90xx specification" } },
  { match: /Miyota\s*(8[23]\d[\dA-Z])/i, spec: { min: -20, max: 40, source: "Miyota 8xxx specification" } },
  // Orient in-house F6
  { match: /\bF6\d{3}\b/i, spec: { min: -15, max: 25, source: "Orient F6 specification" } },
  // Swatch Sistem51
  { match: /sistem\s*51|\bC10111\b/i, spec: { min: -5, max: 15, source: "Swatch Sistem51 specification" } },
  // Powermatic 80 (ETA C07.x11) — Tissot's figure for the standard version
  { match: /powermatic\s*80|\bC07\.(111|611|811)\b/i, spec: { min: -4, max: 10, source: "Powermatic 80, standard (−4/+10 s/d)" } },
  // ETA 2824 / 2892 families and their Sellita equivalents. These are sold in
  // grades and a watch rarely says which it has, so the standard grade — the
  // widest — is assumed. Set the spec on the watch if yours is a better one.
  { match: /\bSW\s?-?[23]\d\d/i, spec: { min: -12, max: 12, source: "Sellita standard grade (±12 s/d; special ±7, premium ±4)" } },
  { match: /\b(2824|2834|2836|2892|2893|2895)\b/, spec: { min: -12, max: 12, source: "ETA standard grade (±12 s/d; elaboré ±7, top ±4)" } },
];

const COSC_SPEC: RateSpec = { min: -4, max: 6, source: "COSC chronometer" };

/**
 * What was typed, reduced to the caliber itself: no "Cal." or "Calibre" in
 * front, and no repeat of the brand name ("Omega 8900" on an Omega).
 */
function cleanCaliber(raw: string, brand: string): string {
  let c = raw.trim().replace(/^(cal(ib(re|er))?|kal(iber)?)\b\.?\s*/i, "");
  if (brand && c.toLowerCase().startsWith(brand)) c = c.slice(brand.length).trim();
  return c;
}

/**
 * Best-known rate tolerance for a caliber. COSC certification wins, since a
 * certified movement is tested to that band regardless of its base caliber.
 */
export function specForCaliber(
  caliber?: string, coscCertified?: boolean, brand?: string
): RateSpec | null {
  const b = brand?.trim().toLowerCase() ?? "";
  const c = caliber ? cleanCaliber(caliber, b) : "";
  const lookup = (text: string): RateSpec | null => {
    for (const { match, brands, spec } of CALIBER_SPECS) {
      if (brands && !brands.includes(b)) continue;
      if (match.test(text)) {
        // A certified chronometer is held to the tighter of the two bands
        if (coscCertified && spec.max - spec.min > COSC_SPEC.max - COSC_SPEC.min) return COSC_SPEC;
        return spec;
      }
    }
    return null;
  };
  if (c) {
    const direct = lookup(c);
    if (direct) return direct;
    // a bare "9015" is the Miyota 9015: try the movement's full name
    const known = findMovement(b, c);
    const byName = known ? lookup(`${known.maker} ${known.caliber}`) : null;
    if (byName) return byName;
  }
  return coscCertified ? COSC_SPEC : null;
}

// ─── Movements ──────────────────────────────────────────────────────────────
// One entry per movement, so its figures are stated — and checked — once, and
// every model that uses it inherits them. A figure is only given when it was
// looked up against a published source (`checked`); an unchecked movement is
// listed by name and type alone rather than with numbers from memory. Jewel
// counts are deliberately not carried: sources disagree on them too often to
// state with confidence, and nothing in the analysis uses them.

export interface Movement {
  maker: string;
  caliber: string;
  type: MovementType;
  /** vibrations per hour */
  beatRate?: number;
  powerReserveHours?: number;
  /** text put in the caliber field, when the bare caliber alone would not be recognisable */
  label?: string;
  /** figures looked up against a published source */
  checked?: boolean;
}

const A = "automatic" as const;
const M = "manual" as const;
const Q = "quartz" as const;
const mv = (
  maker: string, caliber: string, type: MovementType,
  beatRate?: number, powerReserveHours?: number, label?: string
): Movement => ({
  maker, caliber, type, beatRate, powerReserveHours, label,
  checked: beatRate != null || powerReserveHours != null || undefined,
});
/** a movement whose only published figure is its accuracy (quartz) — checked, but nothing to prefill */
const q = (maker: string, caliber: string): Movement => ({ maker, caliber, type: Q, checked: true });

export const MOVEMENTS: Movement[] = [
  // Rolex
  mv("Rolex", "3235", A, 28800, 70), mv("Rolex", "3230", A, 28800, 70),
  mv("Rolex", "3285", A, 28800, 70), mv("Rolex", "3255", A, 28800, 70),
  mv("Rolex", "4131", A, 28800, 72), mv("Rolex", "4130", A, 28800, 72),
  mv("Rolex", "9002", A, 28800, 72), mv("Rolex", "3135", A, 28800, 48),
  mv("Rolex", "3130", A, 28800, 48), mv("Rolex", "3131", A, 28800, 48),
  // Omega
  mv("Omega", "3861", M, 21600), mv("Omega", "1861", M, 21600),
  mv("Omega", "8800", A, 25200, 55), mv("Omega", "8806", A, 25200),
  mv("Omega", "8900", A, 25200), mv("Omega", "8912", A, 25200),
  mv("Omega", "8500", A, 25200, 60), mv("Omega", "3330", A, 28800, 52),
  mv("Omega", "9900", A), mv("Omega", "2500", A), mv("Omega", "3220", A),
  // Tudor
  mv("Tudor", "MT5402", A, 28800, 70), mv("Tudor", "MT5400", A, 28800, 70),
  mv("Tudor", "MT5602", A, 28800, 70), mv("Tudor", "MT5602-U", A, 28800, 70),
  mv("Tudor", "MT5601", A, 28800, 70), mv("Tudor", "MT5813", A, 28800, 70),
  mv("Tudor", "MT5612", A), mv("Tudor", "MT5652", A),
  mv("Tudor", "T601", A, 28800, 38), mv("Tudor", "T603", A, 28800, 38),
  // Seiko
  mv("Seiko", "4R35", A, 21600, 41), mv("Seiko", "4R36", A, 21600, 41), mv("Seiko", "4R34", A),
  mv("Seiko", "6R35", A, 21600, 70), mv("Seiko", "6R15", A, 21600, 50),
  mv("Seiko", "7S26", A), mv("Seiko", "8L35", A, 28800, 50), mv("Seiko", "6L35", A, 28800, 45),
  mv("Seiko", "NH35", A, 21600, 41), mv("Seiko", "NH36", A, 21600, 41), mv("Seiko", "NH34", A),
  q("Seiko", "V157"),
  // Grand Seiko
  mv("Grand Seiko", "9S65", A, 28800, 72), mv("Grand Seiko", "9S64", M, 28800, 72),
  mv("Grand Seiko", "9S66", A, 28800, 72), mv("Grand Seiko", "9S85", A, 36000, 55),
  mv("Grand Seiko", "9S86", A, 36000, 55), mv("Grand Seiko", "9SA5", A, 36000, 80),
  // Spring Drive: wound like an automatic, but no escapement and so no beat rate
  mv("Grand Seiko", "9R65", A, undefined, 72), mv("Grand Seiko", "9R66", A, undefined, 72),
  q("Grand Seiko", "9F62"), q("Grand Seiko", "9F85"),
  // ETA and the movements built on it
  mv("ETA", "2824-2", A, 28800, 38), mv("ETA", "2836-2", A), mv("ETA", "2892-A2", A, 28800, 42),
  mv("ETA", "7750", A, 28800, 44), mv("ETA", "2801-2", M),
  mv("ETA", "6497-2", M, 21600, 53), mv("ETA", "6498-2", M, 21600, 53),
  mv("ETA", "C07.111", A, 21600, 80, "Powermatic 80 (C07.111)"),
  mv("ETA", "C07.611", A, 21600, 80, "Powermatic 80 (C07.611)"),
  mv("ETA", "C07.811", A, 21600, 80, "Powermatic 80 (C07.811)"),
  mv("Mido", "Caliber 80", A, 21600, 80, "Caliber 80 (C07.621)"),
  mv("Rado", "R763", A, 21600, 80, "R763 (C07 series)"),
  // Sellita
  mv("Sellita", "SW200-1", A, 28800, 38), mv("Sellita", "SW220-1", A, 28800, 41),
  mv("Sellita", "SW300-1", A, 28800, 56), mv("Sellita", "SW500-1", A),
  // Miyota
  mv("Miyota", "9015", A, 28800, 42), mv("Miyota", "9039", A, 28800),
  mv("Miyota", "8215", A, 21600, 42), mv("Miyota", "8315", A, 21600, 60), mv("Miyota", "821D", A),
  // Hamilton
  mv("Hamilton", "H-10", A, 21600, 80), mv("Hamilton", "H-30", A, 21600, 80),
  mv("Hamilton", "H-50", M, 21600, 80), mv("Hamilton", "H-31", A, 28800, 60),
  // Longines
  mv("Longines", "L888.4", A, 25200, 72), mv("Longines", "L888.5", A, 25200), mv("Longines", "L844.4", A),
  // Oris, IWC, Nomos
  mv("Oris", "400", A, 28800, 120, "Oris 400"),
  mv("IWC", "32111", A, 28800, 120), mv("IWC", "82100", A, 28800, 60),
  mv("IWC", "69355", A), mv("IWC", "35111", A),
  mv("Nomos", "Alpha", M, 21600), mv("Nomos", "DUW 3001", A),
  // Breitling, TAG Heuer, Zenith
  mv("Breitling", "B01", A, 28800, 70), mv("Breitling", "B20", A, 28800, 70),
  mv("TAG Heuer", "TH20-00", A, 28800, 80), mv("TAG Heuer", "Heuer 02", A, 28800, 80),
  mv("Zenith", "El Primero 3600", A, 36000, 60), mv("Zenith", "El Primero 400", A, 36000, 50),
  mv("Zenith", "El Primero 3620", A),
  // Citizen
  mv("Citizen", "8210", A, 21600, 40), mv("Citizen", "8203", A, 21600), mv("Citizen", "8204", A, 21600, 40),
  mv("Citizen", "9051", A, 28800, 42), mv("Citizen", "9054", A, 28800, 50),
  mv("Citizen", "0950", A, 28800), mv("Citizen", "0200", A, 28800, 60),
  q("Citizen", "F950"), q("Citizen", "H874"), q("Citizen", "H800"), q("Citizen", "E168"),
  q("Citizen", "B877"), q("Citizen", "8826"), q("Citizen", "A060"), q("Citizen", "0100"),
  { maker: "Citizen", caliber: "U680", type: Q },
  // Orient, Vostok, Seagull, Hangzhou, Casio
  mv("Orient", "F6922", A, 21600, 40), mv("Orient", "F6724", A, 21600, 40),
  mv("Vostok", "2416B", A, 19800, 31), mv("Seagull", "ST1901", M, 21600, 51),
  mv("Hangzhou", "5000A", A, 28800, 42), q("Casio", "3229"),
  // Listed by name only — figures not looked up
  mv("Swatch", "Sistem51", A, undefined, undefined, "Sistem51 (C10111)"),
  mv("Jaeger-LeCoultre", "822/2", M), mv("Jaeger-LeCoultre", "899", A), mv("Jaeger-LeCoultre", "898", A),
  mv("Cartier", "1847 MC", A),
  mv("Patek Philippe", "26-330 S C", A),
  mv("Audemars Piguet", "4302", A), mv("Audemars Piguet", "4404", A), mv("Audemars Piguet", "3120", A),
  mv("A. Lange & Söhne", "L093.1", M), mv("A. Lange & Söhne", "L121.1", M),
  mv("Panerai", "P.9010", A), mv("Panerai", "P.6000", M),
  mv("Blancpain", "1315", A), mv("Girard-Perregaux", "GP01800", A),
  mv("Glashütte Original", "36-01", A), mv("Glashütte Original", "39-11", A), mv("Glashütte Original", "90-02", A),
  mv("Ulysse Nardin", "UN-118", A), mv("Ulysse Nardin", "UN-816", A),
  mv("Vacheron Constantin", "5100", A), mv("Vacheron Constantin", "1326", A), mv("Vacheron Constantin", "4400 AS", M),
];

const movementKey = (maker: string, caliber: string) => `${maker} ${caliber}`.toLowerCase();
const MOVEMENT_INDEX = new Map(MOVEMENTS.map((m) => [movementKey(m.maker, m.caliber), m]));

/** What goes in a watch's caliber field for this movement. */
function caliberText(m: Movement, brand: string): string {
  if (m.label) return m.label;
  // an in-house caliber needs no maker in front of it; a bought-in one does
  return m.maker.toLowerCase() === brand.toLowerCase() ? m.caliber : `${m.maker} ${m.caliber}`;
}

/**
 * The movement a typed caliber refers to, if it is one the catalog knows:
 * the brand's own caliber first, then the widely sold ones by any maker.
 */
export function findMovement(brand: string, caliber: string): Movement | undefined {
  const b = brand.trim().toLowerCase();
  const c = cleanCaliber(caliber, b).toLowerCase();
  if (!c) return undefined;
  const own = MOVEMENTS.find((m) => m.maker.toLowerCase() === b && m.caliber.toLowerCase() === c);
  if (own) return own;
  const SHARED = ["eta", "sellita", "miyota", "seiko", "seagull", "hangzhou"];
  return MOVEMENTS.find((m) => {
    if (!SHARED.includes(m.maker.toLowerCase())) return false;
    const name = m.caliber.toLowerCase();
    // "ETA 2824-2", "2824", "SW200", "Seiko NH35A", "J800.1 (ETA 2824-2)"
    const stem = name.replace(/-\w+$/, "").replace(/[^a-z0-9]/g, "\\$&");
    return new RegExp("(^|[^a-z0-9])" + stem, "i").test(c);
  });
}

// ─── Models ─────────────────────────────────────────────────────────────────
// [model, movement ("Maker caliber") or null for a quartz watch with no
// caliber worth naming, options]. Which movement a model uses is from general
// knowledge of the current reference; reference numbers are only given where
// they were looked up (so far: Citizen).

type Row = [
  model: string,
  movement: string | null,
  opts?: { aliases?: string[]; reference?: string; cosc?: boolean; caliber?: string },
];

const CATALOG: Record<string, Row[]> = {
  Rolex: [
    ["Submariner Date", "Rolex 3235", { aliases: ["Sub Date"], cosc: true }],
    ["Submariner No-Date", "Rolex 3230", { aliases: ["Sub No Date", "No Date Sub"], cosc: true }],
    ["Submariner Date 116610", "Rolex 3135", { cosc: true }],
    ["Submariner 114060", "Rolex 3130", { cosc: true }],
    ["Datejust 36", "Rolex 3235", { aliases: ["DJ36"], cosc: true }],
    ["Datejust 41", "Rolex 3235", { aliases: ["DJ41"], cosc: true }],
    ["Day-Date 40", "Rolex 3255", { aliases: ["President"], cosc: true }],
    ["GMT-Master II", "Rolex 3285", { aliases: ["Batman", "Batgirl", "Pepsi", "GMT Master"], cosc: true }],
    ["Explorer 36", "Rolex 3230", { cosc: true }],
    ["Explorer 40", "Rolex 3230", { cosc: true }],
    ["Explorer II", "Rolex 3285", { cosc: true }],
    ["Daytona", "Rolex 4131", { cosc: true }],
    ["Daytona 116500", "Rolex 4130", { cosc: true }],
    ["Oyster Perpetual 36", "Rolex 3230", { aliases: ["OP36"], cosc: true }],
    ["Oyster Perpetual 41", "Rolex 3230", { aliases: ["OP41"], cosc: true }],
    ["Sea-Dweller", "Rolex 3235", { cosc: true }],
    ["Deepsea", "Rolex 3235", { cosc: true }],
    ["Yacht-Master 40", "Rolex 3235", { cosc: true }],
    ["Air-King", "Rolex 3230", { cosc: true }],
    ["Sky-Dweller", "Rolex 9002", { cosc: true }],
    ["Milgauss", "Rolex 3131", { cosc: true }],
  ],
  Omega: [
    ["Speedmaster Professional", "Omega 3861", { aliases: ["Speedy", "Moonwatch", "Speedy Pro"], cosc: true }],
    ["Speedmaster Professional (cal. 1861)", "Omega 1861"],
    ["Speedmaster Racing", "Omega 3330", { cosc: true }],
    ["Speedmaster Reduced", "Omega 3220"],
    ["Seamaster Diver 300M", "Omega 8800", { aliases: ["SMP", "SMP300", "Seamaster 300M"], cosc: true }],
    ["Seamaster Diver 300M Chronograph", "Omega 9900", { cosc: true }],
    ["Seamaster Aqua Terra 150M", "Omega 8900", { aliases: ["Aqua Terra"], cosc: true }],
    ["Seamaster Planet Ocean 600M", "Omega 8900", { aliases: ["Planet Ocean"], cosc: true }],
    ["Seamaster 300", "Omega 8912", { cosc: true }],
    ["Constellation", "Omega 8800", { cosc: true }],
    ["De Ville Prestige", "Omega 2500", { cosc: true }],
    ["Railmaster", "Omega 8806", { cosc: true }],
  ],
  Seiko: [
    ["Prospex SPB143", "Seiko 6R35", { aliases: ["62MAS"] }],
    ["Prospex SPB317", "Seiko 6R35"],
    ["Prospex Alpinist SPB121", "Seiko 6R35", { aliases: ["Alpinist"] }],
    ["Presage Sharp Edged", "Seiko 6R35"],
    ["Presage Cocktail Time", "Seiko 4R35"],
    ["Presage Style 60s", "Seiko 4R35"],
    ["Prospex Samurai", "Seiko 4R35", { aliases: ["Samurai"] }],
    ["Prospex Turtle", "Seiko 4R36", { aliases: ["Turtle"] }],
    ["Prospex Monster", "Seiko 4R36", { aliases: ["Monster"] }],
    ["Seiko 5 Sports SRPD", "Seiko 4R36", { aliases: ["5KX"] }],
    ["5 Sports GMT SSK001", "Seiko 4R34"],
    ["5 Sports GMT SSK003", "Seiko 4R34"],
    ["SKX007", "Seiko 7S26"],
    ["SKX009", "Seiko 7S26"],
    ["Seiko 5 SNK809", "Seiko 7S26", { aliases: ["SNK809"] }],
    ["SARB033", "Seiko 6R15"],
    ["SARB017 Alpinist", "Seiko 6R15"],
    ["Marinemaster 300", "Seiko 8L35", { aliases: ["MM300"] }],
    ["Presage SJE073", "Seiko 6L35"],
    ["Prospex Solar Diver", "Seiko V157"],
  ],
  "Grand Seiko": [
    ["SBGX261", "Grand Seiko 9F62"],
    ["SBGP013", "Grand Seiko 9F85"],
    ["SBGA211 \"Snowflake\"", "Grand Seiko 9R65", { aliases: ["Snowflake"] }],
    ["SBGA413 \"Shunbun\"", "Grand Seiko 9R65", { aliases: ["Shunbun"] }],
    ["SBGE257", "Grand Seiko 9R66"],
    ["SBGW231", "Grand Seiko 9S64"],
    ["SBGR251", "Grand Seiko 9S65"],
    ["SBGM221", "Grand Seiko 9S66"],
    ["SBGH201", "Grand Seiko 9S85"],
    ["SBGJ201", "Grand Seiko 9S86"],
    ["SLGH005 \"White Birch\"", "Grand Seiko 9SA5", { aliases: ["White Birch"] }],
  ],
  Tudor: [
    ["Black Bay 58", "Tudor MT5402", { aliases: ["BB58"], cosc: true }],
    ["Black Bay 54", "Tudor MT5400", { aliases: ["BB54"], cosc: true }],
    ["Black Bay 41", "Tudor MT5602-U", { aliases: ["BB41"], cosc: true }],
    ["Black Bay GMT", "Tudor MT5652", { aliases: ["BB GMT"], cosc: true }],
    ["Black Bay Pro", "Tudor MT5652", { aliases: ["BB Pro"], cosc: true }],
    ["Black Bay Chrono", "Tudor MT5813", { cosc: true }],
    ["Black Bay Bronze", "Tudor MT5601", { cosc: true }],
    ["Pelagos", "Tudor MT5612", { cosc: true }],
    ["Pelagos 39", "Tudor MT5400", { cosc: true }],
    ["Pelagos FXD", "Tudor MT5602", { cosc: true }],
    ["Ranger", "Tudor MT5402", { cosc: true }],
    ["Royal", "Tudor T601"],
    ["Royal 41 Day-Date", "Tudor T603"],
    ["1926", "Tudor T601"],
  ],
  Nomos: [
    ["Tangente 38", "Nomos Alpha"],
    ["Club Campus 38", "Nomos Alpha"],
    ["Orion 38", "Nomos Alpha"],
    ["Ludwig 38", "Nomos Alpha"],
    ["Tangente Neomatik 39", "Nomos DUW 3001"],
    ["Metro Neomatik", "Nomos DUW 3001"],
  ],
  Longines: [
    ["Spirit Zulu Time", "Longines L844.4", { cosc: true }],
    ["Spirit 40", "Longines L888.4", { cosc: true }],
    ["HydroConquest 41", "Longines L888.5"],
    ["Legend Diver", "Longines L888.5"],
    ["Master Collection 40", "Longines L888.5"],
    ["Conquest 41", "Longines L888.5"],
  ],
  Tissot: [
    ["PRX Powermatic 80", "ETA C07.111"],
    ["Seastar 1000 Powermatic 80", "ETA C07.111"],
    ["Le Locle Powermatic 80", "ETA C07.111"],
    ["Gentleman Powermatic 80 Silicium", "ETA C07.811"],
    ["PRX 40 Quartz", null],
    ["Everytime", null],
  ],
  Hamilton: [
    ["Khaki Field Mechanical 38", "Hamilton H-50"],
    ["Khaki Field Auto 38", "Hamilton H-10"],
    ["Khaki Field Auto 42", "Hamilton H-10"],
    ["Khaki Field Murph", "Hamilton H-10", { aliases: ["Murph"] }],
    ["Khaki Aviation Pilot Pioneer", "Hamilton H-10"],
    ["Jazzmaster Open Heart 40", "Hamilton H-10"],
    ["Khaki Field Day Date", "Hamilton H-30"],
    ["Intra-Matic Auto Chrono", "Hamilton H-31"],
    ["Ventura", null],
  ],
  Oris: [
    ["Aquis Date 41.5", "Sellita SW200-1", { caliber: "Oris 733 (Sellita SW200-1)" }],
    ["Divers Sixty-Five 40", "Sellita SW200-1", { caliber: "Oris 733 (Sellita SW200-1)" }],
    ["Big Crown Pointer Date", "Sellita SW200-1", { caliber: "Oris 754 (Sellita SW200-1)" }],
    ["Big Crown ProPilot", "Sellita SW220-1", { caliber: "Oris 751 (Sellita SW220-1)" }],
    ["ProPilot X Calibre 400", "Oris 400"],
    ["Aquis Date Calibre 400", "Oris 400"],
  ],
  IWC: [
    ["Pilot's Watch Mark XX", "IWC 32111"],
    ["Ingenieur Automatic 40", "IWC 32111"],
    ["Aquatimer Automatic", "IWC 32111"],
    ["Big Pilot 43", "IWC 82100"],
    ["Portugieser Chronograph", "IWC 69355"],
    ["Portofino Automatic", "IWC 35111"],
  ],
  Breitling: [
    ["Navitimer B01 43", "Breitling B01", { cosc: true }],
    ["Chronomat B01 42", "Breitling B01", { cosc: true }],
    ["Superocean Heritage 42", "Breitling B20", { cosc: true }],
    ["Superocean Automatic 42", "ETA 2824-2", { caliber: "Breitling 17 (ETA 2824-2)", cosc: true }],
  ],
  "TAG Heuer": [
    ["Carrera Chronograph 42", "TAG Heuer TH20-00"],
    ["Monaco", "TAG Heuer Heuer 02"],
    ["Carrera Calibre 5", "Sellita SW200-1", { caliber: "Calibre 5 (Sellita SW200-1)" }],
    ["Aquaracer Professional 300", "Sellita SW200-1", { caliber: "Calibre 5 (Sellita SW200-1)" }],
    ["Formula 1 Quartz", null],
  ],
  Sinn: [
    ["556 I", "Sellita SW200-1"],
    ["104 St Sa", "Sellita SW220-1"],
    ["U50", "Sellita SW300-1"],
    ["356 Flieger", "Sellita SW500-1"],
  ],
  "Jaeger-LeCoultre": [
    ["Reverso Classic Medium", "Jaeger-LeCoultre 822/2"],
    ["Master Ultra Thin Date", "Jaeger-LeCoultre 899"],
    ["Polaris Automatic", "Jaeger-LeCoultre 898"],
  ],
  Cartier: [
    ["Tank Must", null],
    ["Tank Must Extra-Large Auto", "Cartier 1847 MC"],
    ["Santos Medium", "Cartier 1847 MC"],
    ["Santos Large", "Cartier 1847 MC"],
    ["Ballon Bleu 40", "Cartier 1847 MC"],
  ],
  Zenith: [
    ["Chronomaster Sport", "Zenith El Primero 3600"],
    ["Chronomaster Original", "Zenith El Primero 3600"],
    ["Chronomaster El Primero", "Zenith El Primero 400"],
    ["Defy Skyline", "Zenith El Primero 3620"],
  ],
  Casio: [
    ["F-91W", null],
    ["A168", null],
    ["AE-1200", null, { aliases: ["Casio Royale", "Royale"] }],
    ["MDV-106", null, { aliases: ["Duro", "Marlin"] }],
    ["Oceanus S100", null],
    ["Edifice", null],
  ],
  "G-Shock": [
    ["DW-5600", "Casio 3229", { aliases: ["Square"], caliber: "Module 3229" }],
    ["GW-M5610", null],
    ["GW-5000", null],
    ["DW-6900", null],
    ["GA-2100", null, { aliases: ["CasiOak"] }],
    ["GA-B2100", null],
    ["Mudmaster", null],
  ],
  // Citizen: lines, references, calibers and tolerances looked up 2026-10.
  // Radio-controlled and GPS models keep their stated accuracy only between
  // signals; with reception they are corrected daily.
  Citizen: [
    ["Attesa ACT Line Satellite Wave GPS", "Citizen F950", { aliases: ["Attesa GPS", "Attesa F950"], reference: "CC4055-65E" }],
    ["Attesa Satellite Wave GPS", "Citizen F950", { reference: "CC4105-69E" }],
    ["Attesa Radio-Controlled", "Citizen H874", { aliases: ["Attesa H874"], reference: "BY1001-66E" }],
    ["Attesa Radio-Controlled Chronograph", "Citizen H800", { aliases: ["Attesa H800"] }],
    ["Promaster Dive Eco-Drive", "Citizen E168", { reference: "BN0150-28E" }],
    ["Promaster Mechanical Diver 200m", "Citizen 9051", { aliases: ["Fujitsubo"], reference: "NB6021-68L" }],
    ["Promaster Diver Automatic", "Citizen 8203", { aliases: ["NY0040"], reference: "NY0040-17L" }],
    ["Promaster Fugu", "Citizen 8204", { aliases: ["Fugu"], reference: "NY0155-58X" }],
    ["Promaster Nighthawk", "Citizen B877", { aliases: ["Nighthawk"], reference: "BJ7000-52E" }],
    ["Promaster Navihawk A-T", "Citizen U680", { aliases: ["Navihawk"], reference: "JY8033-51E" }],
    ["Series 8 870", "Citizen 0950", { reference: "NA1004-87E" }],
    ["Series 8 831", "Citizen 9051", { reference: "NB6050-51W" }],
    ["Series 8 880 GMT", "Citizen 9054", { reference: "NB6031-56E" }],
    ["Tsuyosa", "Citizen 8210", { reference: "NJ0150-81E" }],
    ["Eco-Drive One", "Citizen 8826"],
    ["The Citizen Chronomaster", "Citizen A060", { reference: "AQ4100-57C" }],
    ["The Citizen Caliber 0100", "Citizen 0100", { reference: "AQ6021-51E" }],
    ["The Citizen Mechanical Caliber 0200", "Citizen 0200", { reference: "NC0210-11A" }],
  ],
  Orient: [
    ["Bambino", "Orient F6724"],
    ["Kamasu", "Orient F6922"],
    ["Mako II", "Orient F6922", { aliases: ["Mako"] }],
    ["Ray II", "Orient F6922", { aliases: ["Ray"] }],
  ],
  "Christopher Ward": [
    ["C60 Trident Pro 300", "Sellita SW200-1"],
    ["C65 Dune", "Sellita SW200-1"],
    ["C63 Sealander", "Sellita SW200-1"],
    ["The Twelve", "Sellita SW200-1"],
  ],
  "Patek Philippe": [
    ["Aquanaut 5167", "Patek Philippe 26-330 S C"],
    ["Nautilus 5811", "Patek Philippe 26-330 S C"],
  ],
  "Audemars Piguet": [
    ["Royal Oak 41 Selfwinding", "Audemars Piguet 4302"],
    ["Royal Oak 15400", "Audemars Piguet 3120"],
    ["Royal Oak Offshore Chronograph", "Audemars Piguet 4404"],
  ],
  "A. Lange & Söhne": [
    ["Saxonia Thin", "A. Lange & Söhne L093.1"],
    ["Lange 1", "A. Lange & Söhne L121.1"],
  ],
  Panerai: [
    ["Luminor Marina 44", "Panerai P.9010"],
    ["Luminor Base Logo", "Panerai P.6000"],
  ],
  Mido: [
    ["Ocean Star 200", "Mido Caliber 80"],
    ["Baroncelli Heritage", "Mido Caliber 80"],
    ["Multifort M", "Mido Caliber 80"],
  ],
  Junghans: [
    ["Max Bill Automatic", "ETA 2824-2", { caliber: "J800.1 (ETA 2824-2)" }],
    ["Meister Classic", "ETA 2824-2", { caliber: "J800.1 (ETA 2824-2)" }],
    ["Max Bill Hand-Wound", "ETA 2801-2", { caliber: "J805.1 (ETA 2801-2)" }],
  ],
  Baltic: [
    ["Aquascaphe Classic", "Miyota 9039"],
    ["Hermétique", "Miyota 9039"],
    ["HMS 003", "Miyota 8315"],
    ["MR01", "Hangzhou 5000A"],
  ],
  Squale: [
    ["1521 Classic", "Sellita SW200-1"],
    ["Sub-39", "Sellita SW200-1"],
  ],
  Steinhart: [
    ["Ocean One 39", "Sellita SW200-1"],
    ["Nav B-Uhr 44", "Sellita SW200-1"],
  ],
  Certina: [
    ["DS Action Diver 38", "ETA C07.111"],
    ["DS PH200M", "ETA C07.611"],
  ],
  "Frederique Constant": [
    ["Classics Index Automatic", "Sellita SW200-1", { caliber: "FC-303 (Sellita SW200-1)" }],
    ["Highlife Automatic", "Sellita SW200-1", { caliber: "FC-303 (Sellita SW200-1)" }],
  ],
  Blancpain: [
    ["Fifty Fathoms Automatique", "Blancpain 1315"],
    ["Fifty Fathoms Bathyscaphe", "Blancpain 1315"],
  ],
  Bulova: [
    ["Lunar Pilot", null],
    ["Oceanographer", "Miyota 821D", { aliases: ["Devil Diver"] }],
  ],
  Damasko: [
    ["DA36", "ETA 2836-2"],
    ["DS30", "Sellita SW200-1"],
  ],
  Doxa: [
    ["Sub 300", "ETA 2824-2", { cosc: true }],
    ["Sub 300T", "ETA 2824-2"],
    ["Sub 200", "ETA 2824-2"],
  ],
  "Girard-Perregaux": [["Laureato 42", "Girard-Perregaux GP01800"]],
  "Glashütte Original": [
    ["Senator Excellence", "Glashütte Original 36-01"],
    ["SeaQ", "Glashütte Original 39-11"],
    ["PanoMaticLunar", "Glashütte Original 90-02"],
  ],
  Montblanc: [
    ["1858 Automatic", "Sellita SW200-1", { caliber: "MB 24.15 (Sellita SW200-1)" }],
    ["Star Legacy Automatic Date", "Sellita SW200-1", { caliber: "MB 24.17 (Sellita SW200-1)" }],
  ],
  Rado: [
    ["Captain Cook Automatic", "Rado R763"],
    ["True Thinline", null],
  ],
  Swatch: [
    ["Sistem51", "Swatch Sistem51"],
    ["MoonSwatch", null],
  ],
  "Ulysse Nardin": [
    ["Marine Torpilleur", "Ulysse Nardin UN-118", { cosc: true }],
    ["Diver 42", "Ulysse Nardin UN-816"],
  ],
  "Vacheron Constantin": [
    ["Overseas", "Vacheron Constantin 5100"],
    ["Fiftysix Self-Winding", "Vacheron Constantin 1326"],
    ["Patrimony Manual-Winding", "Vacheron Constantin 4400 AS"],
  ],
  Vostok: [
    ["Amphibia", "Vostok 2416B"],
    ["Komandirskie Automatic", "Vostok 2416B"],
  ],
  "Bell & Ross": [
    ["BR 03-92", "Sellita SW300-1", { caliber: "BR-CAL.302 (Sellita SW300-1)" }],
    ["BR 05", "Sellita SW300-1", { caliber: "BR-CAL.321 (Sellita SW300-1)" }],
  ],
  Seagull: [["1963 Chronograph", "Seagull ST1901", { aliases: ["Seagull 1963"] }]],
  Timex: [
    ["Marlin Automatic", "Miyota 8215"],
    ["Q Timex", null],
    ["Weekender", null],
    ["Expedition", null],
  ],
};

function expand(brand: string, [model, movement, opts]: Row): CatalogModel {
  const m = movement ? MOVEMENT_INDEX.get(movement.toLowerCase()) : undefined;
  // a mistyped movement name must not take the app down; the catalog test catches it
  if (movement && !m) console.error(`watch-catalog: ${brand} ${model} names an unknown movement "${movement}"`);
  return {
    model,
    aliases: opts?.aliases,
    reference: opts?.reference,
    movementType: m?.type ?? "quartz",
    caliber: opts?.caliber ?? (m ? caliberText(m, brand) : undefined),
    beatRate: m?.beatRate,
    powerReserveHours: m?.powerReserveHours,
    cosc: opts?.cosc,
    checked: m?.checked,
  };
}

export const WATCH_MODELS: Record<string, CatalogModel[]> = Object.fromEntries(
  Object.entries(CATALOG).map(([brand, rows]) => [brand, rows.map((r) => expand(brand, r))])
);

export const WATCH_BRANDS: string[] = Object.keys(CATALOG).sort((a, b) => a.localeCompare(b));

/** Case/diacritic-insensitive "starts with or contains" filter with ranking. */
export function filterSuggestions(query: string, options: string[], limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice(0, limit);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const nq = norm(q);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const o of options) {
    const no = norm(o);
    if (no.startsWith(nq)) starts.push(o);
    else if (no.includes(nq)) contains.push(o);
  }
  return [...starts, ...contains].slice(0, limit);
}

const fold = (x: string) =>
  x.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Catalog models a typed name could mean, best first. An exact name, nickname
 * or reference is one answer. A partial name ("Datejust", "Black Bay") can be
 * several — the caller decides whether they agree on what it needs.
 * Fragments under three characters match nothing: "5" is not a model.
 */
export function matchCatalogModels(brand: string, model: string): CatalogModel[] {
  const q = fold(model);
  if (!q) return [];
  const candidates = modelsForBrand(brand);
  const exact = candidates.filter(
    (m) =>
      fold(m.model) === q ||
      m.aliases?.some((a) => fold(a) === q) ||
      (!!m.reference && fold(m.reference) === q)
  );
  if (exact.length) return exact;
  if (q.length < 3) return [];
  return candidates.filter((m) => {
    const name = fold(m.model);
    return (
      name.includes(q) ||
      q.includes(name) ||
      m.aliases?.some((a) => q.includes(fold(a))) ||
      (!!m.reference && fold(m.reference).startsWith(q) && q.length >= 5)
    );
  });
}

/** Best single catalog match for a brand + model the user typed. */
export function findCatalogModel(brand: string, model: string): CatalogModel | undefined {
  return matchCatalogModels(brand, model)[0];
}

/** Autocomplete for the model field: names first, then nicknames and references. */
export function suggestModels(brand: string, query: string, limit = 8): CatalogModel[] {
  const all = modelsForBrand(brand);
  const q = fold(query);
  if (!q) return all.slice(0, limit);
  const starts = all.filter((m) => fold(m.model).startsWith(q));
  const contains = all.filter((m) => !starts.includes(m) && fold(m.model).includes(q));
  const other = all.filter(
    (m) =>
      !starts.includes(m) && !contains.includes(m) &&
      (m.aliases?.some((a) => fold(a).startsWith(q)) || (!!m.reference && fold(m.reference).startsWith(q)))
  );
  return [...starts, ...contains, ...other].slice(0, limit);
}

export function modelsForBrand(brand: string): CatalogModel[] {
  const key = Object.keys(WATCH_MODELS).find(
    (k) => k.toLowerCase() === brand.trim().toLowerCase()
  );
  return key ? WATCH_MODELS[key] : [];
}
