// @maintained-by-ai
// Lane: Fortified Health RUNTIME consumption — healingPassiveContribution's
// fortified leg, fortifiedHealthLatchBlocks round-scoping, and
// markFortifiedHealthUsedIfGranted owner-store writes in automationPassives.js.
// Family map: automationPassives.test.js (base lane) owns generic dispatch/
// collection (bonus_healing leg, mastery/resistance predicates) — cited, never
// duplicated here; it never imports resolveHealingBonuses*. elementalAdept #965
// exemplar; landResistance / stormbornResistance / wm008-kindgate own their effects.
// Builder cite #952: automationInfoBuilder/passive.js emits the current envelope
// { type:'passive_rule', effect:'fortified_health', name } with no range byte;
// this lane consumes those bytes and pins legacy 'max_hp_increase' acceptance
// once (source line: effect === 'max_hp_increase' || 'fortified_health') without
// re-pinning envelope bytes. Consumer cite: index.genericHealFortified.test.js
// MOCKS resolve/mark here and pins only the call seam; HP application (+40 max
// HP, CON-based) is owned by featBuffService.computeFeatBuffs / abilityCalc
// lanes. Turn-based latch: no wall-clock, no timers. These branches never log —
// consumers log at their own seams.
// Old -> new: 15 -> 8 blocks (13 table rows). Removed store-routing dupe
// ("null store vs character store" == same block assertion), "blocks within the
// stored round" == table block row; folded re-arm + legacy numeric stamp into
// one round-scoping table; folded caster/target/both mark shapes into an
// ownership table. Rewrote fixtures to builder bytes: old helper used effect
// 'max_hp_increase' with name undefined, so details could never carry the
// 'Fortified Health' name the mark gate consults (#910 honest titles). Added
// oncePerTurn:false / no-campaign guard legs (#936), same-name dedupe row,
// plain-vs-details requirePositive divergence at the real operator site (#959),
// name-keyed expression mock (#908).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}))

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}))

vi.mock('../../automation/common/oncePerTurn.js', () => ({
  markOncePerTurn: vi.fn(),
}))

import {
  resolveHealingBonuses,
  resolveHealingBonusesWithDetails,
  markFortifiedHealthUsedIfGranted,
} from './automationPassives.js'
import { evaluateAutoExpression } from './automationExpressions.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getCombatSummary } from '../../encounters/combatData.js'
import { markOncePerTurn } from '../../automation/common/oncePerTurn.js'

const CAMPAIGN = 'test-campaign'
const FH_KEY = '_fortifiedHealth_usedRound'

// Builder-emitted bytes (#952) — the envelope the read/mark lanes consult.
const FORTIFIED = {
  type: 'passive_rule',
  effect: 'fortified_health',
  name: 'Fortified Health',
  alsoSelfHealing: { extraHealingExpression: 'CON modifier', oncePerTurn: true },
}

const makeChar = (name = 'TestChar', passives = [FORTIFIED]) => ({
  name,
  automation: { passives },
})

// Routes latch reads by (charName, key) so a wrong read-key flips a block row
// to armed and fails the table.
const latchStore = (stamps) => (charName, key) =>
  key === FH_KEY ? stamps[charName] ?? null : null

beforeEach(() => {
  vi.clearAllMocks()
  evaluateAutoExpression.mockImplementation((expression) => {
    const map = { 'CON modifier': 2, '-CON modifier': -1, 'broken expression': NaN }
    return map[expression] ?? 0
  })
  getCombatSummary.mockReturnValue({ round: 1 })
  getRuntimeValue.mockReturnValue(null)
})

