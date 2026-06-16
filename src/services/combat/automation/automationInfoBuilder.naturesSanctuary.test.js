import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – nature_sanctuary', () => {
    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'nature_sanctuary' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'nature_sanctuary',
            name: 'Test Feature',
            range: '120_ft',
            cubeSize: 15,
            duration: '1_minute',
            moveRange: 60,
            movesPerDuration: 1,
            resourceCost: 'wild_shape',
            hasAutomation: true,
        })
    })

    it('includes custom values when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'nature_sanctuary',
                range: '90_ft',
                cubeSize: 20,
                duration: '10_minutes',
                moveRange: 90,
                movesPerDuration: 3,
                resourceCost: 'channel_divinity',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.range).toBe('90_ft')
        expect(result.cubeSize).toBe(20)
        expect(result.duration).toBe('10_minutes')
        expect(result.moveRange).toBe(90)
        expect(result.movesPerDuration).toBe(3)
        expect(result.resourceCost).toBe('channel_divinity')
    })
})

describe('buildAttackInfo – nature_sanctuary_move', () => {
    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'nature_sanctuary_move' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'nature_sanctuary_move',
            name: 'Test Feature',
            action: 'bonus_action',
            moveRange: 60,
            hasAutomation: true,
        })
    })

    it('includes custom moveRange when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'nature_sanctuary_move',
                moveRange: 90,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.moveRange).toBe(90)
    })
})
