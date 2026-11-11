// Per-client UI signal bus for the starter-checklist "Join <wave>" deep link
// (backlog 2026-11-11 KW): the step promises the WAVE, but saved waves live
// behind the Encounter Builder's Load modal — so the step additionally asks
// the builder to open that wave list automatically.
//
// Two seams, one request:
//  - a pending flag survives the navigation seam (the builder is not mounted
//    yet when the click fires; it consumes the flag on its next mount);
//  - a synchronous window event covers the already-mounted case.
// Consumption is single-shot either way, so a later sidebar visit to the
// builder never re-opens a stale request, while every repeat checklist click
// re-arms. Pure view state — never synced to the server (server-first N/A).

const EVENT_NAME = 'encounter-load-request';

let pending = false;

export function requestEncounterLoad() {
  pending = true;
  window.dispatchEvent(new Event(EVENT_NAME));
}

// Returns true (exactly once) if a request is waiting to be honored.
export function consumePendingEncounterLoad() {
  const was = pending;
  pending = false;
  return was;
}

export function subscribeToEncounterLoad(handler) {
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
