import { describe, it, expect } from 'vitest'
import { passiveHandlers } from './passive.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('passiveHandlers – passive_buff', () => {
    it('returns passive_buff info with defaults', () => {
        const feature = makeFeature({ type: 'passive_buff' })
        const result = passiveHandlers.passive_buff(feature, BASE_STATS)
        expect(result.type).toBe('passive_buff')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBe('allies_in_range')
        expect(result.range_expression).toBe('10_ft')
        expect(result.effect).toBe('')
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
        expect(result.alsoSelfHealing).toBeNull()
        expect(result.hasAutomation).toBe(true)
    })

    it('returns passive_rule type when effect is max_hp_increase', () => {
        const feature = makeFeature({
            type: 'passive_buff',
            effect: 'max_hp_increase'
        })
        const result = passiveHandlers.passive_buff(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
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
        })
        const result = passiveHandlers.passive_buff(feature, BASE_STATS)
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

describe('passiveHandlers – ignore_resistance', () => {
    it('returns passive_rule with ignore_resistance effect', () => {
        const feature = makeFeature({ type: 'ignore_resistance' })
        const result = passiveHandlers.ignore_resistance(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('ignore_resistance')
        expect(result.damageTypes).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'ignore_resistance',
            damageTypes: ['fire', 'cold']
        })
        const result = passiveHandlers.ignore_resistance(feature, BASE_STATS)
        expect(result.damageTypes).toEqual(['fire', 'cold'])
    })
})

describe('passiveHandlers – passive_immunity', () => {
    it('returns passive_immunity info with defaults', () => {
        const feature = makeFeature({ type: 'passive_immunity' })
        const result = passiveHandlers.passive_immunity(feature, BASE_STATS)
        expect(result.type).toBe('passive_immunity')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBe('self')
        expect(result.conditionImmunity).toBe('')
        expect(result.damageResistance).toEqual([])
        expect(result.saveAdvantage).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'passive_immunity',
            target: 'allies_in_range',
            conditionImmunity: 'charmed frightened',
            damage_resistance: ['fire', 'cold'],
            save_advantage: [{ saveType: 'WIS', condition: 'against_fear' }]
        })
        const result = passiveHandlers.passive_immunity(feature, BASE_STATS)
        expect(result.target).toBe('allies_in_range')
        expect(result.conditionImmunity).toBe('charmed frightened')
        expect(result.damageResistance).toEqual(['fire', 'cold'])
        expect(result.saveAdvantage).toEqual([{ saveType: 'WIS', condition: 'against_fear' }])
    })
})

