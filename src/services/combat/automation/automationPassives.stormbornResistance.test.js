// @maintained-by-ai
// CLA-336 lane: the type:'resistance' legs of getDamageResistances /
// gatedResistanceTypes (automationPassives.js) resolve LIVE at hit-resolution.
// Consulted-byte census — the branch reads ONLY: passive.type,
// Array.isArray(passive.damageTypes), passive.name exact-match, then store
// bytes (playerStats.name, 'wrathOfTheSeaActive') truthiness for Stormborn or
// (playerStats.name, 'activeBuffs').some(b => b.name === 'Starry Form') for
// Full of Stars. Real gate bytes: handlers write true
// (wrathOfTheSeaHandler.js:72, oceanicGiftHandler.js), CreatureCard badge
// removal / turnStartEffects / clearExpirationEffects write false; unset = never
// used. Gate consult is scoped to playerStats.name — pinned by the name+key
// routed store mock (#908); every other lookup stays explicitly null (#940).
// Family map: automationPassives.test.js (base lane) owns generic dispatch
// (passive_immunity / passive_buff / fiendish_resilience legs, dedupe union,
// null automation) — its getDamageResistances block was scanned for stormborn
// overlap: zero verbatim dupes to cut (#965 precedent). elementalAdept #965 /
// fortifiedHealth #966 / landResistance #967 / wm008-kindgate own their legs.
// Consumers cited, not re-pinned: applyDamage.stormbornResistance.test.js owns
// the halving arithmetic + "Damage Resistance" log at the damage seam;
// wrathOfTheSeaHandler.test.js / oceanicGiftHandler.test.js own the WRITE side
// of wrathOfTheSeaActive; CharSummary-BuffResistances owns the display merge.
// Fixtures byte-exact from public/data (Stormborn + Full of Stars: 2024
// classes.json Circle of the Sea lv10 / Circle of the Stars lv14; Avatar of
// Battle: 5e classes.json lv17; name byte rides along from feature flattening).
// Old -> new: 6 its -> 4 blocks (13 rows): armed/false/unset its folded into
// the gate truth-table; 'never emits Bludgeoning' removed (subsumed by exact
// toEqual, census-over-exists #781); Full of Stars gate table gained case and
// null-guard rows; added store-name-scoping, exact-match-name, foreign-leg,
// missing-damageTypes falsifiers, and the no-store-reads pin for ungated
// passives (rulesFactory parity comment, source line 328). Pure predicate: no
// logging, no timers, zero network, branch unmocked (#791).
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
const WRATH_KEY = 'wrathOfTheSeaActive'

// Byte-exact resistance automation envelope of Circle of the Sea lv10
// Stormborn from public/data/2024/classes.json (feature name byte included).
const STORMBORN_PASSIVE = {
  type: 'resistance',
  name: 'Stormborn',
  damageTypes: ['Cold', 'Lightning', 'Thunder'],
  casting_time: 'passive',
}

// Byte-exact Circle of the Stars lv14 Full of Stars envelope, 2024 data.
const FULL_OF_STARS_PASSIVE = {
  type: 'resistance',
  name: 'Full of Stars',
  damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
  casting_time: 'passive',
}

// Byte-exact 5e barbarian lv17 Avatar of Battle envelope — the only 5e
// type:'resistance' passive; must emit ungated.
const AVATAR_PASSIVE = {
  type: 'resistance',
  name: 'Avatar of Battle',
  damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
  casting_time: 'passive',
}

const druidStats = () => ({
  name: STORE_NAME,
  automation: { passives: [STORMBORN_PASSIVE] },
})

// Name+key-routed store mock (#908): the gate arms only for the exact byte
// pair the predicate consults; any other lookup stays explicitly null (#940).
function armWrath(byte) {
  getRuntimeValue.mockImplementation((name, key) =>
    name === STORE_NAME && key === WRATH_KEY ? byte : null)
}

describe('getDamageResistances Stormborn resistance gate (CLA-336)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Truth-table over the only consulted gate byte.
  it.each([
    ['true — Wrath badge active', true, ['Cold', 'Lightning', 'Thunder']],
    ['false — badge removed', false, []],
    ['null — key unset', null, []],
    ['undefined — store missing', undefined, []],
  ])('wrathOfTheSeaActive %s resolves exactly %j', (_label, gateByte, expected) => {
    armWrath(gateByte)
    expect(getDamageResistances(druidStats())).toEqual(expected)
  })

  it.each([
    ['gate never crosses store names — armed for one char, queried as another', 'Other_SeDruid', STORMBORN_PASSIVE, true, []],
    ['lowercase name byte is not gated — exact match, no normalization authored', STORE_NAME, { ...STORMBORN_PASSIVE, name: 'stormborn' }, null, ['Cold', 'Lightning', 'Thunder']],
    ['foreign leg ignores the name gate — passive_buff emits its resistances ungated', STORE_NAME, { type: 'passive_buff', name: 'Stormborn', resistances: ['Cold'] }, null, ['Cold']],
    ['type:resistance without a damageTypes array emits nothing — shape guard precedes the gate', STORE_NAME, { type: 'resistance', name: 'Stormborn' }, true, []],
  ])('%s', (_label, charName, passive, gateByte, expected) => {
    armWrath(gateByte)
    const stats = { name: charName, automation: { passives: [passive] } }
    expect(getDamageResistances(stats)).toEqual(expected)
  })

  it.each([
    ['Starry Form buff present', [{ name: 'Starry Form' }], ['Bludgeoning', 'Piercing', 'Slashing']],
    ['case-mismatched buff name', [{ name: 'starry form' }], []],
    ['activeBuffs empty', [], []],
    ['activeBuffs null (|| [] guard)', null, []],
  ])('Full of Stars gate: activeBuffs %s resolves %j', (_label, buffs, expected) => {
    getRuntimeValue.mockImplementation((name, key) =>
      name === STORE_NAME && key === 'activeBuffs' ? buffs : null)
    const stats = { name: STORE_NAME, automation: { passives: [FULL_OF_STARS_PASSIVE] } }
    expect(getDamageResistances(stats)).toEqual(expected)
  })

  it('ungated type:resistance emits without consulting the store at all (rulesFactory parity)', () => {
    const stats = { name: 'IronBarbarian', automation: { passives: [AVATAR_PASSIVE] } }
    expect(getDamageResistances(stats)).toEqual(['Bludgeoning', 'Piercing', 'Slashing'])
    expect(getRuntimeValue).not.toHaveBeenCalled()
  })
})
