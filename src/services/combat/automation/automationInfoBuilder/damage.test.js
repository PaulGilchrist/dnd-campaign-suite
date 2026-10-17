// @maintained-by-ai
// ── Canonical unit home for the damage lane (family split map:
// automationInfoBuilder.test.js — damage_bonus / damage feat-gate / GWF
// feat-shape are pinned HERE; automationCollector.coverage.test.js cites
// this file for the great_weapon_fighting feat-shape). Dice stay VERBATIM
// strings from JSON — the builder never pre-evaluates damage; the executor
// owns the math (#2090 split, mn020 save-half class). No clocks (#no-timers).
// spell_breaker is NOT built in this lane — on disk it rides passive_rule
// envelopes through the collector/class-feature lanes (#2101: verified,
// nothing here overlaps, nothing to dedupe).
import { describe, it, expect, vi } from 'vitest'
import { damageHandlers } from './damage.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

vi.mock('../automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn((expr, stats) => {
        if (!expr) return 0
        if (expr === 'proficiency_bonus') return stats.proficiency || 0
        // Unknown expressions resolve falsy so the `|| 1` usesMax fallback is
        // genuinely probed, not masked by a truthy mock return.
        return 0
    })
}))

describe('damageHandlers – damage_bonus', () => {
    it('returns damage_bonus envelope with documented defaults', () => {
        const result = damageHandlers.damage_bonus(makeFeature({ type: 'damage_bonus' }), BASE_STATS)
        expect(result.type).toBe('damage_bonus')
        expect(result.name).toBe('Test Feature')
        expect(result.trigger).toBe('')
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('')
        expect(result.maxDamage).toBe('')
        expect(result.extraVs).toBeNull()
        expect(result.extraDamage).toBe('')
        expect(result.extraDamageExpression).toBe('')
        expect(result.extraDamageType).toBe('')
        expect(result.resourceType).toBe('spell_slot')
        expect(result.oncePerTurn).toBe(false)
        expect(result.options).toEqual([])
        expect(result.tempHpExpression).toBe('')
        expect(result.upgrades).toBe('')
        expect(result.rangeBonusCantrip).toBe('')
        expect(result.uses_expression).toBe('')
        expect(result.usesMax).toBe(0)
        expect(result.recharge).toBe('')
        expect(result.abilityIncreased).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves damageExpression through level tiers, highest matching tier wins', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        for (const [level, expected] of [[1, '1d6'], [5, '2d6'], [11, '3d6'], [20, '3d6']]) {
            const result = damageHandlers.damage_bonus(feature, { ...BASE_STATS, level })
            expect(result.damageExpression, `level ${level}`).toBe(expected)
        }
    })

    it('resolves usesMax from expression, flat uses, or 1-fallback', () => {
        const fromExpr = damageHandlers.damage_bonus(
            makeFeature({ type: 'damage_bonus', uses_expression: 'proficiency_bonus' }), BASE_STATS)
        expect(fromExpr.usesMax).toBe(3)

        const flat = damageHandlers.damage_bonus(
            makeFeature({ type: 'damage_bonus', uses: 5 }), BASE_STATS)
        expect(flat.usesMax).toBe(5)

        const fallback = damageHandlers.damage_bonus(
            makeFeature({ type: 'damage_bonus', uses_expression: 'unknown_expr' }), BASE_STATS)
        expect(fallback.usesMax).toBe(1)
    })

    it('passes through every custom field verbatim and coerces oncePerTurn to boolean', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '8d6',
            trigger: 'hit',
            damageType: 'Fire',
            maxDamage: '20',
            extraVs: 'undead',
            extraDamage: '1d6',
            extraDamageExpression: '2d6',
            extraDamageType: 'Thunder',
            resourceType: 'ki_pool',
            oncePerTurn: 'yes',
            options: ['option1'],
            tempHpExpression: '2d8',
            upgrades: 'upgrade_v2',
            rangeBonusCantrip: '+10ft',
            recharge: 'short_rest',
            abilityIncreased: 'STR'
        })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.damageExpression).toBe('8d6')
        expect(result.trigger).toBe('hit')
        expect(result.damageType).toBe('Fire')
        expect(result.maxDamage).toBe('20')
        expect(result.extraVs).toBe('undead')
        expect(result.extraDamage).toBe('1d6')
        expect(result.extraDamageExpression).toBe('2d6')
        expect(result.extraDamageType).toBe('Thunder')
        expect(result.resourceType).toBe('ki_pool')
        expect(result.oncePerTurn).toBe(true)
        expect(result.options).toEqual(['option1'])
        expect(result.tempHpExpression).toBe('2d8')
        expect(result.upgrades).toBe('upgrade_v2')
        expect(result.rangeBonusCantrip).toBe('+10ft')
        expect(result.recharge).toBe('short_rest')
        expect(result.abilityIncreased).toBe('STR')
    })
})

