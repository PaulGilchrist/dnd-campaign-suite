import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE, normalizeAbilityName } from './automationInfoBuilder.fixtures.js'

vi.mock('./automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn((expr, _stats) => {
        if (!expr) return 0
        return 2
    }),
    resolveHealingPoolExpression: vi.fn((base, scaling, stats) => {
        if (!scaling) return base
        if (!stats) return base
        const entries = Object.entries(scaling)
            .map(([k, v]) => ({ level: parseInt(k, 10), expression: String(v) }))
            .filter(e => !isNaN(e.level))
            .sort((a, b) => a.level - b.level)
        let resolved = base
        for (const entry of entries) {
            if (stats.level >= entry.level) resolved = entry.expression
        }
        return resolved
    }),
    getSaveDc: vi.fn((stats, ability, proficiency) => {
        const canonical = normalizeAbilityName(ability)
        const bonus = stats.abilities?.find(a => a.name === canonical)?.bonus ?? 0
        return 8 + bonus + (proficiency || 0)
    }),
    resolveUses: vi.fn((stats, usesSpec) => {
        if (typeof usesSpec === 'number') return usesSpec
        if (usesSpec === 'proficiency_bonus') return stats.proficiency || 0
        return stats.level || 1
    }),
    resolveDiceExpression: vi.fn((expr) => expr),
    resolveScaling: vi.fn((stats, scaling) => {
        if (!scaling) return null
        let result = null
        for (const entry of scaling) {
            if (stats.level >= entry.level) result = entry
        }
        return result
    }),
}))

import { getSaveDc } from './automationExpressions.js'

describe('buildAttackInfo – resistance', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'resistance' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'resistance',
            name: 'Test Feature',
            damageTypes: [],
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'resistance',
                damageTypes: ['fire', 'cold', 'lightning'],
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageTypes).toEqual(['fire', 'cold', 'lightning'])
    })
})

describe('buildAttackInfo – resource_pool', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'resource_pool' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'resource_pool',
            name: 'Test Feature',
            resource: '',
            uses_expression: '',
            recharge_short_rest: '',
            recharge_long_rest: '',
            conversion: '',
            reverseConversion: '',
            reverseRecharge: '',
            conversionRate: '',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'resource_pool',
                resource: 'sorcery_points',
                uses_expression: '2d6',
                recharge_short_rest: '1',
                recharge_long_rest: '2',
                conversion: 'convert_expr',
                reverseConversion: 'reverse_expr',
                reverseRecharge: 'reverse_recharge',
                conversionRate: '1:1',
                casting_time: '1 bonus action',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resource).toBe('sorcery_points')
        expect(result.uses_expression).toBe('2d6')
        expect(result.recharge_short_rest).toBe('1')
        expect(result.recharge_long_rest).toBe('2')
        expect(result.conversion).toBe('convert_expr')
        expect(result.reverseConversion).toBe('reverse_expr')
        expect(result.reverseRecharge).toBe('reverse_recharge')
        expect(result.conversionRate).toBe('1:1')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

describe('buildAttackInfo – save_attack', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'save_attack' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'save_attack',
            name: 'Test Feature',
            action: 'action',
            damage: '',
            damageType: '',
            saveType: 'DEX',
            saveDc: 10,
            saveAbility: 'CON',
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
            hasAutomation: true,
        })
    })

    it('computes saveDc from ability when saveDc is "ability"', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'save_attack',
                saveDc: 'ability',
                saveAbility: 'INT',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(12) // 8 + 1 (INT bonus) + 3 (proficiency)
        expect(getSaveDc).toHaveBeenCalledWith(BASE_STATS, 'INT', 3)
    })

    it('uses explicit saveDc when not "ability"', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'save_attack',
                saveDc: 16,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(16)
    })

    it('resolves damage via resolveScaling and resolveDiceExpression', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'save_attack',
                damage: '2d6',
                scaling: [{ level: 5, damage: '3d6' }],
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damage).toBe('3d6')
    })

    it('resolves uses via resolveUses', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'save_attack',
                uses: 'proficiency_bonus',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.uses).toBe(3)
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'save_attack',
                action: 'bonus_action',
                damage: '3d8',
                damageType: 'radiant',
                saveType: 'WIS',
                saveDc: 15,
                saveAbility: 'CHA',
                shape: 'cone',
                range: '15 ft',
                conditionInflicted: 'frightened',
                duration: '1 round',
                uses: 3,
                recharge: 'short_rest',
                resourceCost: 'spell_slot',
                hasOptions: true,
                options: ['option1'],
                optionDetails: { option1: { detail: 'value' } },
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.damage).toBe('3d8')
        expect(result.damageType).toBe('radiant')
        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('CHA')
        expect(result.shape).toBe('cone')
        expect(result.range).toBe('15 ft')
        expect(result.conditionInflicted).toBe('frightened')
        expect(result.duration).toBe('1 round')
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.resourceCost).toBe('spell_slot')
        expect(result.hasOptions).toBe(true)
        expect(result.options).toEqual(['option1'])
        expect(result.optionDetails).toEqual({ option1: { detail: 'value' } })
    })
})

describe('buildAttackInfo – save_only', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'save_only' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
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

    it('computes saveDc from ability when saveDc is "ability"', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'save_only',
                saveDc: 'ability',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(14) // 8 + 4 (STR bonus) + 3 (proficiency)
        expect(getSaveDc).toHaveBeenCalledWith(BASE_STATS, 'CON', 3)
    })

    it('uses explicit saveDc when not "ability"', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'save_only',
                saveDc: 16,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(16)
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'save_only',
                saveType: 'CON',
                saveDc: 15,
                conditionInflicted: 'poisoned',
                duration: '1 round',
                successEffect: 'heal',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.conditionInflicted).toBe('poisoned')
        expect(result.duration).toBe('1 round')
        expect(result.successEffect).toBe('heal')
    })
})
