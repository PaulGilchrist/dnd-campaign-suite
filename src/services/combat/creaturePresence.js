// Split-party presence (plan initiative-split-party).
//
// An `away: true` player row in combatSummary stays on the board (HP,
// conditions and SSE sync keep working) but holds NO initiative slot: turn
// navigation skips it, target chooser lists hide it, and its card renders
// greyed at the back. undefined/false ⇒ present — existing boards stay
// compatible. NPCs are always present (the flag is only meaningful for
// player rows).
//
// This lives in its own module (NOT initiativeService) because many
// component tests partial-mock initiativeService — consumers must always
// get the real predicate. Same caution for the isSecondTurnEntry import
// below: any test that factory-mocks thiefsReflexesService and exercises a
// rejoin must spread `await importOriginal()` so the predicate stays real.

import { isSecondTurnEntry } from './thiefsReflexesService.js'

function isCreaturePresent(creature) {
    return !(creature.type === 'player' && creature.away === true)
}

// Lowest rolled initiative among PRESENT creatures — the rejoiner's landing
// slot ("end of the current round"). Null when nobody has rolled (GM then
// sets initiative or lets the player roll). Blank slots (`''`) are unrolled,
// not a zero — only numeric values count.
function computeEndOfRoundInitiative(creatures) {
    const values = (creatures || [])
        .filter(isCreaturePresent)
        .map(c => (c.initiative === '' || c.initiative == null ? NaN : Number(c.initiative)))
        .filter(n => Number.isFinite(n))
    return values.length ? Math.min(...values) : null
}

// Thief's-Reflexes twin rejoin anchor (FU 2026-11-09): the grant law in
// thiefsReflexesService.js authors the twin at holder initiative − 10
// (`String(init - 10)` — plain arithmetic, no clamp/normalization), so an
// Away→Rejoin must re-anchor to the holder's CURRENT initiative − 10 instead
// of re-rolling to the end-of-round slot (that law silently loses the
// grant-time seam: 19→10→3 drift). Holder row absent, or its initiative
// blank/non-numeric ⇒ null ⇒ the end-of-round law applies unchanged
// (mirrors findHolderEntry's guard in the grant service).
function secondTurnAnchorInitiative(creature, creatures) {
    if (!isSecondTurnEntry(creature) || !creature.holderName) return null
    const holder = (creatures || []).find(c => c.type === 'player' && c.name === creature.holderName)
    if (!holder || holder.initiative === '' || holder.initiative == null) return null
    const init = Number(holder.initiative)
    if (!Number.isFinite(init)) return null
    return String(init - 10)
}

// Board display order: rolled first (descending), unrolled after (-1),
// AWAY rows strictly last (their initiative is wiped on split — they hold no
// slot while separated), ties by name.
function sortCreaturesForBoard(combatSummary) {
    combatSummary.creatures.sort((a, b) => {
        const aAway = a.type === 'player' && a.away === true ? 1 : 0
        const bAway = b.type === 'player' && b.away === true ? 1 : 0
        if (aAway !== bAway) return aAway - bAway
        const aInit = a.initiative === '' || a.initiative == null ? -1 : Number(a.initiative)
        const bInit = b.initiative === '' || b.initiative == null ? -1 : Number(b.initiative)
        if (bInit !== aInit) return bInit - aInit
        return a.name.localeCompare(b.name)
    })
}

/**
 * Apply GM presence toggles to the board (the single-card toggle and the
 * bulk Split-Party modal share this mutation — no duplication). Mutates
 * `combatSummary` in place and returns the changed rows for the audit log.
 *
 * Split  ⇒ `away = true` + initiative WIPED (the greyed card parks at the
 * back of the board — no held slot while separated).
 * Rejoin ⇒ flag cleared + initiative auto-set to the board's lowest PRESENT
 * roll (end of the current round); the GM can still edit the input or let the
 * player roll. Nobody rolled ⇒ initiative left blank for the GM.
 * Second-turn twins (`isSecondTurnEntry` + `holderName`) instead re-anchor to
 * the holder's current initiative − 10 — the grant law, not a re-roll (FU
 * 2026-11-09); holder gone/blank ⇒ the end-of-round law as normal.
 * The end-of-round value is computed ONCE against the pre-change present set,
 * so bulk rejoiners land on the same slot.
 */
function applyPresenceChanges(combatSummary, presenceByName) {
    if (!combatSummary || !Array.isArray(combatSummary.creatures)) return []
    const end = computeEndOfRoundInitiative(combatSummary.creatures)
    const changes = []
    for (const creature of combatSummary.creatures) {
        if (creature.type !== 'player') continue
        const wantAway = presenceByName[creature.name]
        if (wantAway === undefined) continue
        const wasAway = creature.away === true
        if (wasAway === !!wantAway) continue
        let anchoredTo = null
        if (wantAway) {
            creature.away = true
            creature.initiative = ''
        } else {
            delete creature.away
            const anchor = secondTurnAnchorInitiative(creature, combatSummary.creatures)
            if (anchor !== null) {
                creature.initiative = anchor
                anchoredTo = creature.holderName
            } else if (end !== null) {
                creature.initiative = String(end)
            }
        }
        const change = { name: creature.name, away: !!wantAway, initiative: creature.initiative }
        if (anchoredTo) change.holderName = anchoredTo
        changes.push(change)
    }
    if (changes.length) sortCreaturesForBoard(combatSummary)
    return changes
}

export {
    isCreaturePresent,
    computeEndOfRoundInitiative,
    sortCreaturesForBoard,
    applyPresenceChanges,
}
