// @maintained-by-ai
// Lane: automationPassives land_resistance ticket slice — the landMappedResistance
// predicate (CLA-237 applyDamage fallback merge) in automationPassives.js. Pins
// what the predicate ACTUALLY consults: the runtime _circleOfTheLandType store
// byte governs (#965 store-byte-governs), falling back to class.major?.type then
// class.subclass?.type, normalized lowercase+trim, looked up verbatim in the
// passive's own landMappings table; line-347 gate requires landMappings object.
// Family map: automationPassives.test.js (base lane) owns generic dispatch/
// collection (dedupe union, passive_immunity/passive_buff/fiendish legs, null
// automation) — cited, never duplicated here. elementalAdept #965 /
// fortifiedHealth #966 exemplars; stormbornResistance / wm008-kindgate own their
// effects. Consumers cited, not re-pinned: applyDamage.natures-ward.test.js owns
// the halving arithmetic + "Damage Resistance" log at the save-damage seam;
// rulesFactory.naturesWard.test.js owns the compute-time merge;
// automationImmunities.js consumes the conditionImmunity byte; CircleOfTheLand
// SpellsModal owns the WRITE side of _circleOfTheLandType (bytes are modal
// capitals — 'Arid'/'Temperate'/… — which is exactly why lowercasing is pinned).
// Fixtures are byte-exact Nature's Ward envelopes from public/data/classes.json
// (#966 fixture integrity). Old -> new: 4 -> 4 blocks (12 rows): the two
// armed-runtime its folded into the full mapping census, the fallback and
// unknown-type its into the ladder/controls tables; added precedence,
// subclass-leg, trim, unmapped-byte, missing-landMappings and foreign-type
// falsifiers. Pure predicate: no logging, no timers, zero network.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDamageResistances } from './automationPassives.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => null),
}))

vi.mock('../../rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn(),
}))

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(() => 0),
}))

vi.mock('./automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

vi.mock('../../rules/core/greatWeaponFighting.js', () => ({
  applyGreatWeaponFighting: vi.fn(),
}))

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

const STORE_NAME = 'Wild_Sage_Druid'
const LAND_KEY = '_circleOfTheLandType'

// Byte-exact Nature's Ward automation envelope from public/data/classes.json
// (both rulesets identical). conditionImmunity is a real byte but consumed by
// the automationImmunities lane — this predicate must not leak it as resistance.
const LAND_PASSIVE = {
  type: 'land_resistance',
  conditionImmunity: 'poisoned',
  landMappings: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
  casting_time: 'passive',
}

const druidStats = () => ({
  name: STORE_NAME,
  class: { name: 'Druid', major: { name: 'Circle of the Land' } },
  automation: { passives: [LAND_PASSIVE] },
})

// Name+key-routed store mock (#908): only the exact routing the predicate uses
// answers; any other lookup stays explicitly null (#940).
function armLand(landByte) {
  getRuntimeValue.mockImplementation((name, key) =>
    name === STORE_NAME && key === LAND_KEY ? landByte : null)
}

describe('getDamageResistances land_resistance (CLA-237)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Census of the full landMappings table; bytes are modal-capital (what the
  // CircleOfTheLandSpellsModal actually writes), so the lowercase step is live.
  it.each([
    ['Arid', ['Fire']],
    ['Polar', ['Cold']],
    ['Temperate', ['Lightning']],
    ['Tropical', ['Poison']],
    ['  Temperate  ', ['Lightning']], // trim normalization
  ])('chosen runtime land byte %s resolves exactly %j', (landByte, expected) => {
    armLand(landByte)
    expect(getDamageResistances(druidStats())).toEqual(expected)
  })

  it('runtime land choice overrides contradicting class bytes', () => {
    armLand('Arid')
    const stats = druidStats()
    stats.class.major.type = 'temperate'
    stats.class.subclass = { type: 'tropical' }
    expect(getDamageResistances(stats)).toEqual(['Fire'])
  })

  it.each([
    [{ major: { type: 'arid' } }, ['Fire']],
    [{ subclass: { type: 'polar' } }, ['Cold']],
  ])('class fallback %o resolves %j when runtime byte is unset', (classBytes, expected) => {
    armLand(null)
    const stats = druidStats()
    Object.assign(stats.class, classBytes)
    expect(getDamageResistances(stats)).toEqual(expected)
  })

  it.each([
    ['no land byte anywhere', LAND_PASSIVE, null],
    ['unmapped land byte', LAND_PASSIVE, 'Coastal'],
    ['passive carries no landMappings', { type: 'land_resistance', conditionImmunity: 'poisoned' }, 'Temperate'],
    ['foreign type with landMappings bytes', { type: 'passive_buff', landMappings: LAND_PASSIVE.landMappings }, 'Temperate'],
  ])('returns [] when %s', (_label, passive, landByte) => {
    armLand(landByte)
    const stats = druidStats()
    stats.automation.passives = [passive]
    expect(getDamageResistances(stats)).toEqual([])
  })
})
