// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – damage_type_choice (Elemental Affinity)', () => {
    it('returns correct structure with all defaults', () => {
        const feature = makeFeature({ type: 'damage_type_choice' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).not.toBeNull()
        expect(result).toBeDefined()
        expect(result.type).toBe('damage_type_choice')
        expect(result.name).toBe('Test Feature')
        expect(result.damageTypes).toEqual([])
        expect(result.effect).toBe('')
        expect(result.casting_time).toBe('passive')
        expect(result.minDamage).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through damageTypes array', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'])
    })

    it('passes through effect value', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            effect: 'elemental_affinity',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('elemental_affinity')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })

    it('defaults casting_time to passive when not provided', () => {
        const feature = makeFeature({ type: 'damage_type_choice' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('coerces minDamage to boolean true when truthy', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            minDamage: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.minDamage).toBe(true)
    })

    it('coerces minDamage to boolean false when falsy', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            minDamage: 0,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.minDamage).toBe(false)
    })

    it('defaults minDamage to false when not provided', () => {
        const feature = makeFeature({ type: 'damage_type_choice' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.minDamage).toBe(false)
    })

    it('defaults damageTypes to empty array when automation has no damageTypes', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            effect: 'elemental_affinity',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageTypes).toEqual([])
    })

    it('preserves custom feature name', () => {
        const feature = makeFeature(
            { type: 'damage_type_choice', effect: 'elemental_affinity' },
            'Elemental Affinity'
        )
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.name).toBe('Elemental Affinity')
    })

    it('handles single damage type', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            damageTypes: ['Fire'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageTypes).toEqual(['Fire'])
    })
})
