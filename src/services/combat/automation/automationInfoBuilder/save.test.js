// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { saveHandlers } from './save.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('saveHandlers – save_attack', () => {
    it('returns save_attack info with defaults', () => {
        const feature = makeFeature({ type: 'save_attack' })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'save_attack',
            name: 'Test Feature',
            action: 'action',
            damage: '',
            damageType: '',
            saveType: 'DEX',
            saveAbility: 'CON',
            saveDc: 10,
            shape: '',
            range: '',
            conditionInflicted: null,
            duration: '',
            uses: 5,
            usesMax: 5,
            recharge: 'long_rest',
            resourceCost: '',
            hasOptions: false,
            options: [],
            optionDetails: {},
            healExpression: '',
            dcSuccess: null,
            casting_time: '',
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'save_attack',
            saveDc: 'ability',
            saveAbility: 'CON'
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.saveDc).toBe(14) // 8 + CON(3) + prof(3)
    })

    it('calculates saveDc with different saveAbility', () => {
        const feature = makeFeature({
            type: 'save_attack',
            saveDc: 'ability',
            saveAbility: 'WIS'
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.saveDc).toBe(16) // 8 + WIS(5) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'save_attack',
            saveDc: 15
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'save_attack' })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('resolves uses from wild_shape resourceCost', () => {
        const stats = {
            ...BASE_STATS,
            class: {
                ...BASE_STATS.class,
                class_levels: [{ level: 5, wild_shape: 2 }]
            }
        }
        const feature = makeFeature({
            type: 'save_attack',
            resourceCost: 'wild_shape'
        })
        const result = saveHandlers.save_attack(feature, stats)
        expect(result.uses).toBe(2)
    })

    it('resolves uses from default resolveUses when not wild_shape', () => {
        const feature = makeFeature({
            type: 'save_attack',
            resourceCost: 'spell_slot'
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.uses).toBe(5)
    })

    it('resolves casting_time to action for various formats', () => {
        const bonusAction = makeFeature({ type: 'save_attack', casting_time: '1 bonus action' })
        expect(saveHandlers.save_attack(bonusAction, BASE_STATS).action).toBe('bonus_action')

        const bonusActionAlt = makeFeature({ type: 'save_attack', casting_time: 'bonus_action' })
        expect(saveHandlers.save_attack(bonusActionAlt, BASE_STATS).action).toBe('bonus_action')

        const action = makeFeature({ type: 'save_attack', casting_time: '1 action' })
        expect(saveHandlers.save_attack(action, BASE_STATS).action).toBe('action')

        const actionAlt = makeFeature({ type: 'save_attack', casting_time: 'action' })
        expect(saveHandlers.save_attack(actionAlt, BASE_STATS).action).toBe('action')

        const reaction = makeFeature({ type: 'save_attack', casting_time: '1 reaction' })
        expect(saveHandlers.save_attack(reaction, BASE_STATS).action).toBe('reaction')

        const reactionAlt = makeFeature({ type: 'save_attack', casting_time: 'reaction' })
        expect(saveHandlers.save_attack(reactionAlt, BASE_STATS).action).toBe('reaction')
    })

    it('prioritizes auto.action over casting_time derived action', () => {
        const feature = makeFeature({
            type: 'save_attack',
            action: 'action',
            casting_time: '1 bonus action'
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.action).toBe('action')
    })

    it('resolves scaling damage', () => {
        const feature = makeFeature({
            type: 'save_attack',
            scaling: [{ level: 1, damage: '1d6' }],
            damage: 'base'
        })
        const result = saveHandlers.save_attack(feature, { ...BASE_STATS, level: 1 })
        expect(result.damage).toBe('1d6')
    })

    it('resolves healing expression with scaling', () => {
        const feature = makeFeature({
            type: 'save_attack',
            healExpression: '2d8',
            healScaling: [{ level: 5, healExpression: '4d8' }]
        })
        const result = saveHandlers.save_attack(feature, { ...BASE_STATS, level: 5 })
        expect(result.healExpression).toBe('4d8')
    })

    it('resolves healing expression without scaling', () => {
        const feature = makeFeature({
            type: 'save_attack',
            healExpression: '2d8'
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.healExpression).toBe('2d8')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'save_attack',
            action: 'bonus_action',
            damage: '2d6',
            damageType: 'Fire',
            saveType: 'CON',
            saveAbility: 'WIS',
            shape: 'cone',
            range: '15_ft',
            conditionInflicted: 'poisoned',
            duration: '1_round',
            uses: 3,
            recharge: 'short_rest',
            resourceCost: 'spell_slot',
            hasOptions: true,
            options: [{ name: 'Option A' }],
            optionDetails: { 'Option A': { effect: 'extra' } },
            dcSuccess: 'no effect'
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.damage).toBe('2d6')
        expect(result.damageType).toBe('Fire')
        expect(result.saveType).toBe('CON')
        expect(result.saveAbility).toBe('WIS')
        expect(result.shape).toBe('cone')
        expect(result.range).toBe('15_ft')
        expect(result.conditionInflicted).toBe('poisoned')
        expect(result.duration).toBe('1_round')
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.resourceCost).toBe('spell_slot')
        expect(result.hasOptions).toBe(true)
        expect(result.options).toEqual([{ name: 'Option A' }])
        expect(result.optionDetails).toEqual({ 'Option A': { effect: 'extra' } })
        expect(result.dcSuccess).toBe('no effect')
    })

    it('defaults saveType to DEX', () => {
        const feature = makeFeature({ type: 'save_attack' })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.saveType).toBe('DEX')
    })

    it('defaults saveAbility to CON', () => {
        const feature = makeFeature({ type: 'save_attack' })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.saveAbility).toBe('CON')
    })

    it('handles hasOptions false explicitly', () => {
        const feature = makeFeature({
            type: 'save_attack',
            hasOptions: false
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.hasOptions).toBe(false)
        expect(result.options).toEqual([])
    })
})

