// @maintained-by-ai
/**
 * Lane: shared in-flight reads of the campaign change-data snapshot
 * (GET /api/campaigns/:campaign/change-data).
 *
 * The mount/enter seam used to fire FOUR near-simultaneous GETs of the SAME
 * bytes per campaign entry (backlog 2026-11-22 SV): the App select callback's
 * combatSummary preload, the 'campaign'-store rescope hydrate, the character
 * seed effect, and the char-sheet modal mount each fetched independently.
 * One hydrated snapshot suffices:
 *
 *  - `fetchCampaignChangeData(name)` single-flights: concurrent callers join
 *    the live in-flight promise; the slot clears SYNCHRONOUSLY on settle, so a
 *    genuinely later sequential load still fetches fresh (no stale-data law).
 *    No timers — pure promise-slot bookkeeping (the app forbids clocks that
 *    gate game state).
 *  - `beginCampaignChangeDataEntry(name)` opens the ENTER seam: the campaign-
 *    select callback calls it synchronously before `loadCombatSummary`, whose
 *    `getCombatContext` then joins the same live slot (one physical GET). The
 *    enter read owns an AbortController so a bounded stall escape (backlog
 *    TT 2026-11-22, `abandonCampaignChangeDataEntry`) can release a dead
 *    socket; the timeout clock itself lives UI-side in App's enter lane.
 *  - `readCampaignChangeData(name)` ADOPTS the entry snapshot for the rest of
 *    the seam (rescope hydrate + character seed): a settled entry promise is
 *    still awaited (zero re-fetch), and each adopter receives a CLONE so the
 *    runtime-store graphs stay isolated exactly as they were under four
 *    independent parses. A re-select seam calls `begin` again, forcing a fresh
 *    read — the adopt-and-evict "re-select re-reads server truth" law holds.
 *
 * Error semantics stay per-lane: the shared promise REJECTS every waiter
 * (transport failure or not-ok carries `changeDataStatus` so the strict EB-join
 * rethrow survives dedupe); only `readCampaignChangeData` clones, never the
 * damage lane (which must hand back the parsed summary verbatim).
 */
import { cloneDeep } from 'lodash';

// campaign → live in-flight snapshot promise (cleared on settle).
const inFlight = new Map();
// campaign → enter-seam snapshot promise (held until the next begin, so
// later mount effects adopt the ONE entry GET instead of re-fetching).
const entrySnapshots = new Map();
// campaign → AbortController for the LIVE enter-seam read, so
// `abandonCampaignChangeDataEntry` can release a stalled socket (backlog
// TT 2026-11-22). Plain (non-enter) reads stay un-aborted.
const entryAborts = new Map();

async function requestCampaignChangeData(campaignName, signal) {
  const response = signal
    ? await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/change-data`, { signal })
    : await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/change-data`);
  if (!response.ok) {
    const err = new Error(`change-data fetch failed (${response.status}) for ${campaignName}`);
    err.changeDataStatus = response.status;
    err.changeDataStatusText = response.statusText;
    throw err;
  }
  return await response.json();
}

/**
 * Start (or join) the single-flight read. `signal` is only attached when a
 * read is STARTED here — joiners adopt whatever the owner attached.
 */
function startCampaignChangeDataRead(campaignName, signal) {
  const live = inFlight.get(campaignName);
  if (live) return live;
  const promise = requestCampaignChangeData(campaignName, signal);
  // Entry adopters may attach their handlers long after settle; keep the
  // shared slot's rejection handled for lanes that never await it (each
  // consumer still attaches its own catch).
  promise.catch(() => {});
  const clearSlot = () => {
    if (inFlight.get(campaignName) === promise) inFlight.delete(campaignName);
  };
  promise.then(clearSlot, clearSlot);
  inFlight.set(campaignName, promise);
  return promise;
}

/**
 * Shared single-flight raw snapshot read. Concurrent callers receive the SAME
 * promise (one GET); the slot is cleared on settle so later loads fetch fresh.
 * A rejection reaches EVERY waiter — strict lanes rethrow, lenient lanes map
 * the error (via `changeDataStatus`) to their historical console + null bytes.
 */
export function fetchCampaignChangeData(campaignName) {
  return startCampaignChangeDataRead(campaignName, undefined);
}

/**
 * Open an enter-seam read: start (or join) the fetch and register it as THIS
 * campaign's entry snapshot. Called by the campaign-select callback BEFORE any
 * consumer mounts, so the whole seam hydrates from one GET. A fresh begin on
 * the same campaign (re-select) always issues a new read — server truth is
 * re-adopted, never served from the previous seam's settled bytes.
 * The enter read owns an AbortController (registered on settle-clear) so the
 * App enter lane's bounded stall escape can release a dead socket and let the
 * next begin (Retry / re-select) physically re-fetch instead of joining a
 * forever-pending GET (backlog TT 2026-11-22).
 */
export function beginCampaignChangeDataEntry(campaignName) {
  const controller = new AbortController();
  const live = inFlight.get(campaignName);
  const promise = live || startCampaignChangeDataRead(campaignName, controller.signal);
  if (!live) entryAborts.set(campaignName, controller);
  const forgetAbort = () => {
    if (entryAborts.get(campaignName) === controller) entryAborts.delete(campaignName);
  };
  promise.then(forgetAbort, forgetAbort);
  entrySnapshots.set(campaignName, promise);
  return promise;
}

/**
 * Bounded stall escape for the ENTER seam (backlog TT 2026-11-22): a hung
 * route / captive proxy pins the shared promise forever, and every joiner —
 * the gate preload, the rescope hydrate, the character seed — waits on it
 * with it. Aborting the physical GET rejects the shared promise (the slot
 * clears synchronously on that settle), so every lenient joiner falls back to
 * its null-as-unknown contract AND the next `beginCampaignChangeDataEntry`
 * (Retry) issues a FRESH GET instead of re-joining the dead socket. The stall
 * CLOCK lives UI-side in App's enter lane (benign-UI timer, allowlisted);
 * this lane stays pure promise/signal bookkeeping — no game state moves here.
 * A no-op when the seam's read has already settled.
 */
export function abandonCampaignChangeDataEntry(campaignName) {
  const controller = entryAborts.get(campaignName);
  if (!controller) return;
  entryAborts.delete(campaignName);
  controller.abort(new Error(`change-data enter read abandoned (stall escape) for ${campaignName}`));
}

/**
 * Seam-aware snapshot read: adopt this campaign's entry snapshot when one
 * exists (settled or in flight — never re-fetches mid-seam), otherwise fall
 * through to the plain single-flight read. Resolves to a PRIVATE clone so the
 * adopter's object graph is isolated, exactly as under independent parses.
 * Rejects with the shared error — callers keep their own null-sentinel /
 * never-evict contracts.
 */
export async function readCampaignChangeData(campaignName) {
  const promise = entrySnapshots.get(campaignName) || fetchCampaignChangeData(campaignName);
  return cloneDeep(await promise);
}
