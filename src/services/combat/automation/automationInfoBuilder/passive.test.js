// @improved-by-ai
// ── passive.test.js ──────────────────────────────────────────────────
// Tests for passive.js — behavior-first, minimal over-mocking
//
// What we test:
//   • Each handler returns the correct `type`, `effect`, `name`, `hasAutomation`
//   • Custom automation fields are passed through (not hardcoded)
//   • Default values are used when automation fields are missing
//   • `feature.name` is forwarded to the result
//   • `hasAutomation` is always true
//   • Conditional type mapping (passive_buff → passive_rule for max_hp_increase)
//   • snake_case → camelCase field mapping (passive_immunity)
//   • casting_time pass-through for handlers that share the same pattern
//
// What we don't test:
//   • Internal implementation details (e.g. which `||` fallbacks exist)
//   • The `makeFeature` fixture internals

import { describe, it, expect } from 'vitest'
import { passiveHandlers } from './passive.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Assert structural invariants on any handler result.
 * Some handlers (passive_immunity) omit `effect`.
 */
function expectValidResult(result, expectedType, expectedEffect) {
    expect(result).toBeInstanceOf(Object)
    expect(result.type).toBe(expectedType)
    if (expectedEffect !== undefined) {
        expect(result.effect).toBe(expectedEffect)
    }
    expect(result.hasAutomation).toBe(true)
    expect(result.name).toBe('Test Feature')
}

// ── Generic handler contract ─────────────────────────────────────────

/**
 * All handlers share the same basic contract: return an object with
 * type, effect, name, and hasAutomation.  This parameterized test
 * verifies that contract for every handler without asserting internal
 * field defaults.
 */
describe('passiveHandlers – generic contract', () => {
    const handlers = [
        ['passive_buff', 'passive_buff', ''],
        ['ignore_resistance', 'passive_rule', 'ignore_resistance'],
        ['passive_immunity', 'passive_immunity', undefined],
        ['holy_nimbus_radiant_damage', 'passive_rule', 'holy_nimbus_radiant_damage'],
        ['umbral_sight', 'passive_rule', 'umbral_sight'],
        ['supreme_sneak', 'passive_rule', 'supreme_sneak'],
        ['otherworldly_glamour', 'passive_buff', 'otherworldly_glamour'],
        ['create_thrall_temp_hp', 'create_thrall_temp_hp', undefined],
        ['ritual_spells', 'passive_rule', 'ritual_spells'],
        ['potent_cantrip', 'potent_cantrip', 'potent_cantrip'],
        ['soulstitch_spells', 'soulstitch_spells', 'soulstitch_spells'],
        ['empowered_evocation', 'empowered_evocation', 'empowered_evocation'],
        ['concentration_disadvantage_on_damage_dealt', 'passive_rule', 'concentration_disadvantage_on_damage_dealt'],
        ['tavern_brawler_reroll_ones', 'passive_rule', 'tavern_brawler_reroll_ones'],
        ['tavern_brawler_push', 'passive_rule', 'tavern_brawler_push'],
        ['ignore_loading_crossbows', 'passive_rule', 'ignore_loading_crossbows'],
        ['no_melee_disadvantage_crossbows', 'passive_rule', 'no_melee_disadvantage_crossbows'],
        ['naturally_stealthy', 'passive_rule', 'naturally_stealthy'],
        ['blessed_warrior', 'passive_rule', 'blessed_warrior'],
    ]

    for (const [handlerName, expectedType, expectedEffect] of handlers) {
        it(`${handlerName} returns correct type, effect, name, and hasAutomation`, () => {
            const feature = makeFeature({ type: handlerName })
            const result = passiveHandlers[handlerName](feature, BASE_STATS)
            expectValidResult(result, expectedType, expectedEffect)
        })
    }
})

// ── passive_buff ─────────────────────────────────────────────────────

