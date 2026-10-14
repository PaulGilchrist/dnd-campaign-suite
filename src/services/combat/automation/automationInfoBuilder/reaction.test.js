import { describe, it, expect } from 'vitest'
import { reactionHandlers } from './reaction.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Assert that every non-optional field in the default result matches
 * its expected default value.
 */
function expectDefaultResult(result, expectedDefaults) {
    for (const [key, value] of Object.entries(expectedDefaults)) {
        expect(result, `default: ${key}`).toHaveProperty(key, value)
    }
}

/**
 * Register the four standard tests for a reaction handler.
 * Each handler also registers its own handler-specific tests.
 *
 * @param {string} name - describe block name suffix
 * @param {string} handlerKey - the handler key in reactionHandlers
 * @param {Object} defaults - expected default values
 * @param {Function} customTestFn - optional handler-specific tests
 * @param {Object} [customStats] - optional stats override for custom tests
 */
function registerStandardTests(name, handlerKey, defaults, customTestFn, customStats) {
    const stats = customStats || BASE_STATS
    const handler = reactionHandlers[handlerKey]

    describe(`reactionHandlers – ${name}`, () => {
        it('returns all default values when automation is empty', () => {
            const feature = makeFeature({ type: handlerKey })
            expectDefaultResult(handler(feature, stats), defaults)
        })

        it('propagates the feature name', () => {
            const feature = makeFeature({ type: handlerKey }, `Mock ${name}`)
            expect(handler(feature, stats).name).toBe(`Mock ${name}`)
        })

        if (customTestFn) customTestFn(handler, stats, makeFeature)

        it('throws when automation is null or undefined', () => {
            expect(() => handler({ name: 'Test', automation: null }, stats)).toThrow(TypeError)
            expect(() => handler({ name: 'Test' }, stats)).toThrow(TypeError)
        })
    })
}

// ── reaction_bonus ───────────────────────────────────────────────────

registerStandardTests('reaction_bonus', 'reaction_bonus', {
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
}, (handler) => {
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
        const result = handler(feature, BASE_STATS)
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
        const feature = makeFeature({ type: 'reaction_bonus', noOAs: false, allyRange: '15 ft' })
        const result = handler(feature, BASE_STATS)
        expect(result.noOAs).toBe(false)
        expect(result.allyRange).toBe('15 ft')
    })
})

// ── reaction_damage ──────────────────────────────────────────────────

