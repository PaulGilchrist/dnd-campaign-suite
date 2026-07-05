// @cleaned-by-ai
// @improved-by-ai
// ── diverse.test.js ──────────────────────────────────────────────────
// Tests for diverse.js — behavior-first, minimal over-mocking
//
// What we test:
//   • Each handler returns the correct `type` and `hasAutomation`
//   • Default values are used when automation fields are missing/absent
//   • Custom automation fields are passed through unchanged
//   • `feature.name` is forwarded to the result
//   • Boolean coercion with !! works correctly
//   • resourceKey generation from feature name (extra_action)
//
// What we don't test:
//   • Internal implementation details (e.g. which `||` fallbacks exist)
//   • The `makeFeature` fixture internals

import { describe, it, expect } from 'vitest'
import { diverseHandlers } from './diverse.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── Helpers ──────────────────────────────────────────────────────────

function expectValidResult(result, expectedType, expectedName) {
    expect(result).toBeInstanceOf(Object)
    expect(result.type).toBe(expectedType)
    expect(result.name).toBe(expectedName)
    expect(result.hasAutomation).toBe(true)
}

// ── divine_intervention ──────────────────────────────────────────────

describe('diverseHandlers – divine_intervention', () => {
    it('returns correct structure with default automation fields', () => {
        const feature = makeFeature({ type: 'divine_intervention' })
        const result = diverseHandlers.divine_intervention(feature, BASE_STATS)

        expectValidResult(result, 'divine_intervention', 'Test Feature')
        expect(result.recharge).toBe('long_rest')
        expect(result.upgradeTo).toBe('')
        expect(result.casting_time).toBe('1 action')
    })

    it('passes through custom automation fields and uses defaults for falsy values', () => {
        const feature = makeFeature(
            {
                type: 'divine_intervention',
                recharge: 'short_rest',
                upgradeTo: 'greater_intervention',
                casting_time: '1 reaction'
            },
            'Divine Intervention'
        )
        const result = diverseHandlers.divine_intervention(feature, BASE_STATS)

        expect(result.name).toBe('Divine Intervention')
        expect(result.recharge).toBe('short_rest')
        expect(result.upgradeTo).toBe('greater_intervention')
        expect(result.casting_time).toBe('1 reaction')
    })

    it('uses defaults when automation fields are falsy', () => {
        const feature = makeFeature({
            type: 'divine_intervention',
            recharge: null,
            upgradeTo: null,
            casting_time: null
        })
        const result = diverseHandlers.divine_intervention(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
        expect(result.upgradeTo).toBe('')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── extra_action ─────────────────────────────────────────────────────

describe('diverseHandlers – extra_action', () => {
    it('returns correct structure with default automation fields', () => {
        const feature = makeFeature({ type: 'extra_action' })
        const result = diverseHandlers.extra_action(feature, BASE_STATS)

        expectValidResult(result, 'extra_action', 'Test Feature')
        expect(result.uses).toBe(1)
        expect(result.recharge).toBe('short_rest')
        expect(result.oncePerTurn).toBe(false)
        expect(result.oncePerCombat).toBe(false)
        expect(result.firstRoundOnly).toBe(false)
        expect(result.resourceKey).toBe('testfeatureUses')
    })

    it('generates resourceKey from feature name by lowercasing and removing spaces', () => {
        const feature = makeFeature({ type: 'extra_action' }, 'Extra Attack')
        const result = diverseHandlers.extra_action(feature, BASE_STATS)
        expect(result.resourceKey).toBe('extraattackUses')
    })

    it('coerces boolean fields with !!', () => {
        const feature = makeFeature({
            type: 'extra_action',
            oncePerTurn: 'yes',
            oncePerCombat: 1,
            firstRoundOnly: 0
        })
        const result = diverseHandlers.extra_action(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
        expect(result.oncePerCombat).toBe(true)
        expect(result.firstRoundOnly).toBe(false)
    })

    it('passes through custom automation fields', () => {
        const feature = makeFeature(
            {
                type: 'extra_action',
                uses: 3,
                recharge: 'long_rest',
                oncePerTurn: true,
                oncePerCombat: true,
                firstRoundOnly: true
            },
            'Limited Use Action'
        )
        const result = diverseHandlers.extra_action(feature, BASE_STATS)

        expect(result.name).toBe('Limited Use Action')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('long_rest')
        expect(result.oncePerTurn).toBe(true)
        expect(result.oncePerCombat).toBe(true)
        expect(result.firstRoundOnly).toBe(true)
    })
})

// ── font_of_magic ────────────────────────────────────────────────────

describe('diverseHandlers – font_of_magic', () => {
    it('returns correct structure with default casting_time', () => {
        const feature = makeFeature({ type: 'font_of_magic' })
        const result = diverseHandlers.font_of_magic(feature, BASE_STATS)

        expectValidResult(result, 'font_of_magic', 'Test Feature')
        expect(result.casting_time).toBe('1 bonus action')
    })

    it('passes through custom casting_time and uses default for falsy', () => {
        const feature = makeFeature(
            { type: 'font_of_magic', casting_time: '1 action' },
            'Font of Magic'
        )
        const result = diverseHandlers.font_of_magic(feature, BASE_STATS)

        expect(result.name).toBe('Font of Magic')
        expect(result.casting_time).toBe('1 action')

        const feature2 = makeFeature({ type: 'font_of_magic', casting_time: null })
        const result2 = diverseHandlers.font_of_magic(feature2, BASE_STATS)
        expect(result2.casting_time).toBe('1 bonus action')
    })
})

// ── font_of_inspiration ──────────────────────────────────────────────

describe('diverseHandlers – font_of_inspiration', () => {
    it('returns correct structure with default casting_time', () => {
        const feature = makeFeature({ type: 'font_of_inspiration' })
        const result = diverseHandlers.font_of_inspiration(feature, BASE_STATS)

        expectValidResult(result, 'font_of_inspiration', 'Test Feature')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through custom casting_time and uses default for falsy', () => {
        const feature = makeFeature(
            { type: 'font_of_inspiration', casting_time: '1 action' },
            'Inspiration Font'
        )
        const result = diverseHandlers.font_of_inspiration(feature, BASE_STATS)

        expect(result.name).toBe('Inspiration Font')
        expect(result.casting_time).toBe('1 action')

        const feature2 = makeFeature({ type: 'font_of_inspiration', casting_time: '' })
        const result2 = diverseHandlers.font_of_inspiration(feature2, BASE_STATS)
        expect(result2.casting_time).toBe('passive')
    })
})

// ── meta ─────────────────────────────────────────────────────────────

describe('diverseHandlers – meta', () => {
    it('returns correct structure with default effect', () => {
        const feature = makeFeature({ type: 'meta' })
        const result = diverseHandlers.meta(feature, BASE_STATS)

        expectValidResult(result, 'meta', 'Test Feature')
        expect(result.effect).toBe('')
    })

    it('passes through custom effect and uses default for falsy', () => {
        const feature = makeFeature(
            { type: 'meta', effect: 'heroic_inspiration_on_long_rest' },
            'Meta Ability'
        )
        const result = diverseHandlers.meta(feature, BASE_STATS)

        expect(result.name).toBe('Meta Ability')
        expect(result.effect).toBe('heroic_inspiration_on_long_rest')

        const feature2 = makeFeature({ type: 'meta', effect: null })
        const result2 = diverseHandlers.meta(feature2, BASE_STATS)
        expect(result2.effect).toBe('')
    })
})

// ── jack_of_all_trades ───────────────────────────────────────────────

describe('diverseHandlers – jack_of_all_trades', () => {
    it('returns correct structure and works when feature has no automation property', () => {
        const feature = makeFeature({ type: 'jack_of_all_trades' })
        const result = diverseHandlers.jack_of_all_trades(feature, BASE_STATS)

        expectValidResult(result, 'jack_of_all_trades', 'Test Feature')

        const feature2 = { name: 'Jack of All Trades' }
        const result2 = diverseHandlers.jack_of_all_trades(feature2, BASE_STATS)

        expect(result2.type).toBe('jack_of_all_trades')
        expect(result2.name).toBe('Jack of All Trades')
        expect(result2.hasAutomation).toBe(true)
    })
})

// ── reliable_talent ──────────────────────────────────────────────────

describe('diverseHandlers – reliable_talent', () => {
    it('returns correct structure and works when feature has no automation property', () => {
        const feature = makeFeature({ type: 'reliable_talent' })
        const result = diverseHandlers.reliable_talent(feature, BASE_STATS)

        expectValidResult(result, 'reliable_talent', 'Test Feature')

        const feature2 = { name: 'Reliable Talent' }
        const result2 = diverseHandlers.reliable_talent(feature2, BASE_STATS)

        expect(result2.type).toBe('reliable_talent')
        expect(result2.name).toBe('Reliable Talent')
        expect(result2.hasAutomation).toBe(true)
    })
})

// ── divine_order ─────────────────────────────────────────────────────

describe('diverseHandlers – divine_order', () => {
    it('returns correct structure and works when feature has no automation property', () => {
        const feature = makeFeature({ type: 'divine_order' })
        const result = diverseHandlers.divine_order(feature, BASE_STATS)

        expectValidResult(result, 'divine_order', 'Test Feature')

        const feature2 = { name: 'Divine Order' }
        const result2 = diverseHandlers.divine_order(feature2, BASE_STATS)

        expect(result2.type).toBe('divine_order')
        expect(result2.name).toBe('Divine Order')
        expect(result2.hasAutomation).toBe(true)
    })
})
