// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo', () => {
    describe('null/early-return paths', () => {
        it('returns null when feature has no automation property', () => {
            const feature = { name: 'No Automation' }
            expect(buildAttackInfo(feature, BASE_STATS)).toBeNull()
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

    describe('behavioral assertions — handlers that compute from playerStats', () => {
        it('save_attack computes saveDc from ability, explicit value, or defaults to 10', () => {
            const abilityFeature = makeFeature({ type: 'save_attack', saveDc: 'ability', saveAbility: 'CON' })
            const explicitFeature = makeFeature({ type: 'save_attack', saveDc: 16 })
            const defaultFeature = makeFeature({ type: 'save_attack' })
            // CON bonus is 3, proficiency is 3, so DC = 8 + 3 + 3 = 14
            expect(buildAttackInfo(abilityFeature, BASE_STATS).saveDc).toBe(14)
            expect(buildAttackInfo(abilityFeature, BASE_STATS).saveAbility).toBe('CON')
            expect(buildAttackInfo(abilityFeature, BASE_STATS).saveType).toBe('DEX')
            expect(buildAttackInfo(explicitFeature, BASE_STATS).saveDc).toBe(16)
            expect(buildAttackInfo(defaultFeature, BASE_STATS).saveDc).toBe(10)
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

        it('temp_buff resolves uses from proficiency_bonus, class_level, or fallback', () => {
            const profFeature = makeFeature({ type: 'temp_buff', uses: 'proficiency_bonus' })
            const paladinStats = { ...BASE_STATS, class: { name: 'Paladin' } }
            const paladinFeature = makeFeature({ type: 'temp_buff', uses: 'paladin_level' })
            const rogueStats = { ...BASE_STATS, class: { name: 'Rogue', levels: 3 } }
            const warlockFeature = makeFeature({ type: 'temp_buff', uses: 'warlock_level' })
            expect(buildAttackInfo(profFeature, BASE_STATS).usesMax).toBe(3)
            expect(buildAttackInfo(paladinFeature, paladinStats).usesMax).toBe(5)
            expect(buildAttackInfo(warlockFeature, rogueStats).usesMax).toBe(3)
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

        it('passive_buff returns type "passive_rule" for max_hp_increase, "passive_buff" otherwise', () => {
            const hpFeature = makeFeature({ type: 'passive_buff', effect: 'max_hp_increase' })
            const otherFeature = makeFeature({ type: 'passive_buff', effect: 'ac_bonus' })
            expect(buildAttackInfo(hpFeature, BASE_STATS).type).toBe('passive_rule')
            expect(buildAttackInfo(otherFeature, BASE_STATS).type).toBe('passive_buff')
        })

        it('free_spell computes usesMax from uses_expression or defaults to 1', () => {
            const exprFeature = makeFeature({ type: 'free_spell', uses_expression: '2 + Math.floor(level / 2)' })
            const defaultFeature = makeFeature({ type: 'free_spell' })
            // level=5, so 2 + Math.floor(5/2) = 2 + 2 = 4
            expect(buildAttackInfo(exprFeature, BASE_STATS).usesMax).toBe(4)
            expect(buildAttackInfo(defaultFeature, BASE_STATS).usesMax).toBe(1)
        })

        it('damage_bonus resolves scaling expression by level or uses base', () => {
            const scalingFeature = makeFeature({ type: 'damage_bonus', damageExpression: '1d6', scaling: { '5': '2d6', '11': '3d6' } })
            const noScalingFeature = makeFeature({ type: 'damage_bonus', damageExpression: '1d4', scaling: { '11': '2d6' } })
            // Level 5 should resolve to '2d6'
            expect(buildAttackInfo(scalingFeature, BASE_STATS).damageExpression).toBe('2d6')
            // Level 5 is below all scaling entries, so uses base '1d4'
            expect(buildAttackInfo(noScalingFeature, BASE_STATS).damageExpression).toBe('1d4')
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
    })

    describe('behavioral assertions — handlers that return null', () => {
        it('damage handler returns null for non-feat sources', () => {
            // The damage handler only processes features where source === 'feat'.
            // Missing source (via makeFeature) and explicit non-feat source both return null.
            expect(buildAttackInfo(makeFeature({ type: 'damage' }), BASE_STATS)).toBeNull()
            expect(buildAttackInfo({ name: 'Damage from class', type: 'damage', source: 'class', automation: { type: 'damage' } }, BASE_STATS)).toBeNull()
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
