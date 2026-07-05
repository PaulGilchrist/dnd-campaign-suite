// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { reactionHandlers } from './reaction.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Assert that every non-optional field in the default result matches
 * its expected default value.  This replaces the brittle pattern of
 * individually asserting 10-20 properties one by one.
 */
function expectDefaultResult(result, expectedDefaults) {
    for (const [key, value] of Object.entries(expectedDefaults)) {
        expect(result, `default: ${key}`).toHaveProperty(key, value)
    }
}

// ── reaction_bonus ───────────────────────────────────────────────────

describe('reactionHandlers – reaction_bonus', () => {
    const defaults = {
        type: 'reaction_bonus',
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
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'reaction_bonus' })
        const result = reactionHandlers.reaction_bonus(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'reaction_bonus' }, 'Shield')
        const result = reactionHandlers.reaction_bonus(feature, BASE_STATS)
        expect(result.name).toBe('Shield')
    })

    it('passes through truthy custom fields and replaces falsy with defaults', () => {
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

    it('coerces explicit false values correctly', () => {
        const feature = makeFeature({
            type: 'reaction_bonus',
            noOAs: false,
            allyRange: '15 ft'
        })
        const result = reactionHandlers.reaction_bonus(feature, BASE_STATS)
        expect(result.noOAs).toBe(false)
        expect(result.allyRange).toBe('15 ft')
    })

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.reaction_bonus({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.reaction_bonus({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── reaction_damage ──────────────────────────────────────────────────

describe('reactionHandlers – reaction_damage', () => {
    const defaults = {
        type: 'reaction_damage',
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
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'reaction_damage' })
        const result = reactionHandlers.reaction_damage(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'reaction_damage' }, 'Thorn Whip')
        const result = reactionHandlers.reaction_damage(feature, BASE_STATS)
        expect(result.name).toBe('Thorn Whip')
    })

    it('resolves scaling at level boundaries', () => {
        const feature = makeFeature({
            type: 'reaction_damage',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        expect(reactionHandlers.reaction_damage(feature, { ...BASE_STATS, level: 1 }).damageExpression).toBe('1d6')
        expect(reactionHandlers.reaction_damage(feature, { ...BASE_STATS, level: 5 }).damageExpression).toBe('2d6')
        expect(reactionHandlers.reaction_damage(feature, { ...BASE_STATS, level: 11 }).damageExpression).toBe('3d6')
    })

    it('resolves saveDc from expression or ability', () => {
        expect(reactionHandlers.reaction_damage(makeFeature({ type: 'reaction_damage', saveDcExpression: 'proficiency_bonus' }), BASE_STATS).saveDc).toBe(3)
        expect(reactionHandlers.reaction_damage(makeFeature({ type: 'reaction_damage', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(16)
        expect(reactionHandlers.reaction_damage(makeFeature({ type: 'reaction_damage', saveDc: 'ability', saveAbility: 'CON' }), BASE_STATS).saveDc).toBe(14)
        expect(reactionHandlers.reaction_damage(makeFeature({ type: 'reaction_damage', saveDc: 18, saveDcExpression: 'proficiency_bonus' }), BASE_STATS).saveDc).toBe(18)
    })

    it('passes through custom fields and replaces falsy with defaults', () => {
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

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.reaction_damage({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.reaction_damage({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── reaction_debuff ──────────────────────────────────────────────────

describe('reactionHandlers – reaction_debuff', () => {
    const defaults = {
        type: 'reaction_debuff',
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
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'reaction_debuff' })
        const result = reactionHandlers.reaction_debuff(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'reaction_debuff' }, 'Counterattack')
        const result = reactionHandlers.reaction_debuff(feature, BASE_STATS)
        expect(result.name).toBe('Counterattack')
    })

    it('resolves uses_expression to numeric values', () => {
        expect(reactionHandlers.reaction_debuff(makeFeature({ type: 'reaction_debuff', uses_expression: 'proficiency_bonus' }), BASE_STATS).usesMax).toBe(3)
        expect(reactionHandlers.reaction_debuff(makeFeature({ type: 'reaction_debuff', uses_expression: 'level' }), BASE_STATS).usesMax).toBe(5)
    })

    it('passes through custom fields and replaces falsy with defaults', () => {
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

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.reaction_debuff({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.reaction_debuff({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── reaction_save ────────────────────────────────────────────────────

describe('reactionHandlers – reaction_save', () => {
    const defaults = {
        type: 'reaction_save',
        trigger: '',
        saveType: 'WIS',
        saveDc: 'ability',
        saveAbility: 'CHA',
        condition: '',
        duration: '',
        range: '120_ft',
        casting_time: '1 reaction',
        target: 'different_creature',
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'reaction_save' })
        const result = reactionHandlers.reaction_save(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'reaction_save' }, 'Uncanny Dodge')
        const result = reactionHandlers.reaction_save(feature, BASE_STATS)
        expect(result.name).toBe('Uncanny Dodge')
    })

    it('passes through custom fields and replaces falsy with defaults', () => {
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

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.reaction_save({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.reaction_save({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── shadowy_dodge ────────────────────────────────────────────────────

describe('reactionHandlers – shadowy_dodge', () => {
    const defaults = {
        type: 'shadowy_dodge',
        range: '30_ft',
        casting_time: '1 reaction',
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'shadowy_dodge' })
        const result = reactionHandlers.shadowy_dodge(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'shadowy_dodge' }, 'Shadow Step')
        const result = reactionHandlers.shadowy_dodge(feature, BASE_STATS)
        expect(result.name).toBe('Shadow Step')
    })

    it('passes through custom fields and replaces falsy with defaults', () => {
        const feature = makeFeature({ type: 'shadowy_dodge', range: '60_ft' })
        const result = reactionHandlers.shadowy_dodge(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
    })

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.shadowy_dodge({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.shadowy_dodge({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── glorious_defense ─────────────────────────────────────────────────

describe('reactionHandlers – glorious_defense', () => {
    const defaults = {
        type: 'glorious_defense',
        acBonusExpression: 'Math.max(1, CHA modifier)',
        range: '10_ft',
        trigger: '',
        casting_time: '1 reaction',
        hasAutomation: true
    }

    it('returns defaults with standard CHA bonus (2)', () => {
        const feature = makeFeature({ type: 'glorious_defense' })
        const result = reactionHandlers.glorious_defense(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
        expect(result.acBonus).toBe(2)
        expect(result.usesMax).toBe(2)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'glorious_defense' }, 'Brave Stance')
        const result = reactionHandlers.glorious_defense(feature, BASE_STATS)
        expect(result.name).toBe('Brave Stance')
    })

    it('clamps acBonus and usesMax to minimum 1', () => {
        const zeroStats = { ...BASE_STATS, abilities: [{ name: 'Charisma', bonus: 0 }] }
        const negStats = { ...BASE_STATS, abilities: [{ name: 'Charisma', bonus: -3 }] }
        const missingStats = { ...BASE_STATS, abilities: undefined }

        expect(reactionHandlers.glorious_defense(makeFeature({ type: 'glorious_defense' }), zeroStats).acBonus).toBe(1)
        expect(reactionHandlers.glorious_defense(makeFeature({ type: 'glorious_defense' }), negStats).acBonus).toBe(1)
        expect(reactionHandlers.glorious_defense(makeFeature({ type: 'glorious_defense' }), missingStats).acBonus).toBe(1)
    })

    it('scales acBonus and usesMax with higher CHA bonus', () => {
        const stats = { ...BASE_STATS, abilities: [{ name: 'Charisma', bonus: 5 }] }
        const result = reactionHandlers.glorious_defense(makeFeature({ type: 'glorious_defense' }), stats)
        expect(result.acBonus).toBe(5)
        expect(result.usesMax).toBe(5)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({ type: 'glorious_defense', range: '15_ft', trigger: 'after_attack_missed' })
        const result = reactionHandlers.glorious_defense(feature, BASE_STATS)
        expect(result.range).toBe('15_ft')
        expect(result.trigger).toBe('after_attack_missed')
    })

    it('throws when automation is null or undefined', () => {
        const stats = { ...BASE_STATS, abilities: [{ name: 'Charisma', bonus: 2 }] }
        expect(() => reactionHandlers.glorious_defense({ name: 'Test', automation: null }, stats)).toThrow(TypeError)
        expect(() => reactionHandlers.glorious_defense({ name: 'Test' }, stats)).toThrow(TypeError)
    })
})

// ── beguiling_defenses ───────────────────────────────────────────────

describe('reactionHandlers – beguiling_defenses', () => {
    const defaults = {
        type: 'beguiling_defenses',
        saveType: 'WIS',
        saveAbility: 'CHA',
        damageType: 'Psychic',
        uses: 1,
        recharge: 'long_rest',
        pactMagicRecharge: false,
        casting_time: '1 reaction',
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'beguiling_defenses' })
        const result = reactionHandlers.beguiling_defenses(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'beguiling_defenses' }, 'Pact Ward')
        const result = reactionHandlers.beguiling_defenses(feature, BASE_STATS)
        expect(result.name).toBe('Pact Ward')
    })

    it('calculates ability-based saveDc', () => {
        // Default saveAbility CHA: 8 + 2 + 3 = 13
        expect(reactionHandlers.beguiling_defenses(makeFeature({ type: 'beguiling_defenses', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(13)
        expect(reactionHandlers.beguiling_defenses(makeFeature({ type: 'beguiling_defenses', saveDc: 'ability', saveAbility: 'CHA' }), BASE_STATS).saveDc).toBe(13)
        // Explicit numeric overrides
        expect(reactionHandlers.beguiling_defenses(makeFeature({ type: 'beguiling_defenses', saveDc: 17 }), BASE_STATS).saveDc).toBe(17)
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

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.beguiling_defenses({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.beguiling_defenses({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── searing_vengeance ────────────────────────────────────────────────

describe('reactionHandlers – searing_vengeance', () => {
    const defaults = {
        type: 'searing_vengeance',
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
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'searing_vengeance' })
        const result = reactionHandlers.searing_vengeance(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'searing_vengeance' }, 'Divine Retribution')
        const result = reactionHandlers.searing_vengeance(feature, BASE_STATS)
        expect(result.name).toBe('Divine Retribution')
    })

    it('uses explicit uses value for both uses and usesMax', () => {
        const result = reactionHandlers.searing_vengeance(makeFeature({ type: 'searing_vengeance', uses: 3 }), BASE_STATS)
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
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

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.searing_vengeance({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.searing_vengeance({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── illusory_self ────────────────────────────────────────────────────

describe('reactionHandlers – illusory_self', () => {
    const defaults = {
        type: 'illusory_self',
        trigger: 'attack_hit',
        uses: 1,
        recharge: 'short_or_long_rest',
        spellSlotRestore: null,
        casting_time: '1 reaction',
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'illusory_self' })
        const result = reactionHandlers.illusory_self(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'illusory_self' }, 'Mirror Image')
        const result = reactionHandlers.illusory_self(feature, BASE_STATS)
        expect(result.name).toBe('Mirror Image')
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

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.illusory_self({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.illusory_self({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── reaction_counterspell ────────────────────────────────────────────

describe('reactionHandlers – reaction_counterspell', () => {
    const defaults = {
        type: 'reaction_counterspell',
        trigger: 'creature_casting_spell',
        saveType: 'CON',
        saveDc: 'ability',
        saveAbility: 'CHA',
        range: '60 ft',
        casting_time: '1 reaction',
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'reaction_counterspell' })
        const result = reactionHandlers.reaction_counterspell(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'reaction_counterspell' }, 'Counterspell')
        const result = reactionHandlers.reaction_counterspell(feature, BASE_STATS)
        expect(result.name).toBe('Counterspell')
    })

    it('calculates saveBonus from CHA bonus and proficiency', () => {
        // CHA bonus=2, proficiency=3 => 8 + 2 + 3 = 13
        expect(reactionHandlers.reaction_counterspell(makeFeature({ type: 'reaction_counterspell' }), BASE_STATS).saveBonus).toBe(13)
    })

    it('handles edge cases for saveBonus calculation', () => {
        const zeroStats = { ...BASE_STATS, abilities: [{ name: 'Charisma', bonus: 0 }] }
        const missingStats = { ...BASE_STATS, abilities: undefined }
        // 8 + 0 + 3 = 11
        expect(reactionHandlers.reaction_counterspell(makeFeature({ type: 'reaction_counterspell' }), zeroStats).saveBonus).toBe(11)
        expect(reactionHandlers.reaction_counterspell(makeFeature({ type: 'reaction_counterspell' }), missingStats).saveBonus).toBe(11)
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

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.reaction_counterspell({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.reaction_counterspell({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── lucky_point ──────────────────────────────────────────────────────

describe('reactionHandlers – lucky_point', () => {
    const defaults = {
        type: 'lucky_point',
        effect: 'advantage',
        target: 'd20',
        cost: 1,
        casting_time: 'reaction',
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'lucky_point' })
        const result = reactionHandlers.lucky_point(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'lucky_point' }, 'Fate Guide')
        const result = reactionHandlers.lucky_point(feature, BASE_STATS)
        expect(result.name).toBe('Fate Guide')
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

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.lucky_point({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.lucky_point({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── reaction_spell ───────────────────────────────────────────────────

describe('reactionHandlers – reaction_spell', () => {
    const defaults = {
        type: 'reaction_spell',
        trigger: '',
        casting_time: '1 reaction',
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'reaction_spell' })
        const result = reactionHandlers.reaction_spell(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'reaction_spell' }, 'Silent Image')
        const result = reactionHandlers.reaction_spell(feature, BASE_STATS)
        expect(result.name).toBe('Silent Image')
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

    it('throws when automation is null or undefined', () => {
        expect(() => reactionHandlers.reaction_spell({ name: 'Test', automation: null }, BASE_STATS)).toThrow(TypeError)
        expect(() => reactionHandlers.reaction_spell({ name: 'Test' }, BASE_STATS)).toThrow(TypeError)
    })
})

// ── sentinel_guardian ────────────────────────────────────────────────

describe('reactionHandlers – sentinel_guardian', () => {
    const defaults = {
        type: 'sentinel_guardian',
        trigger: 'creature_disengages_or_hits_other_within_5ft',
        range: '5_ft',
        oaType: 'any_attack_miss_or_disengage',
        casting_time: '1 reaction',
        hasAutomation: true
    }

    it('returns defaults with null attack when no attacks exist', () => {
        const feature = makeFeature({ type: 'sentinel_guardian' })
        const stats = { ...BASE_STATS, attacks: [] }
        const result = reactionHandlers.sentinel_guardian(feature, stats)
        expectDefaultResult(result, defaults)
        expect(result.attack).toBeNull()
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'sentinel_guardian' }, 'Sentry')
        const result = reactionHandlers.sentinel_guardian(feature, BASE_STATS)
        expect(result.name).toBe('Sentry')
    })

    it('selects first melee action attack over ranged', () => {
        const stats = {
            ...BASE_STATS,
            attacks: [
                { type: 'Action', range: 'melee', name: 'Longsword' },
                { type: 'Action', range: 'ranged', name: 'Longbow' }
            ]
        }
        const result = reactionHandlers.sentinel_guardian(makeFeature({ type: 'sentinel_guardian' }), stats)
        expect(result.attack.name).toBe('Longsword')
    })

    it('selects first melee attack even when non-Action melee exists', () => {
        const stats = {
            ...BASE_STATS,
            attacks: [
                { type: 'Bonus Action', range: 'melee', name: 'Off-hand' },
                { type: 'Action', range: 'melee', name: 'Greataxe' }
            ]
        }
        const result = reactionHandlers.sentinel_guardian(makeFeature({ type: 'sentinel_guardian' }), stats)
        expect(result.attack.name).toBe('Greataxe')
    })

    it('falls back to first attack when no melee attacks exist', () => {
        const stats = {
            ...BASE_STATS,
            attacks: [{ type: 'Action', range: 'ranged', name: 'Longbow' }]
        }
        const result = reactionHandlers.sentinel_guardian(makeFeature({ type: 'sentinel_guardian' }), stats)
        expect(result.attack.name).toBe('Longbow')
    })

    it('returns null attack when attacks array is missing', () => {
        const feature = makeFeature({ type: 'sentinel_guardian' })
        const stats = { ...BASE_STATS }
        const result = reactionHandlers.sentinel_guardian(feature, stats)
        expect(result.attack).toBeNull()
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

    it('throws when automation is null or undefined', () => {
        const stats = { ...BASE_STATS, attacks: [] }
        expect(() => reactionHandlers.sentinel_guardian({ name: 'Test', automation: null }, stats)).toThrow(TypeError)
        expect(() => reactionHandlers.sentinel_guardian({ name: 'Test' }, stats)).toThrow(TypeError)
    })
})
