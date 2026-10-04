// MN-003: Commander's Strike (grant_attack) was inert — the collector dropped
// it at `if (!info) continue` (no DISPATCH entry), the router pushed it to the
// data-only actions bucket, and it was missing from INTERACTIVE_HANDLER_TYPES,
// so no clickable row ever rendered and the die was never offered.
// Mirrors the verified MN-002 movement/skill_check rows (automationCollector.combatSuperiorityMovement.test.js).
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { routeAutomation } from './automationRouter.js'
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
        hasAutomation: true,
    },
    hasAutomation: true,
}

describe('collectAutomationFromFeatures – combat_superiority_grant_attack (MN-003)', () => {
    it('builds grant_attack info so the row is no longer dropped pre-render', () => {
        const result = collectAutomationFromFeatures([commandersStrike], ps)
        expect(result.specialActions).toHaveLength(1)
        const info = result.specialActions[0]
        expect(info.type).toBe('combat_superiority_grant_attack')
        expect(info.maneuverName).toBe("Commander's Strike")
        expect(info.range).toBe('30_ft')
        expect(info.oncePerTurn).toBe(true)
        expect(info.hasAutomation).toBe(true)
    })

    it('routes the grant_attack row to specialActions, NOT the data-only actions bucket', () => {
        const result = collectAutomationFromFeatures([commandersStrike], ps)
        const routed = { actions: [], bonusActions: [], reactions: [], specialActions: [], passives: [], autoEffects: [], saveModifiers: [], primalKnowledge: [], ritualSpells: [] }
        routeAutomation(result.specialActions[0], commandersStrike.automation, routed)
        expect(routed.specialActions).toHaveLength(1)
        expect(routed.actions).toHaveLength(0)
    })

    it('never appears in result.actions from the collector either (was the data-only bucket)', () => {
        const result = collectAutomationFromFeatures([commandersStrike], ps)
        expect(result.actions).toHaveLength(0)
    })

    it('marks the merged special-action row interactive (clickable gate)', () => {
        const result = collectAutomationFromFeatures([commandersStrike], ps)
        const mergedRow = { name: "Commander's Strike", description: '', automation: result.specialActions[0], hasAutomation: true }
        expect(isInteractiveAutomation(mergedRow)).toBe(true)
    })
})
