// Damage/heal "juice" for the initiative tracker (Phase 1 TV-mode plan).
// Pure display feedback: Initiative.jsx diffs creature HP across renders and
// passes the resulting event here. Timer-free by design — the floater removes
// itself via the CSS `animationend` event (no setTimeout, AGENTS "No Game
// Timers"), and both elements animate to opacity 0 with fill-mode forwards so
// a missed animationend (reduced motion / background tab) leaves them
// harmless and invisible until the next event replaces them.
//
// Roadmap Item 10: this render seam is also the heal cue's audio twin — a
// fresh event id with a positive delta plays "heal" on EVERY client (the
// HP diff above is SSE-driven), the floater's exact audible mirror. Damage
// stays silent here on purpose: the attack outcome already sounded at the
// shared log seam (CombatCues.jsx), so no moment is double-voiced.

import { useEffect } from 'react'
import { playCue } from '../../services/ui/audioCues.js'

export default function HpFeedback({ creatureName, hpEvent, onDone }) {
    const delta = hpEvent?.delta ?? 0
    const eventId = hpEvent?.id
    // Fires once per fresh event id (effect deps), never during render and
    // never again for the same id on re-renders.
    useEffect(() => {
        if (eventId !== undefined && delta > 0) playCue('heal')
    }, [eventId, delta])
    if (!delta) return null
    const isDamage = delta < 0
    // Big-number class for hits that meaningfully hurt: ≥10 or ≥25% of max.
    const max = hpEvent?.max || 1
    const isBig = Math.abs(delta) >= Math.max(10, Math.floor(max * 0.25))
    return (
        <span className="hp-feedback" aria-hidden="true">
            <span
                className={`hp-floater ${isDamage ? 'hp-floater-damage' : 'hp-floater-heal'}${isBig ? ' hp-floater-big' : ''}`}
                onAnimationEnd={() => onDone?.(creatureName)}
            >
                {isDamage ? `−${Math.abs(delta)}` : `+${delta}`}
            </span>
            <span className={`hp-hit-flash ${isDamage ? 'hp-hit-flash-damage' : 'hp-hit-flash-heal'}`}></span>
        </span>
    )
}