describe('damageHandlers – damage_modifier', () => {
    it('builds the modifier envelope: defaults on bare feature, verbatim passthrough when set', () => {
        const defaults = damageHandlers.damage_modifier(makeFeature({ type: 'damage_modifier' }), BASE_STATS)
        expect(defaults.type).toBe('damage_modifier')
        expect(defaults.name).toBe('Test Feature')
        expect(defaults.trigger).toBe('')
        expect(defaults.modifierExpression).toBe('')
        expect(defaults.hasAutomation).toBe(true)

        const custom = damageHandlers.damage_modifier(
            makeFeature({ type: 'damage_modifier', trigger: 'after_spell_cast', modifierExpression: '+2d6' }),
            BASE_STATS)
        expect(custom.trigger).toBe('after_spell_cast')
        expect(custom.modifierExpression).toBe('+2d6')
    })
})

describe('damageHandlers – damage_type_modifier', () => {
    it('builds the envelope: empty lists on bare feature, verbatim passthrough when set', () => {
        const defaults = damageHandlers.damage_type_modifier(makeFeature({ type: 'damage_type_modifier' }), BASE_STATS)
        expect(defaults.type).toBe('damage_type_modifier')
        expect(defaults.name).toBe('Test Feature')
        expect(defaults.trigger).toBe('')
        expect(defaults.weaponTypes).toEqual([])
        expect(defaults.options).toEqual([])
        expect(defaults.hasAutomation).toBe(true)

        const custom = damageHandlers.damage_type_modifier(
            makeFeature({
                type: 'damage_type_modifier',
                trigger: 'on_hit',
                weaponTypes: ['melee', 'ranged'],
                options: ['fire', 'cold']
            }),
            BASE_STATS)
        expect(custom.trigger).toBe('on_hit')
        expect(custom.weaponTypes).toEqual(['melee', 'ranged'])
        expect(custom.options).toEqual(['fire', 'cold'])
    })
})

describe('damageHandlers – damage_type_choice', () => {
    it('defaults to passive choice, passes custom fields through, coerces minDamage', () => {
        const defaults = damageHandlers.damage_type_choice(makeFeature({ type: 'damage_type_choice' }), BASE_STATS)
        expect(defaults.type).toBe('damage_type_choice')
        expect(defaults.name).toBe('Test Feature')
        expect(defaults.damageTypes).toEqual([])
        expect(defaults.effect).toBe('')
        expect(defaults.casting_time).toBe('passive')
        expect(defaults.minDamage).toBe(false)
        expect(defaults.hasAutomation).toBe(true)

        const custom = damageHandlers.damage_type_choice(
            makeFeature({
                type: 'damage_type_choice',
                damageTypes: ['fire', 'cold', 'lightning'],
                effect: 'elemental_adept',
                casting_time: '1 bonus action',
                minDamage: 'yes'
            }),
            BASE_STATS)
        expect(custom.damageTypes).toEqual(['fire', 'cold', 'lightning'])
        expect(custom.effect).toBe('elemental_adept')
        expect(custom.casting_time).toBe('1 bonus action')
        expect(custom.minDamage).toBe(true)
    })
})

