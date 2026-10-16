// @maintained-by-ai
// Cross-cutting breadth lane for automationCollector.js — only rows whose HOME is nowhere else:
// the SPECIAL_AUTOMATIONS pre-router exact row shapes (relentless / arcane_ward / spell_breaker /
// projected_ward), cantrip_range_bonus regex extraction, and the three collectTurnStartEffects rows
// missing from automationCollector.turnStartEffects.test.js (vitalityOfTheTree, confusion_turn_start,
// survivor bloodiedOnly branch). Redundant former residents moved to their homes:
// processFeatureAutomation wrapper contract → automationService.collection.test.js,
// router bucket tables → automationCollector.types.test.js,
// crossbow turn-start rows → automationCollector.turnStartEffects.test.js,
// great_weapon_fighting feat-shape → automationInfoBuilder/damage.test.js.
// Fixtures are synthetic shapes pinning dispatch machinery, not disk content from public/data.
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures, collectTurnStartEffects } from './automationCollector.js'
import { makePlayerStats, makeFeature } from './automationService.test-utils.js'

const ps = makePlayerStats()

// ── SPECIAL_AUTOMATIONS pre-router rows: exact shape, exact bucket ──

describe('collectAutomationFromFeatures – special pre-router row shapes', () => {
    it.each([
        {
            name: 'relentless passive_rule',
            automation: { type: 'passive_rule', effect: 'relentless' },
            bucket: 'passives',
            expected: { type: 'passive_rule', name: 'Test Feature', effect: 'relentless', hasAutomation: true },
        },
        {
            name: 'arcane_ward defaults',
            automation: { type: 'passive_rule', effect: 'arcane_ward' },
            bucket: 'passives',
            expected: { type: 'arcane_ward', name: 'Test Feature', wardHpExpression: '', wardRestoreExpression: '', bonusActionRestore: false },
        },
        {
            name: 'arcane_ward custom values pass through',
            automation: { type: 'passive_rule', effect: 'arcane_ward', wardHpExpression: 'INT modifier * 5', wardRestoreExpression: 'full', bonusActionRestore: true },
            bucket: 'passives',
            expected: { type: 'arcane_ward', name: 'Test Feature', wardHpExpression: 'INT modifier * 5', wardRestoreExpression: 'full', bonusActionRestore: true },
        },
        {
            name: 'spell_breaker defaults',
            automation: { type: 'passive_rule', effect: 'spell_breaker' },
            bucket: 'passives',
            expected: { type: 'spell_breaker', name: 'Test Feature', spellLevel: 1, alwaysPreparedSpells: [], bonusActionSpells: [], dispelAbilityCheckBonus: '', slotRetentionSpells: [] },
        },
        {
            name: 'spell_breaker custom values pass through',
            automation: { type: 'passive_rule', effect: 'spell_breaker', spellLevel: 3, alwaysPreparedSpells: ['dispel_magic'], bonusActionSpells: ['counterspell'], dispelAbilityCheckBonus: 'proficiency_bonus', slotRetentionSpells: ['counterspell', 'dispel_magic'] },
            bucket: 'passives',
            expected: { type: 'spell_breaker', name: 'Test Feature', spellLevel: 3, alwaysPreparedSpells: ['dispel_magic'], bonusActionSpells: ['counterspell'], dispelAbilityCheckBonus: 'proficiency_bonus', slotRetentionSpells: ['counterspell', 'dispel_magic'] },
        },
        {
            name: 'projected_ward defaults',
            automation: { type: 'projected_ward' },
            bucket: 'reactions',
            expected: {
                type: 'projected_ward',
                name: 'Test Feature',
                range: 30,
                reaction: true,
                automation: {
                    type: 'projected_ward',
                    name: 'Test Feature',
                    range: 30,
                    reaction: true,
                    wardTrigger: 'ally_damage_taken',
                    casting_time: '1 reaction',
                    hasAutomation: true,
                },
            },
        },
        {
            name: 'projected_ward custom values pass through',
            automation: { type: 'projected_ward', range: 60, wardTrigger: 'self_healing', casting_time: '1 reaction; starts when dropped below 50% hp' },
            bucket: 'reactions',
            expected: {
                type: 'projected_ward',
                name: 'Test Feature',
                range: 60,
                reaction: true,
                automation: {
                    type: 'projected_ward',
                    name: 'Test Feature',
                    range: 60,
                    reaction: true,
                    wardTrigger: 'self_healing',
                    casting_time: '1 reaction; starts when dropped below 50% hp',
                    hasAutomation: true,
                },
            },
        },
    ])('$name', ({ automation, bucket, expected }) => {
        const result = collectAutomationFromFeatures([makeFeature(automation)], ps)
        expect(result[bucket]).toEqual([expected])
    })
})

