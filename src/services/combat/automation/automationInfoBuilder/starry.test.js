import { describe, it, expect } from 'vitest'
import { starryHandlers } from './starry.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('starryHandlers – starry_form', () => {
    it('returns starry_form info with defaults', () => {
        const feature = makeFeature({ type: 'starry_form' })
        const result = starryHandlers.starry_form(feature, BASE_STATS)
        expect(result.type).toBe('starry_form')
        expect(result.effect).toBe('starry_form')
        expect(result.duration).toBe('1_minute')
        expect(result.options).toEqual(['Archer', 'Chalice', 'Dragon'])
        expect(result.resourceKey).toBe('starryFormUses')
        expect(result.uses).toBe(0)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'starry_form',
            effect: 'starry_form_override',
            duration: '10_minutes',
            resourceKey: 'customFormUses',
            uses: 3
        })
        const result = starryHandlers.starry_form(feature, BASE_STATS)
        expect(result.effect).toBe('starry_form_override')
        expect(result.duration).toBe('10_minutes')
        expect(result.resourceKey).toBe('customFormUses')
        expect(result.uses).toBe(3)
    })
})

describe('starryHandlers – cosmic_omen', () => {
    it('returns cosmic_omen info with defaults', () => {
        const feature = makeFeature({ type: 'cosmic_omen' })
        const result = starryHandlers.cosmic_omen(feature, BASE_STATS)
        expect(result.type).toBe('cosmic_omen')
        expect(result.usesMax).toBe(0)
        expect(result.usesRecharge).toBe('long_rest')
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves uses_expression', () => {
        const feature = makeFeature({
            type: 'cosmic_omen',
            uses_expression: 'proficiency_bonus'
        })
        const result = starryHandlers.cosmic_omen(feature, BASE_STATS)
        expect(result.usesMax).toBe(3) // mocked value
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'cosmic_omen',
            action: 'bonus_action',
            casting_time: '1 bonus action'
        })
        const result = starryHandlers.cosmic_omen(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

describe('starryHandlers – twinkling_constellations', () => {
    it('returns twinkling_constellations info with defaults', () => {
        const feature = makeFeature({ type: 'twinkling_constellations' })
        const result = starryHandlers.twinkling_constellations(feature, BASE_STATS)
        expect(result.type).toBe('twinkling_constellations')
        expect(result.options).toEqual(['Archer', 'Chalice', 'Dragon'])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'twinkling_constellations',
            options: ['Archer', 'Chalice', 'Dragon', 'Elementalist']
        })
        const result = starryHandlers.twinkling_constellations(feature, BASE_STATS)
        expect(result.options).toEqual(['Archer', 'Chalice', 'Dragon', 'Elementalist'])
    })
})