describe('passiveHandlers – passive_buff', () => {
    it('returns default values for all fields', () => {
        const feature = makeFeature({ type: 'passive_buff' })
        const result = passiveHandlers.passive_buff(feature, BASE_STATS)

        expect(result.target).toBe('allies_in_range')
        expect(result.range_expression).toBe('10_ft')
        expect(result.bonusExpression).toBe('')
        expect(result.condition).toBe('')
        expect(result.conditionImmunity).toBe('')
        expect(result.resistances).toEqual([])
        expect(result.options).toEqual([])
        expect(result.extraMastery).toEqual([])
        expect(result.replaceMastery).toEqual([])
        expect(result.grantsFlySpeed).toBe(false)
        expect(result.grantsSwimSpeed).toBe(false)
        expect(result.resistanceType).toEqual([])
        expect(result.validTypes).toEqual([])
        expect(result.amount).toBe(0)
        expect(result.alsoSelfHealing).toBe(null)
    })

    it('returns passive_rule type when effect is max_hp_increase', () => {
        const feature = makeFeature({
            type: 'passive_buff',
            effect: 'max_hp_increase'
        })
        const result = passiveHandlers.passive_buff(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('max_hp_increase')
        expect(result.target).toBe('allies_in_range')
    })

    it('passes through all custom automation fields', () => {
        const feature = makeFeature(
            {
                type: 'passive_buff',
                target: 'self',
                effect: 'blindsight',
                bonusExpression: '+2',
                condition: 'adjacent_to_enemy',
                conditionImmunity: 'charmed',
                resistances: ['fire', 'cold'],
                grantsFlySpeed: true,
                grantsSwimSpeed: true,
                resistanceType: ['fire'],
                validTypes: ['fiend', 'undead'],
                amount: 10,
                alsoSelfHealing: { extraHealingExpression: '2d8' }
            },
            'Gloom Stalker Ranger'
        )
        const result = passiveHandlers.passive_buff(feature, BASE_STATS)

        expect(result.name).toBe('Gloom Stalker Ranger')
        expect(result.target).toBe('self')
        expect(result.effect).toBe('blindsight')
        expect(result.bonusExpression).toBe('+2')
        expect(result.condition).toBe('adjacent_to_enemy')
        expect(result.conditionImmunity).toBe('charmed')
        expect(result.resistances).toEqual(['fire', 'cold'])
        expect(result.grantsFlySpeed).toBe(true)
        expect(result.grantsSwimSpeed).toBe(true)
        expect(result.resistanceType).toEqual(['fire'])
        expect(result.validTypes).toEqual(['fiend', 'undead'])
        expect(result.amount).toBe(10)
        expect(result.alsoSelfHealing).toEqual({ extraHealingExpression: '2d8' })
    })
})

// ── ignore_resistance ────────────────────────────────────────────────

describe('passiveHandlers – ignore_resistance', () => {
    it('passes through custom damageTypes', () => {
        const feature = makeFeature(
            { type: 'ignore_resistance', damageTypes: ['fire', 'cold'] },
            'Resist All Damage'
        )
        const result = passiveHandlers.ignore_resistance(feature, BASE_STATS)

        expect(result.name).toBe('Resist All Damage')
        expect(result.damageTypes).toEqual(['fire', 'cold'])
    })
})

// ── passive_immunity ─────────────────────────────────────────────────

describe('passiveHandlers – passive_immunity', () => {
    it('passes through custom fields including snake_case → camelCase mapping', () => {
        const feature = makeFeature(
            {
                type: 'passive_immunity',
                target: 'allies_in_range',
                conditionImmunity: 'charmed frightened',
                damage_resistance: ['fire', 'cold'],
                save_advantage: [{ saveType: 'WIS', condition: 'against_fear' }]
            },
            'Bardic Immunity'
        )
        const result = passiveHandlers.passive_immunity(feature, BASE_STATS)

        expect(result.name).toBe('Bardic Immunity')
        expect(result.target).toBe('allies_in_range')
        expect(result.conditionImmunity).toBe('charmed frightened')
        expect(result.damageResistance).toEqual(['fire', 'cold'])
        expect(result.saveAdvantage).toEqual([{ saveType: 'WIS', condition: 'against_fear' }])
    })
})

// ── Casting-time handlers (share same pattern) ──────────────────────

describe('passiveHandlers – casting_time defaults', () => {
    const handlers = [
        ['umbral_sight', 'immediate', 'Drow Darkness'],
        ['supreme_sneak', 'movement', 'Rogue Cunning'],
        ['ritual_spells', '1 minute', 'Druid Rituals'],
        ['potent_cantrip', 'action', 'Savage Cantrip'],
        ['soulstitch_spells', 'reaction', 'Soul Binder'],
        ['empowered_evocation', '1 action', 'Evocation Expert'],
        ['tavern_brawler_push', '1 action', 'Brawler Shove'],
        ['ignore_loading_crossbows', 'custom', 'Quick Draw'],
        ['blessed_warrior', undefined, 'Warrior Blessing'],
    ]

    for (const [handlerName, customCastingTime, customName] of handlers) {
        it(`${handlerName} passes through custom casting_time`, () => {
            const feature = makeFeature(
                { type: handlerName, casting_time: customCastingTime },
                customName
            )
            const result = passiveHandlers[handlerName](feature, BASE_STATS)

            expect(result.name).toBe(customName)
            if (customCastingTime) {
                expect(result.casting_time).toBe(customCastingTime)
            }
        })
    }
})

// ── ignore_loading_crossbows ─────────────────────────────────────────

describe('passiveHandlers – ignore_loading_crossbows', () => {
    it('passes through custom weapons', () => {
        const feature = makeFeature(
            {
                type: 'ignore_loading_crossbows',
                weapons: ['heavy crossbow', 'light crossbow']
            },
            'Quick Draw'
        )
        const result = passiveHandlers.ignore_loading_crossbows(feature, BASE_STATS)

        expect(result.name).toBe('Quick Draw')
        expect(result.weapons).toEqual(['heavy crossbow', 'light crossbow'])
    })
})
