// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { saveHandlers } from './save.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── save_attack ──────────────────────────────────────────────────────

describe('saveHandlers – save_attack', () => {
    it('returns correct defaults', () => {
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

    it('defaults saveType to DEX and saveAbility to CON', () => {
        const result = saveHandlers.save_attack(makeFeature({ type: 'save_attack' }), BASE_STATS)
        expect(result.saveType).toBe('DEX')
        expect(result.saveAbility).toBe('CON')
    })

    it('resolves saveDc from ability or explicit value', () => {
        // Default saveAbility is CON: 8 + 3 + 3 = 14
        expect(saveHandlers.save_attack(makeFeature({ type: 'save_attack', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(14)
        // Custom saveAbility WIS: 8 + 5 + 3 = 16
        expect(saveHandlers.save_attack(makeFeature({ type: 'save_attack', saveDc: 'ability', saveAbility: 'WIS' }), BASE_STATS).saveDc).toBe(16)
        // Explicit numeric
        expect(saveHandlers.save_attack(makeFeature({ type: 'save_attack', saveDc: 15 }), BASE_STATS).saveDc).toBe(15)
        // Default when undefined
        expect(saveHandlers.save_attack(makeFeature({ type: 'save_attack' }), BASE_STATS).saveDc).toBe(10)
    })

    it('resolves uses from wild_shape resourceCost', () => {
        const stats = {
            ...BASE_STATS,
            class: { ...BASE_STATS.class, class_levels: [{ level: 5, wild_shape: 2 }] }
        }
        const result = saveHandlers.save_attack(makeFeature({ type: 'save_attack', resourceCost: 'wild_shape' }), stats)
        expect(result.uses).toBe(2)
    })

    it('resolves uses from default resolveUses when not wild_shape', () => {
        const result = saveHandlers.save_attack(makeFeature({ type: 'save_attack', resourceCost: 'spell_slot' }), BASE_STATS)
        expect(result.uses).toBe(5)
    })

    it('resolves casting_time to action for various formats', () => {
        const cases = [
            ['1 bonus action', 'bonus_action'],
            ['bonus_action', 'bonus_action'],
            ['1 action', 'action'],
            ['action', 'action'],
            ['1 reaction', 'reaction'],
            ['reaction', 'reaction'],
        ]
        for (const [ct, expected] of cases) {
            expect(saveHandlers.save_attack(makeFeature({ type: 'save_attack', casting_time: ct }), BASE_STATS).action).toBe(expected)
        }
    })

    it('prioritizes auto.action over casting_time derived action', () => {
        const result = saveHandlers.save_attack(makeFeature({ type: 'save_attack', action: 'action', casting_time: '1 bonus action' }), BASE_STATS)
        expect(result.action).toBe('action')
    })

    it('resolves scaling damage and healing', () => {
        const damageResult = saveHandlers.save_attack(makeFeature({ type: 'save_attack', scaling: [{ level: 1, damage: '1d6' }], damage: 'base' }), { ...BASE_STATS, level: 1 })
        expect(damageResult.damage).toBe('1d6')

        const healResult = saveHandlers.save_attack(makeFeature({ type: 'save_attack', healExpression: '2d8', healScaling: [{ level: 5, healExpression: '4d8' }] }), { ...BASE_STATS, level: 5 })
        expect(healResult.healExpression).toBe('4d8')

        expect(saveHandlers.save_attack(makeFeature({ type: 'save_attack', healExpression: '2d8' }), BASE_STATS).healExpression).toBe('2d8')
    })

    it('handles hasOptions false explicitly', () => {
        const result = saveHandlers.save_attack(makeFeature({ type: 'save_attack', hasOptions: false }), BASE_STATS)
        expect(result.hasOptions).toBe(false)
        expect(result.options).toEqual([])
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
})

// ── save_only ────────────────────────────────────────────────────────

describe('saveHandlers – save_only', () => {
    it('returns correct defaults', () => {
        const result = saveHandlers.save_only(makeFeature({ type: 'save_only' }), BASE_STATS)
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

    it('defaults saveType to DEX', () => {
        expect(saveHandlers.save_only(makeFeature({ type: 'save_only' }), BASE_STATS).saveType).toBe('DEX')
    })

    it('resolves saveDc from ability or explicit value', () => {
        // Default saveAbility is CON: 8 + 3 + 3 = 14
        expect(saveHandlers.save_only(makeFeature({ type: 'save_only', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(14)
        expect(saveHandlers.save_only(makeFeature({ type: 'save_only', saveDc: 15 }), BASE_STATS).saveDc).toBe(15)
        expect(saveHandlers.save_only(makeFeature({ type: 'save_only' }), BASE_STATS).saveDc).toBe(10)
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

// ── Fixed-save handlers ──

describe('saveHandlers – flesh_to_stone', () => {
    it('returns correct defaults with fixed condition and duration', () => {
        const result = saveHandlers.flesh_to_stone(makeFeature({ type: 'flesh_to_stone' }), BASE_STATS)
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

    it('defaults saveType to CON', () => {
        expect(saveHandlers.flesh_to_stone(makeFeature({ type: 'flesh_to_stone' }), BASE_STATS).saveType).toBe('CON')
    })

    it('resolves saveDc from ability or explicit value', () => {
        expect(saveHandlers.flesh_to_stone(makeFeature({ type: 'flesh_to_stone', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(14)
        expect(saveHandlers.flesh_to_stone(makeFeature({ type: 'flesh_to_stone', saveDc: 16 }), BASE_STATS).saveDc).toBe(16)
        expect(saveHandlers.flesh_to_stone(makeFeature({ type: 'flesh_to_stone' }), BASE_STATS).saveDc).toBe(10)
    })

    it('passes through custom saveType', () => {
        expect(saveHandlers.flesh_to_stone(makeFeature({ type: 'flesh_to_stone', saveType: 'WIS' }), BASE_STATS).saveType).toBe('WIS')
    })
})

describe('saveHandlers – hold_monster', () => {
    it('returns correct defaults with fixed condition and duration', () => {
        const result = saveHandlers.hold_monster(makeFeature({ type: 'hold_monster' }), BASE_STATS)
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

    it('defaults saveType to WIS', () => {
        expect(saveHandlers.hold_monster(makeFeature({ type: 'hold_monster' }), BASE_STATS).saveType).toBe('WIS')
    })

    it('resolves saveDc from ability or explicit value', () => {
        expect(saveHandlers.hold_monster(makeFeature({ type: 'hold_monster', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(16)
        expect(saveHandlers.hold_monster(makeFeature({ type: 'hold_monster', saveDc: 15 }), BASE_STATS).saveDc).toBe(15)
        expect(saveHandlers.hold_monster(makeFeature({ type: 'hold_monster' }), BASE_STATS).saveDc).toBe(10)
    })
})

describe('saveHandlers – resilient_sphere', () => {
    it('returns correct defaults with fixed duration', () => {
        const result = saveHandlers.resilient_sphere(makeFeature({ type: 'resilient_sphere' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'resilient_sphere',
            name: 'Test Feature',
            saveType: 'DEX',
            saveDc: 10,
            duration: 'Concentration, up to 1 minute',
            hasAutomation: true,
        })
    })

    it('defaults saveType to DEX', () => {
        expect(saveHandlers.resilient_sphere(makeFeature({ type: 'resilient_sphere' }), BASE_STATS).saveType).toBe('DEX')
    })

    it('resolves saveDc from ability or explicit value', () => {
        expect(saveHandlers.resilient_sphere(makeFeature({ type: 'resilient_sphere', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(13)
        expect(saveHandlers.resilient_sphere(makeFeature({ type: 'resilient_sphere', saveDc: 15 }), BASE_STATS).saveDc).toBe(15)
        expect(saveHandlers.resilient_sphere(makeFeature({ type: 'resilient_sphere' }), BASE_STATS).saveDc).toBe(10)
    })

    it('respects custom duration override', () => {
        expect(saveHandlers.resilient_sphere(makeFeature({ type: 'resilient_sphere', duration: '1_round' }), BASE_STATS).duration).toBe('1_round')
    })

    it('defaults duration to Concentration', () => {
        expect(saveHandlers.resilient_sphere(makeFeature({ type: 'resilient_sphere' }), BASE_STATS).duration).toBe('Concentration, up to 1 minute')
    })
})

describe('saveHandlers – ottos_dance', () => {
    it('returns correct defaults with fixed duration', () => {
        const result = saveHandlers.ottos_dance(makeFeature({ type: 'ottos_dance' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'ottos_dance',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 10,
            duration: 'Concentration, up to 1 minute',
            hasAutomation: true,
        })
    })

    it('defaults saveType to WIS', () => {
        expect(saveHandlers.ottos_dance(makeFeature({ type: 'ottos_dance' }), BASE_STATS).saveType).toBe('WIS')
    })

    it('resolves saveDc from ability or explicit value', () => {
        expect(saveHandlers.ottos_dance(makeFeature({ type: 'ottos_dance', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(16)
        expect(saveHandlers.ottos_dance(makeFeature({ type: 'ottos_dance', saveDc: 15 }), BASE_STATS).saveDc).toBe(15)
        expect(saveHandlers.ottos_dance(makeFeature({ type: 'ottos_dance' }), BASE_STATS).saveDc).toBe(10)
    })
})

describe('saveHandlers – power_word_stun', () => {
    it('returns correct defaults', () => {
        const result = saveHandlers.power_word_stun(makeFeature({ type: 'power_word_stun' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'power_word_stun',
            name: 'Test Feature',
            saveType: 'CON',
            saveDc: 10,
            hasAutomation: true,
        })
    })

    it('defaults saveType to CON', () => {
        expect(saveHandlers.power_word_stun(makeFeature({ type: 'power_word_stun' }), BASE_STATS).saveType).toBe('CON')
    })

    it('resolves saveDc from ability or explicit value', () => {
        expect(saveHandlers.power_word_stun(makeFeature({ type: 'power_word_stun', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(14)
        expect(saveHandlers.power_word_stun(makeFeature({ type: 'power_word_stun', saveDc: 15 }), BASE_STATS).saveDc).toBe(15)
        expect(saveHandlers.power_word_stun(makeFeature({ type: 'power_word_stun' }), BASE_STATS).saveDc).toBe(10)
    })
})

describe('saveHandlers – sleep', () => {
    it('returns correct defaults with fixed condition', () => {
        const result = saveHandlers.sleep(makeFeature({ type: 'sleep' }), BASE_STATS)
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

    it('defaults saveType to WIS', () => {
        expect(saveHandlers.sleep(makeFeature({ type: 'sleep' }), BASE_STATS).saveType).toBe('WIS')
    })

    it('resolves saveDc from ability or explicit value', () => {
        expect(saveHandlers.sleep(makeFeature({ type: 'sleep', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(16)
        expect(saveHandlers.sleep(makeFeature({ type: 'sleep', saveDc: 12 }), BASE_STATS).saveDc).toBe(12)
        expect(saveHandlers.sleep(makeFeature({ type: 'sleep' }), BASE_STATS).saveDc).toBe(10)
    })

    it('passes through custom fields', () => {
        const result = saveHandlers.sleep(makeFeature({ type: 'sleep', saveDc: 12, duration: '1_minute' }), BASE_STATS)
        expect(result.saveDc).toBe(12)
        expect(result.duration).toBe('1_minute')
    })
})

describe('saveHandlers – stinking_cloud', () => {
    it('returns correct defaults with fixed condition', () => {
        const result = saveHandlers.stinking_cloud(makeFeature({ type: 'stinking_cloud' }), BASE_STATS)
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

    it('defaults saveType to CON', () => {
        expect(saveHandlers.stinking_cloud(makeFeature({ type: 'stinking_cloud' }), BASE_STATS).saveType).toBe('CON')
    })

    it('resolves saveDc from ability or explicit value', () => {
        expect(saveHandlers.stinking_cloud(makeFeature({ type: 'stinking_cloud', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(14)
        expect(saveHandlers.stinking_cloud(makeFeature({ type: 'stinking_cloud', saveDc: 14 }), BASE_STATS).saveDc).toBe(14)
        expect(saveHandlers.stinking_cloud(makeFeature({ type: 'stinking_cloud' }), BASE_STATS).saveDc).toBe(10)
    })

    it('passes through custom fields', () => {
        const result = saveHandlers.stinking_cloud(makeFeature({ type: 'stinking_cloud', saveDc: 14, duration: '1_round' }), BASE_STATS)
        expect(result.saveDc).toBe(14)
        expect(result.duration).toBe('1_round')
    })
})

describe('saveHandlers – tashas_laughter', () => {
    it('returns correct defaults with fixed condition array', () => {
        const result = saveHandlers.tashas_laughter(makeFeature({ type: 'tashas_laughter' }), BASE_STATS)
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

    it('defaults saveType to WIS', () => {
        expect(saveHandlers.tashas_laughter(makeFeature({ type: 'tashas_laughter' }), BASE_STATS).saveType).toBe('WIS')
    })

    it('resolves saveDc from ability or explicit value', () => {
        expect(saveHandlers.tashas_laughter(makeFeature({ type: 'tashas_laughter', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(16)
        expect(saveHandlers.tashas_laughter(makeFeature({ type: 'tashas_laughter', saveDc: 15 }), BASE_STATS).saveDc).toBe(15)
        expect(saveHandlers.tashas_laughter(makeFeature({ type: 'tashas_laughter' }), BASE_STATS).saveDc).toBe(10)
    })

    it('passes through custom fields', () => {
        const result = saveHandlers.tashas_laughter(makeFeature({ type: 'tashas_laughter', saveDc: 15, duration: '1_round' }), BASE_STATS)
        expect(result.saveDc).toBe(15)
        expect(result.duration).toBe('1_round')
    })
})
