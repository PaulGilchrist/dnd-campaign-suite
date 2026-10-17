// @maintained-by-ai
// combatSuperiority.js builder-envelope unit lane (#2099) — this file owns the
// per-maneuver ENVELOPE VALUES this module emits. Sibling lanes (cite, don't re-pin):
// • routing breadth: automationCollector.types.test.js
// • movement + skill_check collect→render with full disk-shape input:
//   automationCollector.combatSuperiorityMovement.test.js (#2083)
// • grant_attack full envelope via collector (incl. disk-missing effect default):
//   automationCollector.combatSuperiorityGrantAttack.test.js (#2082)
// • commanding_presence_reaction envelope (all 7 exports' sixth handler):
//   combatSuperiority.mn004.test.js — NOT re-pinned here
// • downstream DC math on the 'ability' token (buildSaveDc → 17, never baked 14,
//   MN-020): executeAttackRider.mn020.test.js / combatSuperiorityQueries.mn020.test.js
// • executor lanes: src/services/automation/handlers/class-fighter-rogue/*
//
// #2099 stale-fixture fix, applied: the old skill_check fixture dropped 'Insight'
// from Tactical Assessment's skills and wrote ability as 'INT'. Both re-anchored
// VERBATIM to public/data/2024/maneuvers.json (ability is 'Intelligence' spelled
// out on disk); the Ambush row adds the initiativeBonus:true anchor so a hardcoded
// false cannot pass. combat_superiority anchored verbatim to the Battle Master row
// in public/data/2024/classes.json. Envelopes are exact toEqual — extra synthetic
// input keys (actionType/damageBonus/dieExpression on maneuver rows) must NOT be
// copied into the envelope. No clocks; pure function, zero mocks.
import { describe, it, expect } from 'vitest'
import { combatSuperiorityHandlers } from './combatSuperiority.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// VERBATIM from public/data/2024/classes.json Battle Master → Combat Superiority.
const BM_AUTO = {
    type: 'combat_superiority',
    saveType: 'WIS',
    saveAbility: ['STR', 'DEX'],
    saveDc: 'ability',
    dieExpression: 'superiority_die',
    uses_max: 4,
    recharge: 'short_rest',
    maxOptions: 3,
    maxOptionsScaling: { 7: 2, 10: 2, 15: 2 },
}

// BASE_STATS: STR +4 beats DEX +2 → saveAbility 'STR'.
const BM_ENVELOPE = {
    type: 'combat_superiority',
    name: 'Combat Superiority',
    saveType: 'WIS',
    saveDc: 'ability', // MN-020: token rides through, never a baked number
    saveAbility: 'STR',
    saveAbilities: ['STR', 'DEX'],
    dieExpression: 'superiority_die', // string token, not evaluated at build time
    usesMax: 4,
    usesRecharge: 'short_rest',
    options: [],
    maxOptions: 3,
    oncePerTurn: false,
    chooseOne: false,
    hasAutomation: true,
}

describe('combatSuperiorityHandlers – combat_superiority', () => {
    it.each([
        [3, 3], // base; first scaling threshold is level 7
        [7, 5], // +2 at the first threshold
        [15, 9], // 3 + 2 + 2 + 2 — all thresholds accumulate
    ])('builds the exact disk-row envelope for a level %i host (maxOptions %i)', (level, maxOptions) => {
        const result = combatSuperiorityHandlers.combat_superiority(
            makeFeature(BM_AUTO, 'Combat Superiority'),
            { ...BASE_STATS, level },
        )
        expect(result).toEqual({ ...BM_ENVELOPE, maxOptions })
    })

    it('picks the higher-modifier save ability from the disk pair, not the first entry', () => {
        const result = combatSuperiorityHandlers.combat_superiority(makeFeature(BM_AUTO, 'Combat Superiority'), {
            ...BASE_STATS,
            abilities: [{ name: 'Strength', bonus: 1 }, { name: 'Dexterity', bonus: 5 }],
        })
        expect(result.saveAbility).toBe('DEX')
        expect(result.saveAbilities).toEqual(['STR', 'DEX'])
    })

    it.each([
        ['synthetic minimal shape — every builder default is load-bearing',
            makeFeature({ type: 'combat_superiority' }),
            { ...BM_ENVELOPE, name: 'Test Feature', saveAbilities: ['STR'] }],
        ['explicit overrides — numeric saveDc honored here (unlike mn004, which discards it); truthy flags coerce to boolean',
            makeFeature({ type: 'combat_superiority', saveAbility: ['STR', 'DEX'], saveDc: 15, dieExpression: '2d8', uses_max: 6, recharge: 'long_rest', oncePerTurn: 1, chooseOne: 'yes' }),
            { ...BM_ENVELOPE, name: 'Test Feature', saveDc: 15, dieExpression: '2d8', usesMax: 6, usesRecharge: 'long_rest', oncePerTurn: true, chooseOne: true }],
    ])('%s', (_label, feature, expected) => {
        expect(combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)).toEqual(expected)
    })
})

