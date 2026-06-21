// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

import * as autoExpr from './automationExpressions.js'

// Helper to normalize ability names (mirrors abilityLookup.js)
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

// Mock only the two functions the reaction handlers actually use.
vi.mock('./automationExpressions.js', () => {
    return {
        getSaveDc: vi.fn((stats, ability, proficiency) => {
            const canonical = normalizeAbilityName(ability)
            const bonus = stats.abilities?.find(a => a.name === canonical)?.bonus ?? 0
            return 8 + bonus + (proficiency || 0)
        }),
        evaluateAutoExpression: vi.fn((expr) => {
            if (!expr) return 0
            const numericMatch = String(expr).match(/^(?!.*\D)(-?\d+\.?\d*)$/)
            if (numericMatch) return parseInt(numericMatch[1], 10)
            return expr
        }),
    }
})

describe('buildAttackInfo – reaction handler dispatch', () => {
    it('returns null when feature has no automation', () => {
        const feature = { name: 'No Automation' }
        expect(buildAttackInfo(feature, BASE_STATS)).toBeNull()
    })

    it('returns null when automation type has no handler', () => {
        const feature = makeFeature({ type: 'unknown_type' })
        expect(buildAttackInfo(feature, BASE_STATS)).toBeNull()
    })
})

describe('buildAttackInfo – post_cast_rider', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
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

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'post_cast_rider',
            saveType: 'CON',
            saveDc: 15,
            saveAbility: 'INT',
            condition: 'on_save_fail',
            duration: 'concentration',
            range: '30 ft',
            spellSchools: ['evocation'],
            recharge: 'short_rest',
        })
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

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'reaction_bonus' })
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

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
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
        })
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

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'reaction_damage' })
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
        const feature = makeFeature({
            type: 'reaction_damage',
            saveDc: 'ability',
            saveAbility: 'CON',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(14)
        expect(autoExpr.getSaveDc).toHaveBeenCalledWith(BASE_STATS, 'CON', 3)
    })

    it('uses explicit saveDc when not "ability"', () => {
        const feature = makeFeature({
            type: 'reaction_damage',
            saveDc: 16,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(16)
    })

    it('applies scaling based on player level', () => {
        const feature = makeFeature({
            type: 'reaction_damage',
            damageExpression: '1d6',
            scaling: {
                3: '2d6',
                5: '3d6',
            },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d6')
    })

    it('falls back to base damageExpression when level is below first scaling tier', () => {
        const feature = makeFeature({
            type: 'reaction_damage',
            damageExpression: '1d6',
            scaling: {
                7: '2d6',
                9: '3d6',
            },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('1d6')
    })

    it('evaluates saveDcExpression when saveDc is not set', () => {
        const feature = makeFeature({
            type: 'reaction_damage',
            saveDcExpression: '8 + CON modifier + proficiency_bonus',
        })
        buildAttackInfo(feature, BASE_STATS)
        expect(autoExpr.evaluateAutoExpression).toHaveBeenCalledWith(
            '8 + CON modifier + proficiency_bonus',
            BASE_STATS
        )
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
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
        })
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

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'reaction_debuff' })
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
        const feature = makeFeature({
            type: 'reaction_debuff',
            uses_expression: '2d6',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.usesMax).toBe('2d6')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'reaction_debuff',
            trigger: 'on_attack',
            debuffExpression: '-2',
            subtractive: true,
            effect: 'disadvantage',
            uses_expression: '3',
            recharge: 'short_rest',
            range: '30_ft',
            casting_time: '1 reaction',
        })
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

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'reaction_save_heal' })
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

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'reaction_save_heal',
            saveType: 'DEX',
            saveDc: 15,
            dcScaling: 2,
            healExpression: '2d8',
            recharge: 'long_rest',
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.dcScaling).toBe(2)
        expect(result.healExpression).toBe('2d8')
        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – reaction_save', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'reaction_save' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'reaction_save',
            name: 'Test Feature',
            trigger: '',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            condition: '',
            duration: '',
            range: '120_ft',
            casting_time: '1 reaction',
            target: 'different_creature',
            hasAutomation: true,
        })
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'reaction_save',
            trigger: 'on_save_fail',
            saveType: 'CON',
            saveDc: 15,
            saveAbility: 'INT',
            condition: 'condition_applied',
            duration: '1_round',
            range: '30_ft',
            casting_time: '1 reaction that triggers',
            target: 'self',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_save_fail')
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('INT')
        expect(result.condition).toBe('condition_applied')
        expect(result.duration).toBe('1_round')
        expect(result.range).toBe('30_ft')
        expect(result.casting_time).toBe('1 reaction that triggers')
        expect(result.target).toBe('self')
    })
})

