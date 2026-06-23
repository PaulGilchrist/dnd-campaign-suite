// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { conditionalHandlers } from './conditional.js'
import { BASE_STATS } from '../automationInfoBuilder.fixtures.js'

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Creates a feature with the given automation shape, wrapping it
 * in the same structure that `makeFeature` produces so the handler
 * sees a real feature object (even when automation is nullish).
 */
function featureWith(automation, name = 'Test Feature') {
    return { name, automation }
}

// ── conditional_advantage ────────────────────────────────────────────

describe('conditional_advantage', () => {
    it('returns correct shape with full automation data', () => {
        const feature = featureWith({
            type: 'conditional_advantage',
            target: 'ability_check',
            condition: 'adjacent_to_enemy',
            effect: 'advantage',
            abilities: ['STR', 'DEX'],
            uses: 3,
            recharge: 'short_rest',
            casting_time: '1 action',
            trigger: 'on_spell_cast'
        })
        const result = conditionalHandlers.conditional_advantage(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'conditional_advantage',
            name: 'Test Feature',
            target: 'ability_check',
            condition: 'adjacent_to_enemy',
            effect: 'advantage',
            abilities: ['STR', 'DEX'],
            uses: 3,
            recharge: 'short_rest',
            casting_time: '1 action',
            trigger: 'on_spell_cast',
            hasAutomation: true
        })
    })

    it('applies defaults when automation is an empty object', () => {
        const feature = featureWith({})
        const result = conditionalHandlers.conditional_advantage(feature, BASE_STATS)

        expect(result.target).toBe('saving_throw')
        expect(result.condition).toBe('')
        expect(result.effect).toBe('advantage')
        expect(result.abilities).toEqual([])
        expect(result.uses).toBeNull()
        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('passive')
        expect(result.trigger).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('throws when feature has no automation property', () => {
        const feature = { name: 'No Automation Feature' }
        expect(() => conditionalHandlers.conditional_advantage(feature, BASE_STATS)).toThrow()
    })

    it('throws when automation is null', () => {
        const feature = featureWith(null)
        expect(() => conditionalHandlers.conditional_advantage(feature, BASE_STATS)).toThrow()
    })

    it('throws when automation is undefined', () => {
        const feature = featureWith(undefined)
        expect(() => conditionalHandlers.conditional_advantage(feature, BASE_STATS)).toThrow()
    })

    it('passes through custom feature name', () => {
        const feature = featureWith({ condition: 'flanking' }, 'Flanking Strike')
        const result = conditionalHandlers.conditional_advantage(feature, BASE_STATS)
        expect(result.name).toBe('Flanking Strike')
    })

    it('ignores the playerStats parameter', () => {
        const feature = featureWith({ condition: 'test' })
        const result = conditionalHandlers.conditional_advantage(feature, BASE_STATS)
        expect(result.condition).toBe('test')
    })
})

// ── conditional_disadvantage ─────────────────────────────────────────

describe('conditional_disadvantage', () => {
    it('returns correct shape with full automation data', () => {
        const feature = featureWith({
            type: 'conditional_disadvantage',
            target: 'saving_throw',
            condition: 'below_half_hp',
            effect: 'disadvantage',
            abilities: ['CON']
        })
        const result = conditionalHandlers.conditional_disadvantage(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'conditional_disadvantage',
            name: 'Test Feature',
            target: 'saving_throw',
            condition: 'below_half_hp',
            effect: 'disadvantage',
            abilities: ['CON'],
            hasAutomation: true
        })
    })

    it('applies defaults when automation is an empty object', () => {
        const feature = featureWith({})
        const result = conditionalHandlers.conditional_disadvantage(feature, BASE_STATS)

        expect(result.target).toBe('attack_roll')
        expect(result.condition).toBe('')
        expect(result.effect).toBe('disadvantage')
        expect(result.abilities).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('throws when feature has no automation property', () => {
        const feature = { name: 'No Automation Feature' }
        expect(() => conditionalHandlers.conditional_disadvantage(feature, BASE_STATS)).toThrow()
    })

    it('throws when automation is null or undefined', () => {
        expect(() => conditionalHandlers.conditional_disadvantage(featureWith(null), BASE_STATS)).toThrow()
        expect(() => conditionalHandlers.conditional_disadvantage(featureWith(undefined), BASE_STATS)).toThrow()
    })

    it('ignores the playerStats parameter', () => {
        const feature = featureWith({ condition: 'prone' })
        const result = conditionalHandlers.conditional_disadvantage(feature, BASE_STATS)
        expect(result.condition).toBe('prone')
    })
})

// ── conditional_replacement ──────────────────────────────────────────

describe('conditional_replacement', () => {
    it('returns correct shape with full automation data', () => {
        const feature = featureWith({
            type: 'conditional_replacement',
            target: 'ability_check',
            saveType: 'DEX',
            condition: 'stealthed',
            effect: 'replace_on_stealth',
            replacementAbility: 'DEX'
        })
        const result = conditionalHandlers.conditional_replacement(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'conditional_replacement',
            name: 'Test Feature',
            target: 'ability_check',
            saveType: 'DEX',
            condition: 'stealthed',
            effect: 'replace_on_stealth',
            replacementAbility: 'DEX',
            hasAutomation: true
        })
    })

    it('applies defaults when automation is an empty object', () => {
        const feature = featureWith({})
        const result = conditionalHandlers.conditional_replacement(feature, BASE_STATS)

        expect(result.target).toBe('saving_throw')
        expect(result.saveType).toBe('')
        expect(result.condition).toBe('')
        expect(result.effect).toBe('')
        expect(result.replacementAbility).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('throws when feature has no automation property', () => {
        const feature = { name: 'No Automation Feature' }
        expect(() => conditionalHandlers.conditional_replacement(feature, BASE_STATS)).toThrow()
    })

    it('throws when automation is null or undefined', () => {
        expect(() => conditionalHandlers.conditional_replacement(featureWith(null), BASE_STATS)).toThrow()
        expect(() => conditionalHandlers.conditional_replacement(featureWith(undefined), BASE_STATS)).toThrow()
    })

    it('ignores the playerStats parameter', () => {
        const feature = featureWith({ saveType: 'CON' })
        const result = conditionalHandlers.conditional_replacement(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
    })
})

// ── condition_immunity_while_active ──────────────────────────────────

describe('condition_immunity_while_active', () => {
    it('returns correct shape with full automation data', () => {
        const feature = featureWith({
            type: 'condition_immunity_while_active',
            target: 'allies_in_range',
            immunities: ['charmed', 'frightened'],
            requiresActive: 'aura_of_protection'
        })
        const result = conditionalHandlers.condition_immunity_while_active(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'condition_immunity_while_active',
            name: 'Test Feature',
            target: 'allies_in_range',
            immunities: ['charmed', 'frightened'],
            requiresActive: 'aura_of_protection',
            hasAutomation: true
        })
    })

    it('applies defaults when automation is an empty object', () => {
        const feature = featureWith({})
        const result = conditionalHandlers.condition_immunity_while_active(feature, BASE_STATS)

        expect(result.target).toBe('self')
        expect(result.immunities).toEqual([])
        expect(result.requiresActive).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('throws when feature has no automation property', () => {
        const feature = { name: 'No Automation Feature' }
        expect(() => conditionalHandlers.condition_immunity_while_active(feature, BASE_STATS)).toThrow()
    })

    it('throws when automation is null or undefined', () => {
        expect(() => conditionalHandlers.condition_immunity_while_active(featureWith(null), BASE_STATS)).toThrow()
        expect(() => conditionalHandlers.condition_immunity_while_active(featureWith(undefined), BASE_STATS)).toThrow()
    })

    it('ignores the playerStats parameter', () => {
        const feature = featureWith({ requiresActive: 'paladin_aura' })
        const result = conditionalHandlers.condition_immunity_while_active(feature, BASE_STATS)
        expect(result.requiresActive).toBe('paladin_aura')
    })
})

// ── evasion ──────────────────────────────────────────────────────────

describe('evasion', () => {
    it('returns correct shape with full automation data', () => {
        const feature = featureWith({
            type: 'evasion',
            saveType: 'CON',
            shareable: true,
            shareRange: 30
        })
        const result = conditionalHandlers.evasion(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'evasion',
            name: 'Test Feature',
            saveType: 'CON',
            shareable: true,
            shareRange: 30,
            hasAutomation: true
        })
    })

    it('applies defaults when automation is an empty object', () => {
        const feature = featureWith({})
        const result = conditionalHandlers.evasion(feature, BASE_STATS)

        expect(result.saveType).toBe('DEX')
        expect(result.shareable).toBe(false)
        expect(result.shareRange).toBe(0)
        expect(result.hasAutomation).toBe(true)
    })

    it('coerces shareable to boolean for truthy values', () => {
        const feature = featureWith({ shareable: 'yes' })
        const result = conditionalHandlers.evasion(feature, BASE_STATS)
        expect(result.shareable).toBe(true)
    })

    it('coerces shareable to boolean for falsy values', () => {
        const feature = featureWith({ shareable: 0 })
        const result = conditionalHandlers.evasion(feature, BASE_STATS)
        expect(result.shareable).toBe(false)
    })

    it('throws when feature has no automation property', () => {
        const feature = { name: 'No Automation Feature' }
        expect(() => conditionalHandlers.evasion(feature, BASE_STATS)).toThrow()
    })

    it('throws when automation is null or undefined', () => {
        expect(() => conditionalHandlers.evasion(featureWith(null), BASE_STATS)).toThrow()
        expect(() => conditionalHandlers.evasion(featureWith(undefined), BASE_STATS)).toThrow()
    })

    it('ignores the playerStats parameter', () => {
        const feature = featureWith({ saveType: 'WIS' })
        const result = conditionalHandlers.evasion(feature, BASE_STATS)
        expect(result.saveType).toBe('WIS')
    })
})

// ── save_proficiency ─────────────────────────────────────────────────

describe('save_proficiency', () => {
    it('returns correct shape with full automation data', () => {
        const feature = featureWith({
            type: 'save_proficiency',
            saveType: 'WIS',
            fallbackTypes: ['INT', 'CHA']
        })
        const result = conditionalHandlers.save_proficiency(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'save_proficiency',
            name: 'Test Feature',
            saveType: 'WIS',
            fallbackTypes: ['INT', 'CHA'],
            hasAutomation: true
        })
    })

    it('applies defaults when automation is an empty object', () => {
        const feature = featureWith({})
        const result = conditionalHandlers.save_proficiency(feature, BASE_STATS)

        expect(result.saveType).toBe('')
        expect(result.fallbackTypes).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('throws when feature has no automation property', () => {
        const feature = { name: 'No Automation Feature' }
        expect(() => conditionalHandlers.save_proficiency(feature, BASE_STATS)).toThrow()
    })

    it('throws when automation is null or undefined', () => {
        expect(() => conditionalHandlers.save_proficiency(featureWith(null), BASE_STATS)).toThrow()
        expect(() => conditionalHandlers.save_proficiency(featureWith(undefined), BASE_STATS)).toThrow()
    })

    it('ignores the playerStats parameter', () => {
        const feature = featureWith({ saveType: 'CON' })
        const result = conditionalHandlers.save_proficiency(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
    })
})

// ── passive_rule ─────────────────────────────────────────────────────

describe('passive_rule', () => {
    it('returns ignore_resistance shape with only relevant fields', () => {
        const feature = featureWith({
            type: 'passive_rule',
            effect: 'ignore_resistance',
            damageTypes: ['fire', 'cold']
        })
        const result = conditionalHandlers.passive_rule(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'passive_rule',
            name: 'Test Feature',
            effect: 'ignore_resistance',
            damageTypes: ['fire', 'cold'],
            hasAutomation: true
        })
        // Verify the shape is minimal — no attack-related fields
        expect(result).not.toHaveProperty('criticalRange')
        expect(result).not.toHaveProperty('bonusExpression')
        expect(result).not.toHaveProperty('spells')
        expect(result).not.toHaveProperty('riderSave')
        expect(result).not.toHaveProperty('resistanceTypes')
    })

    it('defaults damageTypes to empty array for ignore_resistance', () => {
        const feature = featureWith({ effect: 'ignore_resistance' })
        const result = conditionalHandlers.passive_rule(feature, BASE_STATS)
        expect(result.damageTypes).toEqual([])
    })

    it('returns generic shape for non-ignore_resistance effects', () => {
        const feature = featureWith({
            type: 'passive_rule',
            effect: 'critical_range',
            criticalRange: '18-20',
            bonusExpression: '+2d6',
            spells: ['fire bolt', 'thunderwave'],
            riderSave: 'DEX',
            casting_time: '1 action',
            cost: 2,
            resource: 'sorcery_points',
            resistanceTypes: ['fire', 'cold'],
            duration: '1_minute',
            endsOnCondition: 'blinded'
        })
        const result = conditionalHandlers.passive_rule(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'passive_rule',
            name: 'Test Feature',
            effect: 'critical_range',
            criticalRange: '18-20',
            bonusExpression: '+2d6',
            spells: ['fire bolt', 'thunderwave'],
            riderSave: 'DEX',
            primalKnowledge: [],
            casting_time: '1 action',
            cost: 2,
            resource: 'sorcery_points',
            resistanceTypes: ['fire', 'cold'],
            duration: '1_minute',
            endsOnCondition: 'blinded',
            hasAutomation: true
        })
    })

    it('defaults all generic fields to empty string, null, or 0', () => {
        const feature = featureWith({ effect: 'something_else' })
        const result = conditionalHandlers.passive_rule(feature, BASE_STATS)

        expect(result.bonusExpression).toBe('')
        expect(result.criticalRange).toBe('')
        expect(result.spells).toEqual([])
        expect(result.riderSave).toBeNull()
        expect(result.primalKnowledge).toEqual([])
        expect(result.casting_time).toBe('')
        expect(result.cost).toBe(0)
        expect(result.resource).toBe('')
        expect(result.resistanceTypes).toEqual([])
        expect(result.duration).toBe('')
        expect(result.endsOnCondition).toBe('')
    })

    it('defaults effect to empty string when omitted', () => {
        const feature = featureWith({})
        const result = conditionalHandlers.passive_rule(feature, BASE_STATS)
        expect(result.effect).toBe('')
    })

    it('maps skills to primalKnowledge in generic shape', () => {
        const feature = featureWith({
            effect: 'critical_range',
            skills: ['stealth', 'deception']
        })
        const result = conditionalHandlers.passive_rule(feature, BASE_STATS)
        expect(result.primalKnowledge).toEqual(['stealth', 'deception'])
    })

    it('throws when feature has no automation property', () => {
        const feature = { name: 'No Automation Feature' }
        expect(() => conditionalHandlers.passive_rule(feature, BASE_STATS)).toThrow()
    })

    it('throws when automation is null or undefined', () => {
        expect(() => conditionalHandlers.passive_rule(featureWith(null), BASE_STATS)).toThrow()
        expect(() => conditionalHandlers.passive_rule(featureWith(undefined), BASE_STATS)).toThrow()
    })

    it('ignores the playerStats parameter', () => {
        const feature = featureWith({ effect: 'ignore_resistance', damageTypes: ['lightning'] })
        const result = conditionalHandlers.passive_rule(feature, BASE_STATS)
        expect(result.damageTypes).toEqual(['lightning'])
    })
})
