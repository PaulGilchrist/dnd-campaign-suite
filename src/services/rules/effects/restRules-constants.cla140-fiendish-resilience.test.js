// @maintained-by-ai
// BUG CLA-140 rest-lane lock: 2024 (and 5e) classes.json Fiend Patron lv10 Fiendish
// Resilience re-chooses "when you finish a Short or Long Rest" — the used-latch
// `_fiendishResilienceUsed` (written true by fiendishResilienceHandler.applyTypeChoice
// via setRuntimeValue) must be null-re-armed by BOTH rest lanes. The chosen type is
// stored by choiceStorage.makeKey as `_Fiendish_Resilience_chosenType` and persists
// "until you choose a different one" — it must appear in NEITHER lane's batch bytes nor
// any standalone setRuntimeValue write. Registration membership is NOT echoed statically:
// applyShortRest nulls every SHORT_REST_RESOURCES key (restRules-shortRest.js:437-439)
// and buildLongRestCharData nulls every LONG_REST_RESOURCES key
// (restRules-longRest.js:64-66), so the observed batch null byte subsumes membership.
// Owned elsewhere: once-per-rest refusal, modal payload, applyTypeChoice writes and log
// copy in fiendishResilienceHandler.test.js; passive resistance collection in
// automationPassives.test.js; consumer modal routing in useCharActionsAutomation.test.js.
// Mock surface mirrors sibling cla048/cla096/cla099/cla130 rest-lane tests verbatim.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import classes5e from '../../../../public/data/classes.json' with { type: 'json' }
import classes2024 from '../../../../public/data/2024/classes.json' with { type: 'json' }

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

import { applyShortRest, applyLongRest } from './restRules.js'
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'
const CHAR = 'HexWarlock'
// Latch written by fiendishResilienceHandler.applyTypeChoice; chosen-type key derived
// by choiceStorage.makeKey(feature name 'Fiendish Resilience' + suffix 'chosenType').
const LATCH = '_fiendishResilienceUsed'
const CHOSEN = '_Fiendish_Resilience_chosenType'

function makeStats() {
  return {
    name: CHAR,
    hitPoints: 100,
    level: 20,
    proficiency: 6,
    class: { name: 'Warlock', hit_point_die: 'd10' },
    abilities: [{ name: 'Charisma', bonus: 5 }],
  }
}

// Premise: the feature has been used (latch spent) with a chosen type in store.
function spentStore() {
  vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
    key === LATCH ? true : key === CHOSEN ? 'Fire' : undefined)
}

function batchFor(name) {
  const call = setRuntimeBatch.mock.calls.find(c => c[0] === name)
  expect(call, `${name} rest lane must fire one atomic batch`).toBeTruthy()
  return call[1]
}

function findFeature(classes, featureName) {
  let found = null
  const walk = (node) => {
    if (found || !node || typeof node !== 'object') return
    if (node.name === featureName && node.automation) { found = node; return }
    (Array.isArray(node) ? node : Object.values(node)).forEach(walk)
  }
  walk(classes)
  return found
}

describe('CLA-140 Fiendish Resilience rest-lane contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spentStore()
  })

  it('canon: classes.json Fiendish Resilience re-chooses on a Short OR Long Rest; type persists until changed', () => {
    for (const classes of [classes5e, classes2024]) {
      const feature = findFeature(classes, 'Fiendish Resilience')
      expect(feature, 'feature row exists on disk').toBeTruthy()
      expect(feature.level).toBe(10)
      expect(feature.automation.type).toBe('damage_type_choice')
      expect(feature.automation.effect).toBe('fiendish_resilience')
      expect(feature.automation.casting_time).toBe('passive')
      // Both clauses drive this file's two assertions below: the latch re-arms on
      // EITHER rest, but the chosen type survives BOTH.
      expect(feature.description).toMatch(/finish a short or long rest/i)
      expect(feature.description).toMatch(/until you choose a different one/i)
    }
  })

  it.each([
    ['Short Rest', applyShortRest],
    ['Long Rest', applyLongRest],
  ])('%s null-re-arms the spent latch in the atomic batch and never touches the chosen type', async (lane, applyRest) => {
    await applyRest(makeStats(), CAMPAIGN)

    const updates = batchFor(CHAR)
    // Exact null byte — subsumes registration membership in the lane's resource list.
    expect(updates, `${lane}: ${LATCH} must be null-re-armed so the feature re-chooses`).toHaveProperty(LATCH, null)
    expect(updates, `${lane}: chosen type persists "until you choose a different one"`).not.toHaveProperty(CHOSEN)
    // Arity-safe: no standalone write of the chosen key at any argument count.
    expect(setRuntimeValue.mock.calls.filter(c => c[1] === CHOSEN), `${lane}: must never rewrite the chosen type`).toHaveLength(0)
  })
})
