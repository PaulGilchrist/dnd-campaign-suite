import { describe, it, expect } from 'vitest'
import { reactionHandlers } from './reaction.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('reactionHandlers – reaction_bonus', () => {
    it('returns reaction_bonus info with defaults', () => {
        const feature = makeFeature({ type: 'reaction_bonus' })
        const result = reactionHandlers.reaction_bonus(feature, BASE_STATS)
        expect(result.type).toBe('reaction_bonus')
        expect(result.trigger).toBe('')
        expect(result.bonusExpression).toBe('')
        expect(result.condition).toBe('')
        expect(result.selfMovement).toBe('')
        expect(result.allyMovement).toBe('')
        expect(result.allyRange).toBe('30 ft')
        expect(result.noOAs).toBe(false)
        expect(result.resourceCost).toBe('')
        expect(result.effect).toBe('')
        expect(result.saveType).toBe('')
        expect(result.saveDc).toBe('')
        expect(result.duration).toBe('')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'reaction_bonus',
            trigger: 'after_ally_hit',
            bonusExpression: '+2d6',
            condition: 'adjacent_to_target',
            selfMovement: '10 ft',
            allyMovement: '15 ft',
            allyRange: '60 ft',
            noOAs: true,
            resourceCost: 'reaction points',
            effect: 'push_back',
            saveType: 'STR',
            saveDc: 15,
            duration: '1_round'
        })
        const result = reactionHandlers.reaction_bonus(feature, BASE_STATS)
        expect(result.trigger).toBe('after_ally_hit')
        expect(result.bonusExpression).toBe('+2d6')
        expect(result.condition).toBe('adjacent_to_target')
        expect(result.selfMovement).toBe('10 ft')
        expect(result.allyMovement).toBe('15 ft')
        expect(result.allyRange).toBe('60 ft')
        expect(result.noOAs).toBe(true)
        expect(result.resourceCost).toBe('reaction points')
        expect(result.effect).toBe('push_back')
        expect(result.saveType).toBe('STR')
        expect(result.saveDc).toBe(15)
        expect(result.duration).toBe('1_round')
    })
})

describe('reactionHandlers – reaction_damage', () => {
    it('returns reaction_damage info with defaults', () => {
        const feature = makeFeature({ type: 'reaction_damage' })
        const result = reactionHandlers.reaction_damage(feature, BASE_STATS)
        expect(result.type).toBe('reaction_damage')
        expect(result.trigger).toBe('')
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('')
        expect(result.saveType).toBeNull()
        expect(result.saveDc).toBeNull()
        expect(result.saveAbility).toBe('WIS')
        expect(result.alsoInflicts).toBeNull()
        expect(result.resourceCost).toBeNull()
        expect(result.range).toBe('5_ft')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.effect).toBeNull()
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves scaling for damageExpression', () => {
        const feature = makeFeature({
            type: 'reaction_damage',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        const result = reactionHandlers.reaction_damage(feature, { ...BASE_STATS, level: 5 })
        expect(result.damageExpression).toBe('2d6')
    })

    it('resolves saveDcExpression', () => {
        const feature = makeFeature({
            type: 'reaction_damage',
            saveDcExpression: 'proficiency_bonus'
        })
        const result = reactionHandlers.reaction_damage(feature, BASE_STATS)
        expect(result.saveDc).toBe(3)
    })

    it('uses ability-based saveDc when saveDc is ability', () => {
        const feature = makeFeature({
            type: 'reaction_damage',
            saveDc: 'ability',
            saveAbility: 'CON'
        })
        const result = reactionHandlers.reaction_damage(feature, BASE_STATS)
        expect(result.saveDc).toBe(14) // 8 + CON(3) + prof(3)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'reaction_damage',
            trigger: 'after_ally_hit',
            damageType: 'Force',
            saveType: 'DEX',
            saveDc: 15,
            saveAbility: 'CHA',
            alsoInflicts: 'slowed',
            resourceCost: 'reaction points',
            range: '10_ft',
            effect: 'knock_prone'
        })
        const result = reactionHandlers.reaction_damage(feature, BASE_STATS)
        expect(result.trigger).toBe('after_ally_hit')
        expect(result.damageType).toBe('Force')
        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('CHA')
        expect(result.alsoInflicts).toBe('slowed')
        expect(result.resourceCost).toBe('reaction points')
        expect(result.range).toBe('10_ft')
        expect(result.effect).toBe('knock_prone')
    })
})