describe('saveHandlers – save_only', () => {
    it('returns save_only info with defaults', () => {
        const feature = makeFeature({ type: 'save_only' })
        const result = saveHandlers.save_only(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'save_only',
            name: 'Test Feature',
            saveType: 'DEX',
            saveDc: 10,
            conditionInflicted: null,
            duration: '',
            successEffect: null,
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'save_only',
            saveDc: 'ability'
        })
        const result = saveHandlers.save_only(feature, BASE_STATS)
        expect(result.saveDc).toBe(14) // 8 + CON(3) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'save_only',
            saveDc: 15
        })
        const result = saveHandlers.save_only(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'save_only' })
        const result = saveHandlers.save_only(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('defaults saveType to DEX', () => {
        const feature = makeFeature({ type: 'save_only' })
        const result = saveHandlers.save_only(feature, BASE_STATS)
        expect(result.saveType).toBe('DEX')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'save_only',
            saveType: 'CON',
            saveDc: 15,
            conditionInflicted: 'poisoned',
            duration: '1_round',
            successEffect: 'no effect'
        })
        const result = saveHandlers.save_only(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.conditionInflicted).toBe('poisoned')
        expect(result.duration).toBe('1_round')
        expect(result.successEffect).toBe('no effect')
    })
})

describe('saveHandlers – flesh_to_stone', () => {
    it('returns flesh_to_stone info with defaults', () => {
        const feature = makeFeature({ type: 'flesh_to_stone' })
        const result = saveHandlers.flesh_to_stone(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'flesh_to_stone',
            name: 'Test Feature',
            saveType: 'CON',
            saveDc: 10,
            conditionInflicted: 'restrained',
            duration: 'Concentration, up to 1 minute',
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'flesh_to_stone',
            saveDc: 'ability',
            saveAbility: 'CON'
        })
        const result = saveHandlers.flesh_to_stone(feature, BASE_STATS)
        expect(result.saveDc).toBe(14) // 8 + CON(3) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'flesh_to_stone',
            saveDc: 16
        })
        const result = saveHandlers.flesh_to_stone(feature, BASE_STATS)
        expect(result.saveDc).toBe(16)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'flesh_to_stone' })
        const result = saveHandlers.flesh_to_stone(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('defaults saveType to CON', () => {
        const feature = makeFeature({ type: 'flesh_to_stone' })
        const result = saveHandlers.flesh_to_stone(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
    })

    it('passes through custom saveType', () => {
        const feature = makeFeature({
            type: 'flesh_to_stone',
            saveType: 'WIS'
        })
        const result = saveHandlers.flesh_to_stone(feature, BASE_STATS)
        expect(result.saveType).toBe('WIS')
    })
})