describe('buildAttackInfo – shadowy_dodge', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'shadowy_dodge' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'shadowy_dodge',
            name: 'Test Feature',
            range: '30_ft',
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'shadowy_dodge',
            range: '60_ft',
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('60_ft')
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – glorious_defense', () => {
    beforeEach(() => vi.clearAllMocks())

    it('computes acBonus and usesMax from CHA modifier', () => {
        const feature = makeFeature({ type: 'glorious_defense' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.acBonus).toBe(2)
        expect(result.usesMax).toBe(2)
        expect(result.acBonusExpression).toBe('Math.max(1, CHA modifier)')
    })

    it('caps acBonus and usesMin at minimum of 1', () => {
        const lowChaStats = {
            ...BASE_STATS,
            abilities: BASE_STATS.abilities.map(a =>
                a.name === 'Charisma' ? { ...a, bonus: 0 } : a
            ),
        }
        const feature = makeFeature({ type: 'glorious_defense' })
        const result = buildAttackInfo(feature, lowChaStats)

        expect(result.acBonus).toBe(1)
        expect(result.usesMax).toBe(1)
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'glorious_defense',
            range: '15_ft',
            trigger: 'on_miss',
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('15_ft')
        expect(result.trigger).toBe('on_miss')
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – beguiling_defenses', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'beguiling_defenses' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'beguiling_defenses',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: null,
            saveAbility: 'CHA',
            damageType: 'Psychic',
            uses: 1,
            recharge: 'long_rest',
            pactMagicRecharge: false,
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('computes saveDc from ability when saveDc is "ability"', () => {
        const feature = makeFeature({
            type: 'beguiling_defenses',
            saveDc: 'ability',
            saveAbility: 'CHA',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(13)
        expect(autoExpr.getSaveDc).toHaveBeenCalledWith(BASE_STATS, 'CHA', 3)
    })

    it('uses explicit saveDc when not "ability"', () => {
        const feature = makeFeature({
            type: 'beguiling_defenses',
            saveDc: 17,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(17)
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'beguiling_defenses',
            saveType: 'INT',
            saveDc: 15,
            saveAbility: 'INT',
            damageType: 'Necrotic',
            uses: 3,
            recharge: 'short_rest',
            pactMagicRecharge: true,
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('INT')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('INT')
        expect(result.damageType).toBe('Necrotic')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.pactMagicRecharge).toBe(true)
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – searing_vengeance', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'searing_vengeance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'searing_vengeance',
            name: 'Test Feature',
            healExpression: '',
            damageExpression: '',
            damageType: 'Radiant',
            range: '30_ft',
            condition: 'blinded',
            conditionDuration: 'until_end_of_current_turn',
            trigger: 'death_save_by_ally_or_self',
            allyRange: '60_ft',
            uses: 1,
            usesMax: 1,
            recharge: 'long_rest',
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'searing_vengeance',
            healExpression: '2d8',
            damageExpression: '1d6',
            damageType: 'Fire',
            range: '15_ft',
            condition: 'burning',
            conditionDuration: '1_round',
            trigger: 'ally_hit_by_attack',
            allyRange: '30_ft',
            uses: 2,
            usesMax: 2,
            recharge: 'short_rest',
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.healExpression).toBe('2d8')
        expect(result.damageExpression).toBe('1d6')
        expect(result.damageType).toBe('Fire')
        expect(result.range).toBe('15_ft')
        expect(result.condition).toBe('burning')
        expect(result.conditionDuration).toBe('1_round')
        expect(result.trigger).toBe('ally_hit_by_attack')
        expect(result.allyRange).toBe('30_ft')
        expect(result.uses).toBe(2)
        expect(result.usesMax).toBe(2)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – illusory_self', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'illusory_self' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'illusory_self',
            name: 'Test Feature',
            trigger: 'attack_hit',
            uses: 1,
            recharge: 'short_or_long_rest',
            spellSlotRestore: null,
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'illusory_self',
            trigger: 'miss_attack',
            uses: 3,
            recharge: 'long_rest',
            spellSlotRestore: 1,
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('miss_attack')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('long_rest')
        expect(result.spellSlotRestore).toBe(1)
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – reaction_counterspell', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'reaction_counterspell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'reaction_counterspell',
            name: 'Test Feature',
            trigger: 'creature_casting_spell',
            saveType: 'CON',
            saveDc: 'ability',
            saveAbility: 'CHA',
            saveBonus: 13,
            range: '60 ft',
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('computes saveBonus from CHA modifier and proficiency', () => {
        const feature = makeFeature({ type: 'reaction_counterspell' })
        const result = buildAttackInfo(feature, BASE_STATS)
        // 8 (base) + 2 (CHA bonus) + 3 (proficiency) = 13
        expect(result.saveBonus).toBe(13)
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'reaction_counterspell',
            trigger: 'spell_cast_in_range',
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'WIS',
            range: '120 ft',
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('spell_cast_in_range')
        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('WIS')
        expect(result.range).toBe('120 ft')
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – lucky_point', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'lucky_point' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'lucky_point',
            name: 'Test Feature',
            effect: 'advantage',
            target: 'd20',
            cost: 1,
            casting_time: 'reaction',
            hasAutomation: true,
        })
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'lucky_point',
            effect: 'disadvantage',
            target: 'enemy',
            cost: 2,
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('disadvantage')
        expect(result.target).toBe('enemy')
        expect(result.cost).toBe(2)
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – reaction_spell', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when automation has no optional fields', () => {
        const feature = makeFeature({ type: 'reaction_spell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'reaction_spell',
            name: 'Test Feature',
            trigger: '',
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'reaction_spell',
            trigger: 'on_enemy_turn',
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_enemy_turn')
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})

describe('buildAttackInfo – sentinel_guardian', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns defaults when player has no attacks', () => {
        const feature = makeFeature({ type: 'sentinel_guardian' })
        const result = buildAttackInfo(feature, { ...BASE_STATS, attacks: [] })

        expect(result).toEqual({
            type: 'sentinel_guardian',
            name: 'Test Feature',
            trigger: 'creature_disengages_or_hits_other_within_5ft',
            range: '5_ft',
            oaType: 'any_attack_miss_or_disengage',
            casting_time: '1 reaction',
            attack: null,
            hasAutomation: true,
        })
    })

    it('selects first melee action attack when available', () => {
        const feature = makeFeature({ type: 'sentinel_guardian' })
        const stats = {
            ...BASE_STATS,
            attacks: [
                { type: 'Action', range: 'melee', name: 'Longsword' },
                { type: 'Action', range: 'ranged', name: 'Longbow' },
            ],
        }
        const result = buildAttackInfo(feature, stats)

        expect(result.attack).toEqual({ type: 'Action', range: 'melee', name: 'Longsword' })
    })

    it('falls back to first attack when no melee attacks exist', () => {
        const feature = makeFeature({ type: 'sentinel_guardian' })
        const stats = {
            ...BASE_STATS,
            attacks: [
                { type: 'Action', range: 'melee', name: 'Longsword' },
                { type: 'Action', range: 'ranged', name: 'Longbow' },
            ],
        }
        const result = buildAttackInfo(feature, stats)

        expect(result.attack).toEqual({ type: 'Action', range: 'melee', name: 'Longsword' })
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'sentinel_guardian',
            trigger: 'on_disengage',
            range: '10_ft',
            oaType: 'only_miss',
            casting_time: '1 reaction that triggers',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_disengage')
        expect(result.range).toBe('10_ft')
        expect(result.oaType).toBe('only_miss')
        expect(result.casting_time).toBe('1 reaction that triggers')
    })
})