describe('reactionHandlers – reaction_debuff', () => {
    it('returns reaction_debuff info with defaults', () => {
        const feature = makeFeature({ type: 'reaction_debuff' })
        const result = reactionHandlers.reaction_debuff(feature, BASE_STATS)
        expect(result.type).toBe('reaction_debuff')
        expect(result.trigger).toBe('')
        expect(result.debuffExpression).toBe('')
        expect(result.subtractive).toBe(false)
        expect(result.effect).toBe('')
        expect(result.uses_expression).toBe('')
        expect(result.usesMax).toBe(0)
        expect(result.recharge).toBe('long_rest')
        expect(result.range).toBe('60_ft')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.triggerTypes).toEqual(['attack_roll', 'damage_roll', 'ability_check'])
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves uses_expression', () => {
        const feature = makeFeature({
            type: 'reaction_debuff',
            uses_expression: 'proficiency_bonus'
        })
        const result = reactionHandlers.reaction_debuff(feature, BASE_STATS)
        expect(result.usesMax).toBe(3) // mocked value
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'reaction_debuff',
            trigger: 'after_attack_miss',
            debuffExpression: '-2',
            subtractive: true,
            effect: 'disadvantage',
            recharge: 'short_rest',
            range: '30_ft'
        })
        const result = reactionHandlers.reaction_debuff(feature, BASE_STATS)
        expect(result.trigger).toBe('after_attack_miss')
        expect(result.debuffExpression).toBe('-2')
        expect(result.subtractive).toBe(true)
        expect(result.effect).toBe('disadvantage')
        expect(result.recharge).toBe('short_rest')
        expect(result.range).toBe('30_ft')
    })
})

describe('reactionHandlers – reaction_save', () => {
    it('returns reaction_save info with defaults', () => {
        const feature = makeFeature({ type: 'reaction_save' })
        const result = reactionHandlers.reaction_save(feature, BASE_STATS)
        expect(result.type).toBe('reaction_save')
        expect(result.trigger).toBe('')
        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('CHA')
        expect(result.condition).toBe('')
        expect(result.duration).toBe('')
        expect(result.range).toBe('120_ft')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.target).toBe('different_creature')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'reaction_save',
            trigger: 'ally_hit',
            saveType: 'CON',
            saveDc: 15,
            saveAbility: 'INT',
            condition: 'slowed',
            duration: '1_round',
            range: '30_ft'
        })
        const result = reactionHandlers.reaction_save(feature, BASE_STATS)
        expect(result.trigger).toBe('ally_hit')
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('INT')
        expect(result.condition).toBe('slowed')
        expect(result.duration).toBe('1_round')
        expect(result.range).toBe('30_ft')
    })
})

describe('reactionHandlers – shadowy_dodge', () => {
    it('returns shadowy_dodge info with defaults', () => {
        const feature = makeFeature({ type: 'shadowy_dodge' })
        const result = reactionHandlers.shadowy_dodge(feature, BASE_STATS)
        expect(result.type).toBe('shadowy_dodge')
        expect(result.range).toBe('30_ft')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'shadowy_dodge',
            range: '60_ft'
        })
        const result = reactionHandlers.shadowy_dodge(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
    })
})

describe('reactionHandlers – glorious_defense', () => {
    it('returns glorious_defense info with defaults', () => {
        const feature = makeFeature({ type: 'glorious_defense' })
        const result = reactionHandlers.glorious_defense(feature, BASE_STATS)
        expect(result.type).toBe('glorious_defense')
        expect(result.acBonusExpression).toBe('Math.max(1, CHA modifier)')
        expect(result.acBonus).toBe(2) // max(1, 2)
        expect(result.usesMax).toBe(2) // max(1, 2)
        expect(result.range).toBe('10_ft')
        expect(result.trigger).toBe('')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('calculates acBonus and usesMax from CHA bonus', () => {
        const stats = {
            ...BASE_STATS,
            abilities: [
                { name: 'Charisma', bonus: 5 }
            ]
        }
        const feature = makeFeature({ type: 'glorious_defense' })
        const result = reactionHandlers.glorious_defense(feature, stats)
        expect(result.acBonus).toBe(5)
        expect(result.usesMax).toBe(5)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'glorious_defense',
            range: '15_ft',
            trigger: 'after_attack_missed'
        })
        const result = reactionHandlers.glorious_defense(feature, BASE_STATS)
        expect(result.range).toBe('15_ft')
        expect(result.trigger).toBe('after_attack_missed')
    })
})