registerStandardTests('reaction_damage', 'reaction_damage', {
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
}, (handler) => {
    it('resolves scaling at level boundaries', () => {
        const feature = makeFeature({ type: 'reaction_damage', damageExpression: '1d6', scaling: { 5: '2d6', 11: '3d6' } })
        expect(handler(feature, { ...BASE_STATS, level: 1 }).damageExpression).toBe('1d6')
        expect(handler(feature, { ...BASE_STATS, level: 5 }).damageExpression).toBe('2d6')
        expect(handler(feature, { ...BASE_STATS, level: 11 }).damageExpression).toBe('3d6')
    })

    it('resolves saveDc from expression or ability', () => {
        expect(handler(makeFeature({ type: 'reaction_damage', saveDcExpression: 'proficiency_bonus' }), BASE_STATS).saveDc).toBe(3)
        expect(handler(makeFeature({ type: 'reaction_damage', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(16)
        expect(handler(makeFeature({ type: 'reaction_damage', saveDc: 'ability', saveAbility: 'CON' }), BASE_STATS).saveDc).toBe(14)
        expect(handler(makeFeature({ type: 'reaction_damage', saveDc: 18, saveDcExpression: 'proficiency_bonus' }), BASE_STATS).saveDc).toBe(18)
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
        const result = handler(feature, BASE_STATS)
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

// ── reaction_debuff ──────────────────────────────────────────────────

registerStandardTests('reaction_debuff', 'reaction_debuff', {
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
}, (handler) => {
    it('resolves uses_expression to numeric values', () => {
        expect(handler(makeFeature({ type: 'reaction_debuff', uses_expression: 'proficiency_bonus' }), BASE_STATS).usesMax).toBe(3)
        expect(handler(makeFeature({ type: 'reaction_debuff', uses_expression: 'level' }), BASE_STATS).usesMax).toBe(5)
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
        const result = handler(feature, BASE_STATS)
        expect(result.trigger).toBe('after_attack_miss')
        expect(result.debuffExpression).toBe('-2')
        expect(result.subtractive).toBe(true)
        expect(result.effect).toBe('disadvantage')
        expect(result.recharge).toBe('short_rest')
        expect(result.range).toBe('30_ft')
    })
})

// ── reaction_save ────────────────────────────────────────────────────

registerStandardTests('reaction_save', 'reaction_save', {
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
}, (handler) => {
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
        const result = handler(feature, BASE_STATS)
        expect(result.trigger).toBe('ally_hit')
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('INT')
        expect(result.condition).toBe('slowed')
        expect(result.duration).toBe('1_round')
        expect(result.range).toBe('30_ft')
    })
})

// ── shadowy_dodge ────────────────────────────────────────────────────

registerStandardTests('shadowy_dodge', 'shadowy_dodge', {
    type: 'shadowy_dodge',
    range: '30_ft',
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler) => {
    it('passes through custom fields and replaces falsy with defaults', () => {
        const feature = makeFeature({ type: 'shadowy_dodge', range: '60_ft' })
        const result = handler(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
    })
})

// ── glorious_defense ─────────────────────────────────────────────────

registerStandardTests('glorious_defense', 'glorious_defense', {
    type: 'glorious_defense',
    acBonusExpression: 'Math.max(1, CHA modifier)',
    range: '10_ft',
    trigger: '',
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler, stats) => {
    it('returns defaults with standard CHA bonus (2)', () => {
        const result = handler(makeFeature({ type: 'glorious_defense' }), stats)
        expectDefaultResult(result, {
            type: 'glorious_defense',
            acBonusExpression: 'Math.max(1, CHA modifier)',
            range: '10_ft',
            trigger: '',
            casting_time: '1 reaction',
            hasAutomation: true
        })
        expect(result.acBonus).toBe(2)
        expect(result.usesMax).toBe(2)
    })

    it('clamps acBonus and usesMax to minimum 1', () => {
        const zeroStats = { ...stats, abilities: [{ name: 'Charisma', bonus: 0 }] }
        const negStats = { ...stats, abilities: [{ name: 'Charisma', bonus: -3 }] }
        const missingStats = { ...stats, abilities: undefined }
        expect(handler(makeFeature({ type: 'glorious_defense' }), zeroStats).acBonus).toBe(1)
        expect(handler(makeFeature({ type: 'glorious_defense' }), negStats).acBonus).toBe(1)
        expect(handler(makeFeature({ type: 'glorious_defense' }), missingStats).acBonus).toBe(1)
    })

    it('scales acBonus and usesMax with higher CHA bonus', () => {
        const highStats = { ...stats, abilities: [{ name: 'Charisma', bonus: 5 }] }
        const result = handler(makeFeature({ type: 'glorious_defense' }), highStats)
        expect(result.acBonus).toBe(5)
        expect(result.usesMax).toBe(5)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({ type: 'glorious_defense', range: '15_ft', trigger: 'after_attack_missed' })
        const result = handler(feature, stats)
        expect(result.range).toBe('15_ft')
        expect(result.trigger).toBe('after_attack_missed')
    })
}, { ...BASE_STATS, abilities: [{ name: 'Charisma', bonus: 2 }] })

// ── beguiling_defenses ───────────────────────────────────────────────

registerStandardTests('beguiling_defenses', 'beguiling_defenses', {
    type: 'beguiling_defenses',
    saveType: 'WIS',
    saveAbility: 'CHA',
    damageType: 'Psychic',
    uses: 1,
    recharge: 'long_rest',
    pactMagicRecharge: false,
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler) => {
    it('calculates ability-based saveDc', () => {
        expect(handler(makeFeature({ type: 'beguiling_defenses', saveDc: 'ability' }), BASE_STATS).saveDc).toBe(13)
        expect(handler(makeFeature({ type: 'beguiling_defenses', saveDc: 'ability', saveAbility: 'CHA' }), BASE_STATS).saveDc).toBe(13)
        expect(handler(makeFeature({ type: 'beguiling_defenses', saveDc: 17 }), BASE_STATS).saveDc).toBe(17)
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
        const result = handler(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.pactMagicRecharge).toBe(true)
    })
})

// ── searing_vengeance ────────────────────────────────────────────────

registerStandardTests('searing_vengeance', 'searing_vengeance', {
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
}, (handler) => {
    it('uses explicit uses value for both uses and usesMax', () => {
        const result = handler(makeFeature({ type: 'searing_vengeance', uses: 3 }), BASE_STATS)
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
        const result = handler(feature, BASE_STATS)
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

// ── illusory_self ────────────────────────────────────────────────────

registerStandardTests('illusory_self', 'illusory_self', {
    type: 'illusory_self',
    trigger: 'attack_hit',
    uses: 1,
    recharge: 'short_or_long_rest',
    spellSlotRestore: null,
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler) => {
    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'illusory_self',
            trigger: 'missed_attack',
            uses: 3,
            recharge: 'long_rest',
            spellSlotRestore: 1
        })
        const result = handler(feature, BASE_STATS)
        expect(result.trigger).toBe('missed_attack')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('long_rest')
        expect(result.spellSlotRestore).toBe(1)
    })
})

// ── reaction_counterspell ────────────────────────────────────────────

registerStandardTests('reaction_counterspell', 'reaction_counterspell', {
    type: 'reaction_counterspell',
    trigger: 'creature_casting_spell',
    saveType: 'CON',
    saveDc: 'ability',
    saveAbility: 'CHA',
    range: '60 ft',
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler) => {
    it('calculates saveBonus from CHA bonus and proficiency', () => {
        expect(handler(makeFeature({ type: 'reaction_counterspell' }), BASE_STATS).saveBonus).toBe(13)
    })

    it('handles edge cases for saveBonus calculation', () => {
        const zeroStats = { ...BASE_STATS, abilities: [{ name: 'Charisma', bonus: 0 }] }
        const missingStats = { ...BASE_STATS, abilities: undefined }
        expect(handler(makeFeature({ type: 'reaction_counterspell' }), zeroStats).saveBonus).toBe(11)
        expect(handler(makeFeature({ type: 'reaction_counterspell' }), missingStats).saveBonus).toBe(11)
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
        const result = handler(feature, BASE_STATS)
        expect(result.trigger).toBe('spell_cast_in_range')
        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('INT')
        expect(result.range).toBe('120 ft')
    })
})

// ── lucky_point ──────────────────────────────────────────────────────

registerStandardTests('lucky_point', 'lucky_point', {
    type: 'lucky_point',
    effect: 'advantage',
    target: 'd20',
    cost: 1,
    casting_time: 'reaction',
    hasAutomation: true
}, (handler) => {
    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'lucky_point',
            effect: 'reroll',
            target: 'attack_roll',
            cost: 2,
            casting_time: '1 action'
        })
        const result = handler(feature, BASE_STATS)
        expect(result.effect).toBe('reroll')
        expect(result.target).toBe('attack_roll')
        expect(result.cost).toBe(2)
        expect(result.casting_time).toBe('1 action')
    })
})

// ── reaction_spell ───────────────────────────────────────────────────

registerStandardTests('reaction_spell', 'reaction_spell', {
    type: 'reaction_spell',
    trigger: '',
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler) => {
    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'reaction_spell',
            trigger: 'after_spell_cast',
            casting_time: '1 reaction'
        })
        const result = handler(feature, BASE_STATS)
        expect(result.trigger).toBe('after_spell_cast')
        expect(result.casting_time).toBe('1 reaction')
    })
})

