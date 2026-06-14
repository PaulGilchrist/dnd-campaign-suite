import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock the dependencies ────────────────────────────────────────

vi.mock('./automationInfoBuilder.js', () => ({
    buildAttackInfo: vi.fn((feature) => {
        if (!feature?.automation) return null
        if (feature.automation.type === 'passive_buff') {
            return { type: 'passive_buff', name: feature.name }
        }
        if (feature.automation.type === 'passive_rule') {
            return { type: 'passive_rule', name: feature.name, effect: feature.automation.effect }
        }
        if (feature.automation.type === 'passive_immunity') {
            return { type: 'passive_immunity', name: feature.name }
        }
        return { type: 'other_type', name: feature.name }
    }),
}))

vi.mock('./automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => {
        if (expr === '2d6') return 7
        if (expr === '1d8+2') return 7
        if (expr === 'invalid') return NaN
        return 0
    }),
}))

vi.mock('../rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((itemName) => {
        if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
            const magicBonus = Number(itemName.charAt(1))
            return {
                baseName: itemName.substring(3),
                magicBonus: isNaN(magicBonus) ? 0 : magicBonus,
            }
        }
        return { baseName: itemName, magicBonus: 0 }
    }),
}))

// ── Imports after mocks ──────────────────────────────────────────

import { buildAttackInfo } from './automationInfoBuilder.js'
import { evaluateAutoExpression } from './automationExpressions.js'
import { parseMagicItemName } from '../rules/core/attackCalc.js'

import {
    getPassiveBuffs,
    collectWeaponMastery,
    resolveHealingBonuses,
    hasHealingMaximization,
} from './automationPassives.js'

// ── Helpers ──────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        level: 5,
        proficiency: 3,
        equipment: [
            { name: 'Longsword', mastery: 'sweeping' },
            { name: 'Shortsword', mastery: 'versatile' },
        ],
        automation: {
            passives: [
                { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2d6' },
                { type: 'passive_rule', effect: 'maximize_healing_dice' },
                { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '1d8+2', extraMastery: ['push', 'topple'] },
            ],
        },
        ...overrides,
    }
}

// ── Tests ────────────────────────────────────────────────────────

describe('getPassiveBuffs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns empty array when features is null', () => {
        const result = getPassiveBuffs(null, {})
        expect(result).toEqual([])
    })

    it('returns empty array when features is undefined', () => {
        const result = getPassiveBuffs(undefined, {})
        expect(result).toEqual([])
    })

    it('returns empty array when features is empty', () => {
        const result = getPassiveBuffs([], {})
        expect(result).toEqual([])
    })

    it('returns empty array when features array has no automation', () => {
        const features = [{ name: 'Feature 1' }, { name: 'Feature 2' }]
        const result = getPassiveBuffs(features, {})
        expect(result).toEqual([])
    })

    it('skips features with undefined entries', () => {
        const features = [undefined, { name: 'Feature', automation: { type: 'passive_buff' } }]
        const result = getPassiveBuffs(features, {})
        expect(result).toHaveLength(1)
    })

    it('collects passive_buff type features', () => {
        const features = [
            { name: 'Feature 1', automation: { type: 'passive_buff' } },
            { name: 'Feature 2', automation: { type: 'other' } },
        ]
        const result = getPassiveBuffs(features, {})
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ type: 'passive_buff', name: 'Feature 1' })
    })

    it('collects passive_rule type features', () => {
        const features = [
            { name: 'Feature 1', automation: { type: 'passive_rule', effect: 'bonus_healing' } },
        ]
        const result = getPassiveBuffs(features, {})
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ type: 'passive_rule', name: 'Feature 1', effect: 'bonus_healing' })
    })

    it('collects passive_immunity type features', () => {
        const features = [
            { name: 'Feature 1', automation: { type: 'passive_immunity' } },
        ]
        const result = getPassiveBuffs(features, {})
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({ type: 'passive_immunity', name: 'Feature 1' })
    })

    it('excludes non-passive types', () => {
        const features = [
            { name: 'Attack', automation: { type: 'attack_rider' } },
            { name: 'Buff', automation: { type: 'passive_buff' } },
            { name: 'Spell', automation: { type: 'auto_effect' } },
        ]
        const result = getPassiveBuffs(features, {})
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('passive_buff')
    })

    it('calls buildAttackInfo with feature and playerStats', () => {
        const feature = { name: 'Test', automation: { type: 'passive_buff' } }
        const playerStats = { level: 5 }
        getPassiveBuffs([feature], playerStats)
        expect(buildAttackInfo).toHaveBeenCalledWith(feature, playerStats)
    })

    it('collects all matching passives from mixed features', () => {
        const features = [
            { name: 'Buff1', automation: { type: 'passive_buff' } },
            { name: 'Rule1', automation: { type: 'passive_rule', effect: 'healing' } },
            { name: 'Immunity1', automation: { type: 'passive_immunity' } },
            { name: 'Other', automation: { type: 'attack_rider' } },
            { name: 'Buff2', automation: { type: 'passive_buff' } },
        ]
        const result = getPassiveBuffs(features, {})
        expect(result).toHaveLength(4)
    })
})

