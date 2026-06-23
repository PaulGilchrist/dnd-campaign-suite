// @improved-by-ai
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
        expect(result.type).toBe('nature_sanctuary')
        expect(result.range).toBe('90_ft')
        expect(result.cubeSize).toBe(20)
        expect(result.duration).toBe('10_minutes')
        expect(result.moveRange).toBe(90)
        expect(result.movesPerDuration).toBe(3)
        expect(result.resourceCost).toBe('channel_divinity')
        expect(result.hasAutomation).toBe(true)
    })

    it('overrides range with custom value', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: { type: 'nature_sanctuary', range: '60_ft' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
    })

    it('overrides cubeSize with custom value', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: { type: 'nature_sanctuary', cubeSize: 10 },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.cubeSize).toBe(10)
    })

    it('overrides duration with custom value', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: { type: 'nature_sanctuary', duration: '1_hour' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.duration).toBe('1_hour')
    })

    it('overrides movesPerDuration with custom value', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: { type: 'nature_sanctuary', movesPerDuration: 2 },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.movesPerDuration).toBe(2)
    })

    it('overrides resourceCost with custom value', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: { type: 'nature_sanctuary', resourceCost: 'expended_spell_slot' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resourceCost).toBe('expended_spell_slot')
    })

    it('preserves feature name in result', () => {
        const feature = { name: 'Circle of the Shepherd', automation: { type: 'nature_sanctuary' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.name).toBe('Circle of the Shepherd')
    })

    it('returns null for unknown automation type', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'unknown_type' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('ignores playerStats parameter (handler does not use it)', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'nature_sanctuary' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.range).toBe('120_ft')
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
            automation: { type: 'nature_sanctuary_move', moveRange: 90 },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.moveRange).toBe(90)
    })

    it('preserves feature name in result', () => {
        const feature = { name: 'Spirit of the Grove', automation: { type: 'nature_sanctuary_move' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.name).toBe('Spirit of the Grove')
    })

    it('always sets action to bonus_action', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: { type: 'nature_sanctuary_move', moveRange: 45 },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
    })

    it('returns null for unknown automation type', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'nonexistent' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })
})
