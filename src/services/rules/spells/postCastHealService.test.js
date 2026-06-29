// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  triggerPostCastSelfHeals,
  triggerPostCastAllyHeals,
} from './postCastHealService.js'

vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

vi.mock('../../automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(),
  logHealingToSSE: vi.fn(),
}))

// Import mocked modules after vi.mock declarations (hoisted by Vitest)
const { evaluateAutoExpression } = await import('../../combat/automation/automationService.js')
const { applyHealingDirectly, logHealingToSSE } = await import('../../automation/common/healingRoll.js')

describe('postCastHealService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    evaluateAutoExpression.mockReturnValue(10)
    applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 10 })
  })

  describe('triggerPostCastSelfHeals', () => {
    const healingSpell = { name: 'Cure Wounds', level: 1 }
    const cantripSpell = { name: 'Thaumaturgy', level: 0 }
    const baseStats = {
      name: 'Cleric1',
      proficiency: 2,
      level: 5,
      automation: {
        passives: [{ type: 'post_cast_self_heal', name: 'Test Heal', healExpression: '1d8' }],
      },
      activeBuffs: [],
    }

    it('returns null for non-healing spell', async () => {
      const result = await triggerPostCastSelfHeals({ name: 'Fireball' }, {}, baseStats, 'camp', 'map')
      expect(result).toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
    })

    it('returns null for cantrip (level 0)', async () => {
      const result = await triggerPostCastSelfHeals(cantripSpell, {}, baseStats, 'camp', 'map')
      expect(result).toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
    })

    it('returns null when no self heal passives', async () => {
      const noHealStats = { ...baseStats, automation: { passives: [] } }
      const result = await triggerPostCastSelfHeals(healingSpell, {}, noHealStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('skips self-heal when othersOnly and spell is self-targeted', async () => {
      const othersOnlyStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Others Only', othersOnly: true, healExpression: '1d8' }] },
      }
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: 'Self' }, {}, othersOnlyStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('applies self-heal when othersOnly but spell range is undefined', async () => {
      const othersOnlyStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Others Only', othersOnly: true, healExpression: '1d8' }] },
      }
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: undefined }, {}, othersOnlyStats, 'camp', 'map')
      expect(result).not.toBeNull()
    })

    it('applies healing when conditions are met', async () => {
      const result = await triggerPostCastSelfHeals(healingSpell, { slotLevel: 2 }, baseStats, 'camp', 'map')
      expect(applyHealingDirectly).toHaveBeenCalledWith(baseStats, baseStats.name, 10, 'camp')
      expect(logHealingToSSE).toHaveBeenCalledWith('camp', {
        targetName: baseStats.name,
        sourceName: 'Test Heal',
        actualHeal: 10,
        newHp: 20,
        maxHp: 20,
      })
      expect(result).toEqual([{ name: 'Test Heal', amount: 10, actualHeal: 10 }])
    })

    it('skips when evaluation returns zero', async () => {
      evaluateAutoExpression.mockReturnValue(0)
      const result = await triggerPostCastSelfHeals(healingSpell, {}, baseStats, 'camp', 'map')
      expect(result).toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
    })

    it('skips when evaluation returns negative', async () => {
      evaluateAutoExpression.mockReturnValue(-5)
      const result = await triggerPostCastSelfHeals(healingSpell, {}, baseStats, 'camp', 'map')
      expect(result).toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
    })

    it('skips when evaluation returns NaN', async () => {
      evaluateAutoExpression.mockReturnValue(NaN)
      const result = await triggerPostCastSelfHeals(healingSpell, {}, baseStats, 'camp', 'map')
      expect(result).toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
    })

    it('upgrades heal expression from 1d8 to 2d8 at level 10+', async () => {
      evaluateAutoExpression.mockReturnValue(15)
      const twinkledStats = { ...baseStats, level: 10 }
      await triggerPostCastSelfHeals(healingSpell, {}, twinkledStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('2d8', twinkledStats, 2, 10, 1)
    })

    it('does not upgrade heal expression below level 10', async () => {
      evaluateAutoExpression.mockReturnValue(15)
      await triggerPostCastSelfHeals(healingSpell, {}, baseStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('1d8', baseStats, 2, 5, 1)
    })

    it('uses slotLevel from metaCtx when available', async () => {
      evaluateAutoExpression.mockReturnValue(15)
      await triggerPostCastSelfHeals(healingSpell, { slotLevel: 5 }, baseStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('1d8', baseStats, 2, 5, 5)
    })

    it('uses spell.level when metaCtx.slotLevel is missing', async () => {
      evaluateAutoExpression.mockReturnValue(15)
      await triggerPostCastSelfHeals(healingSpell, {}, baseStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('1d8', baseStats, 2, 5, 1)
    })

    it('handles multiple self-heal passives', async () => {
      const multiStats = {
        ...baseStats,
        automation: {
          passives: [
            { type: 'post_cast_self_heal', name: 'Heal 1', healExpression: '1d8' },
            { type: 'post_cast_self_heal', name: 'Heal 2', healExpression: '1d8' },
          ],
        },
      }
      const result = await triggerPostCastSelfHeals(healingSpell, {}, multiStats, 'camp', 'map')
      expect(applyHealingDirectly).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
      expect(result).toEqual([
        { name: 'Heal 1', amount: 10, actualHeal: 10 },
        { name: 'Heal 2', amount: 10, actualHeal: 10 },
      ])
    })

    it('defaults to healExpression 0 when missing', async () => {
      const noExpressionStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'No Expression' }] },
      }
      evaluateAutoExpression.mockReturnValue(0)
      const result = await triggerPostCastSelfHeals(healingSpell, {}, noExpressionStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('throws when slot level is missing from both metaCtx and spell', async () => {
      const noSlotStats = { ...baseStats, level: 5 }
      const noSlotSpell = { name: 'Cure Wounds', level: null }
      await expect(
        triggerPostCastSelfHeals(noSlotSpell, {}, noSlotStats, 'camp', 'map')
      ).rejects.toThrow('slot level is required for post-cast self heals')
    })

    it('returns null when all passives are skipped (othersOnly + zero amount)', async () => {
      const allSkippedStats = {
        ...baseStats,
        automation: {
          passives: [
            { type: 'post_cast_self_heal', name: 'Skip 1', othersOnly: true, healExpression: '1d8' },
            { type: 'post_cast_self_heal', name: 'Skip 2', healExpression: '1d8' },
          ],
        },
      }
      evaluateAutoExpression.mockReturnValue(0)
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: 'Self' }, {}, allSkippedStats, 'camp', 'map')
      expect(result).toBeNull()
    })
  })

  describe('triggerPostCastAllyHeals', () => {
    const healingSpell = { name: 'Cure Wounds', level: 1 }
    const cantripSpell = { name: 'Thaumaturgy', level: 0 }
    const baseStats = {
      name: 'Cleric1',
      proficiency: 2,
      level: 5,
      activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }],
      automation: {
        passives: [{ type: 'post_cast_ally_heal', name: 'Ally Heal', healExpression: '1d8' }],
      },
    }

    it('returns null for non-healing spell', async () => {
      const result = await triggerPostCastAllyHeals({ name: 'Fireball' }, {}, baseStats, 'camp', 'map')
      expect(result).toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
    })

    it('returns null for cantrip (level 0)', async () => {
      const result = await triggerPostCastAllyHeals(cantripSpell, {}, baseStats, 'camp', 'map')
      expect(result).toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
    })

    it('returns null when Starry Form not active', async () => {
      const noStarryStats = { ...baseStats, activeBuffs: [] }
      const result = await triggerPostCastAllyHeals(healingSpell, {}, noStarryStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no ally heal passives', async () => {
      const noHealStats = { ...baseStats, automation: { passives: [] } }
      const result = await triggerPostCastAllyHeals(healingSpell, {}, noHealStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('applies ally healing when conditions are met', async () => {
      const allyStats = { ...baseStats, activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }] }
      const result = await triggerPostCastAllyHeals(healingSpell, {}, allyStats, 'camp', 'map')
      expect(applyHealingDirectly).toHaveBeenCalledWith(allyStats, allyStats.name, 10, 'camp', allyStats.hitPoints)
      expect(logHealingToSSE).toHaveBeenCalledWith('camp', {
        targetName: allyStats.name,
        sourceName: 'Ally Heal',
        actualHeal: 10,
        newHp: 20,
        maxHp: 20,
      })
      expect(result).toEqual([{ name: 'Ally Heal', amount: 10, actualHeal: 10, targetName: 'Cleric1' }])
    })

    it('uses custom targetName when specified', async () => {
      const customStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_ally_heal', name: 'Targeted Heal', healExpression: '1d8', targetName: 'Ally1' }] },
        activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }],
      }
      const result = await triggerPostCastAllyHeals(healingSpell, {}, customStats, 'camp', 'map')
      expect(applyHealingDirectly).toHaveBeenCalledWith(customStats, 'Ally1', 10, 'camp', null)
      expect(result).toEqual([{ name: 'Targeted Heal', amount: 10, actualHeal: 10, targetName: 'Ally1' }])
    })

    it('skips when othersOnly and spell is self-targeted', async () => {
      const othersOnlyStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_ally_heal', name: 'Others Only', othersOnly: true, healExpression: '1d8' }] },
      }
      const result = await triggerPostCastAllyHeals({ ...healingSpell, range: 'Self' }, {}, othersOnlyStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('upgrades heal expression from 1d8 to 2d8 at level 10+', async () => {
      evaluateAutoExpression.mockReturnValue(15)
      const twinkledStats = { ...baseStats, level: 10, activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }] }
      await triggerPostCastAllyHeals(healingSpell, {}, twinkledStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('2d8', twinkledStats, 2, 10, 1)
    })

    it('handles multiple ally heal passives', async () => {
      const multiStats = {
        ...baseStats,
        automation: {
          passives: [
            { type: 'post_cast_ally_heal', name: 'Heal 1', healExpression: '1d8' },
            { type: 'post_cast_ally_heal', name: 'Heal 2', healExpression: '1d8' },
          ],
        },
        activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }],
      }
      const result = await triggerPostCastAllyHeals(healingSpell, {}, multiStats, 'camp', 'map')
      expect(applyHealingDirectly).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
    })

    it('defaults to healExpression 0 when missing', async () => {
      const noExpressionStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_ally_heal', name: 'No Expression' }] },
        activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }],
      }
      evaluateAutoExpression.mockReturnValue(0)
      const result = await triggerPostCastAllyHeals(healingSpell, {}, noExpressionStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('throws when slot level is missing from both metaCtx and spell', async () => {
      const noSlotStats = { ...baseStats, level: 5, activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }] }
      const noSlotSpell = { name: 'Cure Wounds', level: null }
      await expect(
        triggerPostCastAllyHeals(noSlotSpell, {}, noSlotStats, 'camp', 'map')
      ).rejects.toThrow('slot level is required for post-cast ally heals')
    })
  })
})