describe('damageHandlers – weapon_mastery_choice', () => {
    it('defaults effect to extra_mastery, passes custom mastery fields through', () => {
        const defaults = damageHandlers.weapon_mastery_choice(makeFeature({ type: 'weapon_mastery_choice' }), BASE_STATS)
        expect(defaults.type).toBe('weapon_mastery_choice')
        expect(defaults.name).toBe('Test Feature')
        expect(defaults.description).toBe('')
        expect(defaults.masteryProperties).toEqual([])
        expect(defaults.effect).toBe('extra_mastery')
        expect(defaults.casting_time).toBe('passive')
        expect(defaults.hasAutomation).toBe(true)

        const custom = damageHandlers.weapon_mastery_choice(
            makeFeature({
                type: 'weapon_mastery_choice',
                masteryProperties: ['push', 'topple'],
                effect: 'extra_damage',
                casting_time: '1 action'
            }),
            BASE_STATS)
        expect(custom.masteryProperties).toEqual(['push', 'topple'])
        expect(custom.effect).toBe('extra_damage')
        expect(custom.casting_time).toBe('1 action')
    })
})

describe('damageHandlers – damage_reduction', () => {
    it('returns damage_reduction info with defaults', () => {
        const result = damageHandlers.damage_reduction(makeFeature({ type: 'damage_reduction' }), BASE_STATS)
        expect(result.type).toBe('damage_reduction')
        expect(result.name).toBe('Test Feature')
        expect(result.reductionExpression).toBe('')
        expect(result.trigger).toBe('')
        expect(result.reaction).toBe(false)
        expect(result.redirect).toBe(false)
        expect(result.redirectCost).toBeNull()
        expect(result.redirectDamage).toBe('')
        expect(result.redirectSave).toBe('DEX')
        expect(result.cost).toBeNull()
        expect(result.damageTypes).toEqual([])
        expect(result.condition).toBe('')
        expect(result.effect).toBe('')
        expect(result.requiresShield).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields and coerces requiresShield to boolean', () => {
        const feature = makeFeature({
            type: 'damage_reduction',
            reductionExpression: '2d8',
            trigger: 'damage_taken',
            reaction: true,
            redirect: true,
            redirectCost: 1,
            redirectDamage: '1d6',
            redirectSave: 'CON',
            cost: 2,
            damageTypes: ['fire', 'cold'],
            condition: 'wearing_heavy_armor',
            effect: 'shield_wall',
            requiresShield: 'yes'
        })
        const result = damageHandlers.damage_reduction(feature, BASE_STATS)
        expect(result.reductionExpression).toBe('2d8')
        expect(result.trigger).toBe('damage_taken')
        expect(result.reaction).toBe(true)
        expect(result.redirect).toBe(true)
        expect(result.redirectCost).toBe(1)
        expect(result.redirectDamage).toBe('1d6')
        expect(result.redirectSave).toBe('CON')
        expect(result.cost).toBe(2)
        expect(result.damageTypes).toEqual(['fire', 'cold'])
        expect(result.condition).toBe('wearing_heavy_armor')
        expect(result.effect).toBe('shield_wall')
        expect(result.requiresShield).toBe(true)
    })
})

describe('damageHandlers – damage_aura', () => {
    it('defaults range/duration/recharge, passes custom aura fields through', () => {
        const defaults = damageHandlers.damage_aura(makeFeature({ type: 'damage_aura' }), BASE_STATS)
        expect(defaults.type).toBe('damage_aura')
        expect(defaults.name).toBe('Test Feature')
        expect(defaults.damageType).toBe('')
        expect(defaults.damageExpression).toBe('')
        expect(defaults.range).toBe('10_ft')
        expect(defaults.duration).toBe('1_minute')
        expect(defaults.recharge).toBe('long_rest')
        expect(defaults.hasAutomation).toBe(true)

        const custom = damageHandlers.damage_aura(
            makeFeature({
                type: 'damage_aura',
                damageType: 'Radiant',
                damageExpression: '2d6',
                range: '15_ft',
                duration: '10_minutes',
                recharge: 'short_rest'
            }),
            BASE_STATS)
        expect(custom.damageType).toBe('Radiant')
        expect(custom.damageExpression).toBe('2d6')
        expect(custom.range).toBe('15_ft')
        expect(custom.duration).toBe('10_minutes')
        expect(custom.recharge).toBe('short_rest')
    })
})