describe('combatSuperiorityHandlers – tactical_mind / know_enemy', () => {
    it.each([
        ['tactical_mind minimal — bonusExpression defaults to empty string', 'tactical_mind',
            makeFeature({ type: 'tactical_mind' }),
            { type: 'tactical_mind', name: 'Test Feature', bonusExpression: '', hasAutomation: true }],
        ['tactical_mind passes through custom expression and name', 'tactical_mind',
            makeFeature({ type: 'tactical_mind', bonusExpression: '+2d4' }, 'Tactical Genius'),
            { type: 'tactical_mind', name: 'Tactical Genius', bonusExpression: '+2d4', hasAutomation: true }],
        ['know_enemy minimal — defaults 30_ft / 4 uses', 'know_enemy',
            makeFeature({ type: 'know_enemy' }),
            { type: 'know_enemy', name: 'Test Feature', range: '30_ft', usesMax: 4, hasAutomation: true }],
        ['know_enemy passes through custom range/uses/name', 'know_enemy',
            makeFeature({ type: 'know_enemy', range: '60_ft', uses_max: 6 }, 'Know Foe'),
            { type: 'know_enemy', name: 'Know Foe', range: '60_ft', usesMax: 6, hasAutomation: true }],
    ])('%s', (_label, type, feature, expected) => {
        expect(combatSuperiorityHandlers[type](feature, BASE_STATS)).toEqual(expected)
    })
})

// MN-002/MN-003: maneuverName must ride the envelope — every dispatcher reads
// action.automation.maneuverName. Row values VERBATIM from
// public/data/2024/maneuvers.json; automation key-set mirrors maneuvers.js
// synthesis (its extra keys must NOT be copied into the envelope). Commander's
// Strike full row is pinned verbatim through the collector in #2082 — here only
// its minimal-fallback path runs.
describe('combatSuperiorityHandlers – movement / skill_check / grant_attack envelopes (MN-002/003)', () => {
    it.each([
        ['movement row verbatim (Bait and Switch)', 'combat_superiority_movement',
            { name: 'Bait and Switch', description: 'Expend one Superiority Die and switch places.', automation: { type: 'combat_superiority_movement', maneuverName: 'Bait and Switch', actionType: 'movement', effect: 'ac_bonus_and_swap', dieExpression: 'superiority_die', range: '5_ft', hasAutomation: true } },
            { type: 'combat_superiority_movement', name: 'Bait and Switch', description: 'Expend one Superiority Die and switch places.', maneuverName: 'Bait and Switch', effect: 'ac_bonus_and_swap', range: '5_ft', hasAutomation: true }],
        ['movement minimal — maneuverName falls back to feature name, disk-value defaults hold', 'combat_superiority_movement',
            { name: 'Bait and Switch', automation: { type: 'combat_superiority_movement' } },
            { type: 'combat_superiority_movement', name: 'Bait and Switch', description: '', maneuverName: 'Bait and Switch', effect: 'ac_bonus_and_swap', range: '5_ft', hasAutomation: true }],
        ['skill_check row verbatim (Tactical Assessment — skills include Insight, ability spelled out, NOT #2099-stale History/Investigation-only INT)', 'combat_superiority_skill_check',
            { name: 'Tactical Assessment', description: 'Add a Superiority Die to one ability check.', automation: { type: 'combat_superiority_skill_check', maneuverName: 'Tactical Assessment', actionType: 'skill_check', skills: ['History', 'Investigation', 'Insight'], ability: 'Intelligence', initiativeBonus: false, hasAutomation: true } },
            { type: 'combat_superiority_skill_check', name: 'Tactical Assessment', description: 'Add a Superiority Die to one ability check.', maneuverName: 'Tactical Assessment', skills: ['History', 'Investigation', 'Insight'], ability: 'Intelligence', initiativeBonus: false, hasAutomation: true }],
        ['skill_check row verbatim (Ambush — initiativeBonus true proves the read, ability absent on disk → null)', 'combat_superiority_skill_check',
            { name: 'Ambush', description: 'Add a Superiority Die to Stealth or Initiative.', automation: { type: 'combat_superiority_skill_check', maneuverName: 'Ambush', actionType: 'skill_check', skills: ['Stealth'], initiativeBonus: true, hasAutomation: true } },
            { type: 'combat_superiority_skill_check', name: 'Ambush', description: 'Add a Superiority Die to Stealth or Initiative.', maneuverName: 'Ambush', skills: ['Stealth'], ability: null, initiativeBonus: true, hasAutomation: true }],
        ['grant_attack minimal — effect/range defaults, oncePerTurn false when absent', 'combat_superiority_grant_attack',
            { name: "Commander's Strike", automation: { type: 'combat_superiority_grant_attack' } },
            { type: 'combat_superiority_grant_attack', name: "Commander's Strike", description: '', maneuverName: "Commander's Strike", effect: 'grant_attack_damage', range: '30_ft', oncePerTurn: false, hasAutomation: true }],
    ])('%s', (_label, type, feature, expected) => {
        expect(combatSuperiorityHandlers[type](feature, BASE_STATS)).toEqual(expected)
    })
})
