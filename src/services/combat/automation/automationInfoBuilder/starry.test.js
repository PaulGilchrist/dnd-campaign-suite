// @cleaned-by-ai
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

const CONSTELLATION_OPTIONS = ['Archer', 'Chalice', 'Dragon']

// ── starry_form ──────────────────────────────────────────────────────

describe('starryHandlers – starry_form', () => {
    it('returns correct structure with defaults', () => {
        const result = starryHandlers.starry_form(makeFeature({ type: 'starry_form' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'starry_form', effect: 'starry_form', duration: '1_minute',
            options: CONSTELLATION_OPTIONS, resourceKey: 'starryFormUses', uses: 0, hasAutomation: true,
        })
    })

    it('propagates the feature name', () => {
        const result = starryHandlers.starry_form(makeFeature({ type: 'starry_form' }, 'Starry Form'), BASE_STATS)
        expect(result.name).toBe('Starry Form')
    })

    it('passes through truthy custom fields', () => {
        const result = starryHandlers.starry_form(makeFeature({
            type: 'starry_form', effect: 'starry_form_override', duration: '10_minutes',
            options: ['Archer', 'Chalice', 'Dragon', 'Elementalist'],
            resourceKey: 'customFormUses', uses: 3,
        }), BASE_STATS)
        expect(result).toMatchObject({
            effect: 'starry_form_override', duration: '10_minutes',
            options: ['Archer', 'Chalice', 'Dragon', 'Elementalist'],
            resourceKey: 'customFormUses', uses: 3,
        })
    })

    it('replaces falsy values with defaults', () => {
        const result = starryHandlers.starry_form(makeFeature({
            type: 'starry_form', effect: '', duration: '', resourceKey: '', uses: 0,
        }), BASE_STATS)
        expect(result).toMatchObject({
            effect: 'starry_form', duration: '1_minute',
            options: CONSTELLATION_OPTIONS, resourceKey: 'starryFormUses', uses: 0,
        })
    })
})

// ── cosmic_omen ──────────────────────────────────────────────────────

describe('starryHandlers – cosmic_omen', () => {
    it('returns correct structure with defaults', () => {
        const result = starryHandlers.cosmic_omen(makeFeature({ type: 'cosmic_omen' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'cosmic_omen', usesMax: 0, usesRecharge: 'long_rest',
            action: 'action', casting_time: '1 reaction', hasAutomation: true,
        })
    })

    it('propagates the feature name', () => {
        const result = starryHandlers.cosmic_omen(makeFeature({ type: 'cosmic_omen' }, 'Cosmic Omen'), BASE_STATS)
        expect(result.name).toBe('Cosmic Omen')
    })

    it('resolves uses_expression when provided', () => {
        const result = starryHandlers.cosmic_omen(makeFeature({ type: 'cosmic_omen', uses_expression: 'proficiency_bonus' }), BASE_STATS)
        expect(result.usesMax).toBe(3)
    })

    it('defaults usesMax to 0 when expression evaluates to falsy', () => {
        const result = starryHandlers.cosmic_omen(makeFeature({ type: 'cosmic_omen', uses_expression: '' }), BASE_STATS)
        expect(result.usesMax).toBe(0)
    })

    it('passes through custom fields', () => {
        const result = starryHandlers.cosmic_omen(makeFeature({
            type: 'cosmic_omen', recharge: 'short_rest', action: 'bonus_action', casting_time: '1 bonus action',
        }), BASE_STATS)
        expect(result).toMatchObject({
            usesRecharge: 'short_rest', action: 'bonus_action', casting_time: '1 bonus action',
        })
    })
})

// ── twinkling_constellations ─────────────────────────────────────────

describe('starryHandlers – twinkling_constellations', () => {
    it('returns correct structure with defaults', () => {
        const result = starryHandlers.twinkling_constellations(makeFeature({ type: 'twinkling_constellations' }), BASE_STATS)
        expect(result).toMatchObject({
            type: 'twinkling_constellations', options: CONSTELLATION_OPTIONS, hasAutomation: true,
        })
    })

    it('propagates the feature name', () => {
        const result = starryHandlers.twinkling_constellations(makeFeature({ type: 'twinkling_constellations' }, 'Twinkling'), BASE_STATS)
        expect(result.name).toBe('Twinkling')
    })

    it('passes through custom options', () => {
        const result = starryHandlers.twinkling_constellations(makeFeature({
            type: 'twinkling_constellations', options: ['Archer', 'Chalice', 'Dragon', 'Elementalist'],
        }), BASE_STATS)
        expect(result.options).toEqual(['Archer', 'Chalice', 'Dragon', 'Elementalist'])
    })
})