describe('reactionHandlers – beguiling_defenses', () => {
    it('returns beguiling_defenses info with defaults', () => {
        const feature = makeFeature({ type: 'beguiling_defenses' })
        const result = reactionHandlers.beguiling_defenses(feature, BASE_STATS)
        expect(result.type).toBe('beguiling_defenses')
        expect(result.saveType).toBe('WIS')
        expect(result.saveAbility).toBe('CHA')
        expect(result.damageType).toBe('Psychic')
        expect(result.uses).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.pactMagicRecharge).toBe(false)
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('calculates saveDc when saveDc is ability', () => {
        const feature = makeFeature({
            type: 'beguiling_defenses',
            saveDc: 'ability',
            saveAbility: 'CHA'
        })
        const result = reactionHandlers.beguiling_defenses(feature, BASE_STATS)
        expect(result.saveDc).toBe(13) // 8 + CHA(2) + prof(3)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'beguiling_defenses',
            saveType: 'CON',
            saveDc: 15,
            uses: 3,
            recharge: 'short_rest',
            pactMagicRecharge: true
        })
        const result = reactionHandlers.beguiling_defenses(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.pactMagicRecharge).toBe(true)
    })
})

describe('reactionHandlers – searing_vengeance', () => {
    it('returns searing_vengeance info with defaults', () => {
        const feature = makeFeature({ type: 'searing_vengeance' })
        const result = reactionHandlers.searing_vengeance(feature, BASE_STATS)
        expect(result.type).toBe('searing_vengeance')
        expect(result.healExpression).toBe('')
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('Radiant')
        expect(result.range).toBe('30_ft')
        expect(result.condition).toBe('blinded')
        expect(result.conditionDuration).toBe('until_end_of_current_turn')
        expect(result.trigger).toBe('death_save_by_ally_or_self')
        expect(result.allyRange).toBe('60_ft')
        expect(result.uses).toBe(1)
        expect(result.usesMax).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'searing_vengeance',
            healExpression: '2d8',
            damageExpression: '3d6',
            damageType: 'Fire',
            range: '60_ft',
            condition: 'burning',
            conditionDuration: '1_round',
            trigger: 'ally_death',
            allyRange: '30_ft',
            uses: 2,
            recharge: 'short_rest'
        })
        const result = reactionHandlers.searing_vengeance(feature, BASE_STATS)
        expect(result.healExpression).toBe('2d8')
        expect(result.damageExpression).toBe('3d6')
        expect(result.damageType).toBe('Fire')
        expect(result.range).toBe('60_ft')
        expect(result.condition).toBe('burning')
        expect(result.conditionDuration).toBe('1_round')
        expect(result.trigger).toBe('ally_death')
        expect(result.allyRange).toBe('30_ft')
        expect(result.uses).toBe(2)
        expect(result.recharge).toBe('short_rest')
    })
})

describe('reactionHandlers – illusory_self', () => {
    it('returns illusory_self info with defaults', () => {
        const feature = makeFeature({ type: 'illusory_self' })
        const result = reactionHandlers.illusory_self(feature, BASE_STATS)
        expect(result.type).toBe('illusory_self')
        expect(result.trigger).toBe('attack_hit')
        expect(result.uses).toBe(1)
        expect(result.recharge).toBe('short_or_long_rest')
        expect(result.spellSlotRestore).toBeNull()
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'illusory_self',
            trigger: 'missed_attack',
            uses: 3,
            recharge: 'long_rest',
            spellSlotRestore: 1
        })
        const result = reactionHandlers.illusory_self(feature, BASE_STATS)
        expect(result.trigger).toBe('missed_attack')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('long_rest')
        expect(result.spellSlotRestore).toBe(1)
    })
})

