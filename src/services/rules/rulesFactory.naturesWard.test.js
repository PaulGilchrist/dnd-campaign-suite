// @maintained-by-ai
// CLA-237 lane: Nature's Ward compute-time merge inside rulesFactory.getPlayerStats
// (rulesFactory.js:148-176) ONLY. Host feature: "Nature's Ward" 2024 Druid Circle of
// the Land lv10, public/data/2024/classes.json:3943 (straight-apostrophe byte 0x27
// verified via hexdump; automation envelope at :3946-3958 mirrored verbatim at
// public/data/classes.json:5377-5389).
// Owns: runtime _circleOfTheLandType governs and flips live, class.major/subclass.type
// is the fallback when the runtime key holds the long-rest null byte
// (restRules-longRest.js:330), runtime BEATS class JSON when both are set and differ
// (CharSheet.jsx display injects class.major/subclass.type locally while damage path
// consults runtime — the CLA-237 split that broke), the threaded campaignName arg-shape
// census (fix#339: store reader is arity-2 useRuntimeState.js:63 — campaignName is
// channel vocabulary, resolution is campaign-blind until #1520), and the poisoned
// conditionImmunity leg independent of land type.
// Producer bytes: CircleOfTheLandSpellsModal.jsx:22 writes landType.name capitalized
// ('Arid'/'Polar'/'Temperate'/'Tropical') WITH campaignName; the store mock routes on
// the production (characterKey, propertyName) pair (fix#339 flip: the pre-fix triple
// mock claimed a campaign-scoped read production cannot honor — pin-lie retired per
// #1348; arg-drop/reorder falsifiability moved to the exact call-shape census below).
// Cited, not duplicated: rulesFactory.test.js owns the selector matrix, the synthetic
// class-type ladder (match/mismatch, major>subclass, trim) and the :153 landMappings
// console.error/throw guard; automationPassives.landResistance.test.js owns the
// predicate byte census; applyDamage.natures-ward.test.js owns halving arithmetic +
// log; CircleOfTheLandSpellsModal.test.jsx owns the runtime WRITE side.
// Quirk scan: rulesFactory.js:158-161 'Expected class to be an object' guard is
// never-executed in production — real classRules.getClass (:31-33) and
// classRules2024.getClass (:83-85) both fall back to { class_levels: [] }, never null;
// reported, deliberately unpinned (pinning it would require a lying mock). Zero
// timers, zero Date.now, no localStorage, no clock stamps in this lane (passive
// feature, no durations). Mocks audited against live-graph imports of rulesFactory.js
// (:1-8): rules.getPlayerStats is the sole trunk call; raceRules supplies the four
// exports the factory touches (getRace/getImmunities/getResistances/getSenses);
// the factory selector itself is never mocked.
// Input purity: druidSummary() is a fresh object per call (mergeDefenseList mutates
// playerStats, not the summary); NATURES_WARD_PASSIVE is read-only consulted.
// Old -> new: 5 -> 3 tests (runtime-resolve + flip folded into test 1; class-fallback
// strengthened into the fallback/precedence ladder in test 2; no-resistance control and
// immunity-independence merged into test 3 on one call).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import rulesFactory from './rulesFactory.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'

vi.mock('./rules.js', () => ({
  default: {
    // Sole rules.js export rulesFactory.js consumes (:1, :97).
    getPlayerStats: vi.fn(async ({ playerSummary: summary }) => ({
      ...summary,
      class: summary.class || { name: 'Druid', class_levels: [] },
      race: {},
      immunities: [],
      resistances: summary.resistances || [],
      automation: summary.automation || { passives: [] },
      level: 20,
    })),
  },
}))

vi.mock('../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(() => ({ name: 'Human' })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
  rules2024: {
    getRace: vi.fn(() => ({ name: 'Human' })),
    getImmunities: vi.fn(() => []),
    getResistances: vi.fn(() => []),
    getSenses: vi.fn(() => []),
  },
}))

// Mirrors the real getClass contract: ALWAYS an object, never null — which is
// exactly why the factory :158 null guard is unreachable (see header).
vi.mock('../character/classRules.js', () => ({
  default: {
    getClass: vi.fn((_allClasses, playerSummary) => ({ ...(playerSummary?.class || {}) })),
  },
}))

vi.mock('../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn((_allClasses, playerSummary) => ({ ...(playerSummary?.class || {}) })),
  },
}))

vi.mock('./trackedResources.js', () => ({
  computeTrackedResources: vi.fn(() => ({})),
}))

vi.mock('../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => null),
}))

