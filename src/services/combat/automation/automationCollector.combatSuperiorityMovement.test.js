// @maintained-by-ai
// MN-002: Bait and Switch (movement) / Tactical Assessment (skill_check) were
// structurally inert — buildAttackInfo's DISPATCH had no combat_superiority_movement /
// combat_superiority_skill_check entries, so the collector dropped them at
// `if (!info) continue`, the Special Actions row never rendered, and the
// maneuver could never trigger.
//
// ── Combat-superiority collector family lane map (inherit for #2084+) ──
// • #2082 combatSuperiorityGrantAttack.test.js: grant_attack row, same seam.
// • #2083 (this file): movement + skill_check rows — collect → builder envelope
//   → route placement (bucket assertions; routeAutomation is called INSIDE the
//   collector with identical args, so no direct re-invocation) → interactive gate.
// • automationCollector.coverage.test.js: verified to carry NO combat_superiority rows.
// • Builder unit defaults pinned in automationInfoBuilder/combatSuperiority.test.js.
// • Executor lane (NOT here): executeMovementManeuver / executeSkillCheckManeuver
//   (die roll + spend, baitAndSwitchChoice chooser, pendingSkillCheckBonus fold).
//
// Fixtures mirror maneuvers.js synthesis shape for the public/data/2024/
// maneuvers.json disk rows (verified verbatim 2026-10-16): Bait and Switch
// (actionType movement, effect ac_bonus_and_swap, range 5_ft, dieExpression
// superiority_die) and Tactical Assessment (actionType skill_check, skills
// History/Investigation/Insight, ability 'Intelligence' spelled out on disk —
// NOT 'INT'). Both dispatchers consume ONLY action.automation.maneuverName,
// so that key riding the envelope is load-bearing here.
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures } from './automationCollector.js'
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
        trigger: null,
        effect: 'ac_bonus_and_swap',
        damageBonus: false,
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
        skills: ['History', 'Investigation', 'Insight'],
        ability: 'Intelligence',
        initiativeBonus: false,
        damageBonus: false,
        dieExpression: 'superiority_die',
        hasAutomation: true,
    },
    hasAutomation: true,
}

describe('collectAutomationFromFeatures – combat_superiority movement/skill_check rows (MN-002)', () => {
    it.each([
        ['movement', baitAndSwitch, {
            type: 'combat_superiority_movement',
            name: 'Bait and Switch',
            description: 'Expend one Superiority Die and switch places.',
            maneuverName: 'Bait and Switch',
            effect: 'ac_bonus_and_swap',
            range: '5_ft',
            hasAutomation: true,
        }],
        ['skill_check', tacticalAssessment, {
            type: 'combat_superiority_skill_check',
            name: 'Tactical Assessment',
            description: 'Add a superiority die to one ability check.',
            maneuverName: 'Tactical Assessment',
            skills: ['History', 'Investigation', 'Insight'],
            ability: 'Intelligence',
            initiativeBonus: false,
            hasAutomation: true,
        }],
    ])('collects the %s maneuver into specialActions with the exact builder envelope and renders it clickable', (_kind, feature, expectedEnvelope) => {
        const result = collectAutomationFromFeatures([feature], ps)
        // MN-002 regression: the row used to be dropped entirely (empty here);
        // routing is observed at the bucket level — routeAutomation runs inside
        // the collector, no direct re-invocation needed.
        expect(result.actions).toHaveLength(0)
        expect(result.specialActions).toEqual([expectedEnvelope])
        // The merged Special Actions row carries the envelope as its .automation;
        // handleCombatSuperiority{Movement,SkillCheck} read maneuverName off it.
        const mergedRow = { name: feature.name, automation: result.specialActions[0] }
        expect(isInteractiveAutomation(mergedRow)).toBe(true)
    })

    it('keeps bonus-action and reaction maneuver siblings out of the clickable gate', () => {
        // Set-membership precision: INTERACTIVE_HANDLER_TYPES holds exactly
        // movement/skill_check/grant_attack superiority rows; the bonus-action
        // (Evasive Footwork) and reaction lanes must not pass by luck.
        expect(isInteractiveAutomation({ name: 'Evasive Footwork', automation: { type: 'combat_superiority_bonus_action', hasAutomation: true } })).toBe(false)
        expect(isInteractiveAutomation({ name: 'Riposte', automation: { type: 'combat_superiority_reaction', hasAutomation: true } })).toBe(false)
    })
})
