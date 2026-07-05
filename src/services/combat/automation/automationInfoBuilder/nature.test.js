// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { natureHandlers } from './nature.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('natureHandlers – nature_sanctuary', () => {
    it('returns nature_sanctuary info with defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'nature_sanctuary' })
        const result = natureHandlers.nature_sanctuary(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'nature_sanctuary',
            name: 'Test Feature',
            range: '120_ft',
            cubeSize: 15,
            duration: '1_minute',
            moveRange: 60,
            movesPerDuration: 1,
            resourceCost: 'wild_shape',
            hasAutomation: true
        })
    })

    it('uses feature.name from the feature object', () => {
        const feature = makeFeature({ type: 'nature_sanctuary' }, 'Wild Heart')
        const result = natureHandlers.nature_sanctuary(feature, BASE_STATS)
        expect(result.name).toBe('Wild Heart')
    })

    it('respects custom automation values', () => {
        const feature = makeFeature({
            type: 'nature_sanctuary',
            range: '60_ft',
            cubeSize: 20,
            duration: '10_minutes',
            moveRange: 30,
            movesPerDuration: 2,
            resourceCost: 'hit_dice'
        })
        const result = natureHandlers.nature_sanctuary(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
        expect(result.cubeSize).toBe(20)
        expect(result.duration).toBe('10_minutes')
        expect(result.moveRange).toBe(30)
        expect(result.movesPerDuration).toBe(2)
        expect(result.resourceCost).toBe('hit_dice')
    })
})

describe('natureHandlers – nature_sanctuary_move', () => {
    it('returns nature_sanctuary_move info with defaults', () => {
        const feature = makeFeature({ type: 'nature_sanctuary_move' })
        const result = natureHandlers.nature_sanctuary_move(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'nature_sanctuary_move',
            name: 'Test Feature',
            action: 'bonus_action',
            moveRange: 60,
            hasAutomation: true
        })
    })

    it('uses feature.name from the feature object', () => {
        const feature = makeFeature({ type: 'nature_sanctuary_move' }, 'Swift Shift')
        const result = natureHandlers.nature_sanctuary_move(feature, BASE_STATS)
        expect(result.name).toBe('Swift Shift')
    })

    it('respects custom moveRange', () => {
        const feature = makeFeature({
            type: 'nature_sanctuary_move',
            moveRange: 30
        })
        const result = natureHandlers.nature_sanctuary_move(feature, BASE_STATS)
        expect(result.moveRange).toBe(30)
    })
})
