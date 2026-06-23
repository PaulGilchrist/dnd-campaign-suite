// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – set_condition dispatch', () => {
    it('returns null when feature has no automation property', () => {
        const feature = { name: 'No Automation' }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation is null', () => {
        const feature = { ...BASE_FEATURE, automation: null }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation type is unknown', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'nonexistent_type' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('uses handler defaults when automation fields are omitted', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'set_condition' } }
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('set_condition')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBeUndefined()
        expect(result.condition).toBeUndefined()
        expect(result.additionalCondition).toBeNull()
        expect(result.cost).toBe('')
        expect(result.range).toBe('60 ft')
        expect(result.saveType).toBe('STR')
        expect(result.effect).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through all set_condition fields from handler output', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'set_condition',
                target: 'enemy',
                condition: 'prone',
                additionalCondition: 'restrained',
                cost: '1 resource',
                range: '30 ft',
                saveType: 'DEX',
                effect: 'condition_effect',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('set_condition')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBe('enemy')
        expect(result.condition).toBe('prone')
        expect(result.additionalCondition).toBe('restrained')
        expect(result.cost).toBe('1 resource')
        expect(result.range).toBe('30 ft')
        expect(result.saveType).toBe('DEX')
        expect(result.effect).toBe('condition_effect')
        expect(result.hasAutomation).toBe(true)
    })

    it('uses explicit saveType override instead of default STR', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: { type: 'set_condition', saveType: 'CON' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
    })

    it('uses explicit range override instead of default 60 ft', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: { type: 'set_condition', range: '15 ft' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.range).toBe('15 ft')
    })

    it('sets additionalCondition to null when not provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: { type: 'set_condition', condition: 'blinded' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.condition).toBe('blinded')
        expect(result.additionalCondition).toBeNull()
    })
})