// ── sentinel_guardian ────────────────────────────────────────────────

registerStandardTests('sentinel_guardian', 'sentinel_guardian', {
    type: 'sentinel_guardian',
    trigger: 'creature_disengages_or_hits_other_within_5ft',
    range: '5_ft',
    oaType: 'any_attack_miss_or_disengage',
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler, stats) => {
    it('returns defaults with null attack when no attacks exist', () => {
        const emptyStats = { ...stats, attacks: [] }
        const result = handler(makeFeature({ type: 'sentinel_guardian' }), emptyStats)
        expectDefaultResult(result, {
            type: 'sentinel_guardian',
            trigger: 'creature_disengages_or_hits_other_within_5ft',
            range: '5_ft',
            oaType: 'any_attack_miss_or_disengage',
            casting_time: '1 reaction',
            hasAutomation: true
        })
        expect(result.attack).toBeNull()
    })

    it('selects first melee action attack over ranged', () => {
        const attackStats = {
            ...stats,
            attacks: [
                { type: 'Action', range: 'melee', name: 'Longsword' },
                { type: 'Action', range: 'ranged', name: 'Longbow' }
            ]
        }
        const result = handler(makeFeature({ type: 'sentinel_guardian' }), attackStats)
        expect(result.attack.name).toBe('Longsword')
    })

    it('selects first melee attack even when non-Action melee exists', () => {
        const attackStats = {
            ...stats,
            attacks: [
                { type: 'Bonus Action', range: 'melee', name: 'Off-hand' },
                { type: 'Action', range: 'melee', name: 'Greataxe' }
            ]
        }
        const result = handler(makeFeature({ type: 'sentinel_guardian' }), attackStats)
        expect(result.attack.name).toBe('Greataxe')
    })

    it('falls back to first attack when no melee attacks exist', () => {
        const attackStats = {
            ...stats,
            attacks: [{ type: 'Action', range: 'ranged', name: 'Longbow' }]
        }
        const result = handler(makeFeature({ type: 'sentinel_guardian' }), attackStats)
        expect(result.attack.name).toBe('Longbow')
    })

    it('returns null attack when attacks array is missing', () => {
        const noAttacksStats = { ...stats }
        const result = handler(makeFeature({ type: 'sentinel_guardian' }), noAttacksStats)
        expect(result.attack).toBeNull()
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'sentinel_guardian',
            trigger: 'after_miss',
            range: '10_ft',
            oaType: 'missed_attack'
        })
        const result = handler(feature, stats)
        expect(result.trigger).toBe('after_miss')
        expect(result.range).toBe('10_ft')
        expect(result.oaType).toBe('missed_attack')
    })
}, { ...BASE_STATS, attacks: [] })

