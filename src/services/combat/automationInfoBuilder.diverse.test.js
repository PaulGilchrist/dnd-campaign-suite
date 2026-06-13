import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – divine_intervention', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'divine_intervention' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'divine_intervention',
            name: 'Test Feature',
            recharge: 'long_rest',
            upgradeTo: '',
            casting_time: '1 action',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'divine_intervention',
                recharge: 'short_rest',
                upgradeTo: 'upgrade_expr',
                casting_time: '1 reaction',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.recharge).toBe('short_rest')
        expect(result.upgradeTo).toBe('upgrade_expr')
        expect(result.casting_time).toBe('1 reaction')
    })
})

describe('buildAttackInfo – extra_action', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'extra_action' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'extra_action',
            name: 'Test Feature',
            uses: 1,
            recharge: 'short_rest',
            oncePerTurn: false,
            oncePerCombat: false,
            firstRoundOnly: false,
            resourceKey: 'testfeatureUses',
            hasAutomation: true,
        })
    })

    it('generates resourceKey from feature name', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'extra_action' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resourceKey).toBe('testfeatureUses')
    })

    it('generates resourceKey with spaces replaced', () => {
        const spacedFeature = { name: 'Extra Action Feature', automation: { type: 'extra_action' } }
        const result = buildAttackInfo(spacedFeature, BASE_STATS)
        expect(result.resourceKey).toBe('extraactionfeatureUses')
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'extra_action',
                uses: 3,
                recharge: 'long_rest',
                oncePerTurn: true,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('long_rest')
        expect(result.oncePerTurn).toBe(true)
    })

    it('includes oncePerCombat and firstRoundOnly when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'extra_action',
                oncePerCombat: true,
                firstRoundOnly: true,
                recharge: 'long_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.oncePerCombat).toBe(true)
        expect(result.firstRoundOnly).toBe(true)
        expect(result.recharge).toBe('long_rest')
    })
})

describe('buildAttackInfo – font_of_inspiration', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'font_of_inspiration' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'font_of_inspiration',
            name: 'Test Feature',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'font_of_inspiration',
                casting_time: '1 bonus action',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 bonus action')
    })
})

describe('buildAttackInfo – font_of_magic', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'font_of_magic' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'font_of_magic',
            name: 'Test Feature',
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'font_of_magic',
                casting_time: '1 action',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
    })
})
