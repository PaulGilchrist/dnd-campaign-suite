// @improved-by-ai
// ── passive.test.js ──────────────────────────────────────────────────
// Tests for passive.js — behavior-first, minimal over-mocking
//
// What we test:
//   • Each handler returns the correct `type` and `effect`
//   • Custom automation fields are passed through (not hardcoded)
//   • Default values are used when automation fields are missing
//   • `feature.name` is forwarded to the result
//   • `hasAutomation` is always true
//
// What we don't test:
//   • Internal implementation details (e.g. which `||` fallbacks exist)
//   • The `makeFeature` fixture internals

import { describe, it, expect } from 'vitest'
import { passiveHandlers } from './passive.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Assert that a handler result always has the structural invariants
 * regardless of the feature data.  This catches missing keys, wrong
 * types, and the always-true hasAutomation flag in one call.
 */
function expectValidResult(result, expectedType, expectedEffect) {
    expect(result).toBeInstanceOf(Object)
    expect(result.type).toBe(expectedType)
    expect(result.effect).toBe(expectedEffect)
    expect(result.hasAutomation).toBe(true)
    expect(result.name).toBe('Test Feature')
}

// ── passive_buff ─────────────────────────────────────────────────────

describe('passiveHandlers – passive_buff', () => {
    it('returns passive_buff type with default automation fields', () => {
        const feature = makeFeature({ type: 'passive_buff' })
        const result = passiveHandlers.passive_buff(feature, BASE_STATS)

        expectValidResult(result, 'passive_buff', '')
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
        // Other fields should still have defaults
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
    it('returns passive_rule with ignore_resistance effect and defaults', () => {
        const feature = makeFeature({ type: 'ignore_resistance' })
        const result = passiveHandlers.ignore_resistance(feature, BASE_STATS)

        expectValidResult(result, 'passive_rule', 'ignore_resistance')
        expect(result.damageTypes).toEqual([])
    })

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
    it('returns passive_immunity info with defaults', () => {
        const feature = makeFeature({ type: 'passive_immunity' })
        const result = passiveHandlers.passive_immunity(feature, BASE_STATS)

        expect(result).toBeInstanceOf(Object)
        expect(result.type).toBe('passive_immunity')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBe('self')
        expect(result.conditionImmunity).toBe('')
        expect(result.damageResistance).toEqual([])
        expect(result.saveAdvantage).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

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

// ── holy_nimbus_radiant_damage ───────────────────────────────────────

describe('passiveHandlers – holy_nimbus_radiant_damage', () => {
    it('returns passive_rule with defaults', () => {
        const feature = makeFeature({ type: 'holy_nimbus_radiant_damage' })
        const result = passiveHandlers.holy_nimbus_radiant_damage(feature, BASE_STATS)

        expectValidResult(result, 'passive_rule', 'holy_nimbus_radiant_damage')
        expect(result.damageExpression).toBe('')
        expect(result.range).toBe('')
        expect(result.casting_time).toBe('')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature(
            {
                type: 'holy_nimbus_radiant_damage',
                damageExpression: '2d6',
                range: '10_ft',
                casting_time: '1 bonus action'
            },
            'Divine Smite Passive'
        )
        const result = passiveHandlers.holy_nimbus_radiant_damage(feature, BASE_STATS)

        expect(result.name).toBe('Divine Smite Passive')
        expect(result.damageExpression).toBe('2d6')
        expect(result.range).toBe('10_ft')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── umbral_sight ─────────────────────────────────────────────────────

describe('passiveHandlers – umbral_sight', () => {
    it('returns passive_rule with umbral_sight effect and casting_time default', () => {
        const feature = makeFeature({ type: 'umbral_sight' })
        const result = passiveHandlers.umbral_sight(feature, BASE_STATS)

        expectValidResult(result, 'passive_rule', 'umbral_sight')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature(
            { type: 'umbral_sight', casting_time: 'immediate' },
            'Drow Darkness'
        )
        const result = passiveHandlers.umbral_sight(feature, BASE_STATS)

        expect(result.name).toBe('Drow Darkness')
        expect(result.casting_time).toBe('immediate')
    })
})

// ── supreme_sneak ────────────────────────────────────────────────────

describe('passiveHandlers – supreme_sneak', () => {
    it('returns passive_rule with supreme_sneak effect and casting_time default', () => {
        const feature = makeFeature({ type: 'supreme_sneak' })
        const result = passiveHandlers.supreme_sneak(feature, BASE_STATS)

        expectValidResult(result, 'passive_rule', 'supreme_sneak')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature(
            { type: 'supreme_sneak', casting_time: 'movement' },
            'Rogue Cunning'
        )
        const result = passiveHandlers.supreme_sneak(feature, BASE_STATS)

        expect(result.name).toBe('Rogue Cunning')
        expect(result.casting_time).toBe('movement')
    })
})

// ── otherworldly_glamour ─────────────────────────────────────────────

describe('passiveHandlers – otherworldly_glamour', () => {
    it('returns passive_buff with otherworldly_glamour effect and hardcoded values', () => {
        const feature = makeFeature({ type: 'otherworldly_glamour' })
        const result = passiveHandlers.otherworldly_glamour(feature, BASE_STATS)

        expect(result.type).toBe('passive_buff')
        expect(result.effect).toBe('otherworldly_glamour')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})

// ── create_thrall_temp_hp ────────────────────────────────────────────

describe('passiveHandlers – create_thrall_temp_hp', () => {
    it('returns create_thrall_temp_hp info with defaults', () => {
        const feature = makeFeature({ type: 'create_thrall_temp_hp' })
        const result = passiveHandlers.create_thrall_temp_hp(feature, BASE_STATS)

        expect(result.type).toBe('create_thrall_temp_hp')
        expect(result.name).toBe('Test Feature')
        expect(result.tempHpExpression).toBe('')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature(
            {
                type: 'create_thrall_temp_hp',
                tempHpExpression: 'warlock level + CHA modifier'
            },
            'Fiendish Vitality'
        )
        const result = passiveHandlers.create_thrall_temp_hp(feature, BASE_STATS)

        expect(result.name).toBe('Fiendish Vitality')
        expect(result.tempHpExpression).toBe('warlock level + CHA modifier')
    })
})

// ── ritual_spells ────────────────────────────────────────────────────

describe('passiveHandlers – ritual_spells', () => {
    it('returns passive_rule with ritual_spells effect and casting_time default', () => {
        const feature = makeFeature({ type: 'ritual_spells' })
        const result = passiveHandlers.ritual_spells(feature, BASE_STATS)

        expectValidResult(result, 'passive_rule', 'ritual_spells')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature(
            { type: 'ritual_spells', casting_time: '1 minute' },
            'Druid Rituals'
        )
        const result = passiveHandlers.ritual_spells(feature, BASE_STATS)

        expect(result.name).toBe('Druid Rituals')
        expect(result.casting_time).toBe('1 minute')
    })
})

// ── potent_cantrip ───────────────────────────────────────────────────

describe('passiveHandlers – potent_cantrip', () => {
    it('returns potent_cantrip info with defaults', () => {
        const feature = makeFeature({ type: 'potent_cantrip' })
        const result = passiveHandlers.potent_cantrip(feature, BASE_STATS)

        expectValidResult(result, 'potent_cantrip', 'potent_cantrip')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature(
            { type: 'potent_cantrip', casting_time: 'action' },
            'Savage Cantrip'
        )
        const result = passiveHandlers.potent_cantrip(feature, BASE_STATS)

        expect(result.name).toBe('Savage Cantrip')
        expect(result.casting_time).toBe('action')
    })
})

// ── soulstitch_spells ────────────────────────────────────────────────

describe('passiveHandlers – soulstitch_spells', () => {
    it('returns soulstitch_spells info with defaults', () => {
        const feature = makeFeature({ type: 'soulstitch_spells' })
        const result = passiveHandlers.soulstitch_spells(feature, BASE_STATS)

        expectValidResult(result, 'soulstitch_spells', 'soulstitch_spells')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature(
            { type: 'soulstitch_spells', casting_time: 'reaction' },
            'Soul Binder'
        )
        const result = passiveHandlers.soulstitch_spells(feature, BASE_STATS)

        expect(result.name).toBe('Soul Binder')
        expect(result.casting_time).toBe('reaction')
    })
})

// ── empowered_evocation ──────────────────────────────────────────────

describe('passiveHandlers – empowered_evocation', () => {
    it('returns empowered_evocation info with defaults', () => {
        const feature = makeFeature({ type: 'empowered_evocation' })
        const result = passiveHandlers.empowered_evocation(feature, BASE_STATS)

        expectValidResult(result, 'empowered_evocation', 'empowered_evocation')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature(
            { type: 'empowered_evocation', casting_time: '1 action' },
            'Evocation Expert'
        )
        const result = passiveHandlers.empowered_evocation(feature, BASE_STATS)

        expect(result.name).toBe('Evocation Expert')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── tavern_brawler_push ──────────────────────────────────────────────

describe('passiveHandlers – tavern_brawler_push', () => {
    it('returns passive_rule with defaults', () => {
        const feature = makeFeature({ type: 'tavern_brawler_push' })
        const result = passiveHandlers.tavern_brawler_push(feature, BASE_STATS)

        expectValidResult(result, 'passive_rule', 'tavern_brawler_push')
        expect(result.oncePerTurn).toBe(false)
        expect(result.casting_time).toBe('passive')
    })

    it('passes through custom fields and coerces oncePerTurn with !!', () => {
        const feature = makeFeature(
            {
                type: 'tavern_brawler_push',
                oncePerTurn: true,
                casting_time: '1 action'
            },
            'Brawler Shove'
        )
        const result = passiveHandlers.tavern_brawler_push(feature, BASE_STATS)

        expect(result.name).toBe('Brawler Shove')
        expect(result.oncePerTurn).toBe(true)
        expect(result.casting_time).toBe('1 action')
    })
})

// ── ignore_loading_crossbows ─────────────────────────────────────────

describe('passiveHandlers – ignore_loading_crossbows', () => {
    it('returns passive_rule with defaults', () => {
        const feature = makeFeature({ type: 'ignore_loading_crossbows' })
        const result = passiveHandlers.ignore_loading_crossbows(feature, BASE_STATS)

        expectValidResult(result, 'passive_rule', 'ignore_loading_crossbows')
        expect(result.weapons).toEqual([])
        expect(result.casting_time).toBe('passive')
    })

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

// ── naturally_stealthy ───────────────────────────────────────────────

describe('passiveHandlers – naturally_stealthy', () => {
    it('returns passive_rule with casting_time default', () => {
        const feature = makeFeature({ type: 'naturally_stealthy' })
        const result = passiveHandlers.naturally_stealthy(feature, BASE_STATS)

        expectValidResult(result, 'passive_rule', 'naturally_stealthy')
        expect(result.casting_time).toBe('passive')
    })
})
