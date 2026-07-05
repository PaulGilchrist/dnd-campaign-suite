// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi } from 'vitest'
import { spellHandlers } from './spell.js'
import * as expressModule from '../automationExpressions.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── Shared helpers ───────────────────────────────────────────────────

/**
 * Assert that a handler returns the expected structural properties
 * (type, name, hasAutomation) and passes through a set of custom fields.
 * This replaces the brittle "defaults snapshot + custom fields snapshot"
 * pattern with a single behavioral test per handler.
 */
function expectHandlerPassesThrough(featureType, customFields, expectedOverrides) {
    const feature = makeFeature({ type: featureType, ...customFields })
    const result = spellHandlers[featureType](feature, BASE_STATS)
    for (const [key, value] of Object.entries(expectedOverrides)) {
        if (Array.isArray(value)) {
            expect(result[key]).toEqual(value)
        } else {
            expect(result[key]).toBe(value)
        }
    }
}

// ── free_spell ───────────────────────────────────────────────────────

describe('spellHandlers – free_spell', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'free_spell' })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'free_spell', name: 'Test Feature', hasAutomation: true,
            usesMax: 1, concentration: false, noConcentration: false,
            perSpellTracking: false,
        })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('free_spell', {
        spell: 'fireball', uses: 3, recharge: 'short_rest', action: 'bonus_action',
        duration: '1_minute', concentration: true, resourceCost: 'spell_slot',
        freeCasts: 'once_per_rest', casting_time: '1 action', perSpellTracking: true,
    }, {
        spell: 'fireball', uses: 3, recharge: 'short_rest', action: 'bonus_action',
        duration: '1_minute', concentration: true, resourceCost: 'spell_slot',
        freeCasts: 'once_per_rest', casting_time: '1 action', perSpellTracking: true,
    }))

    it('coerces boolean and number fields to booleans', () => {
        const feature = makeFeature({ type: 'free_spell', concentration: 'yes', noConcentration: 1 })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result.concentration).toBe(true)
        expect(result.noConcentration).toBe(true)
    })

    it('resolves usesMax from uses_expression', () => {
        const evaluateAutoExpression = vi.spyOn(expressModule, 'evaluateAutoExpression').mockReturnValue(5)
        const result = spellHandlers.free_spell(makeFeature({ type: 'free_spell', uses_expression: 'proficiency_bonus' }), BASE_STATS)
        expect(result.usesMax).toBe(5)
        evaluateAutoExpression.mockRestore()
    })

    it('falls back to 1 when uses_expression returns falsy', () => {
        const evaluateAutoExpression = vi.spyOn(expressModule, 'evaluateAutoExpression').mockReturnValue(null)
        const result = spellHandlers.free_spell(makeFeature({ type: 'free_spell', uses_expression: 'proficiency_bonus', uses: 4 }), BASE_STATS)
        expect(result.usesMax).toBe(1)
        evaluateAutoExpression.mockRestore()
    })
})

// ── fey_reinforcements ───────────────────────────────────────────────

describe('spellHandlers – fey_reinforcements', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'fey_reinforcements' })
        const result = spellHandlers.fey_reinforcements(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'fey_reinforcements', hasAutomation: true, usesMax: 1 })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('fey_reinforcements', {
        spell: 'call lightess', uses: 2, recharge: 'short_rest', action: 'bonus_action',
        duration: '1_round', casting_time: '1 reaction',
    }, {
        spell: 'call lightess', uses: 2, recharge: 'short_rest', action: 'bonus_action',
        duration: '1_round', casting_time: '1 reaction',
    }))

    it('resolves usesMax from uses_expression', () => {
        const evaluateAutoExpression = vi.spyOn(expressModule, 'evaluateAutoExpression').mockReturnValue(3)
        const result = spellHandlers.fey_reinforcements(makeFeature({ type: 'fey_reinforcements', uses_expression: 'proficiency_bonus' }), BASE_STATS)
        expect(result.usesMax).toBe(3)
        evaluateAutoExpression.mockRestore()
    })
})

// ── contact_patron ───────────────────────────────────────────────────

describe('spellHandlers – contact_patron', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'contact_patron' })
        const result = spellHandlers.contact_patron(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'contact_patron', hasAutomation: true })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('contact_patron', {
        spell: 'contact other plane', uses: 3, casting_time: '1 action',
    }, { spell: 'contact other plane', uses: 3, casting_time: '1 action' }))
})

// ── dragon_companion ─────────────────────────────────────────────────

describe('spellHandlers – dragon_companion', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'dragon_companion' })
        const result = spellHandlers.dragon_companion(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'dragon_companion', hasAutomation: true, usesMax: 1, noConcentration: false })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('dragon_companion', {
        spell: 'drakonir companion', uses: 2, recharge: 'short_rest', action: 'bonus_action',
    }, { spell: 'drakonir companion', uses: 2, recharge: 'short_rest', action: 'bonus_action' }))

    it('resolves usesMax from uses_expression', () => {
        const evaluateAutoExpression = vi.spyOn(expressModule, 'evaluateAutoExpression').mockReturnValue(4)
        const result = spellHandlers.dragon_companion(makeFeature({ type: 'dragon_companion', uses_expression: 'proficiency_bonus' }), BASE_STATS)
        expect(result.usesMax).toBe(4)
        evaluateAutoExpression.mockRestore()
    })
})

// ── spell_modifier ───────────────────────────────────────────────────

describe('spellHandlers – spell_modifier', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'spell_modifier' })
        const result = spellHandlers.spell_modifier(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'spell_modifier', hasAutomation: true, options: [], resource: 'sorcery_points' })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('spell_modifier', {
        options: [{ name: 'Empowered' }], resource: 'spell_slot',
    }, { options: [{ name: 'Empowered' }], resource: 'spell_slot' }))
})

