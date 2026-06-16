import { describe, it, expect } from 'vitest'
import { saveHandlers } from './save.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('saveHandlers – save_attack', () => {
    it('returns save_attack info with defaults', () => {
        const feature = makeFeature({ type: 'save_attack' })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.type).toBe('save_attack')
        expect(result.action).toBe('action')
        expect(result.damage).toBe('')
        expect(result.damageType).toBe('')
        expect(result.saveType).toBe('DEX')
        expect(result.saveAbility).toBe('CON')
        expect(result.shape).toBe('')
        expect(result.range).toBe('')
        expect(result.conditionInflicted).toBeNull()
        expect(result.duration).toBe('')
        expect(result.uses).toBe(5)
        expect(result.usesMax).toBe(5)
        expect(result.recharge).toBe('long_rest')
        expect(result.resourceCost).toBe('')
        expect(result.hasOptions).toBe(false)
        expect(result.options).toEqual([])
        expect(result.optionDetails).toEqual({})
        expect(result.healExpression).toBe('')
        expect(result.dcSuccess).toBeNull()
        expect(result.casting_time).toBe('')
        expect(result.hasAutomation).toBe(true)
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

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'save_attack',
            saveDc: 15
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
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

    it('resolves casting_time to action', () => {
        const feature = makeFeature({
            type: 'save_attack',
            casting_time: '1 bonus action'
        })
        const result = saveHandlers.save_attack(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.casting_time).toBe('1 bonus action')
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
            resourceCost: 'spell_slot',
            hasOptions: true,
            options: [{ name: 'Option A' }],
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
        expect(result.resourceCost).toBe('spell_slot')
        expect(result.hasOptions).toBe(true)
        expect(result.options).toEqual([{ name: 'Option A' }])
        expect(result.dcSuccess).toBe('no effect')
    })
})

describe('saveHandlers – save_only', () => {
    it('returns save_only info with defaults', () => {
        const feature = makeFeature({ type: 'save_only' })
        const result = saveHandlers.save_only(feature, BASE_STATS)
        expect(result.type).toBe('save_only')
        expect(result.saveType).toBe('DEX')
        expect(result.conditionInflicted).toBeNull()
        expect(result.duration).toBe('')
        expect(result.successEffect).toBeNull()
        expect(result.hasAutomation).toBe(true)
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'save_only',
            saveDc: 'ability'
        })
        const result = saveHandlers.save_only(feature, BASE_STATS)
        expect(result.saveDc).toBe(14) // 8 + CON(3) + prof(3)
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
        expect(result.type).toBe('flesh_to_stone')
        expect(result.saveType).toBe('CON')
        expect(result.conditionInflicted).toBe('restrained')
        expect(result.duration).toBe('Concentration, up to 1 minute')
        expect(result.hasAutomation).toBe(true)
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

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'flesh_to_stone',
            saveDc: 16
        })
        const result = saveHandlers.flesh_to_stone(feature, BASE_STATS)
        expect(result.saveDc).toBe(16)
    })
})

describe('saveHandlers – hold_monster', () => {
    it('returns hold_monster info with defaults', () => {
        const feature = makeFeature({ type: 'hold_monster' })
        const result = saveHandlers.hold_monster(feature, BASE_STATS)
        expect(result.type).toBe('hold_monster')
        expect(result.saveType).toBe('WIS')
        expect(result.conditionInflicted).toBe('paralyzed')
        expect(result.duration).toBe('Concentration, up to 1 minute')
        expect(result.hasAutomation).toBe(true)
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
})

describe('saveHandlers – resilient_sphere', () => {
    it('returns resilient_sphere info with defaults', () => {
        const feature = makeFeature({ type: 'resilient_sphere' })
        const result = saveHandlers.resilient_sphere(feature, BASE_STATS)
        expect(result.type).toBe('resilient_sphere')
        expect(result.saveType).toBe('DEX')
        expect(result.duration).toBe('Concentration, up to 1 minute')
        expect(result.hasAutomation).toBe(true)
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

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'resilient_sphere',
            saveDc: 15,
            duration: '1_round'
        })
        const result = saveHandlers.resilient_sphere(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
        expect(result.duration).toBe('1_round')
    })
})

describe('saveHandlers – ottos_dance', () => {
    it('returns ottos_dance info with defaults', () => {
        const feature = makeFeature({ type: 'ottos_dance' })
        const result = saveHandlers.ottos_dance(feature, BASE_STATS)
        expect(result.type).toBe('ottos_dance')
        expect(result.saveType).toBe('WIS')
        expect(result.duration).toBe('Concentration, up to 1 minute')
        expect(result.hasAutomation).toBe(true)
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
})

describe('saveHandlers – power_word_stun', () => {
    it('returns power_word_stun info with defaults', () => {
        const feature = makeFeature({ type: 'power_word_stun' })
        const result = saveHandlers.power_word_stun(feature, BASE_STATS)
        expect(result.type).toBe('power_word_stun')
        expect(result.saveType).toBe('CON')
        expect(result.hasAutomation).toBe(true)
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
})

describe('saveHandlers – sleep', () => {
    it('returns sleep info with defaults', () => {
        const feature = makeFeature({ type: 'sleep' })
        const result = saveHandlers.sleep(feature, BASE_STATS)
        expect(result.type).toBe('sleep')
        expect(result.saveType).toBe('WIS')
        expect(result.conditionInflicted).toBe('incapacitated')
        expect(result.duration).toBe('')
        expect(result.hasAutomation).toBe(true)
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
        expect(result.type).toBe('stinking_cloud')
        expect(result.saveType).toBe('CON')
        expect(result.conditionInflicted).toBe('poisoned')
        expect(result.duration).toBe('')
        expect(result.hasAutomation).toBe(true)
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
        expect(result.type).toBe('tashas_laughter')
        expect(result.saveType).toBe('WIS')
        expect(result.conditionInflicted).toEqual(['prone', 'incapacitated'])
        expect(result.duration).toBe('')
        expect(result.hasAutomation).toBe(true)
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
