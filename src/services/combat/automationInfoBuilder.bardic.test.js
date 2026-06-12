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

import { evaluateAutoExpression } from './automationExpressions.js'

describe('buildAttackInfo – bonus_action_attack', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'bonus_action_attack' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'bonus_action_attack',
            name: 'Test Feature',
            trigger: '',
            action: 'bonus_action',
            weaponAttack: false,
            extraDamageExpression: '',
            usesMax: 0,
            recharge: 'long_rest',
            resourceKey: 'warPriestUses',
            hasAutomation: true,
        })
    })

    it('evaluates uses_expression when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'bonus_action_attack',
                uses_expression: '2d6',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.usesMax).toBe(2)
        expect(evaluateAutoExpression).toHaveBeenCalledWith('2d6', BASE_STATS)
    })

    it('uses 0 when no uses_expression', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'bonus_action_attack' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.usesMax).toBe(0)
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'bonus_action_attack',
                trigger: 'on_hit',
                action: 'action',
                weaponAttack: true,
                extraDamageExpression: '1d8',
                recharge: 'short_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_hit')
        expect(result.action).toBe('action')
        expect(result.weaponAttack).toBe(true)
        expect(result.extraDamageExpression).toBe('1d8')
        expect(result.recharge).toBe('short_rest')
    })
})

describe('buildAttackInfo – bonus_attacks', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'bonus_attacks' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'bonus_attacks',
            name: 'Test Feature',
            attacks: 2,
            attackType: 'unarmed_strike',
            cost: null,
            trigger: 'after_attack_action',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'bonus_attacks',
                attacks: 3,
                attackType: 'melee',
                cost: '1 resource',
                trigger: 'on_action',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.attacks).toBe(3)
        expect(result.attackType).toBe('melee')
        expect(result.cost).toBe('1 resource')
        expect(result.trigger).toBe('on_action')
    })
})

describe('buildAttackInfo – buff_ally', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'buff_ally' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'buff_ally',
            name: 'Test Feature',
            buffExpression: '',
            range: '60_ft',
            action: 'bonus_action',
            usesMax: 0,
            usesRecharge: 'long_rest',
            hasAutomation: true,
        })
    })

    it('evaluates uses_expression when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'buff_ally',
                uses_expression: '2d6',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.usesMax).toBe(2)
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'buff_ally',
                buffExpression: 'buff_expr',
                range: '30_ft',
                action: 'action',
                recharge: 'short_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.buffExpression).toBe('buff_expr')
        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.usesRecharge).toBe('short_rest')
    })
})

describe('buildAttackInfo – bardic_inspiration', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'bardic_inspiration' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'bardic_inspiration',
            name: 'Test Feature',
            range: '60_ft',
            action: 'bonus_action',
            usesMax: 0,
            usesRecharge: 'long_rest',
            dieSize: 6,
            hasAutomation: true,
        })
    })

    it('evaluates uses_expression when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'bardic_inspiration',
                uses_expression: '2d6',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.usesMax).toBe(2)
    })

    it('reads dieSize from class_levels when available', () => {
        const bardStats = {
            ...BASE_STATS,
            level: 2,
            class: {
                class_levels: [
                    { level: 1, bardic_die: 6 },
                    { level: 2, bardic_die: 8 },
                ],
            },
        }
        const feature = { ...BASE_FEATURE, automation: { type: 'bardic_inspiration' } }
        const result = buildAttackInfo(feature, bardStats)
        expect(result.dieSize).toBe(8)
    })

    it('falls back to 6 when no class_levels match', () => {
        const bardStats = {
            ...BASE_STATS,
            level: 2,
            class: { class_levels: [] },
        }
        const feature = { ...BASE_FEATURE, automation: { type: 'bardic_inspiration' } }
        const result = buildAttackInfo(feature, bardStats)
        expect(result.dieSize).toBe(6)
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'bardic_inspiration',
                range: '30_ft',
                action: 'action',
                recharge: 'short_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.usesRecharge).toBe('short_rest')
    })
})
