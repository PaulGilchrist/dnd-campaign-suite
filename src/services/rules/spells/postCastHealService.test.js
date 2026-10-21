// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  triggerPostCastSelfHeals,
  triggerPostCastAllyHeals,
  applyStarryChaliceHeal,
} from './postCastHealService.js'

vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

// resolveDiceExpression stays REAL (token resolution of 'spell_slot_level'
// from automationExpressions.js:166 is part of this lane's contract).
vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
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
const { rollExpression } = await import('../../dice/diceRoller.js')
const { applyHealingDirectly, logHealingToSSE } = await import('../../automation/common/healingRoll.js')
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
const { getCombatSummary } = await import('../../encounters/combatData.js')
const { applyHealingToTarget } = await import('../combat/applyHealing.js')

describe('postCastHealService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    evaluateAutoExpression.mockReturnValue(10)
    rollExpression.mockReturnValue({ total: 7, rolls: [6, 1], formula: '2d8+1' })
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

    it('refuses non-healing, cantrip, and unnamed spells before rolling; matches spell names case-insensitively', async () => {
      const fireSnap = JSON.stringify(baseStats)

      // Fireball is not a healing spell; 'healing word' at level 0 is a cantrip
      // gate (source :51); unnamed spell cannot match the 15-name family (source :9-29).
      await expect(triggerPostCastSelfHeals({ name: 'Fireball', level: 3 }, {}, baseStats, 'camp', 'map')).resolves.toBeNull()
      await expect(triggerPostCastSelfHeals({ name: 'Healing Word', level: 0 }, {}, baseStats, 'camp', 'map')).resolves.toBeNull()
      await expect(triggerPostCastSelfHeals({ level: 1 }, {}, baseStats, 'camp', 'map')).resolves.toBeNull()
      expect(evaluateAutoExpression).not.toHaveBeenCalled()
      expect(applyHealingDirectly).not.toHaveBeenCalled()

      // Uppercase name still rides the lowercase set comparison (source :28).
      const result = await triggerPostCastSelfHeals({ name: 'CURE WOUNDS', level: 1 }, {}, baseStats, 'camp', 'map')
      expect(result).toEqual([{ name: 'Test Heal', amount: 10, actualHeal: 10 }])
      expect(JSON.stringify(baseStats)).toBe(fireSnap) // input purity
    })

    it('honors CLA-038 othersOnly against range, resolved targets, and unknown-target fallback', async () => {
      // Disk row verbatim: public/data/classes.json Cleric/Life lvl 6 +
      // public/data/2024/classes.json Cleric/Life Domain: healExpression
      // '2 + spell_slot_level', othersOnly true.
      const blessedStats = {
        ...baseStats,
        automation: {
          passives: [{ type: 'post_cast_self_heal', name: 'Blessed Healer', healExpression: '2 + spell_slot_level', othersOnly: true }],
        },
      }
      const puritySnap = JSON.stringify([blessedStats, healingSpell])

      // Range 'Self' refuses before the roll (source :84-86).
      await expect(triggerPostCastSelfHeals({ ...healingSpell, range: 'Self' }, {}, blessedStats, 'camp', 'map')).resolves.toBeNull()
      // Touch/ranged cast on self only refuses via target identity (source :89-91);
      // singular metaCtx.targetName is folded into the name list (source :73-75).
      await expect(triggerPostCastSelfHeals({ ...healingSpell, range: 'Touch' }, { slotLevel: 1, targetNames: ['Cleric1'] }, blessedStats, 'camp', 'map')).resolves.toBeNull()
      await expect(triggerPostCastSelfHeals({ ...healingSpell, range: '60 feet' }, { slotLevel: 1, targetName: 'Cleric1' }, blessedStats, 'camp', 'map')).resolves.toBeNull()
      expect(evaluateAutoExpression).not.toHaveBeenCalled()
      expect(applyHealingDirectly).not.toHaveBeenCalled()

      // Unknown target set (countHealedOthers === null) still fires — documented
      // legacy fallback (source :70-77, :89 strict ===0).
      const legacyResult = await triggerPostCastSelfHeals({ ...healingSpell, range: 'Touch' }, { slotLevel: 1 }, blessedStats, 'camp', 'map')
      expect(legacyResult).toEqual([{ name: 'Blessed Healer', amount: 10, actualHeal: 10 }])

      // Healed other fires with the disk expression token-resolved by the REAL
      // resolveDiceExpression: '2 + spell_slot_level' -> '2 + 3' at slot 3.
      const result = await triggerPostCastSelfHeals({ ...healingSpell, range: 'Touch' }, { slotLevel: 3, targetNames: ['Cleric1', 'Ally2'] }, blessedStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenCalledWith('2 + 3', blessedStats, 2, 5, 3)
      expect(result).toEqual([{ name: 'Blessed Healer', amount: 10, actualHeal: 10 }])
      expect(applyHealingDirectly).toHaveBeenCalledTimes(2)
      expect(applyHealingDirectly).toHaveBeenLastCalledWith(blessedStats, 'Cleric1', 10, 'camp')
      expect(logHealingToSSE).toHaveBeenLastCalledWith('camp', {
        targetName: 'Cleric1',
        sourceName: 'Blessed Healer',
        actualHeal: 10,
        newHp: 20,
        maxHp: 20,
      })
      expect(JSON.stringify([blessedStats, healingSpell])).toBe(puritySnap) // input purity
    })

    it('upgrades 1d8 to 2d8 only at level 10+ and resolves slot precedence metaCtx over spell (0 swallowed by ||)', async () => {
      const stats9 = { ...baseStats, level: 9 }
      await triggerPostCastSelfHeals({ name: 'Cure Wounds', level: 2 }, {}, stats9, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenLastCalledWith('1d8', stats9, 2, 9, 2)

      const stats10 = { ...baseStats, level: 10 }
      await triggerPostCastSelfHeals({ name: 'Cure Wounds', level: 2 }, {}, stats10, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenLastCalledWith('2d8', stats10, 2, 10, 2)

      // metaCtx.slotLevel wins over spell.level (source :66).
      await triggerPostCastSelfHeals({ name: 'Cure Wounds', level: 2 }, { slotLevel: 5 }, baseStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenLastCalledWith('1d8', baseStats, 2, 5, 5)

      // quirk pin: source :66 uses ||, so metaCtx.slotLevel 0 falls back to spell.level.
      await triggerPostCastSelfHeals({ name: 'Cure Wounds', level: 3 }, { slotLevel: 0 }, baseStats, 'camp', 'map')
      expect(evaluateAutoExpression).toHaveBeenLastCalledWith('1d8', baseStats, 2, 5, 3)
      expect(rollExpression).not.toHaveBeenCalled() // numeric evaluate path, no dice forwarder
    })

    it('throws on missing player level or missing slot level before rolling, and swallows zero-result heals', async () => {
      const noLevelStats = { ...baseStats }
      delete noLevelStats.level
      await expect(triggerPostCastSelfHeals(healingSpell, {}, noLevelStats, 'camp', 'map'))
        .rejects.toThrow('playerStats.level is required for post-cast self heals')

      await expect(triggerPostCastSelfHeals({ name: 'Cure Wounds', level: null }, {}, baseStats, 'camp', 'map'))
        .rejects.toThrow('slot level is required for post-cast self heals')
      expect(evaluateAutoExpression).not.toHaveBeenCalled() // both throw paths precede the roll

      // Roll of 0 is swallowed: no apply, no log, null result (source :104, :126).
      evaluateAutoExpression.mockReturnValue(0)
      await expect(triggerPostCastSelfHeals(healingSpell, {}, baseStats, 'camp', 'map')).resolves.toBeNull()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
      expect(logHealingToSSE).not.toHaveBeenCalled()

      // quirk pin: full target (apply reports actualHeal 0) still returns a row
      // and logs a delta-0 heal to SSE (source :132-140, #1384/85 delta-0 class).
      evaluateAutoExpression.mockReturnValue(10)
      applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 0 })
      await expect(triggerPostCastSelfHeals(healingSpell, {}, baseStats, 'camp', 'map'))
        .resolves.toEqual([{ name: 'Test Heal', amount: 10, actualHeal: 0 }])
      expect(logHealingToSSE).toHaveBeenCalledWith('camp', {
        targetName: 'Cleric1',
        sourceName: 'Test Heal',
        actualHeal: 0,
        newHp: 20,
        maxHp: 20,
      })
    })

    it('forwards non-numeric rolls to rollExpression and continues past zero-amount passives', async () => {
      const multiStats = {
        ...baseStats,
        automation: {
          passives: [
            { type: 'post_cast_self_heal', name: 'Heal 1', healExpression: '2d8+1' },
            { type: 'post_cast_self_heal', name: 'Heal 2', healExpression: '2d8+1' },
          ],
        },
      }
      evaluateAutoExpression.mockReturnValue('2d8+1') // string -> forwarder branch (source :100-102)
      applyHealingDirectly.mockImplementation((_stats, _name, amount) => ({ newHp: 20, maxHp: 20, actualHeal: amount }))
      rollExpression.mockReturnValueOnce({ total: 0, rolls: [], formula: '2d8+1' })

      const result = await triggerPostCastSelfHeals(healingSpell, {}, multiStats, 'camp', 'map')
      expect(rollExpression).toHaveBeenCalledTimes(2)
      expect(rollExpression).toHaveBeenNthCalledWith(1, '2d8+1')
      expect(applyHealingDirectly).toHaveBeenCalledTimes(1)
      expect(applyHealingDirectly).toHaveBeenCalledWith(multiStats, 'Cleric1', 7, 'camp')
      expect(result).toEqual([{ name: 'Heal 2', amount: 7, actualHeal: 7 }])
    })
  })

  describe('triggerPostCastAllyHeals', () => {
    const healingSpell = { name: 'Cure Wounds', level: 1 }
    const chaliceStats = {
      name: 'Cleric1',
      proficiency: 2,
      level: 5,
      activeBuffs: [{ name: 'Starry Form', constellation: 'Chalice' }],
      automation: {
        passives: [{ type: 'post_cast_ally_heal', name: 'Ally Heal', healExpression: '1d8' }],
      },
    }

    it('refuses non-healing, cantrip, missing-Starry, and non-Chalice casts before spending', async () => {
      await expect(triggerPostCastAllyHeals({ name: 'Fireball', level: 3 }, {}, chaliceStats, 'camp', 'map')).resolves.toBeNull()
      await expect(triggerPostCastAllyHeals({ name: 'Healing Word', level: 0 }, {}, chaliceStats, 'camp', 'map')).resolves.toBeNull()

      const noStarryStats = { ...chaliceStats, activeBuffs: [] }
      await expect(triggerPostCastAllyHeals(healingSpell, {}, noStarryStats, 'camp', 'map')).resolves.toBeNull()

      // Archer/Dragon constellations must not arm the Chalice heal (source :42).
      const archerStats = { ...chaliceStats, activeBuffs: [{ name: 'Starry Form', constellation: 'Archer' }] }
      await expect(triggerPostCastAllyHeals(healingSpell, {}, archerStats, 'camp', 'map')).resolves.toBeNull()

      const noHealStats = { ...chaliceStats, automation: { passives: [] } }
      await expect(triggerPostCastAllyHeals(healingSpell, {}, noHealStats, 'camp', 'map')).resolves.toBeNull()

      expect(evaluateAutoExpression).not.toHaveBeenCalled()
      expect(setRuntimeValue).not.toHaveBeenCalled() // refuse-before-spend
    })

    it('arms the pending Chalice modal with the exact payload and consumes only the first passive', async () => {
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally1' }, { name: 'Cleric1' }] })
      const multiStats = {
        ...chaliceStats,
        automation: {
          passives: [
            { type: 'post_cast_ally_heal', name: 'Heal 1', healExpression: '1d8' },
            { type: 'post_cast_ally_heal', name: 'Heal 2', healExpression: '1d8' },
          ],
        },
      }

      const result = await triggerPostCastAllyHeals(healingSpell, {}, multiStats, 'camp', 'map')
      expect(result).toEqual({ needsModal: true, amount: 10 })
      // Target census (source :165-175): caster first, combat creatures minus caster;
      // a duplicate caster entry in the summary is filtered out.
      expect(setRuntimeValue).toHaveBeenCalledTimes(1)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'pendingStarryChaliceHeal',
        { amount: 10, casterName: 'Cleric1', campaignName: 'camp', targetNames: ['Cleric1', 'Ally1'], sourceName: 'Heal 1' },
        'camp',
        true,
      )
    })

    it('prefers runtime activeBuffs over local stats and falls back when runtime is absent or non-array', async () => {
      // Runtime array with Chalice arms even though local stats are empty (source :38-39).
      getRuntimeValue.mockImplementation((_name, key) =>
        key === 'activeBuffs' ? [{ name: 'Starry Form', constellation: 'Chalice' }] : null)
      const emptyLocalStats = { ...chaliceStats, activeBuffs: [] }
      await expect(triggerPostCastAllyHeals(healingSpell, {}, emptyLocalStats, 'camp', 'map'))
        .resolves.toEqual({ needsModal: true, amount: 10 })

      // Non-array runtime value falls back to local stats.activeBuffs (source :39).
      getRuntimeValue.mockImplementation((_name, key) =>
        key === 'activeBuffs' ? 'junk' : null)
      await expect(triggerPostCastAllyHeals(healingSpell, {}, chaliceStats, 'camp', 'map'))
        .resolves.toEqual({ needsModal: true, amount: 10 })
    })
  })

  describe('applyStarryChaliceHeal', () => {
    it('returns null without touching any heal or log channel when nothing is pending', async () => {
      await expect(applyStarryChaliceHeal('Ally1', 'camp')).resolves.toBeNull()
      expect(applyHealingToTarget).not.toHaveBeenCalled()
      expect(applyHealingDirectly).not.toHaveBeenCalled()
      expect(logHealingToSSE).not.toHaveBeenCalled()
      expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('heals a player through applyHealingToTarget with runtime maxHp overriding combat-summary maxHp, then nulls the latch', async () => {
      const cs = { creatures: [{ name: 'Ally1', type: 'player', currentHp: 10, maxHp: 20 }] }
      getCombatSummary.mockReturnValue(cs)
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'pendingStarryChaliceHeal') {
          return { amount: 15, casterName: 'Cleric1', campaignName: 'camp', targetNames: ['Cleric1', 'Ally1'], sourceName: 'Ally Heal' }
        }
        if (key === 'hitPoints') return 95 // maxHp-override lane (mass heal modal precedent)
        return null
      })
      applyHealingToTarget.mockReturnValue({ actualHeal: 10, oldHp: 10, newHp: 20 })

      const result = await applyStarryChaliceHeal('Ally1', 'camp')

      expect(applyHealingToTarget.mock.calls[0][0]).toBe(cs) // same object identity, exact args
      expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Ally1', 15, 'camp')
      expect(applyHealingDirectly).not.toHaveBeenCalled()
      expect(result).toEqual({ targetName: 'Ally1', actualHeal: 10, newHp: 20, maxHp: 95 })
      expect(logHealingToSSE).toHaveBeenCalledWith('camp', {
        targetName: 'Ally1',
        sourceName: 'Ally Heal',
        actualHeal: 10,
        newHp: 20,
        maxHp: 95,
      })
      expect(setRuntimeValue).toHaveBeenCalledTimes(1)
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'pendingStarryChaliceHeal', null, 'camp', true)
    })

    it('takes NPC maxHp from the combat summary, preferring it over the runtime key', async () => {
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Orc1', type: 'npc', currentHp: 5, maxHp: 30 }] })
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'pendingStarryChaliceHeal') {
          return { amount: 15, casterName: 'Cleric1', campaignName: 'camp', targetNames: ['Cleric1', 'Orc1'], sourceName: 'Ally Heal' }
        }
        if (key === 'hitPoints') return 99 // must NOT win on the npc branch (source :198)
        return null
      })
      applyHealingToTarget.mockReturnValue({ actualHeal: 10, oldHp: 5, newHp: 15 })

      const result = await applyStarryChaliceHeal('Orc1', 'camp')

      expect(result).toEqual({ targetName: 'Orc1', actualHeal: 10, newHp: 15, maxHp: 30 })
      expect(logHealingToSSE).toHaveBeenCalledWith('camp', {
        targetName: 'Orc1',
        sourceName: 'Ally Heal',
        actualHeal: 10,
        newHp: 15,
        maxHp: 30,
      })
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'pendingStarryChaliceHeal', null, 'camp', true)
    })

    it('falls back to applyHealingDirectly with its full 5-argument contract when applyHealingToTarget returns null', async () => {
      getRuntimeValue.mockImplementation((_name, key) =>
        key === 'pendingStarryChaliceHeal'
          ? { amount: 15, casterName: 'Cleric1', campaignName: 'camp', targetNames: ['Cleric1'], sourceName: 'Ally Heal' }
          : null)
      getCombatSummary.mockReturnValue({ creatures: [] })
      applyHealingToTarget.mockReturnValue(null)

      const result = await applyStarryChaliceHeal('Cleric1', 'camp')

      // Real signature: applyHealingDirectly(playerStats, targetName, amount, campaignName, targetMaxHp)
      expect(applyHealingDirectly).toHaveBeenCalledWith({}, 'Cleric1', 15, 'camp', null)
      expect(result).toEqual({ targetName: 'Cleric1', actualHeal: 10, newHp: 20, maxHp: 20 })
      expect(logHealingToSSE).toHaveBeenCalledWith('camp', {
        targetName: 'Cleric1',
        sourceName: 'Ally Heal',
        actualHeal: 10,
        newHp: 20,
        maxHp: 20,
      })
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'pendingStarryChaliceHeal', null, 'camp', true)
    })
  })
})