describe('saveHandlers – hold_monster', () => {
    it('returns hold_monster info with defaults', () => {
        const feature = makeFeature({ type: 'hold_monster' })
        const result = saveHandlers.hold_monster(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'hold_monster',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 10,
            conditionInflicted: 'paralyzed',
            duration: 'Concentration, up to 1 minute',
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'hold_monster',
            saveDc: 'ability',
            saveAbility: 'WIS'
        })
        const result = saveHandlers.hold_monster(feature, BASE_STATS)
        expect(result.saveDc).toBe(16) // 8 + WIS(5) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'hold_monster',
            saveDc: 15
        })
        const result = saveHandlers.hold_monster(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'hold_monster' })
        const result = saveHandlers.hold_monster(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('defaults saveType to WIS', () => {
        const feature = makeFeature({ type: 'hold_monster' })
        const result = saveHandlers.hold_monster(feature, BASE_STATS)
        expect(result.saveType).toBe('WIS')
    })
})

describe('saveHandlers – resilient_sphere', () => {
    it('returns resilient_sphere info with defaults', () => {
        const feature = makeFeature({ type: 'resilient_sphere' })
        const result = saveHandlers.resilient_sphere(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'resilient_sphere',
            name: 'Test Feature',
            saveType: 'DEX',
            saveDc: 10,
            duration: 'Concentration, up to 1 minute',
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'resilient_sphere',
            saveDc: 'ability',
            saveAbility: 'DEX'
        })
        const result = saveHandlers.resilient_sphere(feature, BASE_STATS)
        expect(result.saveDc).toBe(13) // 8 + DEX(2) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'resilient_sphere',
            saveDc: 15
        })
        const result = saveHandlers.resilient_sphere(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'resilient_sphere' })
        const result = saveHandlers.resilient_sphere(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('defaults saveType to DEX', () => {
        const feature = makeFeature({ type: 'resilient_sphere' })
        const result = saveHandlers.resilient_sphere(feature, BASE_STATS)
        expect(result.saveType).toBe('DEX')
    })

    it('respects custom duration override', () => {
        const feature = makeFeature({
            type: 'resilient_sphere',
            duration: '1_round'
        })
        const result = saveHandlers.resilient_sphere(feature, BASE_STATS)
        expect(result.duration).toBe('1_round')
    })

    it('defaults duration to Concentration', () => {
        const feature = makeFeature({ type: 'resilient_sphere' })
        const result = saveHandlers.resilient_sphere(feature, BASE_STATS)
        expect(result.duration).toBe('Concentration, up to 1 minute')
    })
})

describe('saveHandlers – ottos_dance', () => {
    it('returns ottos_dance info with defaults', () => {
        const feature = makeFeature({ type: 'ottos_dance' })
        const result = saveHandlers.ottos_dance(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'ottos_dance',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 10,
            duration: 'Concentration, up to 1 minute',
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'ottos_dance',
            saveDc: 'ability',
            saveAbility: 'WIS'
        })
        const result = saveHandlers.ottos_dance(feature, BASE_STATS)
        expect(result.saveDc).toBe(16) // 8 + WIS(5) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'ottos_dance',
            saveDc: 15
        })
        const result = saveHandlers.ottos_dance(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'ottos_dance' })
        const result = saveHandlers.ottos_dance(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('defaults saveType to WIS', () => {
        const feature = makeFeature({ type: 'ottos_dance' })
        const result = saveHandlers.ottos_dance(feature, BASE_STATS)
        expect(result.saveType).toBe('WIS')
    })
})

describe('saveHandlers – power_word_stun', () => {
    it('returns power_word_stun info with defaults', () => {
        const feature = makeFeature({ type: 'power_word_stun' })
        const result = saveHandlers.power_word_stun(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'power_word_stun',
            name: 'Test Feature',
            saveType: 'CON',
            saveDc: 10,
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'power_word_stun',
            saveDc: 'ability',
            saveAbility: 'CON'
        })
        const result = saveHandlers.power_word_stun(feature, BASE_STATS)
        expect(result.saveDc).toBe(14) // 8 + CON(3) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'power_word_stun',
            saveDc: 15
        })
        const result = saveHandlers.power_word_stun(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'power_word_stun' })
        const result = saveHandlers.power_word_stun(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('defaults saveType to CON', () => {
        const feature = makeFeature({ type: 'power_word_stun' })
        const result = saveHandlers.power_word_stun(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
    })
})