// fix#339 flip: route on the REAL arity-2 signature getRuntimeValue(characterKey,
// propertyName) (useRuntimeState.js:63) — production is campaign-blind at read time;
// the old triple-route mock pinned a scoping claim production never honored.
// Threaded-arg falsifiability lives in the exact call-shape census (test 1).
const runtimeStore = new Map()
const LAND_STORE_KEY = 'Wild_Sage_Druid:_circleOfTheLandType'
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeStore.get(`${name}:${key}`) ?? null),
}))

// Byte-exact Nature's Ward automation envelope from public/data/2024/classes.json
// (:3946-3958; 5e mirror at public/data/classes.json:5377-5389).
const NATURES_WARD_PASSIVE = {
  type: 'land_resistance',
  conditionImmunity: 'poisoned',
  landMappings: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
  casting_time: 'passive',
}

const druidSummary = () => ({
  name: 'Wild_Sage_Druid',
  campaignName: 'test-campaign',
  rules: '2024',
  resistances: [],
  class: { name: 'Druid', major: { name: 'Circle of the Land' }, subclass: { name: 'Circle of the Land' } },
  automation: { passives: [NATURES_WARD_PASSIVE] },
})

const callFactory = (playerSummary) => rulesFactory.getPlayerStats({
  allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: {}, playerSummary,
})

const armLand = (landByte) => runtimeStore.set(LAND_STORE_KEY, landByte)

describe('rulesFactory Nature\u2019s Ward land resistance (CLA-237)', () => {
  beforeEach(() => {
    runtimeStore.clear()
    vi.clearAllMocks()
  })

  it('resolves the merged resistance from the runtime land byte, exactly once, with the threaded campaignName arg-shape, and flips live', async () => {
    armLand('Temperate')
    const result = await callFactory(druidSummary())
    expect(result.resistances).toEqual(['Lightning'])
    expect(result.immunities).toEqual(['poisoned'])
    // Single land lookup; campaignName threaded (fix#153 channel vocabulary) — the
    // shape census falsifies an arg drop/reorder; resolution itself is campaign-blind
    // until #1520 (next test).
    expect(getRuntimeValue.mock.calls).toEqual([['Wild_Sage_Druid', '_circleOfTheLandType', 'test-campaign']])

    armLand('Arid')
    const flipped = await callFactory(druidSummary())
    expect(flipped.resistances).toEqual(['Fire'])
  })

  it('falls back to class JSON type when the runtime key holds the long-rest null byte, and runtime beats class JSON when both disagree', async () => {
    const summary = druidSummary()
    summary.class.major.type = 'temperate'
    summary.class.subclass.type = 'temperate'
    armLand(null) // restRules-longRest.js:330 wipes the key to null
    const fallback = await callFactory(summary)
    expect(fallback.resistances).toEqual(['Lightning'])

    armLand('Arid')
    const override = await callFactory(summary) // class JSON still says 'temperate'
    expect(override.resistances).toEqual(['Fire'])
  })

  it('grants poisoned immunity independently of land type and maps no resistance for an unset land', async () => {
    const result = await callFactory(druidSummary())
    // :164 ternary falsifier: an unmapped empty land yields [] — never [undefined].
    expect(result.resistances).toEqual([])
    expect(result.immunities).toEqual(['poisoned'])
  })

  it('fix#339 scope arm: resolution is campaign-blind — foreign-campaign ghost keys are dead bytes and the threaded arg never scopes the lookup', async () => {
    // Pre-fix triple-route mock territory: a campaign-prefixed write is invisible to
    // the arity-2 reader (useRuntimeState.js:63 — stores Map keyed characterKey only).
    runtimeStore.set('other-campaign:Wild_Sage_Druid:_circleOfTheLandType', 'Tropical')
    const ghost = await callFactory(druidSummary())
    expect(ghost.resistances).toEqual([])

    // Same mirror value resolves regardless of the summary's campaignName byte —
    // scope is the SSE-mirrored active campaign (App.jsx:87-96), not the argument.
    armLand('Arid')
    const swapped = await callFactory({ ...druidSummary(), campaignName: 'other-campaign' })
    expect(swapped.resistances).toEqual(['Fire'])
    // ...while the threaded arg-shape census still records what was sent (fix#153).
    expect(getRuntimeValue.mock.calls).toEqual([
      ['Wild_Sage_Druid', '_circleOfTheLandType', 'test-campaign'],
      ['Wild_Sage_Druid', '_circleOfTheLandType', 'other-campaign'],
    ])
  })
})
