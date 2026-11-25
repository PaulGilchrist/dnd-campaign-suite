// @maintained-by-ai
// Per-client UI signal bus for the sheet no-target refusal's "Arm a target"
// deep link (backlog 2026-11-24 run BA): the loud `.mc-no-target-refusal`
// popup already explains the arm lane — the button additionally asks the
// Initiative board to focus the ATTACKER's own card Target select, so the
// very next interaction arms the target. Same two-seam shape as
// encounterLoadSignal.js (starter-checklist "Join <wave>" precedent):
//  - a pending name survives the navigation seam (the sheet unmounts before
//    Initiative mounts; the matching card consumes the request on its own
//    mount effect);
//  - a synchronous window event covers an already-mounted board.
// Consumption is name-matched and single-shot: a card whose creature name
// differs NEVER consumes (the board's dozens of other selects must not eat
// the request), and once the matching card honors it, a later visit never
// re-steals focus. If no mounted card CAN honor it (a visitor's card shows
// a plain span, not a select), the request simply stays pending — per-client
// ephemeral UI only; it never writes targetName or any game state.

const EVENT_NAME = 'initiative-arm-target-request';

let pending = null;

export function requestArmTarget(creatureName) {
    pending = creatureName;
    window.dispatchEvent(new Event(EVENT_NAME));
}

// Returns true (exactly once, and only for the card that IS the requested
// creature) if a request is waiting for this name.
export function consumePendingArmTarget(creatureName) {
    if (pending === null || pending !== creatureName) {
        return false;
    }
    pending = null;
    return true;
}

export function subscribeToArmTarget(handler) {
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
}