describe('passiveHandlers – holy_nimbus_radiant_damage', () => {
    it('returns passive_rule with holy_nimbus_radiant_damage effect', () => {
        const feature = makeFeature({ type: 'holy_nimbus_radiant_damage' })
        const result = passiveHandlers.holy_nimbus_radiant_damage(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('holy_nimbus_radiant_damage')
        expect(result.damageExpression).toBe('')
        expect(result.range).toBe('')
        expect(result.casting_time).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'holy_nimbus_radiant_damage',
            damageExpression: '2d6',
            range: '10_ft',
            casting_time: '1 bonus action'
        })
        const result = passiveHandlers.holy_nimbus_radiant_damage(feature, BASE_STATS)
        expect(result.damageExpression).toBe('2d6')
        expect(result.range).toBe('10_ft')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

describe('passiveHandlers – umbral_sight', () => {
    it('returns passive_rule with umbral_sight effect', () => {
        const feature = makeFeature({ type: 'umbral_sight' })
        const result = passiveHandlers.umbral_sight(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('umbral_sight')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – supreme_sneak', () => {
    it('returns passive_rule with supreme_sneak effect', () => {
        const feature = makeFeature({ type: 'supreme_sneak' })
        const result = passiveHandlers.supreme_sneak(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('supreme_sneak')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – otherworldly_glamour', () => {
    it('returns passive_buff with otherworldly_glamour effect', () => {
        const feature = makeFeature({ type: 'otherworldly_glamour' })
        const result = passiveHandlers.otherworldly_glamour(feature, BASE_STATS)
        expect(result.type).toBe('passive_buff')
        expect(result.effect).toBe('otherworldly_glamour')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – create_thrall_temp_hp', () => {
    it('returns create_thrall_temp_hp info', () => {
        const feature = makeFeature({ type: 'create_thrall_temp_hp' })
        const result = passiveHandlers.create_thrall_temp_hp(feature, BASE_STATS)
        expect(result.type).toBe('create_thrall_temp_hp')
        expect(result.tempHpExpression).toBe('')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'create_thrall_temp_hp',
            tempHpExpression: 'warlock level + CHA modifier'
        })
        const result = passiveHandlers.create_thrall_temp_hp(feature, BASE_STATS)
        expect(result.tempHpExpression).toBe('warlock level + CHA modifier')
    })
})

describe('passiveHandlers – ritual_spells', () => {
    it('returns passive_rule with ritual_spells effect', () => {
        const feature = makeFeature({ type: 'ritual_spells' })
        const result = passiveHandlers.ritual_spells(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('ritual_spells')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – potent_cantrip', () => {
    it('returns potent_cantrip info', () => {
        const feature = makeFeature({ type: 'potent_cantrip' })
        const result = passiveHandlers.potent_cantrip(feature, BASE_STATS)
        expect(result.type).toBe('potent_cantrip')
        expect(result.effect).toBe('potent_cantrip')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – soulstitch_spells', () => {
    it('returns soulstitch_spells info', () => {
        const feature = makeFeature({ type: 'soulstitch_spells' })
        const result = passiveHandlers.soulstitch_spells(feature, BASE_STATS)
        expect(result.type).toBe('soulstitch_spells')
        expect(result.effect).toBe('soulstitch_spells')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – empowered_evocation', () => {
    it('returns empowered_evocation info', () => {
        const feature = makeFeature({ type: 'empowered_evocation' })
        const result = passiveHandlers.empowered_evocation(feature, BASE_STATS)
        expect(result.type).toBe('empowered_evocation')
        expect(result.effect).toBe('empowered_evocation')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – concentration_disadvantage_on_damage_dealt', () => {
    it('returns passive_rule with concentration_disadvantage_on_damage_dealt effect', () => {
        const feature = makeFeature({ type: 'concentration_disadvantage_on_damage_dealt' })
        const result = passiveHandlers.concentration_disadvantage_on_damage_dealt(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('concentration_disadvantage_on_damage_dealt')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – tavern_brawler_reroll_ones', () => {
    it('returns passive_rule with tavern_brawler_reroll_ones effect', () => {
        const feature = makeFeature({ type: 'tavern_brawler_reroll_ones' })
        const result = passiveHandlers.tavern_brawler_reroll_ones(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('tavern_brawler_reroll_ones')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – tavern_brawler_push', () => {
    it('returns passive_rule with tavern_brawler_push effect', () => {
        const feature = makeFeature({ type: 'tavern_brawler_push' })
        const result = passiveHandlers.tavern_brawler_push(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('tavern_brawler_push')
        expect(result.oncePerTurn).toBe(false)
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'tavern_brawler_push',
            oncePerTurn: true,
            casting_time: '1 action'
        })
        const result = passiveHandlers.tavern_brawler_push(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
        expect(result.casting_time).toBe('1 action')
    })
})

describe('passiveHandlers – ignore_loading_crossbows', () => {
    it('returns passive_rule with ignore_loading_crossbows effect', () => {
        const feature = makeFeature({ type: 'ignore_loading_crossbows' })
        const result = passiveHandlers.ignore_loading_crossbows(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('ignore_loading_crossbows')
        expect(result.weapons).toEqual([])
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'ignore_loading_crossbows',
            weapons: ['heavy crossbow', 'light crossbow']
        })
        const result = passiveHandlers.ignore_loading_crossbows(feature, BASE_STATS)
        expect(result.weapons).toEqual(['heavy crossbow', 'light crossbow'])
    })
})

describe('passiveHandlers – no_melee_disadvantage_crossbows', () => {
    it('returns passive_rule with no_melee_disadvantage_crossbows effect', () => {
        const feature = makeFeature({ type: 'no_melee_disadvantage_crossbows' })
        const result = passiveHandlers.no_melee_disadvantage_crossbows(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('no_melee_disadvantage_crossbows')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('passiveHandlers – naturally_stealthy', () => {
    it('returns passive_rule with naturally_stealthy effect', () => {
        const feature = makeFeature({ type: 'naturally_stealthy' })
        const result = passiveHandlers.naturally_stealthy(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('naturally_stealthy')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})
