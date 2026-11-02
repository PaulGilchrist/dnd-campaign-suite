// Damage/heal "juice" for the initiative tracker (Phase 1 TV-mode plan).
// Pure display feedback: Initiative.jsx diffs creature HP across renders and
// passes the resulting event here. Timer-free by design — the floater removes
// itself via the CSS `animationend` event (no setTimeout, AGENTS "No Game
// Timers"), and both elements animate to opacity 0 with fill-mode forwards so
// a missed animationend (reduced motion / background tab) leaves them
// harmless and invisible until the next event replaces them.

export default function HpFeedback({ creatureName, hpEvent, onDone }) {
    const delta = hpEvent?.delta ?? 0
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
