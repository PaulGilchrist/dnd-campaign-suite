// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { sorceryHandlers } from './sorcery.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('sorceryHandlers – sorcery_aura', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'sorcery_aura' })
        const result = sorceryHandlers.sorcery_aura(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'sorcery_aura',
            name: 'Test Feature',
            uses_max: 2,
            recharge: 'long_rest',
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('passes through custom automation fields', () => {
        const feature = makeFeature({
            type: 'sorcery_aura',
            recharge: 'short_rest',
            casting_time: '1 action',
        })
        const result = sorceryHandlers.sorcery_aura(feature, BASE_STATS)

        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
    })

    it('falls back to defaults when automation fields are empty strings', () => {
        const feature = makeFeature({
            type: 'sorcery_aura',
            recharge: '',
            casting_time: '',
        })
        const result = sorceryHandlers.sorcery_aura(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('1 bonus action')
    })

    it('uses custom name from feature', () => {
        const feature = makeFeature({ type: 'sorcery_aura' }, 'Custom Aura')
        const result = sorceryHandlers.sorcery_aura(feature, BASE_STATS)

        expect(result.name).toBe('Custom Aura')
    })
})

describe('sorceryHandlers – sorcery_incarnate', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'sorcery_incarnate' })
        const result = sorceryHandlers.sorcery_incarnate(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'sorcery_incarnate',
            name: 'Test Feature',
            casting_time: '1 bonus action',
            cost: 2,
            hasAutomation: true,
        })
    })

    it('passes through custom automation fields', () => {
        const feature = makeFeature({
            type: 'sorcery_incarnate',
            casting_time: '1 action',
            cost: 3,
        })
        const result = sorceryHandlers.sorcery_incarnate(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
        expect(result.cost).toBe(3)
    })

    it('falls back to defaults when automation fields are empty strings', () => {
        const feature = makeFeature({
            type: 'sorcery_incarnate',
            casting_time: '',
            cost: 0,
        })
        const result = sorceryHandlers.sorcery_incarnate(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
        expect(result.cost).toBe(2)
    })
})

describe('sorceryHandlers – bastion_of_law', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'bastion_of_law' })
        const result = sorceryHandlers.bastion_of_law(feature, BASE_STATS)

        expect(result).toMatchObject({
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

    it('passes through custom automation fields', () => {
        const feature = makeFeature({
            type: 'bastion_of_law',
            range: '60_ft',
            action: 'bonus_action',
            resourceCost: 'channel_divinity',
            maxSP: 10,
            minSP: 2,
        })
        const result = sorceryHandlers.bastion_of_law(feature, BASE_STATS)

        expect(result.range).toBe('60_ft')
        expect(result.action).toBe('bonus_action')
        expect(result.resourceCost).toBe('channel_divinity')
        expect(result.maxSP).toBe(10)
        expect(result.minSP).toBe(2)
    })

    it('falls back to defaults when automation fields are empty strings or zero', () => {
        const feature = makeFeature({
            type: 'bastion_of_law',
            range: '',
            action: '',
            resourceCost: '',
            maxSP: 0,
            minSP: 0,
        })
        const result = sorceryHandlers.bastion_of_law(feature, BASE_STATS)

        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.resourceCost).toBe('sorcery_points')
        expect(result.maxSP).toBe(5)
        expect(result.minSP).toBe(1)
    })
})

describe('sorceryHandlers – transe_of_order', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'transe_of_order' })
        const result = sorceryHandlers.transe_of_order(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'transe_of_order',
            name: 'Test Feature',
            duration: '1_minute',
            action: 'bonus_action',
            restoreCost: 5,
            hasAutomation: true,
        })
    })

    it('passes through custom automation fields', () => {
        const feature = makeFeature({
            type: 'transe_of_order',
            duration: '10_minutes',
            action: 'action',
            restoreCost: 10,
        })
        const result = sorceryHandlers.transe_of_order(feature, BASE_STATS)

        expect(result.duration).toBe('10_minutes')
        expect(result.action).toBe('action')
        expect(result.restoreCost).toBe(10)
    })

    it('falls back to defaults when automation fields are empty strings or zero', () => {
        const feature = makeFeature({
            type: 'transe_of_order',
            duration: '',
            action: '',
            restoreCost: 0,
        })
        const result = sorceryHandlers.transe_of_order(feature, BASE_STATS)

        expect(result.duration).toBe('1_minute')
        expect(result.action).toBe('bonus_action')
        expect(result.restoreCost).toBe(5)
    })
})

