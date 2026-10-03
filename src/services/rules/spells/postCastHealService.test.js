// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  triggerPostCastSelfHeals,
  triggerPostCastAllyHeals,
  applyStarryChaliceHeal,
} from './postCastHealService.js'

vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

vi.mock('../../automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(),
  logHealingToSSE: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}))

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}))

vi.mock('../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

const { evaluateAutoExpression } = await import('../../combat/automation/automationService.js')
const { applyHealingDirectly, logHealingToSSE } = await import('../../automation/common/healingRoll.js')
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
const { getCombatSummary } = await import('../../encounters/combatData.js')
const { applyHealingToTarget } = await import('../combat/applyHealing.js')

describe('postCastHealService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    evaluateAutoExpression.mockReturnValue(10)
    applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 10 })
    getRuntimeValue.mockReturnValue(null)
    setRuntimeValue.mockReturnValue(undefined)
    getCombatSummary.mockReturnValue({ creatures: [] })
    applyHealingToTarget.mockReturnValue(null)
  })

  describe('triggerPostCastSelfHeals', () => {
    const healingSpell = { name: 'Cure Wounds', level: 1 }
    const baseStats = {
      name: 'Cleric1',
      proficiency: 2,
      level: 5,
      automation: {
        passives: [{ type: 'post_cast_self_heal', name: 'Test Heal', healExpression: '1d8' }],
      },
      activeBuffs: [],
    }

    it('returns null when early-return conditions are met', async () => {
      const nonHealingResult = await triggerPostCastSelfHeals({ name: 'Fireball' }, {}, baseStats, 'camp', 'map')
      expect(nonHealingResult).toBeNull()

      const cantripResult = await triggerPostCastSelfHeals({ name: 'Thaumaturgy', level: 0 }, {}, baseStats, 'camp', 'map')
      expect(cantripResult).toBeNull()

      const noPassivesStats = { ...baseStats, automation: { passives: [] } }
      const noPassivesResult = await triggerPostCastSelfHeals(healingSpell, {}, noPassivesStats, 'camp', 'map')
      expect(noPassivesResult).toBeNull()
    })

    it('skips self-heal when othersOnly and spell is self-targeted', async () => {
      const othersOnlyStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Others Only', othersOnly: true, healExpression: '1d8' }] },
      }
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: 'Self' }, {}, othersOnlyStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    // CLA-038: othersOnly must honor resolved target identity, not just range.
    it('skips othersOnly when a touch spell targets only the caster', async () => {
      const othersOnlyStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Blessed Healer', othersOnly: true, healExpression: '2 + spell_slot_level' }] },
      }
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: 'Touch' }, { slotLevel: 1, targetNames: ['Cleric1'] }, othersOnlyStats, 'camp', 'map')
      expect(result).toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
    })

    it('skips othersOnly when targetName is only the caster', async () => {
      const othersOnlyStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Blessed Healer', othersOnly: true, healExpression: '2 + spell_slot_level' }] },
      }
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: '60 feet' }, { slotLevel: 1, targetName: 'Cleric1' }, othersOnlyStats, 'camp', 'map')
      expect(result).toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
    })

    it('applies othersOnly when at least one healed target is not the caster', async () => {
      const othersOnlyStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Blessed Healer', othersOnly: true, healExpression: '2 + spell_slot_level' }] },
      }
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: 'Touch' }, { slotLevel: 3, targetNames: ['Cleric1', 'Ally1'] }, othersOnlyStats, 'camp', 'map')
      expect(result).toEqual([{ name: 'Blessed Healer', amount: 10, actualHeal: 10 }])
      expect(applyHealingDirectly).toHaveBeenCalledWith(othersOnlyStats, 'Cleric1', 10, 'camp')
    })

    it('fires othersOnly when target identity is unknown (legacy fallback)', async () => {
      const othersOnlyStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_self_heal', name: 'Blessed Healer', othersOnly: true, healExpression: '2 + spell_slot_level' }] },
      }
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: 'Touch' }, { slotLevel: 1 }, othersOnlyStats, 'camp', 'map')
      expect(result).toEqual([{ name: 'Blessed Healer', amount: 10, actualHeal: 10 }])
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

    it('upgrades heal expression at level 10+', async () => {
      evaluateAutoExpression.mockReturnValue(15)
      const twinkledStats = { ...baseStats, level: 10 }
      await triggerPostCastSelfHeals(healingSpell, {}, twinkledStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('2d8', twinkledStats, 2, 10, 1)
    })

    it('uses slotLevel from metaCtx or falls back to spell.level', async () => {
      evaluateAutoExpression.mockReturnValue(15)
      await triggerPostCastSelfHeals(healingSpell, { slotLevel: 5 }, baseStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('1d8', baseStats, 2, 5, 5)
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
      expect(result).toEqual([
        { name: 'Heal 1', amount: 10, actualHeal: 10 },
        { name: 'Heal 2', amount: 10, actualHeal: 10 },
      ])
    })

    it('throws when slot level is missing from both metaCtx and spell', async () => {
      const noSlotStats = { ...baseStats, level: 5 }
      const noSlotSpell = { name: 'Cure Wounds', level: null }
      await expect(
        triggerPostCastSelfHeals(noSlotSpell, {}, noSlotStats, 'camp', 'map')
      ).rejects.toThrow('slot level is required for post-cast self heals')
    })
  })

  describe('triggerPostCastAllyHeals', () => {
    const healingSpell = { name: 'Cure Wounds', level: 1 }
    const baseStats = {
      name: 'Cleric1',
      proficiency: 2,
      level: 5,
      activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }],
      automation: {
        passives: [{ type: 'post_cast_ally_heal', name: 'Ally Heal', healExpression: '1d8' }],
      },
    }

    it('returns null when early-return conditions are met', async () => {
      const nonHealingResult = await triggerPostCastAllyHeals({ name: 'Fireball' }, {}, baseStats, 'camp', 'map')
      expect(nonHealingResult).toBeNull()

      const cantripResult = await triggerPostCastAllyHeals({ name: 'Thaumaturgy', level: 0 }, {}, baseStats, 'camp', 'map')
      expect(cantripResult).toBeNull()

      const noStarryStats = { ...baseStats, activeBuffs: [] }
      const noStarryResult = await triggerPostCastAllyHeals(healingSpell, {}, noStarryStats, 'camp', 'map')
      expect(noStarryResult).toBeNull()

      const noHealStats = { ...baseStats, automation: { passives: [] } }
      const noHealResult = await triggerPostCastAllyHeals(healingSpell, {}, noHealStats, 'camp', 'map')
      expect(noHealResult).toBeNull()
    })

    it('returns modal signal when conditions are met', async () => {
      const allyStats = { ...baseStats, activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }] }
      const result = await triggerPostCastAllyHeals(healingSpell, {}, allyStats, 'camp', 'map')
      expect(result).toEqual({ needsModal: true, amount: 10 })
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'pendingStarryChaliceHeal',
        expect.objectContaining({
          amount: 10,
          casterName: 'Cleric1',
          campaignName: 'camp',
        }),
        'camp',
        true,
      )
    })

    it('skips when othersOnly and spell is self-targeted', async () => {
      const othersOnlyStats = {
        ...baseStats,
        automation: { passives: [{ type: 'post_cast_ally_heal', name: 'Others Only', othersOnly: true, healExpression: '1d8' }] },
      }
      const result = await triggerPostCastAllyHeals({ ...healingSpell, range: 'Self' }, {}, othersOnlyStats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('upgrades heal expression at level 10+', async () => {
      evaluateAutoExpression.mockReturnValue(15)
      const twinkledStats = { ...baseStats, level: 10, activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }] }
      await triggerPostCastAllyHeals(healingSpell, {}, twinkledStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('2d8', twinkledStats, 2, 10, 1)
    })

    it('handles multiple ally heal passives (returns first match)', async () => {
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
      expect(result).toEqual({ needsModal: true, amount: 10 })
    })

    it('throws when slot level is missing from both metaCtx and spell', async () => {
      const noSlotStats = { ...baseStats, level: 5, activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }] }
      const noSlotSpell = { name: 'Cure Wounds', level: null }
      await expect(
        triggerPostCastAllyHeals(noSlotSpell, {}, noSlotStats, 'camp', 'map')
      ).rejects.toThrow('slot level is required for post-cast ally heals')
    })
  })

  describe('applyStarryChaliceHeal', () => {
    it('heals a player target through applyHealingToTarget using runtime HP', async () => {
      getRuntimeValue.mockImplementation((caster, key, _camp) => {
        if (key === 'pendingStarryChaliceHeal') {
          return { amount: 15, casterName: 'Cleric1', campaignName: 'camp', targetNames: ['Cleric1', 'Ally1'], sourceName: 'Ally Heal' }
        }
        if (key === 'hitPoints') return 20
        return null
      })
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally1', type: 'player', currentHp: 10, maxHp: 20 }] })
      applyHealingToTarget.mockReturnValue({ actualHeal: 10, oldHp: 10, newHp: 20 })

      const result = await applyStarryChaliceHeal('Ally1', 'camp')

      expect(applyHealingToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally1', 15, 'camp')
      expect(applyHealingDirectly).not.toHaveBeenCalled()
      expect(result).toEqual({
        targetName: 'Ally1',
        actualHeal: 10,
        newHp: 20,
        maxHp: 20,
      })
      expect(logHealingToSSE).toHaveBeenCalledWith('camp', {
        targetName: 'Ally1',
        sourceName: 'Ally Heal',
        actualHeal: 10,
        newHp: 20,
        maxHp: 20,
      })
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'pendingStarryChaliceHeal',
        null,
        'camp',
        true,
      )
    })

    it('heals an NPC target through applyHealingToTarget with maxHp from combat summary', async () => {
      getRuntimeValue.mockImplementation((caster, key, _camp) => {
        if (key === 'pendingStarryChaliceHeal') {
          return { amount: 15, casterName: 'Cleric1', campaignName: 'camp', targetNames: ['Cleric1', 'Orc1'], sourceName: 'Ally Heal' }
        }
        return null
      })
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Orc1', type: 'npc', currentHp: 5, maxHp: 30 }] })
      applyHealingToTarget.mockReturnValue({ actualHeal: 10, oldHp: 5, newHp: 15 })

      const result = await applyStarryChaliceHeal('Orc1', 'camp')

      expect(applyHealingToTarget).toHaveBeenCalledWith(expect.any(Object), 'Orc1', 15, 'camp')
      expect(applyHealingDirectly).not.toHaveBeenCalled()
      expect(result).toEqual({
        targetName: 'Orc1',
        actualHeal: 10,
        newHp: 15,
        maxHp: 30,
      })
    })

    it('falls back to applyHealingDirectly when target is not in combat summary', async () => {
      getRuntimeValue.mockImplementation((caster, key, _camp) => {
        if (key === 'pendingStarryChaliceHeal') {
          return { amount: 15, casterName: 'Cleric1', campaignName: 'camp', targetNames: ['Cleric1'], sourceName: 'Ally Heal' }
        }
        if (key === 'currentHitPoints') return 10
        return null
      })
      getCombatSummary.mockReturnValue({ creatures: [] })
      applyHealingToTarget.mockReturnValue(null)

      const result = await applyStarryChaliceHeal('Cleric1', 'camp')

      expect(applyHealingToTarget).toHaveBeenCalledWith(expect.any(Object), 'Cleric1', 15, 'camp')
      expect(applyHealingDirectly).toHaveBeenCalledWith({}, 'Cleric1', 15, 'camp', null)
      expect(result).toEqual({
        targetName: 'Cleric1',
        actualHeal: 10,
        newHp: 20,
        maxHp: 20,
      })
    })

    it('returns null when no pending heal', async () => {
      getRuntimeValue.mockReturnValue(null)
      const result = await applyStarryChaliceHeal('Ally1', 'camp')
      expect(result).toBeNull()
    })
  })
})
