// @improved-by-ai
import { describe, it, expect, vi } from 'vitest'

import { starryHandlers } from './starry.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

vi.mock('./automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn((expr, _stats) => {
        if (!expr) return 0
        return 2
    }),
}))

// ── Helpers ──────────────────────────────────────────────────────────

const CONSTELLATION_OPTIONS = ['Archer', 'Chalice', 'Dragon']

/**
 * Assert that every non-optional field in the default result matches
 * its expected default value.  This replaces the brittle pattern of
 * individually asserting properties one by one.
 */
function expectDefaultResult(result, expectedDefaults) {
    for (const [key, value] of Object.entries(expectedDefaults)) {
        expect(result, `default: ${key}`).toHaveProperty(key, value)
    }
}

// ── starry_form ──────────────────────────────────────────────────────

describe('starryHandlers – starry_form', () => {
    const defaults = {
        type: 'starry_form',
        effect: 'starry_form',
        duration: '1_minute',
        options: CONSTELLATION_OPTIONS,
        resourceKey: 'starryFormUses',
        uses: 0,
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'starry_form' })
        const result = starryHandlers.starry_form(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'starry_form' }, 'Starry Form')
        const result = starryHandlers.starry_form(feature, BASE_STATS)
        expect(result.name).toBe('Starry Form')
    })

    it('passes through truthy custom fields and replaces falsy with defaults', () => {
        const feature = makeFeature({
            type: 'starry_form',
            effect: 'starry_form_override',
            duration: '10_minutes',
            options: ['Archer', 'Chalice', 'Dragon', 'Elementalist'],
            resourceKey: 'customFormUses',
            uses: 3
        })
        const result = starryHandlers.starry_form(feature, BASE_STATS)
        expect(result.effect).toBe('starry_form_override')
        expect(result.duration).toBe('10_minutes')
        expect(result.options).toEqual(['Archer', 'Chalice', 'Dragon', 'Elementalist'])
        expect(result.resourceKey).toBe('customFormUses')
        expect(result.uses).toBe(3)
    })

    it('coerces explicit false/empty values correctly', () => {
        const feature = makeFeature({
            type: 'starry_form',
            effect: '',
            duration: '',
            resourceKey: '',
            uses: 0
        })
        const result = starryHandlers.starry_form(feature, BASE_STATS)
        expect(result.effect).toBe('starry_form')
        expect(result.duration).toBe('1_minute')
        expect(result.options).toEqual(CONSTELLATION_OPTIONS)
        expect(result.resourceKey).toBe('starryFormUses')
        expect(result.uses).toBe(0)
    })
})

// ── cosmic_omen ──────────────────────────────────────────────────────

describe('starryHandlers – cosmic_omen', () => {
    const defaults = {
        type: 'cosmic_omen',
        usesMax: 0,
        usesRecharge: 'long_rest',
        action: 'action',
        casting_time: '1 action',
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'cosmic_omen' })
        const result = starryHandlers.cosmic_omen(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'cosmic_omen' }, 'Cosmic Omen')
        const result = starryHandlers.cosmic_omen(feature, BASE_STATS)
        expect(result.name).toBe('Cosmic Omen')
    })

    it('resolves uses_expression when provided', () => {
        const feature = makeFeature({
            type: 'cosmic_omen',
            uses_expression: 'proficiency_bonus'
        })
        const result = starryHandlers.cosmic_omen(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })

    it('defaults usesMax to 0 when expression evaluates to falsy', () => {
        const feature = makeFeature({
            type: 'cosmic_omen',
            uses_expression: ''
        })
        const result = starryHandlers.cosmic_omen(feature, BASE_STATS)
        expect(result.usesMax).toBe(0)
    })

    it('passes through custom fields and replaces falsy with defaults', () => {
        const feature = makeFeature({
            type: 'cosmic_omen',
            recharge: 'short_rest',
            action: 'bonus_action',
            casting_time: '1 bonus action'
        })
        const result = starryHandlers.cosmic_omen(feature, BASE_STATS)
        expect(result.usesRecharge).toBe('short_rest')
        expect(result.action).toBe('bonus_action')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── twinkling_constellations ─────────────────────────────────────────

describe('starryHandlers – twinkling_constellations', () => {
    const defaults = {
        type: 'twinkling_constellations',
        options: CONSTELLATION_OPTIONS,
        hasAutomation: true
    }

    it('returns all default values when automation is empty', () => {
        const feature = makeFeature({ type: 'twinkling_constellations' })
        const result = starryHandlers.twinkling_constellations(feature, BASE_STATS)
        expectDefaultResult(result, defaults)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'twinkling_constellations' }, 'Twinkling')
        const result = starryHandlers.twinkling_constellations(feature, BASE_STATS)
        expect(result.name).toBe('Twinkling')
    })

    it('passes through custom options and replaces falsy with defaults', () => {
        const feature = makeFeature({
            type: 'twinkling_constellations',
            options: ['Archer', 'Chalice', 'Dragon', 'Elementalist']
        })
        const result = starryHandlers.twinkling_constellations(feature, BASE_STATS)
        expect(result.options).toEqual(['Archer', 'Chalice', 'Dragon', 'Elementalist'])
    })
})
