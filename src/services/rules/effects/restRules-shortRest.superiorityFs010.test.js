// @maintained-by-ai
// FS-010: Superiority Dice SHORT-rest restore lane (restRules-shortRest.js
// addFighterResourceUpdates). Mechanism: 'superiorityDice' is in
// SHORT_REST_RESOURCES (generic null re-arm) and addFighterResourceUpdates
// overwrites that null with the holder's ACTUAL max as a numeric byte —
// UNGATED (it runs at :440, before the skipAutoRecovery gate at :453), so
// the ShortRestModal lane (skipAutoRecovery:true) still performs the write.
// The bug being pinned: restoring null armed the consumers' `?? 4` phantom
// pool (2024 disk table Battle Master lv18 = 6; pure Superior Technique
// style fighters get exactly 1; holders of nothing keep the null re-arm).
// LR contrast: LONG_REST_RESOURCES null-re-arms the same key — the generic
// lane, no numeric overwrite there. Max-COUNT computation is owned by
// computeSuperiorityDiceMax (trackedResources) and die stride/actionType by
// maneuvers tests — this lane pins only the batch byte at a short rest.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyShortRest } from './restRules.js'
import { SHORT_REST_RESOURCES, LONG_REST_RESOURCES } from './restRules-constants.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}))

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
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
  // automation/index.js imports handle + confirm/skip statically — mock full surface
  handle: vi.fn(() => null),
  confirmCelestialResilience: vi.fn(() => null),
  skipCelestialResilience: vi.fn(() => null),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

import { getRuntimeValue, setRuntimeBatch, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'
const FIGHTER = 'Fs010Fighter'
const MAX_HP = 50

// Disk canon: 2024 classes.json Fighter table (Battle Master is a major).
const fighterTable = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8')
).find(c => c.name === 'Fighter')
const lv18 = fighterTable.class_levels.find(cl => cl.level === 18)

function makeFighter(cls) {
  return {
    name: FIGHTER,
    hitPoints: MAX_HP,
    level: 18,
    proficiency: 6,
    class: cls,
    abilities: [{ name: 'Strength', bonus: 3 }],
  }
}

function battleMaster2024() {
  return {
    name: 'Fighter',
    hit_point_die: 'd10',
    major: { name: 'Battle Master' },
    class_levels: [{ level: 18, second_wind: lv18.second_wind, superiority_dice: lv18.superiority_dice }],
  }
}

function batchUpdates() {
  expect(setRuntimeBatch).toHaveBeenCalledTimes(1)
  return vi.mocked(setRuntimeBatch).mock.calls[0][1]
}

describe('FS-010 applyShortRest — superiority dice restore lane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // vitest-4 re-seed: keep the undefined/empty defaults after clearing.
    vi.mocked(getRuntimeValue).mockReturnValue(undefined)
    vi.mocked(getAllStoreKeys).mockReturnValue([])
  })

  it('disk canon + registry membership: numeric overwrite of a registered null re-arm', () => {
    expect(fighterTable.majors.map(m => m.name)).toContain('Battle Master')
    expect(Number.isInteger(lv18.superiority_dice)).toBe(true)
    // The table max exceeds the consumers' `?? 4` phantom fallback — a null
    // write here is a real desync, which is exactly what FS-010 fixed.
    expect(lv18.superiority_dice).toBeGreaterThan(4)

    const styles = JSON.parse(
      readFileSync(resolve(process.cwd(), 'public/data/fighting-styles.json'), 'utf8')
    )
    expect(styles.map(s => s.name)).toContain('Superior Technique')

    // SR: the key IS in the generic null re-arm — addFighterResourceUpdates
    // must run AFTER that loop and win with the numeric max, on both lanes.
    expect(SHORT_REST_RESOURCES).toContain('superiorityDice')
    // LR contrast: long rest re-arms via the same generic null lane.
    expect(LONG_REST_RESOURCES).toContain('superiorityDice')
  })

  it.each([
    ['Battle Master lv18 (disk table max) — ungated default lane', undefined, battleMaster2024(), lv18.superiority_dice],
    ['Battle Master lv18 (disk table max) — modal lane skipAutoRecovery:true still restores (ungated)', { skipAutoRecovery: true }, battleMaster2024(), lv18.superiority_dice],
    ['5e Battle Master lv18 without class_levels dice — tier max 6, never the ??4 phantom', { skipAutoRecovery: true }, { name: 'Fighter', major: { name: 'Battle Master' }, class_levels: [] }, 6],
    ['pure Superior Technique fighter (Champion) — exactly 1', { skipAutoRecovery: true }, { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Superior Technique'], class_levels: [{ level: 18, second_wind: 1 }] }, 1],
    ['branch bait: Champion without the style — nothing to restore, registry null re-arm survives', { skipAutoRecovery: true }, { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Defense'], class_levels: [{ level: 18, second_wind: 1 }] }, null],
  ])('%s', async (_desc, options, cls, want) => {
    await applyShortRest(makeFighter(cls), CAMPAIGN, options)

    // One atomic batch; the superiority byte rides alongside the HP write.
    const updates = batchUpdates()
    expect(updates.currentHitPoints).toBe(MAX_HP)
    expect(updates.superiorityDice).toBe(want)
    expect(setRuntimeBatch).toHaveBeenCalledWith(
      FIGHTER,
      expect.objectContaining({ superiorityDice: want }),
      CAMPAIGN,
    )
  })
})
