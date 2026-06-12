import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import {
    BASE_STATS,
    BASE_FEATURE,
    normalizeAbilityName,
} from './automationInfoBuilder.fixtures.js'

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

describe('buildAttackInfo – attack_rider', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns null when feature has no automation', () => {
        const feature = { name: 'No Automation' }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation type is unknown', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'unknown_type' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns correct structure with minimal automation', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'attack_rider' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'attack_rider',
            name: 'Test Feature',
            options: [],
            cost: null,
            damageExpression: '',
            damageType: '',
            trigger: '',
            oncePerTurn: false,
            chooseOne: false,
            maxEffects: 1,
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'attack_rider',
                damageExpression: '2d6 fire',
                options: ['option1'],
                cost: '1 resource',
                damageType: 'fire',
                trigger: 'on_hit',
                oncePerTurn: true,
                chooseOne: true,
                maxEffects: 3,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('2d6 fire')
        expect(result.options).toEqual(['option1'])
        expect(result.cost).toBe('1 resource')
        expect(result.damageType).toBe('fire')
        expect(result.trigger).toBe('on_hit')
        expect(result.oncePerTurn).toBe(true)
        expect(result.chooseOne).toBe(true)
        expect(result.maxEffects).toBe(3)
    })

    it('applies scaling based on player level', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'attack_rider',
                damageExpression: '1d6',
                scaling: {
                    3: '2d6',
                    5: '3d6',
                    11: '4d6',
                },
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d6')
    })

    it('applies lowest matching scaling tier', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'attack_rider',
                damageExpression: '1d6',
                scaling: {
                    3: '2d6',
                    5: '3d6',
                },
            },
        }
        const lowStats = { ...BASE_STATS, level: 3 }
        const result = buildAttackInfo(feature, lowStats)
        expect(result.damageExpression).toBe('2d6')
    })

    it('falls back to base expression when level below all scaling tiers', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'attack_rider',
                damageExpression: '1d6',
                scaling: {
                    11: '2d6',
                },
            },
        }
        const lowStats = { ...BASE_STATS, level: 1 }
        const result = buildAttackInfo(feature, lowStats)
        expect(result.damageExpression).toBe('1d6')
    })

    it('handles scaling with string numeric keys', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'attack_rider',
                damageExpression: '1d4',
                scaling: {
                    '3': '2d4',
                    '5': '3d4',
                },
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d4')
    })

    it('skips invalid scaling entries with NaN levels', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'attack_rider',
                damageExpression: '1d4',
                scaling: {
                    'invalid': '2d4',
                    '5': '3d4',
                },
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d4')
    })

    it('uses level 1 default when playerStats.level is missing', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'attack_rider',
                damageExpression: '1d4',
                scaling: {
                    '3': '2d4',
                },
            },
        }
        const noLevelStats = { proficiency: 2 }
        const result = buildAttackInfo(feature, noLevelStats)
        expect(result.damageExpression).toBe('1d4')
    })
})

describe('buildAttackInfo – open_hand_technique', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'open_hand_technique' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'open_hand_technique',
            name: 'Test Feature',
            options: [],
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'WIS',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'open_hand_technique',
                options: ['push 15 ft'],
                saveType: 'DEX',
                saveDc: 15,
                saveAbility: 'CON',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.options).toEqual(['push 15 ft'])
        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('CON')
    })
})

describe('buildAttackInfo – mastery_rider', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'mastery_rider' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'mastery_rider',
            name: 'Test Feature',
            masteries: [],
            extraMastery: [],
            trigger: 'hit',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'mastery_rider',
                masteries: ['mastery1'],
                extraMastery: ['extra1', 'extra2'],
                trigger: 'miss',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.masteries).toEqual(['mastery1'])
        expect(result.extraMastery).toEqual(['extra1', 'extra2'])
        expect(result.trigger).toBe('miss')
    })
})

describe('buildAttackInfo – auto_effect', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'auto_effect' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'auto_effect',
            name: 'Test Feature',
            trigger: '',
            effect: '',
            value: null,
            uses: null,
            recharge: 'long_rest',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'auto_effect',
                trigger: 'on_spell',
                effect: 'buff',
                value: 5,
                uses: 3,
                recharge: 'short_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_spell')
        expect(result.effect).toBe('buff')
        expect(result.value).toBe(5)
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
    })
})

describe('buildAttackInfo – auto_reroll', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'auto_reroll' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'auto_reroll',
            name: 'Test Feature',
            target: 'd20',
            condition: '',
            effect: 'reroll',
            trigger: '',
            bonus: null,
            range: '',
            resourceCost: '',
            casting_time: '',
            bonusExpression: '',
            oncePerRage: false,
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'auto_reroll',
                target: 'ability_check',
                condition: 'natural_1',
                effect: 'replace',
                trigger: 'on_roll',
                bonus: 5,
                range: 'self',
                resourceCost: 'spell_slot',
                casting_time: '1 reaction',
                bonusExpression: '2d6',
                oncePerRage: true,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('ability_check')
        expect(result.condition).toBe('natural_1')
        expect(result.effect).toBe('replace')
        expect(result.bonus).toBe(5)
        expect(result.oncePerRage).toBe(true)
    })
})
