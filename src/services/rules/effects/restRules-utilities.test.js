// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getHitDieSize,
  getShortRestResourceLabels,
  computeHitDieRecovery,
  computeShortRestHpNewCurrent,
  clearHuntersMarkConcentration,
  getShortRestResources,
  getLongRestResources,
  spellSlotLevels,
  SHORT_REST_RESOURCES,
  LONG_REST_RESOURCES,
} from './restRules.js'

// restRules.js is a barrel: the pure helpers and resource lists are
// re-exported verbatim from restRules-constants.js and exercised here
// through the barrel's public surface. Only clearHuntersMarkConcentration
// is impure — it reads/writes the three seams mocked below.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import * as storageService from '../../../services/ui/storage.js'

const CAMPAIGN = 'test-campaign'

describe('restRules utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // mockImplementation survives clearAllMocks — re-seed determinism per test
    vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
    vi.mocked(getCombatSummary).mockReturnValue(null)
  })

  describe('getHitDieSize', () => {
    it.each([
      ['parses the primary key', { class: { hit_point_die: 'd12' } }, 12],
      ['primary key wins over fallback', { class: { hit_point_die: 'd10', hit_die: 'd8' } }, 10],
      ['falls back to hit_die', { class: { hit_die: 'd8' } }, 8],
      ['extracts digits from a dirty string', { class: { hit_point_die: 'd10-extra' } }, 10],
      ['empty primary falls through to fallback', { class: { hit_point_die: '', hit_die: 'd12' } }, 12],
      ['non-numeric value defaults to 8', { class: { hit_point_die: 'dX' } }, 8],
      ['null stats defaults to 8', null, 8],
      ['missing class defaults to 8', {}, 8],
    ])('%s', (_case, stats, expected) => {
      expect(getHitDieSize(stats)).toBe(expected)
    })
  })

  describe('getShortRestResourceLabels', () => {
    // Full arrays pinned verbatim against the SHORT_REST_RESOURCE_LABELS
    // registry in restRules-constants.js (exact membership and order).
    it.each([
      ['Cleric', { class: { name: 'Cleric' } }, ['Channel Divinity']],
      ['Monk', { class: { name: 'Monk' } }, ['Focus Points']],
      ['Rogue without the Soulknife subclass gets nothing', { class: { name: 'Rogue' } }, []],
      ['Soulknife Rogue', { class: { name: 'Rogue', subclass: { name: 'Soulknife' } } }, ['Psionic Energy']],
      ['Fighter base', { class: { name: 'Fighter' } }, ['Second Wind', 'Action Surge']],
      ['Psi Warrior Fighter', { class: { name: 'Fighter', subclass: { name: 'Psi Warrior' } } }, ['Second Wind', 'Action Surge', 'Psionic Energy', 'Telekinetic Thrust']],
      ['Battle Master Fighter', { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } }, ['Second Wind', 'Action Surge', 'Superiority Dice']],
      ['Wizard', { class: { name: 'Wizard' } }, ['Arcane Recovery (Spell Slots)']],
      ['major.name acts as subclass fallback', { class: { name: 'Druid', major: { name: 'Circle of the Land' } } }, ['Wild Shape', 'Natural Recovery (Spell Slots)']],
      ['missing class', {}, []],
    ])('%s', (_case, stats, expected) => {
      expect(getShortRestResourceLabels(stats)).toEqual(expected)
    })

    // FS-010: Superior Technique style (non-Battle Master) also restores
    // Superiority Dice; other styles must not (label-layer owner for fs010).
    it('gates Superiority Dice on the Superior Technique fighting style', () => {
      expect(getShortRestResourceLabels({
        class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Superior Technique'] },
      })).toEqual(['Second Wind', 'Action Surge', 'Superiority Dice'])

      expect(getShortRestResourceLabels({
        class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Defense'] },
      })).toEqual(['Second Wind', 'Action Surge'])
    })
  })

  describe('computeHitDieRecovery', () => {
    it.each([
      ['adds the CON bonus', 5, 3, 8],
      ['deep negative CON floors at 1', 1, -5, 1],
      ['zero roll zero bonus floors at 1', 0, 0, 1],
      ['negative CON still pays out the remainder', 5, -2, 3],
    ])('%s', (_case, roll, conBonus, expected) => {
      expect(computeHitDieRecovery(roll, conBonus)).toBe(expected)
    })
  })

  describe('computeShortRestHpNewCurrent', () => {
    it.each([
      ['adds recovery to current HP', 10, 20, 5, 15],
      ['caps at maxHp', 18, 20, 5, 20],
      ['null currentHp starts from max', null, 20, 5, 20],
      ['empty-string currentHp starts from max', '', 20, 5, 20],
      ['zero HP is a real value, not missing', 0, 20, 5, 5],
      ['zero recovery leaves HP untouched', 10, 20, 0, 10],
      ['missing recovery is treated as 0', 10, 20, undefined, 10],
    ])('%s', (_case, currentHp, maxHp, recovered, expected) => {
      expect(computeShortRestHpNewCurrent(currentHp, maxHp, recovered)).toBe(expected)
    })
  })

  describe('clearHuntersMarkConcentration', () => {
    it('nulls the concentration, persists combatSummary, filters the buff, and broadcasts', () => {
      const cs = { creatures: [{ name: 'Caster', concentration: { spell: "Hunter's Mark" } }] }
      vi.mocked(getCombatSummary).mockReturnValue(cs)
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'activeBuffs' ? [{ name: "Hunter's Mark" }, { name: 'Haste' }] : undefined)
      const onUpdate = vi.fn()
      window.addEventListener('combat-summary-updated', onUpdate)
      try {
        clearHuntersMarkConcentration('Caster', CAMPAIGN)
      } finally {
        window.removeEventListener('combat-summary-updated', onUpdate)
      }
      expect(cs.creatures[0].concentration).toBeNull()
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Caster', 'activeBuffs', [{ name: 'Haste' }], CAMPAIGN)
      expect(onUpdate).toHaveBeenCalledTimes(1)
    })

    it('still persists a cleared concentration when the buff list has no Hunter\'s Mark to filter', () => {
      const cs = { creatures: [{ name: 'Caster', concentration: { spell: "Hunter's Mark" } }] }
      vi.mocked(getCombatSummary).mockReturnValue(cs)
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'activeBuffs' ? [{ name: 'Haste' }] : undefined)
      clearHuntersMarkConcentration('Caster', CAMPAIGN)
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it.each([
      ['combatSummary is null', null],
      ['combatSummary has no creatures list', {}],
      ['no creature with that name', { creatures: [{ name: 'Other', concentration: { spell: "Hunter's Mark" } }] }],
      ['creature is concentrated on another spell', { creatures: [{ name: 'Caster', concentration: { spell: 'Witch Bolt' } }] }],
      ['creature has no concentration', { creatures: [{ name: 'Caster', concentration: null }] }],
    ])('does nothing when %s', (_case, cs) => {
      vi.mocked(getCombatSummary).mockReturnValue(cs)
      clearHuntersMarkConcentration('Caster', CAMPAIGN)
      expect(storageService.default.set).not.toHaveBeenCalled()
      expect(setRuntimeValue).not.toHaveBeenCalled()
    })
  })

  describe('resource lists', () => {
    it.each([
      ['getShortRestResources', getShortRestResources, SHORT_REST_RESOURCES],
      ['getLongRestResources', getLongRestResources, LONG_REST_RESOURCES],
    ])('%s returns a defensive copy of the registry', (_case, getter, registry) => {
      const copy = getter()
      expect(copy).toEqual(registry)
      expect(copy).not.toBe(registry)
      copy.push('__mutated__')
      expect(getter()).not.toContain('__mutated__')
    })

    it('spellSlotLevels returns the nine spell slot levels', () => {
      expect(spellSlotLevels()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })
})