describe('collectWeaponMastery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns base mastery from equipment', () => {
        const playerStats = makePlayerStats({
            automation: { passives: [] },
        })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.baseMastery).toBe('sweeping')
        expect(result.extraMasteries).toEqual([])
    })

    it('returns null base mastery when weapon not found', () => {
        const playerStats = makePlayerStats({
            automation: { passives: [] },
        })
        const result = collectWeaponMastery('Greatclub', playerStats)
        expect(result.baseMastery).toBeNull()
        expect(result.extraMasteries).toEqual([])
    })

    it('returns null base mastery when equipment is missing', () => {
        const playerStats = makePlayerStats({ equipment: null, automation: { passives: [] } })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.baseMastery).toBeNull()
        expect(result.extraMasteries).toEqual([])
    })

    it('returns null base mastery when equipment is undefined', () => {
        const playerStats = makePlayerStats({ equipment: undefined, automation: { passives: [] } })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.baseMastery).toBeNull()
        expect(result.extraMasteries).toEqual([])
    })

    it('strips magic prefix from weapon name', () => {
        const playerStats = makePlayerStats()
        const result = collectWeaponMastery('+1 Longsword', playerStats)
        expect(result.baseMastery).toBe('sweeping')
        expect(parseMagicItemName).toHaveBeenCalledWith('+1 Longsword')
    })

    it('collects extra masteries from passives', () => {
        const playerStats = makePlayerStats()
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.extraMasteries).toContain('push')
        expect(result.extraMasteries).toContain('topple')
    })

    it('deduplicates extra masteries', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2d6', extraMastery: ['push', 'push'] },
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '1d8', extraMastery: ['push', 'topple'] },
                ],
            },
        })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.extraMasteries).toEqual(['push', 'topple'])
    })

    it('returns empty extraMasteries when no passives exist', () => {
        const playerStats = makePlayerStats({ automation: { passives: [] } })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.extraMasteries).toEqual([])
    })

    it('returns empty extraMasteries when automation.passives is missing', () => {
        const playerStats = makePlayerStats({ automation: {} })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.extraMasteries).toEqual([])
    })

    it('returns empty extraMasteries when automation is missing', () => {
        const playerStats = makePlayerStats({ automation: null })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.extraMasteries).toEqual([])
    })

    it('returns empty extraMasteries when automation is undefined', () => {
        const playerStats = makePlayerStats({ automation: undefined })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.extraMasteries).toEqual([])
    })

    it('handles weapon with no mastery field', () => {
        const playerStats = makePlayerStats({
            equipment: [{ name: 'Longsword' }, { name: 'Shortsword' }],
        })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.baseMastery).toBeNull()
    })

    it('returns unique extraMasteries even when from multiple passives', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', extraMastery: ['push', 'topple'] },
                    { type: 'passive_rule', extraMastery: ['topple', 'sweeping'] },
                ],
            },
        })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.extraMasteries).toEqual(['push', 'topple', 'sweeping'])
    })

    it('ignores passives without extraMastery', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2d6' },
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '1d8', extraMastery: ['push'] },
                ],
            },
        })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.extraMasteries).toEqual(['push'])
    })

    it('ignores passives with non-array extraMastery', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', extraMastery: 'not-an-array' },
                    { type: 'passive_rule', extraMastery: ['push'] },
                ],
            },
        })
        const result = collectWeaponMastery('Longsword', playerStats)
        expect(result.extraMasteries).toEqual(['push'])
    })
})