describe('saveHandlers – sleep', () => {
    it('returns sleep info with defaults', () => {
        const feature = makeFeature({ type: 'sleep' })
        const result = saveHandlers.sleep(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'sleep',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 10,
            conditionInflicted: 'incapacitated',
            duration: '',
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'sleep',
            saveDc: 'ability',
            saveAbility: 'WIS'
        })
        const result = saveHandlers.sleep(feature, BASE_STATS)
        expect(result.saveDc).toBe(16) // 8 + WIS(5) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'sleep',
            saveDc: 12
        })
        const result = saveHandlers.sleep(feature, BASE_STATS)
        expect(result.saveDc).toBe(12)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'sleep' })
        const result = saveHandlers.sleep(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('defaults saveType to WIS', () => {
        const feature = makeFeature({ type: 'sleep' })
        const result = saveHandlers.sleep(feature, BASE_STATS)
        expect(result.saveType).toBe('WIS')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'sleep',
            saveDc: 12,
            duration: '1_minute'
        })
        const result = saveHandlers.sleep(feature, BASE_STATS)
        expect(result.saveDc).toBe(12)
        expect(result.duration).toBe('1_minute')
    })
})

describe('saveHandlers – stinking_cloud', () => {
    it('returns stinking_cloud info with defaults', () => {
        const feature = makeFeature({ type: 'stinking_cloud' })
        const result = saveHandlers.stinking_cloud(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'stinking_cloud',
            name: 'Test Feature',
            saveType: 'CON',
            saveDc: 10,
            conditionInflicted: 'poisoned',
            duration: '',
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'stinking_cloud',
            saveDc: 'ability',
            saveAbility: 'CON'
        })
        const result = saveHandlers.stinking_cloud(feature, BASE_STATS)
        expect(result.saveDc).toBe(14) // 8 + CON(3) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'stinking_cloud',
            saveDc: 14
        })
        const result = saveHandlers.stinking_cloud(feature, BASE_STATS)
        expect(result.saveDc).toBe(14)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'stinking_cloud' })
        const result = saveHandlers.stinking_cloud(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('defaults saveType to CON', () => {
        const feature = makeFeature({ type: 'stinking_cloud' })
        const result = saveHandlers.stinking_cloud(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'stinking_cloud',
            saveDc: 14,
            duration: '1_round'
        })
        const result = saveHandlers.stinking_cloud(feature, BASE_STATS)
        expect(result.saveDc).toBe(14)
        expect(result.duration).toBe('1_round')
    })
})

describe('saveHandlers – tashas_laughter', () => {
    it('returns tashas_laughter info with defaults', () => {
        const feature = makeFeature({ type: 'tashas_laughter' })
        const result = saveHandlers.tashas_laughter(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'tashas_laughter',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 10,
            conditionInflicted: ['prone', 'incapacitated'],
            duration: '',
            hasAutomation: true,
        })
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'tashas_laughter',
            saveDc: 'ability',
            saveAbility: 'WIS'
        })
        const result = saveHandlers.tashas_laughter(feature, BASE_STATS)
        expect(result.saveDc).toBe(16) // 8 + WIS(5) + prof(3)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'tashas_laughter',
            saveDc: 15
        })
        const result = saveHandlers.tashas_laughter(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('defaults saveDc to 10 when undefined', () => {
        const feature = makeFeature({ type: 'tashas_laughter' })
        const result = saveHandlers.tashas_laughter(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('defaults saveType to WIS', () => {
        const feature = makeFeature({ type: 'tashas_laughter' })
        const result = saveHandlers.tashas_laughter(feature, BASE_STATS)
        expect(result.saveType).toBe('WIS')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'tashas_laughter',
            saveDc: 15,
            duration: '1_round'
        })
        const result = saveHandlers.tashas_laughter(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
        expect(result.duration).toBe('1_round')
    })
})
