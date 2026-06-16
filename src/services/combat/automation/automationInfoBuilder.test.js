import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo', () => {
    it('returns null when feature has no automation', () => {
        const feature = { name: 'No Automation' }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation is null', () => {
        const feature = { name: 'Null Auto', automation: null }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation is undefined', () => {
        const feature = { name: 'Undefined Auto', automation: undefined }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null for unknown automation type', () => {
        const feature = makeFeature({ type: 'unknown_type' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns info for save_attack type', () => {
        const feature = makeFeature({ type: 'save_attack' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('save_attack')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for passive_buff type', () => {
        const feature = makeFeature({ type: 'passive_buff' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('passive_buff')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for combat_stance type', () => {
        const feature = makeFeature({ type: 'combat_stance' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('combat_stance')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for bardic_inspiration type', () => {
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('bardic_inspiration')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for damage_bonus type', () => {
        const feature = makeFeature({ type: 'damage_bonus' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('damage_bonus')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for extra_action type', () => {
        const feature = makeFeature({ type: 'extra_action' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('extra_action')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for healing type', () => {
        const feature = makeFeature({ type: 'healing' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('healing')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for reaction_damage type', () => {
        const feature = makeFeature({ type: 'reaction_damage' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('reaction_damage')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for auto_effect type', () => {
        const feature = makeFeature({ type: 'auto_effect' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('auto_effect')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for resource_pool type', () => {
        const feature = makeFeature({ type: 'resource_pool' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('resource_pool')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns info for free_spell type', () => {
        const feature = makeFeature({ type: 'free_spell' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).not.toBeNull()
        expect(result.type).toBe('free_spell')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})
