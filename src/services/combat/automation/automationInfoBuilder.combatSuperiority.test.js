import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – combat_superiority', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'combat_superiority',
                saveDc: 'ability',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        // BASE_STATS: STR bonus=4, proficiency=3, DC = 8+4+3 = 15
        expect(result).toEqual({
            type: 'combat_superiority',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'STR',
            dieExpression: 'superiority_die',
            usesMax: 4,
            usesRecharge: 'short_rest',
            options: [],
            oncePerTurn: false,
            chooseOne: false,
            hasAutomation: true,
        })
    })

    it('computes save DC from DEX ability + proficiency', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'combat_superiority',
                saveAbility: 'DEX',
                saveDc: 'ability',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        // BASE_STATS: DEX bonus=2, proficiency=3, DC = 8+2+3 = 13
        expect(result.saveDc).toBe(13)
        expect(result.saveAbility).toBe('DEX')
    })

    it('uses explicit saveDc when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'combat_superiority',
                saveDc: 15,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('respects custom die expression', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'combat_superiority',
                dieExpression: 'superiority_die',
                uses_max: 5,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.dieExpression).toBe('superiority_die')
        expect(result.usesMax).toBe(5)
    })

    it('includes options when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'combat_superiority',
                options: ['option1', 'option2'],
                oncePerTurn: true,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.options).toEqual(['option1', 'option2'])
        expect(result.oncePerTurn).toBe(true)
    })

    it('resolves superiority die size at level 3', () => {
        const level3Stats = { ...BASE_STATS, level: 3 }
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'combat_superiority',
            },
        }
        const result = buildAttackInfo(feature, level3Stats)
        // At level 3 (below 10), die should be d8
        expect(result.dieExpression).toBe('superiority_die')
    })

    it('resolves superiority die size at level 10 (d10)', () => {
        const level10Stats = { ...BASE_STATS, level: 10 }
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'combat_superiority',
            },
        }
        const result = buildAttackInfo(feature, level10Stats)
        // At level 10+, die should be d10
        expect(result.dieExpression).toBe('superiority_die')
    })

    it('resolves superiority die size at level 18 (d12)', () => {
        const level18Stats = { ...BASE_STATS, level: 18 }
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'combat_superiority',
            },
        }
        const result = buildAttackInfo(feature, level18Stats)
        // At level 18+, die should be d12
        expect(result.dieExpression).toBe('superiority_die')
    })
})
