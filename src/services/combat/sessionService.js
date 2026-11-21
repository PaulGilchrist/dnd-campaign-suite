/**
 * L5 Phase 4 (§10.1) — session state machine.
 *
 * sessionState.phase ∈ exploration | encounter | travel | roleplay, stored
 * as a campaign runtime key (`sessionState`) through the server-validated
 * chokepoint. Turn-based discipline (§ No Game Timers): phases move ONLY on
 * human/engine ACTION — a referee click, initiative stamped, combat cleared,
 * travel started/stopped. Nothing here expires or advances on wall-clock.
 *
 * Off-by-default honesty: the phase is ORCHESTRATION METADATA — no existing
 * L1–4 feature consults it yet, so a campaign that never touches this key
 * plays byte-identical (readSessionPhase returns 'exploration', zero writes
 * made by readers). The features the phase will gate (§10.2 auto-encounter,
 * §10.4 console) read it as truth once it moves.
 */
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

export const SESSION_PHASES = ['exploration', 'encounter', 'travel', 'roleplay'];
export const DEFAULT_SESSION_PHASE = 'exploration';

export function isSessionPhase(value) {
    return SESSION_PHASES.includes(value);
}

/** Sync read; unset key ⇒ 'exploration' (today's implicit truth). Readers never write. */
export function readSessionPhase(campaignName) {
    const state = getRuntimeValue('campaign', 'sessionState', campaignName);
    return isSessionPhase(state?.phase) ? state.phase : DEFAULT_SESSION_PHASE;
}

/** Sync read of the ACTIVE SESSION name (log memory stamp, 2026-11-21); null when no session is tracked. */
export function readActiveSessionName(campaignName) {
    const state = getRuntimeValue('campaign', 'sessionState', campaignName);
    return typeof state?.name === 'string' && state.name.trim() ? state.name : null;
}

/**
 * Set (or clear with name=null) the campaign's active session. Every campaign
 * log row the server stamps from here on carries this name (addEntry in
 * server/routes/log.js reads the same `sessionState` key) — the primitive
 * behind per-session memory queries and future recap generation.
 * Audit: one `session_active` log entry naming the change.
 * @returns {Promise<{set: boolean, name: string|null}>}
 */
export async function setActiveSession({ campaignName, name, changedBy = 'referee' }) {
    if (!campaignName) return { set: false, name: null };
    const cleaned = typeof name === 'string' && name.trim() ? name.trim() : null;
    const state = getRuntimeValue('campaign', 'sessionState', campaignName) || {};
    await setRuntimeValue('campaign', 'sessionState', { phase: readSessionPhase(campaignName), ...state, name: cleaned }, campaignName);
    await addEntry(campaignName, {
        type: 'session_active',
        description: cleaned
            ? `Active session: “${cleaned}” — ${changedBy}.`
            : 'Active session cleared — the log stamps rows with no session.',
        timestamp: Date.now(),
    }).catch((e) => { console.error('[sessionService] active-session log failed:', e); });
    return { set: true, name: cleaned };
}

/**
 * Move the session to a new phase. Same-phase ⇒ zero writes (no spam).
 * Audit: one `session_phase` log entry naming who moved it where.
 * The active-session `name` rides through untouched — a phase move must never
 * silently drop the session the log is stamping rows with.
 * @returns {Promise<{moved: boolean, phase: string, reason?: string}>}
 */
export async function setSessionPhase({ campaignName, phase, changedBy = 'referee', reason = null }) {
    if (!campaignName) return { moved: false, phase: DEFAULT_SESSION_PHASE, reason: 'no campaign' };
    if (!isSessionPhase(phase)) {
        console.error(`[sessionService] refusing unknown session phase: ${JSON.stringify(phase)}`);
        return { moved: false, phase: readSessionPhase(campaignName), reason: 'invalid phase' };
    }
    const current = readSessionPhase(campaignName);
    if (current === phase) return { moved: false, phase };

    const state = getRuntimeValue('campaign', 'sessionState', campaignName) || {};
    const base = { phase: current, ...state };
    await setRuntimeValue('campaign', 'sessionState', { ...base, phase, changedBy, changedAt: Date.now() }, campaignName);
    await addEntry(campaignName, {
        type: 'session_phase',
        phase,
        previousPhase: current,
        changedBy,
        description: `Session phase: ${current} → ${phase}${reason ? ` (${reason})` : ''} — ${changedBy}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[sessionService] phase log failed:', e); });
    return { moved: true, phase };
}
