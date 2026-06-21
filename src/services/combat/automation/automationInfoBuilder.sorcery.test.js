// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – sorcery_aura', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'sorcery_aura' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'sorcery_aura',
            name: 'Test Feature',
            uses_max: 2,
            recharge: 'long_rest',
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('passes through custom recharge and casting_time', () => {
        const feature = makeFeature({
            type: 'sorcery_aura',
            recharge: 'short_rest',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
    })
})

describe('buildAttackInfo – sorcery_incarnate', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'sorcery_incarnate' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'sorcery_incarnate',
            name: 'Test Feature',
            casting_time: '1 bonus action',
            cost: 2,
            hasAutomation: true,
        })
    })

    it('passes through custom casting_time and cost', () => {
        const feature = makeFeature({
            type: 'sorcery_incarnate',
            casting_time: '1 action',
            cost: 5,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
        expect(result.cost).toBe(5)
    })
})

describe('buildAttackInfo – bastion_of_law', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'bastion_of_law' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'bastion_of_law',
            name: 'Test Feature',
            range: '30_ft',
            action: 'action',
            casting_time: '1 action',
            resourceCost: 'sorcery_points',
            maxSP: 5,
            minSP: 1,
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'bastion_of_law',
            range: '60_ft',
            action: 'bonus_action',
            casting_time: '1 reaction',
            resourceCost: 'custom_resource',
            maxSP: 10,
            minSP: 3,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
        expect(result.action).toBe('bonus_action')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.resourceCost).toBe('custom_resource')
        expect(result.maxSP).toBe(10)
        expect(result.minSP).toBe(3)
    })
})

describe('buildAttackInfo – transe_of_order', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'transe_of_order' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'transe_of_order',
            name: 'Test Feature',
            duration: '1_minute',
            action: 'bonus_action',
            restoreCost: 5,
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'transe_of_order',
            duration: '10_minutes',
            action: 'action',
            restoreCost: 10,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.duration).toBe('10_minutes')
        expect(result.action).toBe('action')
        expect(result.restoreCost).toBe(10)
    })
})

describe('buildAttackInfo – clockwork_cavalcade', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'clockwork_cavalcade' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'clockwork_cavalcade',
            name: 'Test Feature',
            action: 'action',
            range: '30_ft_cube',
            maxHeal: 100,
            restoreCost: 7,
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'clockwork_cavalcade',
            action: 'bonus_action',
            range: '60_ft_cube',
            maxHeal: 200,
            restoreCost: 14,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.range).toBe('60_ft_cube')
        expect(result.maxHeal).toBe(200)
        expect(result.restoreCost).toBe(14)
    })
})

describe('buildAttackInfo – warping_implosion', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'warping_implosion' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('save_attack')
        expect(result.name).toBe('Test Feature')
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

    it('computes saveDc from CHA ability and proficiency when saveDc is ability', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            saveDc: 'ability',
            saveAbility: 'CHA',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        // 8 + CHA bonus(2) + proficiency(3) = 13
        expect(result.saveDc).toBe(13)
    })

    it('uses explicit saveDc value when saveDc is not ability', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            saveDc: 16,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(16)
    })

    it('defaults to saveDc 10 when saveDc is absent and not ability', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('uses WIS ability for saveDc calculation when specified', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            saveDc: 'ability',
            saveAbility: 'WIS',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        // 8 + WIS bonus(5) + proficiency(3) = 16
        expect(result.saveDc).toBe(16)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            action: 'bonus_action',
            damage: '4d8',
            damageType: 'force',
            saveType: 'DEX',
            shape: 'cone',
            range: '60_ft',
            conditionInflicted: 'prone',
            duration: '1_round',
            uses: 3,
            recharge: 'short_rest',
            resourceCost: 'sorcery_points',
            restoreCost: 2,
            hasOptions: true,
            options: ['option1', 'option2'],
            optionDetails: { option1: { detail: 'a' } },
            dcSuccess: 'half',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.damage).toBe('4d8')
        expect(result.damageType).toBe('force')
        expect(result.saveType).toBe('DEX')
        expect(result.shape).toBe('cone')
        expect(result.range).toBe('60_ft')
        expect(result.conditionInflicted).toBe('prone')
        expect(result.duration).toBe('1_round')
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.resourceCost).toBe('sorcery_points')
        expect(result.restoreCost).toBe(2)
        expect(result.hasOptions).toBe(true)
        expect(result.options).toEqual(['option1', 'option2'])
        expect(result.optionDetails).toEqual({ option1: { detail: 'a' } })
        expect(result.dcSuccess).toBe('half')
    })

    it('uses proficiency from playerStats for saveDc calculation', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            saveDc: 'ability',
            saveAbility: 'DEX',
        })
        const highProfStats = { ...BASE_STATS, proficiency: 6 }
        const result = buildAttackInfo(feature, highProfStats)
        // 8 + DEX bonus(2) + proficiency(6) = 16
        expect(result.saveDc).toBe(16)
    })
})

describe('buildAttackInfo – unknown handler type', () => {
    it('returns null for unregistered automation type', () => {
        const feature = makeFeature({ type: 'unknown_type' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })
})