describe('damageHandlers – psionic_strike', () => {
    it('returns psionic_strike info with defaults', () => {
        const result = damageHandlers.psionic_strike(makeFeature({ type: 'psionic_strike' }), BASE_STATS)
        expect(result.type).toBe('psionic_strike')
        expect(result.name).toBe('Test Feature')
        expect(result.resource).toBe('psionicEnergy')
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('Force')
        expect(result.oncePerTurn).toBe(false)
        expect(result.trigger).toBe('after_attack_hit')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields and coerces oncePerTurn to boolean', () => {
        const feature = makeFeature({
            type: 'psionic_strike',
            resource: 'psionicPoints',
            damageExpression: '2d8',
            damageType: 'Psychic',
            oncePerTurn: 'yes',
            trigger: 'on_kill'
        })
        const result = damageHandlers.psionic_strike(feature, BASE_STATS)
        expect(result.resource).toBe('psionicPoints')
        expect(result.damageExpression).toBe('2d8')
        expect(result.damageType).toBe('Psychic')
        expect(result.oncePerTurn).toBe(true)
        expect(result.trigger).toBe('on_kill')
    })
})

describe('damageHandlers – primal_companion_double_strike_damage', () => {
    function rangerWithHunterMark(level, spellSlots) {
        return {
            ...BASE_STATS,
            level,
            class: { name: 'Ranger', major: { features: [{ name: 'Bestial Fury' }] } },
            concentration: { spell: "Hunter's Mark", target: 'Orc' },
            spellAbilities: spellSlots
        }
    }
    const doubleStrike = () => makeFeature({
        type: 'primal_companion_double_strike_damage',
        damageExpression: '1d6',
        damageType: 'Force',
        oncePerTurn: true
    })

    it('returns damage_bonus envelope with companion hit trigger, JSON fields verbatim', () => {
        const result = damageHandlers.primal_companion_double_strike_damage(doubleStrike(), BASE_STATS)
        expect(result.type).toBe('damage_bonus')
        expect(result.name).toBe('Test Feature')
        expect(result.trigger).toBe('companion_beasts_strike_hit')
        expect(result.damageExpression).toBe('1d6')
        expect(result.damageType).toBe('Force')
        expect(result.oncePerTurn).toBe(true)
        expect(result.hasAutomation).toBe(true)
    })

    it('falls back to JSON damageExpression when the Hunter\'s Mark lane does not apply', () => {
        // No concentration at all.
        const noConcentration = {
            ...BASE_STATS,
            class: { name: 'Ranger', major: { features: [{ name: 'Bestial Fury' }] } }
        }
        expect(damageHandlers.primal_companion_double_strike_damage(doubleStrike(), noConcentration).damageExpression).toBe('1d6')

        // Hunter's Mark concentrated but no spell slots recorded — highest-slot lookup finds nothing.
        const noSlots = rangerWithHunterMark(5, { spell_slots_level_1: 0, spell_slots_level_3: 0, spell_slots_level_5: 0, spell_slots_level_7: 0 })
        expect(damageHandlers.primal_companion_double_strike_damage(doubleStrike(), noSlots).damageExpression).toBe('1d6')
    })

    it.each([
        ['1st-level slot', 5, { spell_slots_level_1: 4 }, '1d6'],
        ['3rd-level slot', 11, { spell_slots_level_1: 0, spell_slots_level_3: 2 }, '1d8'],
        ['5th-level slot', 15, { spell_slots_level_5: 1 }, '1d10'],
        ['7th-level slot', 17, { spell_slots_level_7: 1 }, '1d12'],
    ])('scales Hunter\'s Mark strike with highest slot: %s at level %i → %s', (_label, level, slots, expected) => {
        const result = damageHandlers.primal_companion_double_strike_damage(doubleStrike(), rangerWithHunterMark(level, slots))
        expect(result.damageExpression).toBe(expected)
    })

    it('caps the strike at 1d10 for level-20 Foe Slayer regardless of slot level', () => {
        // 7th-level slot would scale to 1d12 — the level-20 cap must win.
        const result = damageHandlers.primal_companion_double_strike_damage(
            doubleStrike(), rangerWithHunterMark(20, { spell_slots_level_7: 1 }))
        expect(result.damageExpression).toBe('1d10')
    })

    it('does not apply Hunter\'s Mark logic for non-Ranger classes', () => {
        const wizardStats = {
            ...BASE_STATS,
            class: { name: 'Wizard', major: { features: [] } },
            concentration: { spell: "Hunter's Mark", target: 'Orc' },
            spellAbilities: { spell_slots_level_3: 2 }
        }
        const feature = makeFeature({ type: 'primal_companion_double_strike_damage', damageExpression: '2d6', damageType: 'Force', oncePerTurn: true })
        expect(damageHandlers.primal_companion_double_strike_damage(feature, wizardStats).damageExpression).toBe('2d6')
    })
})

