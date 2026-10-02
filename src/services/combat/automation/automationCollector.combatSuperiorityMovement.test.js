// MN-002: Bait and Switch (movement) / skill-check maneuvers were structurally
// inert — automationCollector dropped them at `if (!info) continue` because
// automationInfoBuilder DISPATCH had no combat_superiority_movement /
// combat_superiority_skill_check entries, so the Special Actions row never
// rendered and the maneuver could never trigger.
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { routeAutomation } from './automationRouter.js'
import { isInteractiveAutomation } from './automationService.js'
import { makePlayerStats } from './automationService.test-utils.js'

const ps = makePlayerStats()

const baitAndSwitch = {
    name: 'Bait and Switch',
    description: 'Expend one Superiority Die and switch places.',
    automation: {
        type: 'combat_superiority_movement',
        maneuverName: 'Bait and Switch',
        actionType: 'movement',
        effect: 'ac_bonus_and_swap',
        dieExpression: 'superiority_die',
        range: '5_ft',
        hasAutomation: true,
    },
    hasAutomation: true,
}

const tacticalAssessment = {
    name: 'Tactical Assessment',
    description: 'Add a superiority die to one ability check.',
    automation: {
        type: 'combat_superiority_skill_check',
        maneuverName: 'Tactical Assessment',
        actionType: 'skill_check',
        skills: ['History', 'Investigation'],
        ability: 'INT',
        dieExpression: 'superiority_die',
        hasAutomation: true,
    },
    hasAutomation: true,
}

describe('collectAutomationFromFeatures – combat_superiority_movement (MN-002)', () => {
    it('builds movement info so the row is no longer dropped pre-render', () => {
        const result = collectAutomationFromFeatures([baitAndSwitch], ps)
        expect(result.specialActions).toHaveLength(1)
        const info = result.specialActions[0]
        expect(info.type).toBe('combat_superiority_movement')
        expect(info.maneuverName).toBe('Bait and Switch')
        expect(info.effect).toBe('ac_bonus_and_swap')
        expect(info.range).toBe('5_ft')
        expect(info.hasAutomation).toBe(true)
    })

    it('routes the movement row to specialActions via routeAutomation', () => {
        const result = collectAutomationFromFeatures([baitAndSwitch], ps)
        const routed = { actions: [], bonusActions: [], reactions: [], specialActions: [], passives: [], autoEffects: [], saveModifiers: [], primalKnowledge: [], ritualSpells: [] }
        routeAutomation(result.specialActions[0], baitAndSwitch.automation, routed)
        expect(routed.specialActions).toHaveLength(1)
    })

    it('marks the merged special-action row interactive (clickable gate)', () => {
        const result = collectAutomationFromFeatures([baitAndSwitch], ps)
        const mergedRow = { name: 'Bait and Switch', description: '', automation: result.specialActions[0], hasAutomation: true }
        expect(isInteractiveAutomation(mergedRow)).toBe(true)
    })
})

describe('collectAutomationFromFeatures – combat_superiority_skill_check (MN-002)', () => {
    it('builds skill-check info and lands it in specialActions', () => {
        const result = collectAutomationFromFeatures([tacticalAssessment], ps)
        expect(result.specialActions).toHaveLength(1)
        const info = result.specialActions[0]
        expect(info.type).toBe('combat_superiority_skill_check')
        expect(info.maneuverName).toBe('Tactical Assessment')
        expect(info.skills).toEqual(['History', 'Investigation'])
    })

    it('marks the merged skill-check row interactive', () => {
        const result = collectAutomationFromFeatures([tacticalAssessment], ps)
        const mergedRow = { name: 'Tactical Assessment', description: '', automation: result.specialActions[0], hasAutomation: true }
        expect(isInteractiveAutomation(mergedRow)).toBe(true)
    })
})