describe('resolveHealingBonusesWithDetails — fortified contribution and latch', () => {
  it.each([
    ['armed self grants CON bonus', {}, undefined, 1, 2, ['Fortified Health']],
    ['latched same round blocks self', { TestChar: { round: 1, activeCreature: 'TestChar' } }, undefined, 1, 0, []],
    ['armed self and armed target stack', {}, makeChar('Ally'), 1, 4, ['Fortified Health', 'Fortified Health']],
    ['self latched, armed target still contributes', { TestChar: { round: 1, activeCreature: 'TestChar' } }, makeChar('Ally'), 1, 2, ['Fortified Health']],
    ['both latched yields nothing', { TestChar: { round: 1, activeCreature: 'TestChar' }, Ally: { round: 1, activeCreature: 'Ally' } }, makeChar('Ally'), 1, 0, []],
  ])('%s', (_desc, stamps, targetStats, round, expectedTotal, expectedNames) => {
    getRuntimeValue.mockImplementation(latchStore(stamps))
    getCombatSummary.mockReturnValue({ round })
    const { totalBonus, details } = resolveHealingBonusesWithDetails(makeChar(), { slotLevel: 3, campaignName: CAMPAIGN, targetStats })
    expect(totalBonus).toBe(expectedTotal)
    expect(details.map(d => d.name)).toEqual(expectedNames)
  })

  it.each([
    ['object stamp blocks on its round', { round: 4 }, 4, 0],
    ['object stamp re-arms once round exceeds it', { round: 4 }, 5, 2],
    ['legacy numeric stamp blocks on exact match', 3, 3, 0],
    ['legacy numeric stamp re-arms past its round', 3, 4, 2],
    ['legacy numeric stamp ignores earlier rounds', 3, 2, 2],
  ])('%s', (_desc, stamp, round, expected) => {
    getRuntimeValue.mockImplementation(latchStore({ TestChar: stamp }))
    getCombatSummary.mockReturnValue({ round })
    expect(resolveHealingBonuses(makeChar(), 5, 3, 3, CAMPAIGN)).toBe(expected)
  })

  it('does not latch when oncePerTurn is false or campaign scope is missing', () => {
    const stamp = { TestChar: { round: 1, activeCreature: 'TestChar' } }
    getRuntimeValue.mockImplementation(latchStore(stamp))
    const notOnce = { ...FORTIFIED, alsoSelfHealing: { ...FORTIFIED.alsoSelfHealing, oncePerTurn: false } }
    expect(resolveHealingBonusesWithDetails(makeChar('TestChar', [notOnce]), { slotLevel: 3, campaignName: CAMPAIGN }).totalBonus).toBe(2)
    expect(resolveHealingBonusesWithDetails(makeChar(), { slotLevel: 3 }).totalBonus).toBe(2)
  })

  it('legacy max_hp_increase effect bytes still contribute', () => {
    const legacy = { ...FORTIFIED, effect: 'max_hp_increase', name: 'Boon of Fortitude' }
    expect(resolveHealingBonuses(makeChar('TestChar', [legacy]), 5, 3, 3, CAMPAIGN)).toBe(2)
  })

  it('details lane requires positive bonuses; plain lane sums negatives and drops NaN', () => {
    evaluateAutoExpression.mockImplementation(expr => ({ 'CON modifier': -1 })[expr] ?? 0)
    expect(resolveHealingBonuses(makeChar(), 5, 3, 3, CAMPAIGN)).toBe(-1)
    expect(resolveHealingBonusesWithDetails(makeChar(), { slotLevel: 3, campaignName: CAMPAIGN }))
      .toEqual({ totalBonus: 0, details: [] })

    evaluateAutoExpression.mockImplementation(expr => ({ 'CON modifier': NaN })[expr] ?? 0)
    expect(resolveHealingBonuses(makeChar(), 5, 3, 3, CAMPAIGN)).toBe(0)
    expect(resolveHealingBonusesWithDetails(makeChar(), { slotLevel: 3, campaignName: CAMPAIGN }))
      .toEqual({ totalBonus: 0, details: [] })
  })
})

describe('markFortifiedHealthUsedIfGranted — owner-store latch writes', () => {
  const fhDetail = [{ name: 'Fortified Health', amount: 2 }]

  it.each([
    ['marks the target owner, not the plain caster', undefined, makeChar('Disciplined_Monk'), ['Disciplined_Monk']],
    ['marks the caster owner', makeChar('Disciplined_Monk'), makeChar('Ally', []), ['Disciplined_Monk']],
    ['marks both owners once each when both hold the passive', makeChar('CasterHolder'), makeChar('TargetHolder'), ['CasterHolder', 'TargetHolder']],
    ['same-named caster and target mark once', makeChar('SharedName'), makeChar('SharedName'), ['SharedName']],
  ])('%s', async (_desc, caster, target, expectedNames) => {
    await markFortifiedHealthUsedIfGranted(fhDetail, caster, target, CAMPAIGN)
    expect(markOncePerTurn).toHaveBeenCalledTimes(expectedNames.length)
    expectedNames.forEach((name, i) => {
      expect(markOncePerTurn.mock.calls[i]).toEqual(['Fortified Health', FH_KEY, expect.objectContaining({ name }), CAMPAIGN])
    })
  })

  it('skips marking when details carry no Fortified Health entry', async () => {
    await markFortifiedHealthUsedIfGranted(undefined, null, makeChar(), CAMPAIGN)
    await markFortifiedHealthUsedIfGranted([{ name: 'Other', amount: 1 }], null, makeChar(), CAMPAIGN)
    expect(markOncePerTurn).not.toHaveBeenCalled()
  })

  it('skips marking when the owner latch is already stamped this round', async () => {
    getRuntimeValue.mockImplementation(latchStore({ Disciplined_Monk: { round: 1, activeCreature: 'Disciplined_Monk' } }))
    await markFortifiedHealthUsedIfGranted(fhDetail, null, makeChar('Disciplined_Monk'), CAMPAIGN)
    expect(markOncePerTurn).not.toHaveBeenCalled()
  })
})
