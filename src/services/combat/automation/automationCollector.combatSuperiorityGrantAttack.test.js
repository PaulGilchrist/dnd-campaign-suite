// @maintained-by-ai
// MN-003: Commander's Strike (grant_attack) was inert — the collector dropped
// it at `if (!info) continue` (no DISPATCH entry), the router pushed it to the
// data-only actions bucket, and it was missing from INTERACTIVE_HANDLER_TYPES,
// so no clickable row ever rendered and the die was never offered.
//
// ── Combat-superiority collector family lane map (inherit for #2083-86+) ──
// • #2082 (this file): combat_superiority_grant_attack ROW lane only —
//   collect → builder envelope → route placement → interactive gate.
// • automationCollector.combatSuperiorityMovement.test.js: movement + skill_check
//   rows (same seam, different types). Do not duplicate types across files.
// • automationCollector.coverage.test.js: cross-cutting sweep; verified to carry
//   NO combat_superiority rows — per-feature files own their types.
// • Executor lane (NOT here): src/services/automation/handlers/class-fighter-rogue/
//   combatSuperiorityGrantAttack.mn003.test.js owns latch / 30-ft gate / die
//   roll+spend / commanderStrikeChoice chooser / campaign-log envelope.
// • Pipeline mechanics: actionPipeline (#2067); act-gates: assertCanAct pair.
//
// Fixture mirrors production synthesis verbatim-in-shape: maneuvers.js attaches
// this automation from the public/data/2024/maneuvers.json Commander's Strike row
// (actionType grant_attack, trigger replace_attack, range 30_ft, dieExpression
// superiority_die, oncePerTurn true). Quirk probed before pinning: the disk row
// has NO `effect` field, so maneuvers.js passes undefined and the builder must
// default effect to 'grant_attack_damage' — pinned below. The handler
// (dispatchers.js handleCombatSuperiorityGrantAttack) consumes only
// action.automation.maneuverName, so that key riding the info is load-bearing.
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { isInteractiveAutomation } from './automationService.js'
import { makePlayerStats } from './automationService.test-utils.js'

const ps = makePlayerStats()

const commandersStrike = {
    name: "Commander's Strike",
    description: 'Replace one attack to direct a companion to strike.',
    automation: {
        type: 'combat_superiority_grant_attack',
        maneuverName: "Commander's Strike",
        actionType: 'grant_attack',
        trigger: 'replace_attack',
        dieExpression: 'superiority_die',
        range: '30_ft',
        oncePerTurn: true,
        damageBonus: false,
        hasAutomation: true,
        // effect intentionally omitted — as synthesized from disk (undefined in).
    },
    hasAutomation: true,
}

describe('collectAutomationFromFeatures – combat_superiority_grant_attack (MN-003)', () => {
    it('collects the row into specialActions with the exact builder envelope, never the data-only actions bucket', () => {
        const result = collectAutomationFromFeatures([commandersStrike], ps)
        // MN-003 regression: previously landed in `actions` (data-only, inert).
        expect(result.actions).toHaveLength(0)
        expect(result.specialActions).toHaveLength(1)
        // Full envelope pin: handleCombatSuperiorityGrantAttack reads maneuverName
        // and the builder must default the disk-missing effect here.
        expect(result.specialActions[0]).toEqual({
            type: 'combat_superiority_grant_attack',
            name: "Commander's Strike",
            description: 'Replace one attack to direct a companion to strike.',
            maneuverName: "Commander's Strike",
            effect: 'grant_attack_damage',
            range: '30_ft',
            oncePerTurn: true,
            hasAutomation: true,
        })
    })

    it('marks the merged special-action row interactive, and keeps the bonus-action sibling out of the clickable gate', () => {
        const result = collectAutomationFromFeatures([commandersStrike], ps)
        const mergedRow = { name: "Commander's Strike", description: '', automation: result.specialActions[0], hasAutomation: true }
        expect(isInteractiveAutomation(mergedRow)).toBe(true)
        // Set-membership precision: combat_superiority_bonus_action rides the
        // bonusActions lane instead — a typo'd grant type must not pass by luck.
        const bonusSiblingRow = { name: 'Rally', automation: { type: 'combat_superiority_bonus_action', hasAutomation: true } }
        expect(isInteractiveAutomation(bonusSiblingRow)).toBe(false)
    })
})
