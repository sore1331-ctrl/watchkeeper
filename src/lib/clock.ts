// ─── Checking the device clock ──────────────────────────────────────────────
// Every offset the app records is "watch minus reference", and the reference
// is this device's clock. This measures how far that clock is from the
// server's, the same way NTP does: ask the time, note when the question left
// and when the answer came back, and assume the answer was stamped halfway.

export interface ClockCheck {
  /** add this to the device's time to get true time, ms (negative = device is fast) */
  offsetMs: number;
  /** the check cannot be better than half the round trip, ms */
  uncertaintyMs: number;
}

/** A round trip slower than this says more about the network than the clock. */
const MAX_ROUND_TRIP_MS = 2000;

async function sample(): Promise<{ offsetMs: number; roundTripMs: number } | null> {
  const sentAt = Date.now();
  const started = performance.now();
  const res = await fetch("/api/time", { cache: "no-store", signal: AbortSignal.timeout(3000) });
  const roundTripMs = performance.now() - started;
  if (!res.ok) return null;
  const { now } = (await res.json()) as { now?: unknown };
  if (typeof now !== "number" || roundTripMs > MAX_ROUND_TRIP_MS) return null;
  return { offsetMs: now - (sentAt + roundTripMs / 2), roundTripMs };
}

/**
 * Compare the device clock with the server's. Several round trips are made
 * and the quickest kept — it had the least room for the two legs to differ.
 * Returns null when it cannot be done (offline, server unreachable).
 */
export async function checkClock(attempts = 4): Promise<ClockCheck | null> {
  let best: { offsetMs: number; roundTripMs: number } | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const s = await sample();
      if (s && (!best || s.roundTripMs < best.roundTripMs)) best = s;
    } catch {
      // one failed attempt is not a verdict; no successes at all is
      if (!best && i >= 1) return null;
    }
  }
  return best ? { offsetMs: best.offsetMs, uncertaintyMs: best.roundTripMs / 2 } : null;
}

/** "0.8 s fast", "0.3 s slow", or null when the difference is within the check's own precision. */
export function describeClockError(check: ClockCheck): string | null {
  const floor = Math.max(check.uncertaintyMs, 50);
  if (Math.abs(check.offsetMs) <= floor) return null;
  const s = Math.abs(check.offsetMs) / 1000;
  return `${s < 10 ? s.toFixed(1) : Math.round(s)} s ${check.offsetMs < 0 ? "fast" : "slow"}`;
}
