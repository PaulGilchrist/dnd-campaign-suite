// @cleaned-by-ai
// @improved-by-ai
// ── initiative.test.js ───────────────────────────────────────────────
// Tests for initiative.js — behavior-first, minimal over-mocking
//
// What we test:
//   • Default values are used when automation fields are absent
//   • `uses` and `usesMax` stay in sync from the same source
//   • Custom automation fields are passed through (not hardcoded)
//   • `resourceKey` is derived from `feature.name` via the spec
//   • `feature.name` is forwarded to the result
//
// What we don't test:
//   • Internal implementation details (e.g. which `||` / `??` fallbacks exist)
//   • The `makeFeature` fixture internals

import { describe, it, expect } from 'vitest'
import { initiativeHandlers } from './initiative.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Derive the expected resourceKey from a feature name, matching the
 * implementation in initiative.js exactly.
 */
function expectedResourceKey(name) {
    return name.toLowerCase().replace(/\s+/g, '') + 'Uses'
}

// ── initiative_action ────────────────────────────────────────────────

describe('initiativeHandlers – initiative_action', () => {
    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'initiative_action' })
        const result = initiativeHandlers.initiative_action(feature, BASE_STATS)

        expect(result.type).toBe('initiative_action')
        expect(result.name).toBe('Test Feature')
        expect(result.effect).toBe('')
        expect(result.healExpression).toBe('')
        expect(result.trigger).toBe('roll_initiative')
        expect(result.uses).toBe(1)
        expect(result.usesMax).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.resourceCost).toBe('')
        expect(result.resourceKey).toBe(expectedResourceKey('Test Feature'))
        expect(result.hasAutomation).toBe(true)
    })

    it('uses explicit uses value for both uses and usesMax', () => {
        const feature = makeFeature({
            type: 'initiative_action',
            uses: 3
        })
        const result = initiativeHandlers.initiative_action(feature, BASE_STATS)
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
    })

    it('propagates the feature name and derives resourceKey', () => {
        const feature = makeFeature(
            { type: 'initiative_action' },
            'Extraordinary Luck'
        )
        const result = initiativeHandlers.initiative_action(feature, BASE_STATS)

        expect(result.name).toBe('Extraordinary Luck')
        expect(result.resourceKey).toBe('extraordinaryluckUses')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature(
            {
                type: 'initiative_action',
                effect: 'advantage',
                healExpression: '1d6',
                trigger: 'round_start',
                uses: 3,
                recharge: 'short_rest',
                resourceCost: 'luck_points'
            },
            'Blessed Fortune'
        )
        const result = initiativeHandlers.initiative_action(feature, BASE_STATS)

        expect(result.effect).toBe('advantage')
        expect(result.healExpression).toBe('1d6')
        expect(result.trigger).toBe('round_start')
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.resourceCost).toBe('luck_points')
        expect(result.resourceKey).toBe(expectedResourceKey('Blessed Fortune'))
    })
})
