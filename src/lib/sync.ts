// ─── Local ⇄ cloud merge ────────────────────────────────────────────────────
// Pure functions, no I/O, so the rules that decide what happens to your data
// can be reasoned about (and tested) on their own.
//
// The guarantees this aims for:
//   1. Nothing is ever silently discarded. A record present on either side
//      survives unless it was deliberately deleted on a device that had
//      already synced it.
//   2. When both sides changed the same record, the newer edit wins.
//   3. Records that have never been synced are always kept — on a first
//      sign-in, everything already on this device is uploaded.

import type { Synced } from "./types";

export interface Identified extends Synced {
  id: string;
}

export interface MergeResult<T> {
  merged: T[];
  /** present locally but not in the cloud, and never synced → upload these */
  toUpload: T[];
  /** previously synced here but now gone from the cloud → deleted elsewhere */
  removedRemotely: string[];
}

const time = (r: Synced): number => {
  const t = r.updatedAt ? +new Date(r.updatedAt) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Merge one collection.
 *
 * @param local     records currently on this device
 * @param remote    records fetched from the cloud
 * @param syncedIds ids this device has previously pushed or pulled. An id in
 *                  this set that is missing from `remote` was deleted on
 *                  another device; an id not in the set is simply new here.
 */
export function mergeCollection<T extends Identified>(
  local: T[],
  remote: T[],
  syncedIds: Set<string>
): MergeResult<T> {
  const localById = new Map(local.map((r) => [r.id, r]));
  const remoteById = new Map(remote.map((r) => [r.id, r]));

  const merged: T[] = [];
  const toUpload: T[] = [];
  const removedRemotely: string[] = [];

  // every remote record, reconciled against its local twin
  for (const [id, rem] of remoteById) {
    const loc = localById.get(id);
    if (!loc) {
      merged.push(rem);
      continue;
    }
    // Both sides have it: the more recent edit wins. Ties favour local so a
    // device never appears to lose the change the user just made.
    merged.push(time(loc) >= time(rem) ? loc : rem);
    if (time(loc) > time(rem)) toUpload.push(loc);
  }

  // local records the cloud doesn't have
  for (const [id, loc] of localById) {
    if (remoteById.has(id)) continue;
    if (syncedIds.has(id)) {
      // it was synced before and is gone now → deleted on another device
      removedRemotely.push(id);
    } else {
      merged.push(loc);
      toUpload.push(loc);
    }
  }

  return { merged, toUpload, removedRemotely };
}

export interface SyncBundle {
  watches: Identified[];
  measurements: Identified[];
  services: Identified[];
}

export interface MergeSummary {
  added: number;
  updated: number;
  uploaded: number;
  removed: number;
}

export function summarize(results: MergeResult<Identified>[], localCounts: number[]): MergeSummary {
  let added = 0;
  let uploaded = 0;
  let removed = 0;
  results.forEach((r, i) => {
    added += Math.max(0, r.merged.length - localCounts[i] + r.removedRemotely.length);
    uploaded += r.toUpload.length;
    removed += r.removedRemotely.length;
  });
  return { added, updated: 0, uploaded, removed };
}

/** Stamp a record as changed now — called on every local create/update. */
export function touch<T extends object>(record: T): T & Synced {
  return { ...record, updatedAt: new Date().toISOString() };
}
