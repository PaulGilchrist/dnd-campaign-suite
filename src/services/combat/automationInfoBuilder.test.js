import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Helper to normalize ability names (same as abilityLookup.js) ─────────
const ABILITY_MAP = {
    str: 'Strength', dex: 'Dexterity',
    con: 'Constitution', int: 'Intelligence',
    wis: 'Wisdom', cha: 'Charisma',
}

function normalizeAbilityName(name) {
    if (!name) return null
    const lower = name.toLowerCase().replace(/\s+/g, '')
    if (ABILITY_MAP[lower]) return ABILITY_MAP[lower]
    for (const long of Object.values(ABILITY_MAP)) {
        if (long.toLowerCase() === lower) return long
    }
    return null
}

// ── Mock the automationExpressions module ─────────────────────────
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

import { buildAttackInfo } from './automationInfoBuilder.js'
import {
    evaluateAutoExpression,
    resolveHealingPoolExpression,
    getSaveDc,
} from './automationExpressions.js'

const BASE_STATS = {
    level: 5,
    proficiency: 3,
    abilities: [
        { name: 'Strength', bonus: 4 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Constitution', bonus: 3 },
        { name: 'Intelligence', bonus: 1 },
        { name: 'Wisdom', bonus: 5 },
        { name: 'Charisma', bonus: 2 },
    ],
}

const BASE_FEATURE = { name: 'Test Feature' }

describe('buildAttackInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

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

    describe('attack_rider', () => {
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

    describe('open_hand_technique', () => {
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

    describe('mastery_rider', () => {
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

    describe('auto_effect', () => {
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

    describe('auto_reroll', () => {
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

    describe('bonus_action_attack', () => {
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

    describe('bonus_attacks', () => {
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

    describe('buff_ally', () => {
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

    describe('bardic_inspiration', () => {
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

    describe('bardic_inspiration_defense', () => {
        it('returns correct structure', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'bardic_inspiration_defense' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'bardic_inspiration_defense',
                name: 'Test Feature',
                hasAutomation: true,
            })
        })
    })

    describe('bardic_inspiration_offense', () => {
        it('returns correct structure', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'bardic_inspiration_offense' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'bardic_inspiration_offense',
                name: 'Test Feature',
                hasAutomation: true,
            })
        })
    })

    describe('combat_stance', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'combat_stance' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'combat_stance',
                name: 'Test Feature',
                effect: '',
                damageBonusExpression: '',
                resistanceTypes: [],
                advantages: [],
                options: [],
                duration: '',
                resourceKey: 'ragePoints',
                uses: 0,
                flySpeed: null,
                reactionSave: null,
                blocksSpellcasting: false,
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'combat_stance',
                    effect: 'rage',
                    damageBonusExpression: '2d6',
                    resistanceTypes: ['fire', 'cold'],
                    advantages: ['perception'],
                    options: ['option1'],
                    duration: '1 minute',
                    resourceKey: 'customKey',
                    uses: 3,
                    flySpeed: 30,
                    reactionSave: 'DEX',
                    blocksSpellcasting: true,
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.effect).toBe('rage')
            expect(result.damageBonusExpression).toBe('2d6')
            expect(result.resistanceTypes).toEqual(['fire', 'cold'])
            expect(result.advantages).toEqual(['perception'])
            expect(result.options).toEqual(['option1'])
            expect(result.duration).toBe('1 minute')
            expect(result.resourceKey).toBe('customKey')
            expect(result.uses).toBe(3)
            expect(result.flySpeed).toBe(30)
            expect(result.reactionSave).toBe('DEX')
            expect(result.blocksSpellcasting).toBe(true)
        })
    })

    describe('conditional_advantage', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'conditional_advantage' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'conditional_advantage',
                name: 'Test Feature',
                target: 'saving_throw',
                condition: '',
                effect: 'advantage',
                abilities: [],
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'conditional_advantage',
                    target: 'attack_roll',
                    condition: 'flanked',
                    effect: 'advantage2',
                    abilities: ['STR', 'DEX'],
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.target).toBe('attack_roll')
            expect(result.condition).toBe('flanked')
            expect(result.effect).toBe('advantage2')
            expect(result.abilities).toEqual(['STR', 'DEX'])
        })
    })

    describe('evasion', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'evasion' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'evasion',
                name: 'Test Feature',
                saveType: 'DEX',
                shareable: false,
                shareRange: 0,
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'evasion',
                    saveType: 'CON',
                    shareable: true,
                    shareRange: 30,
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.saveType).toBe('CON')
            expect(result.shareable).toBe(true)
            expect(result.shareRange).toBe(30)
        })
    })

    describe('conditional_disadvantage', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'conditional_disadvantage' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'conditional_disadvantage',
                name: 'Test Feature',
                target: 'attack_roll',
                condition: '',
                effect: 'disadvantage',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'conditional_disadvantage',
                    target: 'saving_throw',
                    condition: 'blinded',
                    effect: 'disadvantage2',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.target).toBe('saving_throw')
            expect(result.condition).toBe('blinded')
            expect(result.effect).toBe('disadvantage2')
        })
    })

    describe('countercharm', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'countercharm' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'countercharm',
                name: 'Test Feature',
                trigger: '',
                range: '',
                conditions: [],
                effect: '',
                uses: 1,
                recharge: 'long_rest',
                casting_time: '1 reaction',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'countercharm',
                    trigger: 'on_charm',
                    range: '30 ft',
                    conditions: ['charmed', 'frightened'],
                    effect: 'remove_conditions',
                    uses: 3,
                    recharge: 'short_rest',
                    casting_time: '1 action',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.trigger).toBe('on_charm')
            expect(result.range).toBe('30 ft')
            expect(result.conditions).toEqual(['charmed', 'frightened'])
            expect(result.effect).toBe('remove_conditions')
            expect(result.uses).toBe(3)
            expect(result.recharge).toBe('short_rest')
            expect(result.casting_time).toBe('1 action')
        })
    })

    describe('damage_aura', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'damage_aura' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'damage_aura',
                name: 'Test Feature',
                damageType: '',
                damageExpression: '',
                range: '10_ft',
                duration: '1_minute',
                recharge: 'long_rest',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'damage_aura',
                    damageType: 'fire',
                    damageExpression: '2d6',
                    range: '15_ft',
                    duration: 'concentration',
                    recharge: 'short_rest',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.damageType).toBe('fire')
            expect(result.damageExpression).toBe('2d6')
            expect(result.range).toBe('15_ft')
            expect(result.duration).toBe('concentration')
            expect(result.recharge).toBe('short_rest')
        })
    })

    describe('damage_bonus', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'damage_bonus' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'damage_bonus',
                name: 'Test Feature',
                trigger: '',
                damageExpression: '',
                damageType: '',
                maxDamage: '',
                extraVs: null,
                extraDamage: '',
                resourceType: 'spell_slot',
                oncePerTurn: false,
                options: [],
                tempHpExpression: '',
                upgrades: '',
                rangeBonusCantrip: '',
                hasAutomation: true,
            })
        })

        it('applies scaling based on player level', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'damage_bonus',
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
                    type: 'damage_bonus',
                    trigger: 'on_hit',
                    damageExpression: '2d6',
                    damageType: 'fire',
                    maxDamage: 20,
                    extraVs: 'giant',
                    extraDamage: '1d8',
                    resourceType: 'warlock_slot',
                    oncePerTurn: true,
                    options: ['option1'],
                    tempHpExpression: '2d4',
                    upgrades: 'upgrade_expr',
                    rangeBonusCantrip: '120_ft',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.trigger).toBe('on_hit')
            expect(result.damageExpression).toBe('2d6')
            expect(result.damageType).toBe('fire')
            expect(result.maxDamage).toBe(20)
            expect(result.extraVs).toBe('giant')
            expect(result.extraDamage).toBe('1d8')
            expect(result.resourceType).toBe('warlock_slot')
            expect(result.oncePerTurn).toBe(true)
            expect(result.options).toEqual(['option1'])
            expect(result.tempHpExpression).toBe('2d4')
            expect(result.upgrades).toBe('upgrade_expr')
            expect(result.rangeBonusCantrip).toBe('120_ft')
        })
    })

    describe('damage_modifier', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'damage_modifier' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'damage_modifier',
                name: 'Test Feature',
                trigger: '',
                modifierExpression: '',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'damage_modifier',
                    trigger: 'on_hit',
                    modifierExpression: '+2d6',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.trigger).toBe('on_hit')
            expect(result.modifierExpression).toBe('+2d6')
        })
    })

    describe('damage_reduction', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'damage_reduction' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'damage_reduction',
                name: 'Test Feature',
                reductionExpression: '',
                trigger: '',
                reaction: false,
                redirect: false,
                redirectCost: null,
                redirectDamage: '',
                redirectSave: 'DEX',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'damage_reduction',
                    reductionExpression: '1d10',
                    trigger: 'on_hit',
                    reaction: true,
                    redirect: true,
                    redirectCost: 'resource',
                    redirectDamage: '1d6',
                    redirectSave: 'CON',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.reductionExpression).toBe('1d10')
            expect(result.trigger).toBe('on_hit')
            expect(result.reaction).toBe(true)
            expect(result.redirect).toBe(true)
            expect(result.redirectCost).toBe('resource')
            expect(result.redirectDamage).toBe('1d6')
            expect(result.redirectSave).toBe('CON')
        })
    })

    describe('extra_action', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'extra_action' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'extra_action',
                name: 'Test Feature',
                uses: 1,
                recharge: 'short_rest',
                oncePerTurn: false,
                resourceKey: 'testfeatureUses',
                hasAutomation: true,
            })
        })

        it('generates resourceKey from feature name', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'extra_action' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.resourceKey).toBe('testfeatureUses')
        })

        it('generates resourceKey with spaces replaced', () => {
            const spacedFeature = { name: 'Extra Action Feature', automation: { type: 'extra_action' } }
            const result = buildAttackInfo(spacedFeature, BASE_STATS)
            expect(result.resourceKey).toBe('extraactionfeatureUses')
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'extra_action',
                    uses: 3,
                    recharge: 'long_rest',
                    oncePerTurn: true,
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.uses).toBe(3)
            expect(result.recharge).toBe('long_rest')
            expect(result.oncePerTurn).toBe(true)
        })
    })

    describe('divine_intervention', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'divine_intervention' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'divine_intervention',
                name: 'Test Feature',
                recharge: 'long_rest',
                upgradeTo: '',
                casting_time: '1 action',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'divine_intervention',
                    recharge: 'short_rest',
                    upgradeTo: 'upgrade_expr',
                    casting_time: '1 reaction',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.recharge).toBe('short_rest')
            expect(result.upgradeTo).toBe('upgrade_expr')
            expect(result.casting_time).toBe('1 reaction')
        })
    })

    describe('font_of_magic', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'font_of_magic' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'font_of_magic',
                name: 'Test Feature',
                casting_time: '1 bonus action',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'font_of_magic',
                    casting_time: '1 action',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.casting_time).toBe('1 action')
        })
    })

    describe('font_of_inspiration', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'font_of_inspiration' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'font_of_inspiration',
                name: 'Test Feature',
                casting_time: 'passive',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'font_of_inspiration',
                    casting_time: '1 bonus action',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.casting_time).toBe('1 bonus action')
        })
    })

    describe('free_spell', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'free_spell' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'free_spell',
                name: 'Test Feature',
                spell: '',
                uses: 1,
                recharge: 'long_rest',
                action: 'action',
                duration: '',
                concentration: false,
                noConcentration: false,
                resourceCost: '',
                freeCasts: '',
                casting_time: '',
                perSpellTracking: false,
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'free_spell',
                    spell: 'fireball',
                    uses: 3,
                    recharge: 'short_rest',
                    action: 'bonus_action',
                    duration: '1 minute',
                    concentration: true,
                    noConcentration: true,
                    resourceCost: 'spell_slot',
                    freeCasts: '2',
                    casting_time: '1 reaction',
                    perSpellTracking: true,
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.spell).toBe('fireball')
            expect(result.uses).toBe(3)
            expect(result.recharge).toBe('short_rest')
            expect(result.action).toBe('bonus_action')
            expect(result.duration).toBe('1 minute')
            expect(result.concentration).toBe(true)
            expect(result.noConcentration).toBe(true)
            expect(result.resourceCost).toBe('spell_slot')
            expect(result.freeCasts).toBe('2')
            expect(result.casting_time).toBe('1 reaction')
            expect(result.perSpellTracking).toBe(true)
        })
    })

    describe('healing', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'healing' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'healing',
                name: 'Test Feature',
                healAmount: 0,
                healExpression: '',
                action: 'action',
                uses: null,
                usesMax: null,
                recharge: 'long_rest',
                hasAutomation: true,
            })
        })

        it('evaluates healExpression when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'healing',
                    healExpression: '2d8',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.healAmount).toBe(2)
            expect(evaluateAutoExpression).toHaveBeenCalledWith('2d8', BASE_STATS, 3, 5)
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'healing',
                    healExpression: '3d6',
                    action: 'bonus_action',
                    uses: 5,
                    recharge: 'short_rest',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.healExpression).toBe('3d6')
            expect(result.action).toBe('bonus_action')
            expect(result.uses).toBe(5)
            expect(result.usesMax).toBe(5)
            expect(result.recharge).toBe('short_rest')
        })
    })

    describe('healing_pool', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'healing_pool' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'healing_pool',
                name: 'Test Feature',
                pool: 0,
                poolExpression: '',
                isDicePool: false,
                dieType: null,
                action: 'action',
                recharge: 'long_rest',
                alsoCures: [],
                cureCost: 5,
                range: '',
                resourceCost: '',
                resourceKey: 'testfeaturePool',
                hasAutomation: true,
            })
        })

        it('generates resourceKey from feature name', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'healing_pool' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.resourceKey).toBe('testfeaturePool')
        })

        it('evaluates pool expression via resolveHealingPoolExpression', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'healing_pool',
                    poolExpression: '2d8',
                    scaling: {
                        5: '3d8',
                    },
                },
            }
            buildAttackInfo(feature, BASE_STATS)
            expect(resolveHealingPoolExpression).toHaveBeenCalledWith('2d8', { 5: '3d8' }, BASE_STATS)
        })

        it('detects dice pool format and extracts values', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'healing_pool',
                    poolExpression: '4d8',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.isDicePool).toBe(true)
            expect(result.pool).toBe(4)
            expect(result.dieType).toBe(8)
        })

        it('detects dice pool format in resolved expression', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'healing_pool',
                    poolExpression: '2d8',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            // resolveHealingPoolExpression returns '2d8' which matches dice format
            expect(result.isDicePool).toBe(true)
            expect(result.pool).toBe(2)
            expect(result.dieType).toBe(8)
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'healing_pool',
                    poolExpression: '3d6',
                    action: 'bonus_action',
                    recharge: 'short_rest',
                    alsoCures: ['poisoned'],
                    cureCost: 10,
                    range: '30 ft',
                    resourceCost: 'spell_slot',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.action).toBe('bonus_action')
            expect(result.recharge).toBe('short_rest')
            expect(result.alsoCures).toEqual(['poisoned'])
            expect(result.cureCost).toBe(10)
            expect(result.range).toBe('30 ft')
            expect(result.resourceCost).toBe('spell_slot')
        })
    })

    describe('initiative_action', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'initiative_action' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'initiative_action',
                name: 'Test Feature',
                effect: '',
                healExpression: '',
                trigger: 'roll_initiative',
                uses: 1,
                usesMax: 1,
                recharge: 'long_rest',
                resourceCost: '',
                resourceKey: 'testfeatureUses',
                hasAutomation: true,
            })
        })

        it('generates resourceKey from feature name', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'initiative_action' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.resourceKey).toBe('testfeatureUses')
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'initiative_action',
                    effect: 'advantage',
                    healExpression: '2d4',
                    trigger: 'on_initiative',
                    uses: 3,
                    recharge: 'short_rest',
                    resourceCost: 'spell_slot',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.effect).toBe('advantage')
            expect(result.healExpression).toBe('2d4')
            expect(result.trigger).toBe('on_initiative')
            expect(result.uses).toBe(3)
            expect(result.usesMax).toBe(3)
            expect(result.recharge).toBe('short_rest')
            expect(result.resourceCost).toBe('spell_slot')
        })
    })

    describe('meta', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'meta' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'meta',
                name: 'Test Feature',
                effect: '',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'meta',
                    effect: 'meta_effect',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.effect).toBe('meta_effect')
        })
    })

    describe('passive_buff', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'passive_buff' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'passive_buff',
                name: 'Test Feature',
                target: 'allies_in_range',
                range_expression: '10_ft',
                effect: '',
                bonusExpression: '',
                condition: '',
                conditionImmunity: '',
                resistances: [],
                options: [],
                extraMastery: [],
                grantsFlySpeed: false,
                grantsSwimSpeed: false,
                hasAutomation: true,
            })
        })

        it('falls back bonus to bonus when bonusExpression is empty', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'passive_buff',
                    bonus: '+2',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.bonusExpression).toBe('+2')
        })

        it('prefers bonusExpression over bonus', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'passive_buff',
                    bonusExpression: '+3',
                    bonus: '+2',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.bonusExpression).toBe('+3')
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'passive_buff',
                    target: 'self',
                    range_expression: '30_ft',
                    effect: 'buff',
                    bonusExpression: '+2',
                    condition: 'conditions',
                    conditionImmunity: 'charmed',
                    resistances: ['fire'],
                    options: ['option1'],
                    extraMastery: ['extra1'],
                    grantsFlySpeed: true,
                    grantsSwimSpeed: true,
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.target).toBe('self')
            expect(result.range_expression).toBe('30_ft')
            expect(result.effect).toBe('buff')
            expect(result.bonusExpression).toBe('+2')
            expect(result.condition).toBe('conditions')
            expect(result.conditionImmunity).toBe('charmed')
            expect(result.resistances).toEqual(['fire'])
            expect(result.options).toEqual(['option1'])
            expect(result.extraMastery).toEqual(['extra1'])
            expect(result.grantsFlySpeed).toBe(true)
            expect(result.grantsSwimSpeed).toBe(true)
        })
    })

    describe('passive_immunity', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'passive_immunity' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'passive_immunity',
                name: 'Test Feature',
                target: 'self',
                conditionImmunity: '',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'passive_immunity',
                    target: 'allies',
                    conditionImmunity: 'charmed|frightened',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.target).toBe('allies')
            expect(result.conditionImmunity).toBe('charmed|frightened')
        })
    })

    describe('condition_immunity_while_active', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'condition_immunity_while_active' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'condition_immunity_while_active',
                name: 'Test Feature',
                target: 'self',
                immunities: [],
                requiresActive: '',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'condition_immunity_while_active',
                    target: 'allies',
                    immunities: ['poisoned', 'paralyzed'],
                    requiresActive: 'stance',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.target).toBe('allies')
            expect(result.immunities).toEqual(['poisoned', 'paralyzed'])
            expect(result.requiresActive).toBe('stance')
        })
    })

    describe('conditional_replacement', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'conditional_replacement' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'conditional_replacement',
                name: 'Test Feature',
                target: 'saving_throw',
                saveType: '',
                condition: '',
                effect: '',
                replacementAbility: '',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'conditional_replacement',
                    target: 'attack_roll',
                    saveType: 'DEX',
                    condition: 'natural_1',
                    effect: 'replace_with_max',
                    replacementAbility: 'INT',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.target).toBe('attack_roll')
            expect(result.saveType).toBe('DEX')
            expect(result.condition).toBe('natural_1')
            expect(result.effect).toBe('replace_with_max')
            expect(result.replacementAbility).toBe('INT')
        })
    })

    describe('passive_rule', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'passive_rule' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'passive_rule',
                name: 'Test Feature',
                effect: '',
                bonusExpression: '',
                criticalRange: '',
                spells: [],
                riderSave: null,
                primalKnowledge: [],
                casting_time: '',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'passive_rule',
                    effect: 'rule',
                    bonusExpression: '+1',
                    criticalRange: '19-20',
                    spells: ['fireball'],
                    riderSave: 'save_expr',
                    skills: ['history', 'arcana'],
                    casting_time: '1 action',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.effect).toBe('rule')
            expect(result.bonusExpression).toBe('+1')
            expect(result.criticalRange).toBe('19-20')
            expect(result.spells).toEqual(['fireball'])
            expect(result.riderSave).toBe('save_expr')
            expect(result.primalKnowledge).toEqual(['history', 'arcana'])
            expect(result.casting_time).toBe('1 action')
        })
    })

    describe('post_cast_rider', () => {
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

    describe('reaction_bonus', () => {
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

    describe('reaction_damage', () => {
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

    describe('reaction_debuff', () => {
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

    describe('reaction_save_heal', () => {
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

    describe('resistance', () => {
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

    describe('resource_pool', () => {
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

    describe('save_attack', () => {
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

    describe('save_only', () => {
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

    describe('self_healing', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'self_healing' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'self_healing',
                name: 'Test Feature',
                healAmount: 0,
                healExpression: '',
                action: 'action',
                uses: 1,
                usesMax: 1,
                recharge: 'short_rest',
                hasAutomation: true,
            })
        })

        it('evaluates healExpression when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'self_healing',
                    healExpression: '2d8',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.healAmount).toBe(2)
            expect(evaluateAutoExpression).toHaveBeenCalledWith('2d8', BASE_STATS, 3, 5)
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'self_healing',
                    healExpression: '3d6',
                    action: 'bonus_action',
                    uses: 5,
                    recharge: 'long_rest',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.healExpression).toBe('3d6')
            expect(result.action).toBe('bonus_action')
            expect(result.uses).toBe(5)
            expect(result.usesMax).toBe(5)
            expect(result.recharge).toBe('long_rest')
        })
    })

    describe('divine_spark', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'divine_spark' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'divine_spark',
                name: 'Test Feature',
                range: '30 ft',
                healExpression: '',
                damageExpression: '',
                damageTypes: [],
                saveType: 'CON',
                resourceCost: '',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'divine_spark',
                    range: '60 ft',
                    healExpression: '2d8',
                    damageExpression: '3d6',
                    damageTypes: ['fire', 'radiant'],
                    saveType: 'DEX',
                    resourceCost: 'spell_slot',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.range).toBe('60 ft')
            expect(result.healExpression).toBe('2d8')
            expect(result.damageExpression).toBe('3d6')
            expect(result.damageTypes).toEqual(['fire', 'radiant'])
            expect(result.saveType).toBe('DEX')
            expect(result.resourceCost).toBe('spell_slot')
        })
    })

    describe('set_condition', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'set_condition' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'set_condition',
                name: 'Test Feature',
                target: undefined,
                condition: undefined,
                additionalCondition: null,
                cost: '',
                range: '60 ft',
                saveType: 'STR',
                effect: '',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'set_condition',
                    target: 'enemy',
                    condition: 'prone',
                    additionalCondition: 'restrained',
                    cost: '1 resource',
                    range: '30 ft',
                    saveType: 'DEX',
                    effect: 'condition_effect',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.target).toBe('enemy')
            expect(result.condition).toBe('prone')
            expect(result.additionalCondition).toBe('restrained')
            expect(result.cost).toBe('1 resource')
            expect(result.range).toBe('30 ft')
            expect(result.saveType).toBe('DEX')
            expect(result.effect).toBe('condition_effect')
        })
    })

    describe('spell_modifier', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'spell_modifier' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'spell_modifier',
                name: 'Test Feature',
                options: [],
                resource: 'sorcery_points',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'spell_modifier',
                    options: ['option1'],
                    resource: 'warlock_slots',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.options).toEqual(['option1'])
            expect(result.resource).toBe('warlock_slots')
        })
    })

    describe('temp_buff', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'temp_buff' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'temp_buff',
                name: 'Test Feature',
                effect: '',
                duration: '1_minute',
                action: 'bonus_action',
                recharge: 'long_rest',
                distance: '',
                extendedDistance: '',
                oncePerRage: false,
                bringAllies: false,
                allyCount: 0,
                teleportRange: '',
                enemiesDisadvantageSaves: [],
                triggerOnRage: false,
                distanceExpression: '',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'temp_buff',
                    effect: 'teleport',
                    duration: 'concentration',
                    action: 'action',
                    recharge: 'short_rest',
                    distance: '30 ft',
                    extendedDistance: '60 ft',
                    oncePerRage: true,
                    bringAllies: true,
                    allyCount: 2,
                    teleportRange: '100 ft',
                    enemies_disadvantage_saves: ['save1'],
                    triggerOnRage: true,
                    distanceExpression: '2d6',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.effect).toBe('teleport')
            expect(result.duration).toBe('concentration')
            expect(result.action).toBe('action')
            expect(result.recharge).toBe('short_rest')
            expect(result.distance).toBe('30 ft')
            expect(result.extendedDistance).toBe('60 ft')
            expect(result.oncePerRage).toBe(true)
            expect(result.bringAllies).toBe(true)
            expect(result.allyCount).toBe(2)
            expect(result.teleportRange).toBe('100 ft')
            expect(result.enemiesDisadvantageSaves).toEqual(['save1'])
            expect(result.triggerOnRage).toBe(true)
            expect(result.distanceExpression).toBe('2d6')
        })
    })

    describe('temp_hp_buff', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'temp_hp_buff' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'temp_hp_buff',
                name: 'Test Feature',
                buffExpression: '',
                range: '60_ft',
                targets: 1,
                targetsExpression: '',
                bonusMovement: false,
                extraEffect: null,
                tempHpExpression: '',
                triggerOnRage: false,
                ongoingHealingExpression: '',
                healingStartOfTurn: false,
                healingRange: '',
                casting_time: '1 bonus action',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'temp_hp_buff',
                    buffExpression: '2d8',
                    range: '30_ft',
                    targets: 3,
                    targetsExpression: '2d4',
                    bonusMovement: true,
                    extraEffect: 'extra',
                    tempHpExpression: '3d6',
                    trigger_on_rage: true,
                    ongoingHealingExpression: '1d4',
                    healingStartOfTurn: true,
                    healingRange: '10_ft',
                    casting_time: '1 action',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.buffExpression).toBe('2d8')
            expect(result.range).toBe('30_ft')
            expect(result.targets).toBe(3)
            expect(result.targetsExpression).toBe('2d4')
            expect(result.bonusMovement).toBe(true)
            expect(result.extraEffect).toBe('extra')
            expect(result.tempHpExpression).toBe('3d6')
            expect(result.triggerOnRage).toBe(true)
            expect(result.ongoingHealingExpression).toBe('1d4')
            expect(result.healingStartOfTurn).toBe(true)
            expect(result.healingRange).toBe('10_ft')
            expect(result.casting_time).toBe('1 action')
        })
    })

    describe('sorcery_aura', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'sorcery_aura' } }
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

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'sorcery_aura',
                    recharge: 'short_rest',
                    casting_time: '1 action',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.recharge).toBe('short_rest')
            expect(result.casting_time).toBe('1 action')
        })
    })

    describe('resource_restoration', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'resource_restoration' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'resource_restoration',
                name: 'Test Feature',
                trigger: 'short_rest',
                casting_time: 'passive',
                restore_amount: 0,
                restore_expression: '',
                resourceKey: '',
                uses_max: 1,
                recharge: 'long_rest',
                hasAutomation: true,
            })
        })

        it('evaluates restore_expression when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'resource_restoration',
                    restore_expression: '2d6',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.restore_amount).toBe(2)
            expect(evaluateAutoExpression).toHaveBeenCalledWith('2d6', BASE_STATS)
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'resource_restoration',
                    trigger: 'long_rest',
                    casting_time: '1 bonus action',
                    restore_expression: '3d6',
                    resourceKey: 'customKey',
                    uses_max: 3,
                    recharge: 'short_rest',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.trigger).toBe('long_rest')
            expect(result.casting_time).toBe('1 bonus action')
            expect(result.restore_expression).toBe('3d6')
            expect(result.resourceKey).toBe('customKey')
            expect(result.uses_max).toBe(3)
            expect(result.recharge).toBe('short_rest')
        })
    })

    describe('sorcery_incarnate', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'sorcery_incarnate' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'sorcery_incarnate',
                name: 'Test Feature',
                casting_time: '1 bonus action',
                cost: 2,
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'sorcery_incarnate',
                    casting_time: '1 action',
                    cost: 5,
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.casting_time).toBe('1 action')
            expect(result.cost).toBe(5)
        })
    })

    describe('post_cast_self_heal', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'post_cast_self_heal' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'post_cast_self_heal',
                name: 'Test Feature',
                healExpression: '0',
                othersOnly: true,
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'post_cast_self_heal',
                    healExpression: '2d8',
                    othersOnly: false,
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.healExpression).toBe('2d8')
            expect(result.othersOnly).toBe(false)
        })
    })

    describe('multi_target_spread', () => {
        it('returns correct structure with defaults', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'multi_target_spread' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'multi_target_spread',
                name: 'Test Feature',
                spellFilter: [],
                range: '10 ft',
                hasAutomation: true,
            })
        })

        it('includes optional fields when provided', () => {
            const feature = {
                ...BASE_FEATURE,
                automation: {
                    type: 'multi_target_spread',
                    spellFilter: ['fireball', 'lightning_bolt'],
                    range: '30 ft',
                },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.spellFilter).toEqual(['fireball', 'lightning_bolt'])
            expect(result.range).toBe('30 ft')
        })
    })

    describe('jack_of_all_trades', () => {
        it('returns correct structure', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'jack_of_all_trades' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'jack_of_all_trades',
                name: 'Test Feature',
                hasAutomation: true,
            })
        })
    })

    describe('divine_order', () => {
        it('returns correct structure', () => {
            const feature = { ...BASE_FEATURE, automation: { type: 'divine_order' } }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'divine_order',
                name: 'Test Feature',
                hasAutomation: true,
            })
        })
    })
})
