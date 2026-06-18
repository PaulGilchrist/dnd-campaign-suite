import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hasPostCastSelfHeal,
  triggerPostCastSelfHeals,
  triggerPostCastAllyHeals,
} from './postCastHealService.js'

vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => 10),
}))

vi.mock('../../automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(() => ({ newHp: 20, maxHp: 20, actualHeal: 10 })),
  logHealingToSSE: vi.fn(),
}))

describe('postCastHealService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hasPostCastSelfHeal', () => {
    it('returns true when post_cast_self_heal passives exist', () => {
      const stats = { automation: { passives: [{ type: 'post_cast_self_heal' }] } }
      expect(hasPostCastSelfHeal(stats)).toBe(true)
    })

    it('returns false when no post_cast_self_heal passives', () => {
      const stats = { automation: { passives: [{ type: 'other' }] } }
      expect(hasPostCastSelfHeal(stats)).toBe(false)
    })

    it('returns false when no passives', () => {
      expect(hasPostCastSelfHeal({ automation: { passives: [] } })).toBe(false)
    })
  })

  describe('triggerPostCastSelfHeals', () => {
    const healingSpell = { name: 'Cure Wounds', level: 1 }
    const cantripSpell = { name: 'Thaumaturgy', level: 0 }
    const stats = {
      name: 'Cleric1',
      proficiency: 2,
      level: 5,
      automation: {
        passives: [{ type: 'post_cast_self_heal', name: 'Test Heal', healExpression: '1d8' }],
      },
    }

    it('returns null for non-healing spell', async () => {
      const result = await triggerPostCastSelfHeals({ name: 'Fireball' }, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null for cantrip (level 0)', async () => {
      const result = await triggerPostCastSelfHeals(cantripSpell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no self heal passives', async () => {
      const noHealStats = { ...stats, automation: { passives: [] } }
      const result = await triggerPostCastSelfHeals(healingSpell, {}, noHealStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('skips self-heal when othersOnly and spell is self-targeted', async () => {
      const othersOnlyStats = {
        ...stats,
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Others Only', othersOnly: true, healExpression: '1d8' }] },
      }
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: 'Self' }, {}, othersOnlyStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('applies healing when conditions are met', async () => {
      const { applyHealingDirectly } = await import('../../automation/common/healingRoll.js')
      const result = await triggerPostCastSelfHeals(healingSpell, { slotLevel: 2 }, stats, 'camp', 'map')
      expect(applyHealingDirectly).toHaveBeenCalled()
      expect(result).toEqual([{ name: 'Test Heal', amount: 10, actualHeal: 10 }])
    })

    it('skips when evaluation returns non-positive amount', async () => {
      const { evaluateAutoExpression } = await import('../../combat/automation/automationService.js')
      evaluateAutoExpression.mockReturnValue(0)
      const result = await triggerPostCastSelfHeals(healingSpell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('skips when evaluation returns NaN', async () => {
      const { evaluateAutoExpression } = await import('../../combat/automation/automationService.js')
      evaluateAutoExpression.mockReturnValue(NaN)
      const result = await triggerPostCastSelfHeals(healingSpell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('twinkles 1d8 to 2d8 at level 10+', async () => {
      const { evaluateAutoExpression } = await import('../../combat/automation/automationService.js')
      evaluateAutoExpression.mockReturnValue(15)
      const twinkledStats = { ...stats, level: 10 }
      await triggerPostCastSelfHeals(healingSpell, {}, twinkledStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('2d8', twinkledStats, 2, 10, 1)
      evaluateAutoExpression.mockRestore()
    })

    it('uses slotLevel from metaCtx when available', async () => {
      const { evaluateAutoExpression } = await import('../../combat/automation/automationService.js')
      evaluateAutoExpression.mockReturnValue(15)
      await triggerPostCastSelfHeals(healingSpell, { slotLevel: 5 }, stats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('1d8', stats, 2, 5, 5)
      evaluateAutoExpression.mockRestore()
    })

    it('handles multiple self-heal passives', async () => {
      const multiStats = {
        ...stats,
        automation: {
          passives: [
            { type: 'post_cast_self_heal', name: 'Heal 1', healExpression: '1d8' },
            { type: 'post_cast_self_heal', name: 'Heal 2', healExpression: '1d8' },
          ],
        },
      }
      const { applyHealingDirectly } = await import('../../automation/common/healingRoll.js')
      applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 10 })
      const result = await triggerPostCastSelfHeals(healingSpell, {}, multiStats, 'camp', 'map')
      expect(applyHealingDirectly).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
    })
  })

  describe('triggerPostCastAllyHeals', () => {
    const healingSpell = { name: 'Cure Wounds', level: 1 }
    const cantripSpell = { name: 'Thaumaturgy', level: 0 }
    const stats = {
      name: 'Cleric1',
      proficiency: 2,
      level: 5,
      activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }],
      automation: {
        passives: [{ type: 'post_cast_ally_heal', name: 'Ally Heal', healExpression: '1d8' }],
      },
    }

    it('returns null for non-healing spell', async () => {
      const result = await triggerPostCastAllyHeals({ name: 'Fireball' }, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null for cantrip (level 0)', async () => {
      const result = await triggerPostCastAllyHeals(cantripSpell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when Starry Form not active', async () => {
      const noStarryStats = {
        ...stats,
        activeBuffs: [],
      }
      const result = await triggerPostCastAllyHeals(healingSpell, {}, noStarryStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no ally heal passives', async () => {
      const noHealStats = {
        ...stats,
        automation: { passives: [] },
      }
      const result = await triggerPostCastAllyHeals(healingSpell, {}, noHealStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('applies ally healing when conditions are met', async () => {
      const { applyHealingDirectly } = await import('../../automation/common/healingRoll.js')
      const result = await triggerPostCastAllyHeals(healingSpell, {}, stats, 'camp', 'map')
      expect(applyHealingDirectly).toHaveBeenCalled()
      expect(result).toEqual([{ name: 'Ally Heal', amount: 10, actualHeal: 10, targetName: 'Cleric1' }])
    })

    it('uses custom targetName when specified', async () => {
      const customStats = {
        ...stats,
        automation: { passives: [{ type: 'post_cast_ally_heal', name: 'Targeted Heal', healExpression: '1d8', targetName: 'Ally1' }] },
      }
      const { applyHealingDirectly } = await import('../../automation/common/healingRoll.js')
      await triggerPostCastAllyHeals(healingSpell, {}, customStats, 'camp', 'map')
      expect(applyHealingDirectly).toHaveBeenCalledWith(customStats, 'Ally1', expect.any(Number), 'camp')
    })

    it('skips when othersOnly and spell is self-targeted', async () => {
      const othersOnlyStats = {
        ...stats,
        automation: { passives: [{ type: 'post_cast_ally_heal', name: 'Others Only', othersOnly: true, healExpression: '1d8' }] },
      }
      const result = await triggerPostCastAllyHeals({ ...healingSpell, range: 'Self' }, {}, othersOnlyStats, 'camp', 'map')
      expect(result).toBeNull()
    })
  })
})
