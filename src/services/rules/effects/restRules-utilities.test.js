// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
} from './restRules.js'

// Mock dependencies
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, key, _campaign) => {
    if (key === 'bastionOfLawWardTarget') return 'WardTarget';
    return undefined;
  }),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}))

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((level) => Math.max(0, level - 1)),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}))

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}))

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  clearAllConcentrations: vi.fn(),
}))

vi.mock('../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  grantCelestialResilience: vi.fn(() => null),
}))

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn((name, amount) => amount),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

// Import mocked functions for per-test customization
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import * as storageService from '../../../services/ui/storage.js'

const CAMPAIGN = 'test-campaign'

describe('restRules utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
      if (key === 'bastionOfLawWardTarget') return 'WardTarget';
      return undefined;
    })
  })

  describe('getHitDieSize', () => {
    it('returns the parsed die size from hit_point_die or hit_die', () => {
      expect(getHitDieSize({ class: { hit_point_die: 'd12' } })).toBe(12)
      expect(getHitDieSize({ class: { hit_die: 'd8' } })).toBe(8)
      expect(getHitDieSize({ class: { hit_point_die: 'd10-extra' } })).toBe(10)
    })

    it('returns 8 as default when playerStats, class, or hit_point_die is missing or falsy', () => {
      expect(getHitDieSize(null)).toBe(8)
      expect(getHitDieSize({})).toBe(8)
      expect(getHitDieSize({ class: { hit_point_die: null } })).toBe(8)
      expect(getHitDieSize({ class: { hit_point_die: '' } })).toBe(8)
    })
  })

  describe('getShortRestResourceLabels', () => {
    it('returns class-specific resource labels', () => {
      expect(getShortRestResourceLabels({ class: { name: 'Cleric' } })).toContain('Channel Divinity')
      expect(getShortRestResourceLabels({ class: { name: 'Druid' } })).toContain('Wild Shape')
      expect(getShortRestResourceLabels({ class: { name: 'Monk' } })).toContain('Focus Points')
      expect(getShortRestResourceLabels({ class: { name: 'Rogue' } })).toEqual([])
    })

    it('returns Fighter resources and respects subclass matching', () => {
      const fighterLabels = getShortRestResourceLabels({ class: { name: 'Fighter' } })
      expect(fighterLabels).toContain('Second Wind')
      expect(fighterLabels).toContain('Action Surge')
      expect(fighterLabels).not.toContain('Psionic Energy')
      expect(fighterLabels).not.toContain('Superiority Dice')

      const psiLabels = getShortRestResourceLabels({ class: { name: 'Fighter', subclass: { name: 'Psi Warrior' } } })
      expect(psiLabels).toContain('Psionic Energy')

      const battleLabels = getShortRestResourceLabels({ class: { name: 'Fighter', subclass: { name: 'Battle Master' } } })
      expect(battleLabels).toContain('Superiority Dice')

      // FS-010: Superior Technique style (non-Battle Master) also restores Superiority Dice
      const styleLabels = getShortRestResourceLabels({
        class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Superior Technique'] },
      })
      expect(styleLabels).toContain('Superiority Dice')

      const noStyleLabels = getShortRestResourceLabels({
        class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Defense'] },
      })
      expect(noStyleLabels).not.toContain('Superiority Dice')
    })

    it('uses major.name as fallback for subclass matching', () => {
      const labels = getShortRestResourceLabels({
        class: { name: 'Druid', major: { name: 'Circle of the Land' } },
      })
      expect(labels).toContain('Natural Recovery (Spell Slots)')
    })

    it('returns empty array when class is missing', () => {
      expect(getShortRestResourceLabels({})).toEqual([])
    })
  })

  describe('computeHitDieRecovery', () => {
    it('returns roll + conBonus when positive, minimum 1', () => {
      expect(computeHitDieRecovery(5, 3)).toBe(8)
      expect(computeHitDieRecovery(1, -5)).toBe(1)
      expect(computeHitDieRecovery(0, 0)).toBe(1)
      expect(computeHitDieRecovery(5, -2)).toBe(3)
    })
  })

  describe('computeShortRestHpNewCurrent', () => {
    it('adds recovered amount to currentHp capped at maxHp', () => {
      expect(computeShortRestHpNewCurrent(10, 20, 5)).toBe(15)
      expect(computeShortRestHpNewCurrent(18, 20, 5)).toBe(20)
    })

    it('uses maxHp as base when currentHp is null or empty string', () => {
      expect(computeShortRestHpNewCurrent(null, 20, 5)).toBe(20)
      expect(computeShortRestHpNewCurrent('', 20, 5)).toBe(20)
    })

    it('handles zero recovery', () => {
      expect(computeShortRestHpNewCurrent(null, 20, 0)).toBe(20)
      expect(computeShortRestHpNewCurrent(10, 20, 0)).toBe(10)
    })
  })

  describe('clearHuntersMarkConcentration', () => {
    it('clears Hunter\'s Mark concentration and removes from activeBuffs when creature has it', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: "Hunter's Mark" }, { name: 'Haste' }]
        return undefined
      })
      vi.mocked(getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Caster', concentration: { spell: "Hunter's Mark" } }],
      })
      clearHuntersMarkConcentration('Caster', CAMPAIGN)
      expect(storageService.default.set).toHaveBeenCalled()
      expect(setRuntimeValue).toHaveBeenCalledWith('Caster', 'activeBuffs', [{ name: 'Haste' }], CAMPAIGN)
    })

    it('does nothing when creature is not found', () => {
      vi.clearAllMocks()
      vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] })
      clearHuntersMarkConcentration('NonExistent', CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('does nothing when creature has no Hunter\'s Mark concentration', () => {
      vi.clearAllMocks()
      vi.mocked(getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Caster', concentration: { spell: 'Witch Bolt' } }],
      })
      clearHuntersMarkConcentration('Caster', CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('does nothing when creature has no concentration', () => {
      vi.clearAllMocks()
      vi.mocked(getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Caster', concentration: null }],
      })
      clearHuntersMarkConcentration('Caster', CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('does nothing when combatSummary is null', () => {
      vi.clearAllMocks()
      vi.mocked(getCombatSummary).mockReturnValue(null)
      clearHuntersMarkConcentration('Caster', CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalled()
    })
  })

  describe('resource/slot getters', () => {
    it('getShortRestResources returns a copy of SHORT_REST_RESOURCES', () => {
      const resources = getShortRestResources()
      expect(Array.isArray(resources)).toBe(true)
      expect(resources.length).toBeGreaterThan(0)
      expect(resources).not.toBe(getShortRestResources())
    })

    it('getLongRestResources returns a copy of LONG_REST_RESOURCES', () => {
      const resources = getLongRestResources()
      expect(Array.isArray(resources)).toBe(true)
      expect(resources.length).toBeGreaterThan(0)
      expect(resources).not.toBe(getLongRestResources())
    })

    it('spellSlotLevels returns array 1-9', () => {
      expect(spellSlotLevels()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })
})