// ── Collector boundary resilience ──

describe('collectAutomationFromFeatures – boundary resilience', () => {
    it.each([
        { label: 'null', playerStats: null },
        { label: 'undefined', playerStats: undefined },
    ])('still collects rows when playerStats is $label', ({ playerStats }) => {
        const result = collectAutomationFromFeatures([makeFeature({ type: 'warding_bond' })], playerStats)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('warding_bond')
    })

    it('collects a feature with no name property, leaving name undefined on the row', () => {
        const result = collectAutomationFromFeatures([{ automation: { type: 'warding_bond' } }], ps)
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].name).toBeUndefined()
    })
})

// ── cantrip_range_bonus regex at the collector boundary ──

describe('collectAutomationFromFeatures – cantrip_range_bonus extraction', () => {
    it.each([
        { rangeBonusCantrip: '+100ft', expected: '100' },
        { rangeBonusCantrip: '+ 25 ft', expected: '25' },
        { rangeBonusCantrip: '-5ft', expected: '5' },
    ])('extracts first digit run from rangeBonusCantrip $rangeBonusCantrip', ({ rangeBonusCantrip, expected }) => {
        const result = collectAutomationFromFeatures([
            { name: 'Fire Bolt', automation: { type: 'damage_bonus', rangeBonusCantrip } },
        ], ps)
        expect(result.passives).toEqual([{
            type: 'cantrip_range_bonus',
            name: 'Fire Bolt',
            effect: 'cantrip_range_bonus',
            bonusExpression: expected,
            hasAutomation: true,
        }])
    })

    it.each([
        { label: 'non-numeric rangeBonusCantrip', automation: { type: 'damage_bonus', rangeBonusCantrip: 'doubled' } },
        { label: 'missing rangeBonusCantrip', automation: { type: 'damage_bonus' } },
        { label: 'non-damage_bonus type', automation: { type: 'healing', rangeBonusCantrip: '+30ft' } },
    ])('emits no cantrip_range_bonus row for $label', ({ automation }) => {
        const result = collectAutomationFromFeatures([{ name: 'Bolt', automation }], ps)
        expect(result.passives.filter(p => p.type === 'cantrip_range_bonus')).toEqual([])
    })
})

// ── collectTurnStartEffects rows absent from the turnStartEffects table ──

describe('collectTurnStartEffects – rows not covered by automationCollector.turnStartEffects.test.js', () => {
    it.each([
        {
            name: 'temp_hp_buff with healingStartOfTurn → vitalityOfTheTree defaults',
            feature: { name: 'Vitality of the Tree', automation: { type: 'temp_hp_buff', healingStartOfTurn: true } },
            expected: { type: 'vitalityOfTheTree_turn_start', name: 'Vitality of the Tree', ongoingHealingExpression: '', healingRange: '10 ft' },
        },
        {
            name: 'vitalityOfTheTree custom expression and range pass through',
            feature: { name: 'Vitality of the Tree', automation: { type: 'temp_hp_buff', healingStartOfTurn: true, ongoingHealingExpression: '2d6', healingRange: '30 ft' } },
            expected: { type: 'vitalityOfTheTree_turn_start', name: 'Vitality of the Tree', ongoingHealingExpression: '2d6', healingRange: '30 ft' },
        },
        {
            name: 'passive_rule confusion_turn_start',
            feature: { name: 'Confusion Aura', automation: { type: 'passive_rule', effect: 'confusion_turn_start' } },
            expected: { type: 'confusion_turn_start', name: 'Confusion Aura' },
        },
        {
            name: 'bloodiedOnly healing_start_of_turn → survivor branch (regenerate branch covered in turnStartEffects file)',
            feature: { name: 'Survivor', automation: { type: 'healing_start_of_turn', bloodiedOnly: true, healExpression: '5' } },
            expected: { type: 'survivor_turn_start_heal', name: 'Survivor', healExpression: '5', bloodiedOnly: true, bodyPartRegrowMinutes: 2 },
        },
    ])('$name', ({ feature, expected }) => {
        expect(collectTurnStartEffects([feature])).toEqual([expected])
    })

    it('temp_hp_buff WITHOUT healingStartOfTurn produces no turn-start effect', () => {
        expect(collectTurnStartEffects([{ name: 'Temp HP', automation: { type: 'temp_hp_buff' } }])).toEqual([])
    })
})
