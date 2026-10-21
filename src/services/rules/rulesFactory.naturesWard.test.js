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
// consults runtime — the CLA-237 split that broke), campaign-scoped lookup args, and
// the poisoned conditionImmunity leg independent of land type.
// Producer bytes: CircleOfTheLandSpellsModal.jsx:22 writes landType.name capitalized
// ('Arid'/'Polar'/'Temperate'/'Tropical') WITH campaignName; the store mock keys on
// the full campaign:name:key triple so a dropped or misordered campaignName arg misses
// (getCurrentCombatRound arg-drop family). Fixtures never set class-JSON land types
// except where a test says so, matching production shape per the CLA-237 root cause.
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

// Real signature is getRuntimeValue(name, key, campaignName) — route on the full
// triple so dropped/misordered campaign args miss instead of silently resolving.
const runtimeStore = new Map()
const LAND_STORE_KEY = 'test-campaign:Wild_Sage_Druid:_circleOfTheLandType'
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key, campaignName) => runtimeStore.get(`${campaignName}:${name}:${key}`)),
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

  it('resolves the merged resistance from the runtime land byte, exactly once, campaign-scoped, and flips live', async () => {
    armLand('Temperate')
    const result = await callFactory(druidSummary())
    expect(result.resistances).toEqual(['Lightning'])
    expect(result.immunities).toEqual(['poisoned'])
    // Single land lookup with the modal-producer arg order; no stray keys consulted.
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
})
