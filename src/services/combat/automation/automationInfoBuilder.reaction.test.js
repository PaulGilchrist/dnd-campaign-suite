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

describe('buildAttackInfo – post_cast_rider', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'post_cast_rider' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'post_cast_rider',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            condition: '',
            duration: '1_minute',
            range: '60 ft',
            spellSchools: [],
            recharge: 'long_rest',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'post_cast_rider',
                saveType: 'CON',
                saveDc: 15,
                saveAbility: 'INT',
                condition: 'on_save_fail',
                duration: 'concentration',
                range: '30 ft',
                spellSchools: ['evocation'],
                recharge: 'short_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('INT')
        expect(result.condition).toBe('on_save_fail')
        expect(result.duration).toBe('concentration')
        expect(result.range).toBe('30 ft')
        expect(result.spellSchools).toEqual(['evocation'])
        expect(result.recharge).toBe('short_rest')
    })
})

describe('buildAttackInfo – reaction_bonus', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'reaction_bonus' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'reaction_bonus',
            name: 'Test Feature',
            trigger: '',
            bonusExpression: '',
            condition: '',
            selfMovement: '',
            allyMovement: '',
            allyRange: '30 ft',
            noOAs: false,
            resourceCost: '',
            effect: '',
            saveType: '',
            saveDc: '',
            duration: '',
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'reaction_bonus',
                trigger: 'on_attack',
                bonusExpression: '+2',
                condition: 'flanked',
                selfMovement: '10 ft',
                allyMovement: '15 ft',
                allyRange: '60 ft',
                noOAs: true,
                resourceCost: 'spell_slot',
                effect: 'move_away',
                saveType: 'DEX',
                saveDc: 15,
                duration: '1 round',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_attack')
        expect(result.bonusExpression).toBe('+2')
        expect(result.condition).toBe('flanked')
        expect(result.selfMovement).toBe('10 ft')
        expect(result.allyMovement).toBe('15 ft')
        expect(result.allyRange).toBe('60 ft')
        expect(result.noOAs).toBe(true)
        expect(result.resourceCost).toBe('spell_slot')
        expect(result.effect).toBe('move_away')
        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.duration).toBe('1 round')
    })
})

describe('buildAttackInfo – reaction_damage', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'reaction_damage' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'reaction_damage',
            name: 'Test Feature',
            trigger: '',
            damageExpression: '',
            damageType: '',
            saveType: null,
            saveDc: null,
            saveAbility: 'WIS',
            alsoInflicts: null,
            resourceCost: null,
            range: '5_ft',
            casting_time: '1 reaction',
            effect: null,
            hasAutomation: true,
        })
    })

    it('computes saveDc from ability when saveDc is "ability"', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'reaction_damage',
                saveDc: 'ability',
                saveAbility: 'CON',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(14) // 8 + 3 (CON bonus) + 3 (proficiency)
        expect(getSaveDc).toHaveBeenCalledWith(BASE_STATS, 'CON', 3)
    })

    it('uses explicit saveDc when not "ability"', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'reaction_damage',
                saveDc: 16,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(16)
    })

    it('applies scaling based on player level', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'reaction_damage',
                damageExpression: '1d6',
                scaling: {
                    3: '2d6',
                    5: '3d6',
                },
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d6')
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'reaction_damage',
                trigger: 'on_hit',
                damageExpression: '2d6',
                damageType: 'radiant',
                saveType: 'DEX',
                saveDc: 15,
                saveAbility: 'INT',
                alsoInflicts: 'blinded',
                resourceCost: 'spell_slot',
                range: '15_ft',
                casting_time: '1 reaction that triggers',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_hit')
        expect(result.damageExpression).toBe('2d6')
        expect(result.damageType).toBe('radiant')
        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('INT')
        expect(result.alsoInflicts).toBe('blinded')
        expect(result.resourceCost).toBe('spell_slot')
        expect(result.range).toBe('15_ft')
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – reaction_debuff', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'reaction_debuff' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'reaction_debuff',
            name: 'Test Feature',
            trigger: '',
            debuffExpression: '',
            subtractive: false,
            effect: '',
            uses_expression: '',
            usesMax: 0,
            recharge: 'long_rest',
            range: '60_ft',
            casting_time: '1 reaction',
            triggerTypes: ['attack_roll', 'damage_roll', 'ability_check'],
            hasAutomation: true,
        })
    })

    it('evaluates uses_expression when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'reaction_debuff',
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
                type: 'reaction_debuff',
                trigger: 'on_attack',
                debuffExpression: '-2',
                subtractive: true,
                effect: 'disadvantage',
                uses_expression: '3',
                recharge: 'short_rest',
                range: '30_ft',
                casting_time: '1 reaction',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_attack')
        expect(result.debuffExpression).toBe('-2')
        expect(result.subtractive).toBe(true)
        expect(result.effect).toBe('disadvantage')
        expect(result.uses_expression).toBe('3')
        expect(result.recharge).toBe('short_rest')
        expect(result.range).toBe('30_ft')
        expect(result.casting_time).toBe('1 reaction')
    })
})

describe('buildAttackInfo – reaction_save_heal', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'reaction_save_heal' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'reaction_save_heal',
            name: 'Test Feature',
            saveType: 'CON',
            saveDc: 10,
            dcScaling: 0,
            healExpression: '',
            recharge: 'short_or_long_rest',
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'reaction_save_heal',
                saveType: 'DEX',
                saveDc: 15,
                dcScaling: 2,
                healExpression: '2d8',
                recharge: 'long_rest',
                casting_time: '1 reaction that triggers',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.dcScaling).toBe(2)
        expect(result.healExpression).toBe('2d8')
        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})