describe('sorceryHandlers – clockwork_cavalcade', () => {
    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'clockwork_cavalcade' })
        const result = sorceryHandlers.clockwork_cavalcade(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'clockwork_cavalcade',
            name: 'Test Feature',
            action: 'action',
            range: '30_ft_cube',
            maxHeal: 100,
            restoreCost: 7,
            hasAutomation: true,
        })
    })

    it('passes through custom automation fields', () => {
        const feature = makeFeature({
            type: 'clockwork_cavalcade',
            action: 'bonus_action',
            range: '15_ft_cube',
            maxHeal: 50,
            restoreCost: 5,
        })
        const result = sorceryHandlers.clockwork_cavalcade(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
        expect(result.range).toBe('15_ft_cube')
        expect(result.maxHeal).toBe(50)
        expect(result.restoreCost).toBe(5)
    })

    it('falls back to defaults when automation fields are empty strings or zero', () => {
        const feature = makeFeature({
            type: 'clockwork_cavalcade',
            action: '',
            range: '',
            maxHeal: 0,
            restoreCost: 0,
        })
        const result = sorceryHandlers.clockwork_cavalcade(feature, BASE_STATS)

        expect(result.action).toBe('action')
        expect(result.range).toBe('30_ft_cube')
        expect(result.maxHeal).toBe(100)
        expect(result.restoreCost).toBe(7)
    })
})

describe('sorceryHandlers – warping_implosion', () => {
    const expectedDefaults = {
        type: 'save_attack',
        name: 'Test Feature',
        action: 'action',
        damage: '',
        damageType: '',
        saveType: 'STR',
        saveAbility: 'CHA',
        shape: '',
        range: '',
        conditionInflicted: null,
        duration: '',
        uses: 1,
        usesMax: 1,
        recharge: 'long_rest',
        resourceCost: '',
        resourceKey: 'sorcery_points',
        restoreCost: null,
        hasOptions: false,
        options: [],
        optionDetails: {},
        healExpression: null,
        dcSuccess: null,
        hasAutomation: true,
    }

    it('returns correct defaults', () => {
        const feature = makeFeature({ type: 'warping_implosion' })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)

        expect(result).toMatchObject(expectedDefaults)
    })

    it('calculates saveDc from ability when saveDc is "ability"', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            saveDc: 'ability',
            saveAbility: 'CHA',
        })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)

        // CHA bonus=2, proficiency=3 => 8 + 2 + 3 = 13
        expect(result.saveDc).toBe(13)
    })

    it('calculates saveDc from ability with different ability score', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            saveDc: 'ability',
            saveAbility: 'WIS',
        })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)

        // WIS bonus=5, proficiency=3 => 8 + 5 + 3 = 16
        expect(result.saveDc).toBe(16)
    })

    it('uses explicit saveDc value when not "ability"', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            saveDc: 15,
        })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)

        expect(result.saveDc).toBe(15)
    })

    it('defaults saveDc to 10 when not specified and not "ability"', () => {
        const feature = makeFeature({ type: 'warping_implosion' })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)

        expect(result.saveDc).toBe(10)
    })

    it('passes through custom automation fields', () => {
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
            restoreCost: 3,
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
        expect(result.usesMax).toBe(2)
        expect(result.resourceCost).toBe('sorcery_points')
        expect(result.restoreCost).toBe(3)
    })

    it('passes through hasOptions, options, and optionDetails', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            hasOptions: true,
            options: ['option_a', 'option_b'],
            optionDetails: { option_a: 'Detail A' },
        })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)

        expect(result.hasOptions).toBe(true)
        expect(result.options).toEqual(['option_a', 'option_b'])
        expect(result.optionDetails).toEqual({ option_a: 'Detail A' })
    })

    it('passes through dcSuccess', () => {
        const feature = makeFeature({
            type: 'warping_implosion',
            dcSuccess: 'half damage',
        })
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)

        expect(result.dcSuccess).toBe('half damage')
    })

    it('passes through custom name from feature', () => {
        const feature = makeFeature({ type: 'warping_implosion' }, 'Warping Doom')
        const result = sorceryHandlers.warping_implosion(feature, BASE_STATS)

        expect(result.name).toBe('Warping Doom')
    })
})