describe('damageHandlers – passive_rule feat handlers', () => {
    it('wraps each passive damage feat in a passive_rule envelope carrying its own effect key', () => {
        for (const type of ['great_weapon_fighting', 'grapple_damage', 'two_weapon_fighting', 'reroll_damage_once_per_turn']) {
            const result = damageHandlers[type](makeFeature({ type }), BASE_STATS)
            expect(result.type, type).toBe('passive_rule')
            expect(result.effect, type).toBe(type)
            expect(result.name, type).toBe('Test Feature')
            expect(result.hasAutomation, type).toBe(true)
        }
    })
})

describe('damageHandlers – damage feat-source gate', () => {
    it.each([
        ['bare generic damage feature', { type: 'damage', name: 'Generic', automation: { type: 'damage' } }],
        ['non-feat source with matching automation', { type: 'damage', source: 'class', name: 'Some Feature', automation: { type: 'great_weapon_fighting' } }],
        ['feat with mismatched automation type', { type: 'damage', source: 'feat', name: 'Some Feature', automation: { type: 'other_type' } }],
    ])('returns null for %s', (_label, feature) => {
        expect(damageHandlers.damage(feature, BASE_STATS)).toBeNull()
    })

    // Canonical GWF feat-shape — cited by automationCollector.coverage.test.js
    // header as owned here; do not remove from either lane without checking both.
    it.each([
        ['great_weapon_fighting', { type: 'damage', source: 'feat', name: 'Great Weapon Fighting', automation: { type: 'great_weapon_fighting' } }],
        ['two_weapon_fighting', { type: 'two_weapon_fighting', source: 'feat', name: 'Two-Weapon Fighting', automation: { type: 'two_weapon_fighting' } }],
    ])('maps feat-sourced %s to a passive_rule envelope', (effect, feature) => {
        const result = damageHandlers.damage(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe(effect)
        expect(result.name).toBe(feature.name)
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – piercer_puncture', () => {
    it('defaults to single-die reroll reaction, passes custom fields through', () => {
        const defaults = damageHandlers.piercer_puncture(makeFeature({ type: 'piercer_puncture' }), BASE_STATS)
        expect(defaults.type).toBe('piercer_puncture')
        expect(defaults.name).toBe('Test Feature')
        expect(defaults.effect).toBe('reroll_damage_die')
        expect(defaults.rerollCount).toBe(1)
        expect(defaults.oncePerTurn).toBe(false)
        expect(defaults.mustUseNew).toBe(false)
        expect(defaults.casting_time).toBe('reaction')
        expect(defaults.hasAutomation).toBe(true)

        const custom = damageHandlers.piercer_puncture(
            makeFeature({
                type: 'piercer_puncture',
                effect: 'puncture_extra_die',
                rerollCount: 2,
                oncePerTurn: true,
                mustUseNew: true,
                casting_time: 'free_action'
            }),
            BASE_STATS)
        expect(custom.effect).toBe('puncture_extra_die')
        expect(custom.rerollCount).toBe(2)
        expect(custom.oncePerTurn).toBe(true)
        expect(custom.mustUseNew).toBe(true)
        expect(custom.casting_time).toBe('free_action')
    })
})