describe('resolveHealingBonuses', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 0 when no passives exist', () => {
        const playerStats = makePlayerStats({ automation: { passives: [] } })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(0)
    })

    it('returns 0 when automation.passives is missing', () => {
        const playerStats = makePlayerStats({ automation: {} })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(0)
    })

    it('returns 0 when automation is missing', () => {
        const playerStats = makePlayerStats({ automation: null })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(0)
    })

    it('accumulates bonus from bonus_healing passives', () => {
        const playerStats = makePlayerStats()
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(14) // 7 + 7 from two bonus_expression passives
    })

    it('calls evaluateAutoExpression for each bonus_expression', () => {
        const playerStats = makePlayerStats()
        resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(evaluateAutoExpression).toHaveBeenCalledTimes(2)
        expect(evaluateAutoExpression).toHaveBeenCalledWith('2d6', playerStats, 3, 5, 1)
        expect(evaluateAutoExpression).toHaveBeenCalledWith('1d8+2', playerStats, 3, 5, 1)
    })

    it('skips passives without bonusExpression', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'bonus_healing' },
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2d6' },
                ],
            },
        })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(7)
        expect(evaluateAutoExpression).toHaveBeenCalledTimes(1)
    })

    it('skips non-bonus_healing effects', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'maximize_healing_dice' },
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2d6' },
                ],
            },
        })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(7)
    })

    it('skips non-passive_rule types', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_buff', effect: 'bonus_healing', bonusExpression: '2d6' },
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2d6' },
                ],
            },
        })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(7)
    })

    it('returns 0 when bonusExpression evaluates to NaN', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'invalid' },
                ],
            },
        })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(0)
    })

    it('returns 0 when bonusExpression evaluates to non-number', () => {
        vi.mocked(evaluateAutoExpression).mockReturnValue('not-a-number')
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2d6' },
                ],
            },
        })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(0)
    })

    it('includes valid bonus when mixed with NaN bonus', () => {
        vi.mocked(evaluateAutoExpression).mockImplementation((expr) => {
            if (expr === '2d6') return 7
            return NaN
        })
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2d6' },
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'invalid' },
                ],
            },
        })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(7)
    })

    it('passes prof, level, and slotLevel to evaluateAutoExpression', () => {
        const playerStats = makePlayerStats()
        resolveHealingBonuses(playerStats, 4, 10, 3)
        expect(evaluateAutoExpression).toHaveBeenCalledWith('2d6', playerStats, 4, 10, 3)
        expect(evaluateAutoExpression).toHaveBeenCalledWith('1d8+2', playerStats, 4, 10, 3)
    })

    it('handles negative bonus values', () => {
        vi.mocked(evaluateAutoExpression).mockReturnValue(-3)
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2d6' },
                ],
            },
        })
        const result = resolveHealingBonuses(playerStats, 3, 5, 1)
        expect(result).toBe(-3)
    })
})

describe('hasHealingMaximization', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns true when maximize_healing_dice passive exists', () => {
        const playerStats = makePlayerStats()
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(true)
    })

    it('returns false when no passives exist', () => {
        const playerStats = makePlayerStats({ automation: { passives: [] } })
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(false)
    })

    it('returns false when automation.passives is missing', () => {
        const playerStats = makePlayerStats({ automation: {} })
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(false)
    })

    it('returns false when automation is missing', () => {
        const playerStats = makePlayerStats({ automation: null })
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(false)
    })

    it('returns false when automation is undefined', () => {
        const playerStats = makePlayerStats({ automation: undefined })
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(false)
    })

    it('returns false when no passives have the effect', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'bonus_healing' },
                    { type: 'passive_buff', effect: 'advantage' },
                ],
            },
        })
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(false)
    })

    it('returns true when effect exists among other passives', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_buff', effect: 'advantage' },
                    { type: 'passive_rule', effect: 'maximize_healing_dice' },
                    { type: 'passive_rule', effect: 'bonus_healing' },
                ],
            },
        })
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(true)
    })

    it('returns false for passive_buff type with same effect', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_buff', effect: 'maximize_healing_dice' },
                ],
            },
        })
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(false)
    })

    it('returns false for passive_immunity type with same effect', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_immunity', effect: 'maximize_healing_dice' },
                ],
            },
        })
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(false)
    })

    it('handles multiple maximize_healing_dice passives', () => {
        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { type: 'passive_rule', effect: 'maximize_healing_dice' },
                    { type: 'passive_rule', effect: 'maximize_healing_dice' },
                ],
            },
        })
        const result = hasHealingMaximization(playerStats)
        expect(result).toBe(true)
    })
})
