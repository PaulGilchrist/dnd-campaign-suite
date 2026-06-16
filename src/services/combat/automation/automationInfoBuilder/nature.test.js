import { describe, it, expect } from 'vitest'
import { natureHandlers } from './nature.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('natureHandlers – nature_sanctuary', () => {
    it('returns nature_sanctuary info with defaults', () => {
        const feature = makeFeature({ type: 'nature_sanctuary' })
        const result = natureHandlers.nature_sanctuary(feature, BASE_STATS)
        expect(result.type).toBe('nature_sanctuary')
        expect(result.name).toBe('Test Feature')
        expect(result.range).toBe('120_ft')
        expect(result.cubeSize).toBe(15)
        expect(result.duration).toBe('1_minute')
        expect(result.moveRange).toBe(60)
        expect(result.movesPerDuration).toBe(1)
        expect(result.resourceCost).toBe('wild_shape')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
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
        expect(result.type).toBe('nature_sanctuary_move')
        expect(result.name).toBe('Test Feature')
        expect(result.action).toBe('bonus_action')
        expect(result.moveRange).toBe(60)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'nature_sanctuary_move',
            moveRange: 30
        })
        const result = natureHandlers.nature_sanctuary_move(feature, BASE_STATS)
        expect(result.moveRange).toBe(30)
    })
})
