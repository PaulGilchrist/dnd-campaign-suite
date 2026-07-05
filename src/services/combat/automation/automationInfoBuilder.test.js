// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo', () => {
    describe('null/early-return paths', () => {
        it('returns null when feature has no automation property', () => {
            const feature = { name: 'No Automation' }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })

        it('returns null when automation is null or undefined', () => {
            expect(buildAttackInfo({ name: 'Null Auto', automation: null }, BASE_STATS)).toBeNull()
            expect(buildAttackInfo({ name: 'Undefined Auto', automation: undefined }, BASE_STATS)).toBeNull()
        })

        it('returns null for unknown automation type or missing type', () => {
            expect(buildAttackInfo(makeFeature({ type: 'nonexistent_type' }), BASE_STATS)).toBeNull()
            expect(buildAttackInfo(makeFeature({ foo: 'bar' }), BASE_STATS)).toBeNull()
        })
    })

    describe('dispatch correctness — representative handler coverage', () => {
        // Representative behavioral tests across handler categories.
        // The DISPATCH map in automationInfoBuilder.js merges 21 handler modules.
        // This test verifies that each handler category produces a non-null result
        // with the expected type and hasAutomation flag.
        const representativeTypes = [
            // attack.js
            { type: 'attack_rider', expectedType: 'attack_rider' },
            { type: 'bonus_action_attack', expectedType: 'bonus_action_attack' },
            // save.js
            { type: 'save_attack', expectedType: 'save_attack' },
            { type: 'sleep', expectedType: 'sleep' },
            // passive.js
            { type: 'passive_buff', expectedType: 'passive_buff' },
            { type: 'passive_immunity', expectedType: 'passive_immunity' },
            { type: 'ignore_resistance', expectedType: 'passive_rule' },
            // combatStance.js
            { type: 'combat_stance', expectedType: 'combat_stance' },
            // bardic.js
            { type: 'bardic_inspiration', expectedType: 'bardic_inspiration' },
            // damage.js
            { type: 'damage_bonus', expectedType: 'damage_bonus' },
            { type: 'great_weapon_fighting', expectedType: 'passive_rule' },
            // healing.js
            { type: 'healing', expectedType: 'healing' },
            { type: 'healing_pool', expectedType: 'healing_pool' },
            // reaction.js
            { type: 'reaction_damage', expectedType: 'reaction_damage' },
            { type: 'reaction_save', expectedType: 'reaction_save' },
            // resource.js
            { type: 'resource_pool', expectedType: 'resource_pool' },
            // spell.js
            { type: 'free_spell', expectedType: 'free_spell' },
            { type: 'warding_bond', expectedType: 'warding_bond' },
            // diverse.js
            { type: 'extra_action', expectedType: 'extra_action' },
            { type: 'font_of_magic', expectedType: 'font_of_magic' },
            // misc.js
            { type: 'auto_effect', expectedType: 'auto_effect' },
            { type: 'resistance', expectedType: 'resistance' },
            // nature.js
            { type: 'nature_sanctuary', expectedType: 'nature_sanctuary' },
            // primal.js
            { type: 'primal_companion_summon', expectedType: 'primal_companion_summon' },
            // psionic.js
            { type: 'psychic_spells', expectedType: 'psychic_spells' },
            // sorcery.js
            { type: 'sorcery_aura', expectedType: 'sorcery_aura' },
            // starry.js
            { type: 'starry_form', expectedType: 'starry_form' },
            // temp.js
            { type: 'temp_buff', expectedType: 'temp_buff' },
            { type: 'holy_nimbus', expectedType: 'holy_nimbus' },
            // conditional.js
            { type: 'conditional_advantage', expectedType: 'conditional_advantage' },
            { type: 'passive_rule', expectedType: 'passive_rule' },
            // initiative.js
            { type: 'initiative_action', expectedType: 'initiative_action' },
        ]

        for (const { type, expectedType } of representativeTypes) {
            it(`dispatches "${type}" and returns correct type`, () => {
                const feature = makeFeature({ type })
                const result = buildAttackInfo(feature, BASE_STATS)
                expect(result).not.toBeNull()
                expect(result.type).toBe(expectedType)
                expect(result.hasAutomation).toBe(true)
                expect(typeof result.name).toBe('string')
            })
        }
    })

    describe('behavioral assertions — handlers that compute from playerStats', () => {
        it('save_attack computes saveDc from ability scores when saveDc is "ability"', () => {
            const feature = makeFeature({
                type: 'save_attack',
                saveDc: 'ability',
                saveAbility: 'CON',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // CON bonus is 3 in BASE_STATS, so DC = 8 + 3 + proficiency(3) = 14
            expect(result.saveDc).toBe(14)
            expect(result.saveAbility).toBe('CON')
            expect(result.saveType).toBe('DEX')
        })

        it('save_attack uses explicit saveDc when provided', () => {
            const feature = makeFeature({
                type: 'save_attack',
                saveDc: 16,
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.saveDc).toBe(16)
        })

        it('save_attack defaults saveDc to 10 when not "ability" and no explicit value', () => {
            const feature = makeFeature({ type: 'save_attack' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.saveDc).toBe(10)
        })

        it('healing returns healExpression string when expression cannot be evaluated numerically', () => {
            const feature = makeFeature({
                type: 'healing',
                healExpression: '2d8+4',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.type).toBe('healing')
            // When evaluateAutoExpression returns the expression string (unparsed dice),
            // the handler stores it as-is
            expect(typeof result.healAmount).not.toBe('number')
            expect(result.action).toBe('action')
        })

        it('bardic_inspiration computes dieSize from class levels', () => {
            const stats = {
                ...BASE_STATS,
                class: {
                    class_levels: [{ level: 5, bardic_die: 8 }],
                },
            }
            const feature = makeFeature({ type: 'bardic_inspiration' })
            const result = buildAttackInfo(feature, stats)
            expect(result).not.toBeNull()
            expect(result.dieSize).toBe(8)
        })

        it('bardic_inspiration defaults dieSize to 6 when no class level found', () => {
            const stats = { ...BASE_STATS }
            const feature = makeFeature({ type: 'bardic_inspiration' })
            const result = buildAttackInfo(feature, stats)
            expect(result.dieSize).toBe(6)
        })

        it('combat_stance includes resourceKey and uses', () => {
            const feature = makeFeature({
                type: 'combat_stance',
                resourceKey: 'customResource',
                uses: 2,
                effect: 'rage',
                damageBonusExpression: '1d8',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.resourceKey).toBe('customResource')
            expect(result.uses).toBe(2)
            expect(result.effect).toBe('rage')
            expect(result.damageBonusExpression).toBe('1d8')
        })

        it('reaction_damage computes saveDc from WIS when saveDc is "ability"', () => {
            const feature = makeFeature({
                type: 'reaction_damage',
                saveDc: 'ability',
                saveAbility: 'WIS',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // WIS bonus is 5, proficiency is 3, so DC = 8 + 5 + 3 = 16
            expect(result.saveDc).toBe(16)
            expect(result.saveAbility).toBe('WIS')
        })

        it('reaction_damage returns null saveDc when saveDc is neither "ability" nor explicit', () => {
            const feature = makeFeature({
                type: 'reaction_damage',
                saveAbility: 'WIS',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.saveDc).toBeNull()
        })

        it('temp_buff resolves uses="proficiency_bonus" from stats', () => {
            const feature = makeFeature({
                type: 'temp_buff',
                uses: 'proficiency_bonus',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.usesMax).toBe(3)
        })

        it('temp_buff resolves uses="paladin_level" when class matches', () => {
            const stats = {
                ...BASE_STATS,
                class: { name: 'Paladin' },
            }
            const feature = makeFeature({
                type: 'temp_buff',
                uses: 'paladin_level',
            })
            const result = buildAttackInfo(feature, stats)
            expect(result).not.toBeNull()
            expect(result.usesMax).toBe(5)
        })

        it('temp_buff resolves uses="warlock_level" when class does not match', () => {
            const stats = {
                ...BASE_STATS,
                class: { name: 'Rogue', levels: 3 },
            }
            const feature = makeFeature({
                type: 'temp_buff',
                uses: 'warlock_level',
            })
            const result = buildAttackInfo(feature, stats)
            expect(result).not.toBeNull()
            expect(result.usesMax).toBe(3)
        })

        it('glorious_defense computes acBonus from CHA modifier', () => {
            const feature = makeFeature({
                type: 'glorious_defense',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // CHA bonus is 2, so acBonus = Math.max(1, 2) = 2
            expect(result.acBonus).toBe(2)
            expect(result.usesMax).toBe(2)
        })

        it('beguiling_defenses computes saveDc from CHA when saveDc is "ability"', () => {
            const feature = makeFeature({
                type: 'beguiling_defenses',
                saveDc: 'ability',
                saveAbility: 'CHA',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // CHA bonus is 2, proficiency is 3, so DC = 8 + 2 + 3 = 13
            expect(result.saveDc).toBe(13)
        })

        it('reaction_counterspell computes saveBonus from CHA and proficiency', () => {
            const feature = makeFeature({
                type: 'reaction_counterspell',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // CHA bonus is 2, proficiency is 3, so saveBonus = 8 + 2 + 3 = 13
            expect(result.saveBonus).toBe(13)
        })

        it('passive_buff with max_hp_increase returns type "passive_rule"', () => {
            const feature = makeFeature({
                type: 'passive_buff',
                effect: 'max_hp_increase',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.type).toBe('passive_rule')
        })

        it('passive_buff without special effect returns type "passive_buff"', () => {
            const feature = makeFeature({
                type: 'passive_buff',
                effect: 'ac_bonus',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.type).toBe('passive_buff')
        })

        it('free_spell computes usesMax from uses_expression', () => {
            const feature = makeFeature({
                type: 'free_spell',
                uses_expression: '2 + Math.floor(level / 2)',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // level=5, so 2 + Math.floor(5/2) = 2 + 2 = 4
            expect(result.usesMax).toBe(4)
        })

        it('free_spell defaults usesMax to 1 when no uses_expression', () => {
            const feature = makeFeature({
                type: 'free_spell',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.usesMax).toBe(1)
        })

        it('damage_bonus resolves scaling expression by level', () => {
            const feature = makeFeature({
                type: 'damage_bonus',
                damageExpression: '1d6',
                scaling: { '5': '2d6', '11': '3d6' },
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // Level 5 should resolve to '2d6'
            expect(result.damageExpression).toBe('2d6')
        })

        it('damage_bonus uses base expression when level below all scaling entries', () => {
            const feature = makeFeature({
                type: 'damage_bonus',
                damageExpression: '1d4',
                scaling: { '11': '2d6' },
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.damageExpression).toBe('1d4')
        })

        it('attack_rider resolves scaling expression by level', () => {
            const feature = makeFeature({
                type: 'attack_rider',
                damageExpression: '1d4',
                scaling: { '5': '2d4', '11': '3d4' },
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.damageExpression).toBe('2d4')
        })
    })

    describe('behavioral assertions — handlers with default values', () => {
        it('extra_action defaults uses to 1 and recharge to short_rest', () => {
            const feature = makeFeature({ type: 'extra_action' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.uses).toBe(1)
            expect(result.recharge).toBe('short_rest')
            // resourceKey is built from feature.name: 'testfeature' + 'Uses'
            expect(result.resourceKey).toBe('testfeatureUses')
        })

        it('auto_effect defaults trigger and effect to empty strings', () => {
            const feature = makeFeature({ type: 'auto_effect' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.trigger).toBe('')
            expect(result.effect).toBe('')
            expect(result.recharge).toBe('long_rest')
        })

        it('resource_pool defaults casting_time to passive', () => {
            const feature = makeFeature({ type: 'resource_pool' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.casting_time).toBe('passive')
        })

        it('initiative_action defaults uses to 1 and recharge to long_rest', () => {
            const feature = makeFeature({ type: 'initiative_action' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.uses).toBe(1)
            expect(result.usesMax).toBe(1)
            expect(result.recharge).toBe('long_rest')
        })

        it('diverse handlers without automation object properties still work', () => {
            const feature = makeFeature({ type: 'jack_of_all_trades' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.type).toBe('jack_of_all_trades')
            expect(result.hasAutomation).toBe(true)
        })
    })

    describe('behavioral assertions — handlers that return null', () => {
        it('damage handler returns null when feature has no matching type and source', () => {
            // makeFeature({ type: 'damage' }) creates automation: { type: 'damage' }
            // The damage handler checks feature.type === 'damage' && feature.source === 'feat'
            // But makeFeature doesn't set feature.type or feature.source
            const feature = makeFeature({ type: 'damage' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })

        it('damage handler returns null when feature type is "damage" but source is not "feat"', () => {
            const feature = {
                name: 'Damage from class',
                type: 'damage',
                source: 'class',
                automation: { type: 'damage' },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })
    })

    describe('name passthrough', () => {
        it('preserves custom feature name across multiple handler types', () => {
            const names = ['Flaming Strike', 'Shield of Faith', 'Hunter\'s Mark']
            const types = ['attack_rider', 'passive_buff', 'save_attack']

            for (let i = 0; i < names.length; i++) {
                const feature = makeFeature({ type: types[i] }, names[i])
                const result = buildAttackInfo(feature, BASE_STATS)
                expect(result).not.toBeNull()
                expect(result.name).toBe(names[i])
            }
        })
    })
})