describe('reactionHandlers – reaction_counterspell', () => {
    it('returns reaction_counterspell info with defaults', () => {
        const feature = makeFeature({ type: 'reaction_counterspell' })
        const result = reactionHandlers.reaction_counterspell(feature, BASE_STATS)
        expect(result.type).toBe('reaction_counterspell')
        expect(result.trigger).toBe('creature_casting_spell')
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('CHA')
        expect(result.saveBonus).toBe(13) // 8 + CHA(2) + prof(3)
        expect(result.range).toBe('60 ft')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'reaction_counterspell',
            trigger: 'spell_cast_in_range',
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'INT',
            range: '120 ft'
        })
        const result = reactionHandlers.reaction_counterspell(feature, BASE_STATS)
        expect(result.trigger).toBe('spell_cast_in_range')
        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('INT')
        expect(result.range).toBe('120 ft')
    })
})

describe('reactionHandlers – lucky_point', () => {
    it('returns lucky_point info with defaults', () => {
        const feature = makeFeature({ type: 'lucky_point' })
        const result = reactionHandlers.lucky_point(feature, BASE_STATS)
        expect(result.type).toBe('lucky_point')
        expect(result.effect).toBe('advantage')
        expect(result.target).toBe('d20')
        expect(result.cost).toBe(1)
        expect(result.casting_time).toBe('reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'lucky_point',
            effect: 'reroll',
            target: 'attack_roll',
            cost: 2,
            casting_time: '1 action'
        })
        const result = reactionHandlers.lucky_point(feature, BASE_STATS)
        expect(result.effect).toBe('reroll')
        expect(result.target).toBe('attack_roll')
        expect(result.cost).toBe(2)
        expect(result.casting_time).toBe('1 action')
    })
})

describe('reactionHandlers – reaction_spell', () => {
    it('returns reaction_spell info with defaults', () => {
        const feature = makeFeature({ type: 'reaction_spell' })
        const result = reactionHandlers.reaction_spell(feature, BASE_STATS)
        expect(result.type).toBe('reaction_spell')
        expect(result.trigger).toBe('')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'reaction_spell',
            trigger: 'after_spell_cast',
            casting_time: '1 reaction'
        })
        const result = reactionHandlers.reaction_spell(feature, BASE_STATS)
        expect(result.trigger).toBe('after_spell_cast')
        expect(result.casting_time).toBe('1 reaction')
    })
})

describe('reactionHandlers – sentinel_guardian', () => {
    it('returns sentinel_guardian info with default attack when no melee attacks', () => {
        const feature = makeFeature({ type: 'sentinel_guardian' })
        const stats = { ...BASE_STATS, attacks: [] }
        const result = reactionHandlers.sentinel_guardian(feature, stats)
        expect(result.type).toBe('sentinel_guardian')
        expect(result.trigger).toBe('creature_disengages_or_hits_other_within_5ft')
        expect(result.range).toBe('5_ft')
        expect(result.oaType).toBe('any_attack_miss_or_disengage')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.attack).toBeNull()
        expect(result.hasAutomation).toBe(true)
    })

    it('selects first melee action attack', () => {
        const feature = makeFeature({ type: 'sentinel_guardian' })
        const stats = {
            ...BASE_STATS,
            attacks: [
                { type: 'Action', range: 'melee', name: 'Longsword' },
                { type: 'Action', range: 'ranged', name: 'Longbow' }
            ]
        }
        const result = reactionHandlers.sentinel_guardian(feature, stats)
        expect(result.attack.name).toBe('Longsword')
    })

    it('falls back to first attack when no melee attacks', () => {
        const feature = makeFeature({ type: 'sentinel_guardian' })
        const stats = {
            ...BASE_STATS,
            attacks: [
                { type: 'Action', range: 'ranged', name: 'Longbow' }
            ]
        }
        const result = reactionHandlers.sentinel_guardian(feature, stats)
        expect(result.attack.name).toBe('Longbow')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'sentinel_guardian',
            trigger: 'after_miss',
            range: '10_ft',
            oaType: 'missed_attack'
        })
        const result = reactionHandlers.sentinel_guardian(feature, BASE_STATS)
        expect(result.trigger).toBe('after_miss')
        expect(result.range).toBe('10_ft')
        expect(result.oaType).toBe('missed_attack')
    })
})
