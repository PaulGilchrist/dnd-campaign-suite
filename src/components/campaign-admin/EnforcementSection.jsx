/**
 * L5-001 — Enforcement section (Admin view, localhost-only surface).
 *
 * Master enforcement switch + the Phase 0/1 sub-flags. The localhost client
 * IS the GM/referee — authority is hostname-derived, full stop (plan §12,
 * simplified 2026-10-13: the assignable referee role was removed; there is
 * no delegation channel, so no referee key/client-id plumbing exists).
 * All writes flow through useSyncedState → the server-validated chokepoint
 * (server/validation/keyValidators.js). Default OFF ⇒ Levels 1–4 unchanged.
 *
 * Checkbox writes sit behind a trailing debounce on the WRITE lane only
 * (mirror of the currency-chip fix 97165afc2) — see the component below.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'
import { ENFORCEMENT_DEFAULTS } from '../../services/combat/canTakeAction.js'
import './EnforcementSection.css'

// Trailing debounce for enforcement checkbox writes (backlog 2026-10-24): every click
// used to POST the whole enforcement blob immediately — master-on → turnLock → master-off
// was 3 POSTs, two of which were intermediate churn nobody ever read. Each click now
// flips an optimistic local draft instantly (checkboxes and fieldset gating stay
// immediate); the network flush waits for a short quiet window, so a burst coalesces
// into ONE POST carrying the final blob, well inside the ~1–1.5s settle the GM panel
// needs. Writes are deferred, never dropped or rate-limited: the timer, or the unmount
// flush, always fires them. Benign network/save debounce (no-timers guard).
const ENFORCEMENT_PERSIST_DEBOUNCE_MS = 600

const FLAGS = [
    { key: 'turnLock', label: 'Turn lock', hint: 'Only the active creature may take Actions or Bonus Actions (Reactions stay allowed off-turn).' },
    { key: 'actionEconomy', label: 'Action economy', hint: 'Charge 1 Action + 1 Bonus Action + 1 Reaction per creature; extra attempts are refused.' },
    { key: 'movementBudget', label: 'Movement budget', hint: 'Clamp token drags to each creature\u2019s remaining speed (active map only).' },
    { key: 'tokenMoving', label: 'Teleport token-move', hint: 'Teleport automations move the token to the nearest legal space near the selected target (active map only).' },
    { key: 'autoEncounters', label: 'Auto-encounters', hint: 'Accepting a travel combat event also starts the initiative tracker — the engine rolls initiative for every monster. Off: the encounter map spawns and you start initiative when you like.' },
    { key: 'autoRewards', label: 'Auto-rewards on clear', hint: 'Clearing combat automatically generates loot and awards split XP to every character through normal character management (same maths as the loot panel\u2019s Award button). Off: you award when you like.' },
    // §8.3 follow-up: the spatial/zone flags ride the store — surfaced here
    // so the GM can toggle them without hand-editing runtime state.
    { key: 'zones', label: 'Zones & areas', hint: 'Zone automations arm real expiry clocks and turn-end damage (insect-cloud style); lair cadence matures at the initiative-count-20 wrap.' },
    { key: 'lineOfSight', label: 'Line of sight', hint: 'Attacks and spells behind walls or closed doors are denied before their slot is charged (active map only).' },
    { key: 'opportunityAttacks', label: 'Opportunity attacks', hint: 'Leaving a hostile creature\u2019s reach spends their reaction and prompts you to resolve the attack on their sheet.' },
    // §7.4 server dice oracle — live consumers: server/routes/campaigns-roll.js
    // (rolls + logs + broadcasts, 403s unless this flag is on) and
    // src/services/ai/applyRuling.js ('dice' rulings route through the oracle
    // when on, client diceRoller when off). Normal combat rolls stay client-side.
    { key: 'serverDice', label: 'Server dice', hint: 'AI dice rulings are rolled by the SERVER oracle instead of your client roller \u2014 crypto-random, logged to the campaign log and broadcast via SSE, so results are auditable and cannot be forged client-side. Off: those dice roll client-side exactly as today.' },
]

export default function EnforcementSection({ campaignName }) {
    const [enforcement, setEnforcement] = useSyncedState('campaign', 'enforcement', { ...ENFORCEMENT_DEFAULTS }, campaignName)

    // Optimistic write lane (backlog 2026-10-24, mirrors PartyInventory 97165afc2):
    // `draft` is the blob the UI renders while a burst is pending; the debounced flush
    // POSTs it via setEnforcement once the clicks stop. The synced value stays the
    // server truth and renders unchanged when idle. Never drop writes — the unmount
    // effect flushes a stranded draft.
    const [draft, setDraft] = useState(null)
    const draftRef = useRef(null)
    const flushTimerRef = useRef(null)
    const writeRef = useRef(setEnforcement)
    writeRef.current = setEnforcement

    const flushDraft = useCallback(() => {
        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current)
            flushTimerRef.current = null
        }
        const pending = draftRef.current
        if (!pending) return
        draftRef.current = null
        setDraft(null)
        writeRef.current(pending)
    }, [])

    const writeDebounced = useCallback((blob) => {
        draftRef.current = blob
        setDraft(blob)
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
        flushTimerRef.current = setTimeout(flushDraft, ENFORCEMENT_PERSIST_DEBOUNCE_MS)
    }, [flushDraft])

    // Flush a pending burst if the section unmounts (navigation away) before the timer lands.
    // flushDraft is identity-stable (ref-only deps), so this cleanup runs on unmount only.
    useEffect(() => flushDraft, [flushDraft])

    const flags = { ...ENFORCEMENT_DEFAULTS, ...(draft || enforcement || {}) }

    const setFlag = (key, value) => writeDebounced({ ...flags, [key]: value })

    // Master-off zeroes EVERY sub-flag in the written blob:
    // with the mode off nothing is gated, so a stale `true` riding along is
    // functionally inert but a confusing disk shape for harnesses. Flipping
    // back ON therefore starts from all-false — sub-flags never re-arm
    // themselves without an individual click. The zeroed blob is what rides
    // the coalesced POST when master-off is the last click of a burst.
    const setMaster = (on) => writeDebounced(on
        ? { ...flags, mode: 'on' }
        : { ...ENFORCEMENT_DEFAULTS, mode: 'off' })

    return (
        <div className="admin-section enforcement-section">
            <h3><i className="fas fa-gavel"></i> Enforcement</h3>
            <div className="enforcement-master">
                <label className="enforcement-toggle">
                    <input
                        type="checkbox"
                        checked={flags.mode === 'on'}
                        onChange={(e) => setMaster(e.target.checked)}
                    />
                    <span>Enforcement {flags.mode === 'on' ? 'ON' : 'OFF'}</span>
                </label>
                <p className="enforcement-hint">
                    Master switch. With Enforcement OFF the game plays exactly as before — nothing is gated.
                </p>
            </div>

            <fieldset className="enforcement-flags" disabled={flags.mode !== 'on'}>
                {FLAGS.map(f => (
                    <label key={f.key} className="enforcement-toggle" title={f.hint}>
                        <input
                            type="checkbox"
                            checked={!!flags[f.key]}
                            onChange={(e) => setFlag(f.key, e.target.checked)}
                        />
                        <span>{f.label}</span>
                        <em className="enforcement-flag-hint">{f.hint}</em>
                    </label>
                ))}
            </fieldset>
        </div>
    )
}