// ── spell_thief ──────────────────────────────────────────────────────

describe('spellHandlers – spell_thief', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'spell_thief' })
        const result = spellHandlers.spell_thief(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'spell_thief', hasAutomation: true, oncePerLongRest: false })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('spell_thief', {
        saveType: 'WIS', saveDc: 15, saveAbility: 'CHA', trigger: 'spell_miss', oncePerLongRest: true, casting_time: '1 action',
    }, { saveType: 'WIS', saveDc: 15, saveAbility: 'CHA', trigger: 'spell_miss', oncePerLongRest: true, casting_time: '1 action' }))

    it('coerces oncePerLongRest to boolean', () => {
        const result = spellHandlers.spell_thief(makeFeature({ type: 'spell_thief', oncePerLongRest: 'yes' }), BASE_STATS)
        expect(result.oncePerLongRest).toBe(true)
    })
})

// ── war_magic_cantrip ────────────────────────────────────────────────

describe('spellHandlers – war_magic_cantrip', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'war_magic_cantrip' })
        const result = spellHandlers.war_magic_cantrip(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'war_magic_cantrip', hasAutomation: true })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('war_magic_cantrip', {
        spellList: 'sorcerer_cantrips', action: 'bonus_action', casting_time: '1 bonus action',
    }, { spellList: 'sorcerer_cantrips', action: 'bonus_action', casting_time: '1 bonus action' }))
})

// ── war_magic_spell ──────────────────────────────────────────────────

describe('spellHandlers – war_magic_spell', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'war_magic_spell' })
        const result = spellHandlers.war_magic_spell(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'war_magic_spell', hasAutomation: true, replacesWarMagic: false })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('war_magic_spell', {
        spellList: 'sorcerer_spells', maxSpellLevel: 3, replacesWarMagic: true, action: 'bonus_action',
    }, { spellList: 'sorcerer_spells', maxSpellLevel: 3, replacesWarMagic: true, action: 'bonus_action' }))

    it('coerces replacesWarMagic to boolean', () => {
        const result = spellHandlers.war_magic_spell(makeFeature({ type: 'war_magic_spell', replacesWarMagic: 'yes' }), BASE_STATS)
        expect(result.replacesWarMagic).toBe(true)
    })
})

// ── arcane_charge ────────────────────────────────────────────────────

describe('spellHandlers – arcane_charge', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'arcane_charge' })
        const result = spellHandlers.arcane_charge(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'arcane_charge', hasAutomation: true })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('arcane_charge', {
        distance: '60 ft', casting_time: '1 bonus action',
    }, { distance: '60 ft', casting_time: '1 bonus action' }))
})

// ── guarded_mind ─────────────────────────────────────────────────────

describe('spellHandlers – guarded_mind', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'guarded_mind' })
        const result = spellHandlers.guarded_mind(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'guarded_mind', hasAutomation: true })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('guarded_mind', {
        resource: 'sorcery_points', action: 'bonus_action', casting_time: '1 bonus action',
    }, { resource: 'sorcery_points', action: 'bonus_action', casting_time: '1 bonus action' }))
})

// ── bulwark_of_force ─────────────────────────────────────────────────

describe('spellHandlers – bulwark_of_force', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'bulwark_of_force' })
        const result = spellHandlers.bulwark_of_force(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'bulwark_of_force', hasAutomation: true })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('bulwark_of_force', {
        range: '60_ft', duration: '1_minute', casting_time: '1 action',
    }, { range: '60_ft', duration: '1_minute', casting_time: '1 action' }))
})

// ── signature_spells ─────────────────────────────────────────────────

describe('spellHandlers – signature_spells', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'signature_spells' })
        const result = spellHandlers.signature_spells(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'signature_spells', hasAutomation: true })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('signature_spells', {
        action: 'bonus_action', casting_time: '1 action',
    }, { action: 'bonus_action', casting_time: '1 action' }))
})

// ── spell_mastery ────────────────────────────────────────────────────

describe('spellHandlers – spell_mastery', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'spell_mastery' })
        const result = spellHandlers.spell_mastery(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'spell_mastery', hasAutomation: true })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('spell_mastery', {
        action: 'bonus_action', casting_time: '1 action',
    }, { action: 'bonus_action', casting_time: '1 action' }))
})

// ── overchannel ──────────────────────────────────────────────────────

describe('spellHandlers – overchannel', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'overchannel' })
        const result = spellHandlers.overchannel(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'overchannel', hasAutomation: true, effect: 'overchannel' })
    })

    it('passes through custom casting_time', () => {
        const result = spellHandlers.overchannel(makeFeature({ type: 'overchannel', casting_time: '1 action' }), BASE_STATS)
        expect(result.casting_time).toBe('1 action')
    })
})

// ── pass_without_trace ───────────────────────────────────────────────

describe('spellHandlers – pass_without_trace', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'pass_without_trace' })
        const result = spellHandlers.pass_without_trace(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'pass_without_trace', hasAutomation: true })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('pass_without_trace', {
        duration: '8_hours', auraRange: 60, casting_time: '1 bonus action',
    }, { duration: '8_hours', auraRange: 60, casting_time: '1 bonus action' }))
})

// ── warding_bond ─────────────────────────────────────────────────────

describe('spellHandlers – warding_bond', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'warding_bond' })
        const result = spellHandlers.warding_bond(feature, BASE_STATS)
        expect(result).toMatchObject({ type: 'warding_bond', hasAutomation: true })
    })

    it('passes through custom fields', () => expectHandlerPassesThrough('warding_bond', {
        range: '30 ft', duration: '8 hours', casting_time: '1 reaction',
    }, { range: '30 ft', duration: '8 hours', casting_time: '1 reaction' }))
})
