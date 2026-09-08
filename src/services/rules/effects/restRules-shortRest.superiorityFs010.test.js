import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyShortRest } from './restRules.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}))

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}))

vi.mock('../../combat/conditions/exhaustionRules', () => ({
  getLevelAfterLongRest: vi.fn((level) => level),
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

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

import { setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'

const makeFighter = (overrides = {}) => ({
  name: 'TestFighter',
  hitPoints: 50,
  rules: '2024',
  level: 18,
  proficiency: 6,
  class: { name: 'Fighter', hit_point_die: 'd10', class_levels: [{ level: 18, second_wind: 1, superiority_dice: 8 }] },
  abilities: [{ name: 'Strength', bonus: 3 }],
  ...overrides,
})

const batchUpdates = () => vi.mocked(setRuntimeBatch).mock.calls.at(-1)[1]

describe('applyShortRest — FS-010 superiority die restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValueHelper).mockReturnValue(undefined)
  })

  it('restores Superiority Dice to 1 for a pure Superior Technique fighter (not null)', async () => {
    await applyShortRest(makeFighter({
      class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Superior Technique'], class_levels: [{ level: 18, second_wind: 1 }] },
    }), CAMPAIGN)

    expect(batchUpdates().superiorityDice).toBe(1)
  })

  it('restores Battle Master Superiority Dice to the level-table count', async () => {
    await applyShortRest(makeFighter({
      class: { name: 'Fighter', subclass: { name: 'Battle Master' }, class_levels: [{ level: 18, second_wind: 1, superiority_dice: 8 }] },
    }), CAMPAIGN)

    expect(batchUpdates().superiorityDice).toBe(8)
  })

  it('leaves Superiority Dice null for fighters without dice to restore', async () => {
    await applyShortRest(makeFighter({
      class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Defense'], class_levels: [{ level: 18, second_wind: 1 }] },
    }), CAMPAIGN)

    expect(batchUpdates().superiorityDice).toBeNull()
  })
})

import { getRuntimeValue as getRuntimeValueHelper } from '../../../hooks/runtime/useRuntimeState.js'
