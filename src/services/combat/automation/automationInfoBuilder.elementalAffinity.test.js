import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'

const BASE_FEATURE = { name: 'Elemental Affinity' }
const ps = { level: 10, proficiency: 4, abilities: [{ name: 'Charisma', bonus: 3, baseScore: 16 }] }

describe('buildAttackInfo – damage_type_choice (Elemental Affinity)', () => {
    it('returns damage_type_choice info with correct properties', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'damage_type_choice', damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'], effect: 'elemental_affinity' } }

        const result = buildAttackInfo(feature, ps)

        expect(result).not.toBeNull()
        expect(result.type).toBe('damage_type_choice')
        expect(result.name).toBe('Elemental Affinity')
        expect(result.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'])
        expect(result.effect).toBe('elemental_affinity')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns empty damageTypes when not provided', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'damage_type_choice', effect: 'elemental_affinity' } }

        const result = buildAttackInfo(feature, ps)

        expect(result.damageTypes).toEqual([])
    })

    it('defaults casting_time to passive when not provided', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'damage_type_choice', damageTypes: ['Fire'] } }

        const result = buildAttackInfo(feature, ps)

        expect(result.casting_time).toBe('passive')
    })
})