// ── interception ─────────────────────────────────────────────────────

registerStandardTests('interception', 'interception', {
    type: 'interception',
    trigger: 'ally_within_5ft_attacked',
    range: '5_ft',
    damageExpression: '1d10',
    damageType: '',
    damageBonusExpression: 'proficiency_bonus',
    damageBonus: 3,
    requiresShield: false,
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler) => {
    it('passes through custom fields and replaces falsy with defaults', () => {
        const feature = makeFeature({
            type: 'interception',
            trigger: 'ally_hit',
            range: '10_ft',
            damageExpression: '2d10',
            damageType: 'Bludgeoning',
            damageBonusExpression: 'strength_modifier',
            requiresShield: true
        })
        const result = handler(feature, BASE_STATS)
        expect(result.trigger).toBe('ally_hit')
        expect(result.range).toBe('10_ft')
        expect(result.damageExpression).toBe('2d10')
        expect(result.damageType).toBe('Bludgeoning')
        expect(result.damageBonusExpression).toBe('strength_modifier')
        expect(result.requiresShield).toBe(true)
    })

    it('sets damageBonus from proficiency', () => {
        const highProfStats = { ...BASE_STATS, proficiency: 6 }
        const result = handler(makeFeature({ type: 'interception' }), highProfStats)
        expect(result.damageBonus).toBe(6)
    })
})

// ── protection ───────────────────────────────────────────────────────

registerStandardTests('protection', 'protection', {
    type: 'protection',
    trigger: 'ally_within_5ft_attacked',
    range: '5_ft',
    requiresShield: true,
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler) => {
    it('passes through custom fields and replaces falsy with defaults', () => {
        const feature = makeFeature({ type: 'protection', trigger: 'ally_missed', range: '10_ft' })
        const result = handler(feature, BASE_STATS)
        expect(result.trigger).toBe('ally_missed')
        expect(result.range).toBe('10_ft')
    })

    it('always sets requiresShield to true by default', () => {
        const feature = makeFeature({ type: 'protection', requiresShield: false })
        const result = handler(feature, BASE_STATS)
        expect(result.requiresShield).toBe(true)
    })
})

// ── dread_ambush_damage ──────────────────────────────────────────────

registerStandardTests('dread_ambush_damage', 'dread_ambush_damage', {
    type: 'dread_ambush_damage',
    trigger: '',
    damageExpression: '2d6',
    damageType: 'Psychic',
    oncePerTurn: false,
    uses_expression: '',
    usesMax: 1,
    recharge: 'long_rest',
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler) => {
    it('resolves scaling at level boundaries', () => {
        const feature = makeFeature({ type: 'dread_ambush_damage', damageExpression: '2d6', scaling: { 5: '3d6', 11: '4d6' } })
        expect(handler(feature, { ...BASE_STATS, level: 1 }).damageExpression).toBe('2d6')
        expect(handler(feature, { ...BASE_STATS, level: 5 }).damageExpression).toBe('3d6')
        expect(handler(feature, { ...BASE_STATS, level: 11 }).damageExpression).toBe('4d6')
    })

    it('resolves uses_expression to numeric values', () => {
        expect(handler(makeFeature({ type: 'dread_ambush_damage', uses_expression: 'proficiency_bonus' }), BASE_STATS).usesMax).toBe(3)
        expect(handler(makeFeature({ type: 'dread_ambush_damage', uses_expression: 'level' }), BASE_STATS).usesMax).toBe(5)
    })

    it('passes through custom fields and replaces falsy with defaults', () => {
        const feature = makeFeature({
            type: 'dread_ambush_damage',
            trigger: 'surprise_round',
            damageType: 'Necrotic',
            oncePerTurn: true,
            recharge: 'short_rest'
        })
        const result = handler(feature, BASE_STATS)
        expect(result.trigger).toBe('surprise_round')
        expect(result.damageType).toBe('Necrotic')
        expect(result.oncePerTurn).toBe(true)
        expect(result.recharge).toBe('short_rest')
    })
})

// ── shield ───────────────────────────────────────────────────────────

registerStandardTests('shield', 'shield', {
    type: 'shield',
    casting_time: '1 reaction',
    hasAutomation: true
}, (handler) => {
    it('passes through custom casting_time', () => {
        const feature = makeFeature({ type: 'shield', casting_time: '1 reaction' })
        const result = handler(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 reaction')
    })
})
