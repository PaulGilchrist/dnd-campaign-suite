// @maintained-by-ai
// CLA-372 lane — SOLE OWNER of the uncannyMetabolismUsed latch rest-boundary
// contract (verified: no sibling test in this folder names the key, and it is
// NOT registered in LONG_REST_RESOURCES/SHORT_REST_RESOURCES, so the base lane's
// full-set batch proof in restRules-longRest.test.js does not subsume it).
// Contract faces, each pinned once:
//   1. Long Rest re-arms a SPENT latch (`true` seeded) to exact byte `false` —
//      store-backed overwrite, not a call-membership echo (restRules-longRest.js
//      resetFlags row `['uncannyMetabolismUsed', false]` inside the Psionic
//      Strike block; resetFlags writes skipSync=true).
//   2. Exactly ONE standalone write with the full byte tuple incl. skipSync=true,
//      and the atomic batch payload never carries the latch (a stale latch riding
//      the batch would broadcast spent/armed ordering bugs).
//   3. The "ONLY legitimate reset" half of CLA-372: a Short Rest must leave the
//      spent latch untouched — discriminated by its LIVE neighbor row
//      psionicStrikeUsedThisTurn (shortRest nulls it, must NOT null the latch).
// Consumers: initiativeHandler.js handleUncannyMetabolism stamps `true`
// (:212) and refuses while `=== true` (:157); useInitiativeEffects.js
// recoverPerfectFocus reads `=== true` (:261). The initiative-seam no-clear
// leg lives with initiativeProcessing.js:37-38 (comment) — initiative-lane
// tests own that seam; not re-mocked here (no over-mocking).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyLongRest, applyShortRest } from './restRules.js'

// Stateful runtime store: seeded spent-state must be observably overwritten;
// residue (latch staying `true`) fails the reset row loudly.
const { mockStore } = vi.hoisted(() => ({ mockStore: new Map() }))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => mockStore.get(`${name}::${key}`)),
  setRuntimeBatch: vi.fn((name, data) => {
    for (const [key, value] of Object.entries(data ?? {})) {
      mockStore.set(`${name}::${key}`, value)
    }
  }),
  setRuntimeValue: vi.fn((name, key, value) => {
    mockStore.set(`${name}::${key}`, value)
  }),
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

import { setRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'
const NAME = 'Disciplined_Monk'
const LATCH = 'uncannyMetabolismUsed'

function makeMonkStats(overrides = {}) {
  return {
    name: NAME,
    hitPoints: 129,
    level: 18,
    proficiency: 6,
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    automation: { passives: [] },
    ...overrides,
  }
}

// Arity-safe writer set: every standalone setRuntimeValue call for the latch.
function latchWrites() {
  return vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === NAME && c[1] === LATCH)
}

// The atomic batch payload fired for the monk (pins that the batch ran at all).
function batchPayload() {
  const call = vi.mocked(setRuntimeBatch).mock.calls.find(c => c[0] === NAME)
  expect(call, `${NAME} rest must fire one atomic batch`).toBeTruthy()
  return call[1]
}

beforeEach(() => {
  vi.clearAllMocks()  // clears call records; static vi.fn impls survive
  mockStore.clear()   // explicit store re-seed (clearAllMocks never touches Maps)
})

describe('CLA-372 — uncannyMetabolismUsed once-per-Long-Rest latch', () => {
  it('long rest re-arms a SPENT latch to exact byte `false`', async () => {
    mockStore.set(`${NAME}::${LATCH}`, true) // mid-adventure spent state

    await applyLongRest(makeMonkStats(), CAMPAIGN)

    // `false`, not null/undefined — proves the dedicated resetFlags row ran
    // and overwrote the seed (a deleted row leaves residue `true`).
    expect(mockStore.get(`${NAME}::${LATCH}`)).toBe(false)
  })

  it('long rest writes the latch exactly once with the full byte tuple (skipSync=true) and never carries it in the batch', async () => {
    mockStore.set(`${NAME}::${LATCH}`, true)

    await applyLongRest(makeMonkStats(), CAMPAIGN)

    expect(latchWrites()).toEqual([[NAME, LATCH, false, CAMPAIGN, true]])
    // The latch rides only the dedicated skipSync row — a stale spent/armed
    // value inside the atomic batch would broadcast wrong availability ordering.
    expect(batchPayload()).not.toHaveProperty(LATCH)
  })

  it('short rest does NOT re-arm the spent latch (once-per-LONG-rest)', async () => {
    mockStore.set(`${NAME}::${LATCH}`, true)

    await applyShortRest(makeMonkStats(), CAMPAIGN)

    expect(mockStore.get(`${NAME}::${LATCH}`)).toBe(true)
    expect(latchWrites()).toHaveLength(0)
    const batch = batchPayload()
    expect(batch).not.toHaveProperty(LATCH)
    // Branch discriminator: the short rest DID run its own Psionic Strike
    // neighbour reset (live row, restRules-shortRest.js SHORT_REST_NULL_FLAG_KEYS)
    // while correctly leaving the long-rest latch spent.
    expect(batch.psionicStrikeUsedThisTurn).toBeNull()
  })
})
