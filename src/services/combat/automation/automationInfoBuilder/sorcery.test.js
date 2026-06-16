import { describe, it, expect } from 'vitest'
import { sorceryHandlers } from './sorcery.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('sorceryHandlers – sorcery_aura', () => {
    it('returns sorcery_aura info with defaults', () => {
        const feature = makeFeature({ type: 'sorcery_aura' })
        const result = sorceryHandlers.sorcery_aura(feature, BASE_STATS)
        expect(result.type).toBe('sorcery_aura')
        expect(result.uses_max).toBe(2)
        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'sorcery_aura',
            recharge: 'short_rest',
            casting_time: '1 action'
        })
        const result = sorceryHandlers.sorcery_aura(feature, BASE_STATS)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
    })
})

describe('sorceryHandlers – sorcery_incarnate', () => {
    it('returns sorcery_incarnate info with defaults', () => {
        const feature = makeFeature({ type: 'sorcery_incarnate' })
        const result = sorceryHandlers.sorcery_incarnate(feature, BASE_STATS)
        expect(result.type).toBe('sorcery_incarnate')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.cost).toBe(2)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'sorcery_incarnate',
            casting_time: '1 action',
            cost: 3
        })
        const result = sorceryHandlers.sorcery_incarnate(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
        expect(result.cost).toBe(3)
    })
})

describe('sorceryHandlers – bastion_of_law', () => {
    it('returns bastion_of_law info with defaults', () => {
        const feature = makeFeature({ type: 'bastion_of_law' })
        const result = sorceryHandlers.bastion_of_law(feature, BASE_STATS)
        expect(result.type).toBe('bastion_of_law')
        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
        expect(result.resourceCost).toBe('sorcery_points')
        expect(result.maxSP).toBe(5)
        expect(result.minSP).toBe(1)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'bastion_of_law',
            range: '60_ft',
            action: 'bonus_action',
            resourceCost: 'channel_divinity',
            maxSP: 10,
            minSP: 2
        })
        const result = sorceryHandlers.bastion_of_law(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
        expect(result.action).toBe('bonus_action')
        expect(result.resourceCost).toBe('channel_divinity')
        expect(result.maxSP).toBe(10)
        expect(result.minSP).toBe(2)
    })
})

describe('sorceryHandlers – transe_of_order', () => {
    it('returns transe_of_order info with defaults', () => {
        const feature = makeFeature({ type: 'transe_of_order' })
        const result = sorceryHandlers.transe_of_order(feature, BASE_STATS)
        expect(result.type).toBe('transe_of_order')
        expect(result.duration).toBe('1_minute')
        expect(result.action).toBe('bonus_action')
        expect(result.restoreCost).toBe(5)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'transe_of_order',
            duration: '10_minutes',
            action: 'action',
            restoreCost: 10
        })
        const result = sorceryHandlers.transe_of_order(feature, BASE_STATS)
        expect(result.duration).toBe('10_minutes')
        expect(result.action).toBe('action')
        expect(result.restoreCost).toBe(10)
    })
})

describe('sorceryHandlers – clockwork_cavalcade', () => {
    it('returns clockwork_cavalcade info with defaults', () => {
        const feature = makeFeature({ type: 'clockwork_cavalcade' })
        const result = sorceryHandlers.clockwork_cavalcade(feature, BASE_STATS)
        expect(result.type).toBe('clockwork_cavalcade')
        expect(result.action).toBe('action')
        expect(result.range).toBe('30_ft_cube')
        expect(result.maxHeal).toBe(100)
        expect(result.restoreCost).toBe(7)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'clockwork_cavalcade',
            action: 'bonus_action',
            range: '15_ft_cube',
            maxHeal: 50,
            restoreCost: 5
        })
        const result = sorceryHandlers.clockwork_cavalcade(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.range).toBe('15_ft_cube')
        expect(result.maxHeal).toBe(50)
        expect(result.restoreCost).toBe(5)
    })
})

describe('sorceryHandlers – warping_implosion', () => {
    it('returns save_attack type for warping_implosion with defaults', () => {
        const feature = makeFeature({ type: 'warping_implosion' })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)
        expect(result.type).toBe('save_attack')
        expect(result.action).toBe('action')
        expect(result.damage).toBe('')
        expect(result.damageType).toBe('')
        expect(result.saveType).toBe('STR')
        expect(result.saveAbility).toBe('CHA')
        expect(result.shape).toBe('')
        expect(result.range).toBe('')
        expect(result.conditionInflicted).toBeNull()
        expect(result.duration).toBe('')
        expect(result.uses).toBe(1)
        expect(result.usesMax).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.resourceCost).toBe('')
        expect(result.resourceKey).toBe('sorcery_points')
        expect(result.restoreCost).toBeNull()
        expect(result.hasOptions).toBe(false)
        expect(result.options).toEqual([])
        expect(result.optionDetails).toEqual({})
        expect(result.healExpression).toBeNull()
        expect(result.dcSuccess).toBeNull()
        expect(result.hasAutomation).toBe(true)
    })

    it('calculates saveDc when ability', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            saveDc: 'ability',
            saveAbility: 'CHA'
        })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)
        expect(result.saveDc).toBe(13) // 8 + CHA(2) + prof(3)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            action: 'bonus_action',
            damage: '4d6',
            damageType: 'Force',
            saveType: 'CON',
            saveAbility: 'INT',
            shape: 'sphere',
            range: '20_ft',
            conditionInflicted: 'prone',
            duration: '1_round',
            uses: 2,
            resourceCost: 'sorcery_points',
            restoreCost: 3
        })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.damage).toBe('4d6')
        expect(result.damageType).toBe('Force')
        expect(result.saveType).toBe('CON')
        expect(result.saveAbility).toBe('INT')
        expect(result.shape).toBe('sphere')
        expect(result.range).toBe('20_ft')
        expect(result.conditionInflicted).toBe('prone')
        expect(result.duration).toBe('1_round')
        expect(result.uses).toBe(2)
        expect(result.resourceCost).toBe('sorcery_points')
        expect(result.restoreCost).toBe(3)
    })
})
