// @maintained-by-ai
// LANE: Thief's Reflexes (2024 Thief 11) SECOND-TURN GRANT service.
// Family map — this file owns only the grant/resync decision + store bytes:
//   - opportunityTrigger.test.js #1018 owns attack-trigger gating (distinct lane).
//   - d20RollComputation family #936-#939 owns roll selection-core (#938 literal queues).
//   - savePromptService #1010 / saveProcessing #943-#944 own save transport — this is
//     not a save-reroll lane; 2024 Thief's Reflexes grants a duplicate initiative entry.
//   - extraActionHandler.test.js owns oncePerCombat extra-action EXECUTION fed by the
//     entry this service creates (oncePerCombat therefore omitted from fixtures here).
//   - initiative-init-rolled-handler.test.jsx owns second-turn REMOVAL on new initiative;
//     CreatureCard.rendering.test.jsx owns card/target lanes. Rest reset lives in
//     restRules-constants.js. Callers (createCreatureHandlers, initiativeProcessing)
//     assert they invoke this service; here we verify the service itself.
// Old -> new: grant+spend+log kept; exhausted -> resource-latch table (#1051 strict <=0,
// consulted bytes #967, #1026 zero-applied-not-burned); idempotent+resync consolidated
// (#903); no-feature -> predicate-discriminates (#1035); invalid-init -> table;
// specialActions now pins the DEFAULT resourceKey fallback byte (#1050).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { maybeGrantThiefsReflexesSecondTurn, isSecondTurnEntry } from './thiefsReflexesService.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../ui/logService.js';

const campaignName = 'test-campaign';
// automationInfoBuilder/diverse.js emits feature.name.toLowerCase() + 'Uses'.
const RESOURCE_KEY = "thief'sreflexesUses";

function makeCharacters(withFeature = true) {
  const actions = withFeature
    ? [{ type: 'extra_action', name: "Thief's Reflexes", uses: 1, firstRoundOnly: true, resourceKey: RESOURCE_KEY }]
    : []
  return [{ name: 'AasimarTest', computedStats: { automation: { actions } } }]
}

function makeSummary(round = 1) {
  return {
    round,
    creatures: [
      { name: 'AasimarTest', type: 'player', initiative: '18', targetName: null, concentration: null },
      { name: 'NPC 1', type: 'npc', initiative: '13', targetName: null, concentration: null },
      { name: 'NPC 2', type: 'npc', initiative: '9', targetName: null, concentration: null },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useRuntimeState.getRuntimeValue.mockReturnValue(null)
})

describe("Thief's Reflexes second-turn service", () => {
  it('grants a second entry at initiative − 10 in round 1, spends the use and logs ability_use', () => {
    const cs = makeSummary()
    const granted = maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, makeCharacters())
    expect(granted).toBe(true)
    const second = cs.creatures.find(c => c.name === 'AasimarTest (Second Turn)')
    expect(second).toBeTruthy()
    expect(second.initiative).toBe('8')
    expect(second.type).toBe('player')
    expect(second.secondTurn).toBe(true)
    expect(second.holderName).toBe('AasimarTest')
    expect(second.targetName).toBeNull()
    expect(second.concentration).toBeNull()
    // Ordered below NPC 1 (13) and NPC 2 (9): 18 → 13 → 9 → 8
    const order = cs.creatures.map(c => c.name)
    expect(order.indexOf('NPC 1')).toBeLessThan(order.indexOf('AasimarTest (Second Turn)'))
    expect(order.indexOf('NPC 2')).toBeLessThan(order.indexOf('AasimarTest (Second Turn)'))
    // holder-scoped consulted byte, then spend 1 → 0
    expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('AasimarTest', RESOURCE_KEY, campaignName)
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', RESOURCE_KEY, 0, campaignName)
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'AasimarTest',
      abilityName: "Thief's Reflexes",
      description: "AasimarTest used Thief's Reflexes: gained a second turn at initiative 8 (18 \u2212 10) in round 1.",
    }))
  })

  // #1051 latch: store byte drives grant/spend; 0 (and only >0) may pass.
  // #1026: a declined grant never burns the resource or logs.
  it.each([
    ['unset store defaults to declared uses (1)', null, true, 0],
    ['string byte "1" coerces and spends numeric 0', '1', true, 0],
    ['2 remaining spends down to numeric 1', 2, true, 1],
    ['0 exhausted never grants', 0, false, undefined],
  ])('resource latch: %s', (_label, stored, grants, spentTo) => {
    useRuntimeState.getRuntimeValue.mockReturnValue(stored)
    const cs = makeSummary()
    const granted = maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, makeCharacters())
    expect(granted).toBe(grants)
    if (grants) {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', RESOURCE_KEY, spentTo, campaignName)
    } else {
      expect(cs.creatures.some(c => c.secondTurn)).toBe(false)
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
      expect(addEntry).not.toHaveBeenCalled()
    }
  })

  // No resourceKey on the action → service falls back to its DEFAULT byte (= RESOURCE_KEY).
  it('finds the feature under automation.specialActions and spends the default resource key', () => {
    const characters = [{ name: 'AasimarTest', computedStats: { automation: { specialActions: [{ type: 'extra_action', name: "Thief's Reflexes", uses: 1, firstRoundOnly: true }] } } }]
    const cs = makeSummary()
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, characters)).toBe(true)
    expect(cs.creatures.find(c => c.name === 'AasimarTest (Second Turn)').initiative).toBe('8')
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', RESOURCE_KEY, 0, campaignName)
  })

  it('does not grant in round 2+ and applies nothing', () => {
    const cs = makeSummary(2)
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, makeCharacters())).toBe(false)
    expect(cs.creatures.some(c => c.secondTurn)).toBe(false)
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('requires an extra_action flagged firstRoundOnly, held by this character', () => {
    // A real non-first-round extra_action (Action Surge-style) must NOT qualify.
    const noFlag = [{ name: 'AasimarTest', computedStats: { automation: { actions: [{ type: 'extra_action', name: 'Action Surge', uses: 1 }] } } }]
    const cs = makeSummary()
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, noFlag)).toBe(false)

    // The feature exists but on another holder — lookup is holder-scoped.
    const otherHolder = [
      { name: 'AasimarTest', computedStats: { automation: { actions: [] } } },
      { name: 'Rogue Two', computedStats: { automation: { actions: [{ type: 'extra_action', name: "Thief's Reflexes", uses: 1, firstRoundOnly: true }] } } },
    ]
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, otherHolder)).toBe(false)
    expect(cs.creatures.some(c => c.secondTurn)).toBe(false)
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('is idempotent, and re-syncs the existing entry when the holder initiative moves', () => {
    const cs = makeSummary()
    const characters = makeCharacters()
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, characters)).toBe(true)
    useRuntimeState.setRuntimeValue.mockClear()
    addEntry.mockClear()

    // Same initiative: no re-grant, no re-spend.
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, characters)).toBe(false)
    // Holder moves to 20 → second entry follows to 10, list re-sorted, still no spend.
    cs.creatures.find(c => c.name === 'AasimarTest').initiative = '20'
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, characters)).toBe(false)
    expect(cs.creatures.filter(c => c.secondTurn).length).toBe(1)
    expect(cs.creatures.find(c => c.name === 'AasimarTest (Second Turn)').initiative).toBe('10')
    expect(cs.creatures.map(c => c.name)).toEqual(['AasimarTest', 'NPC 1', 'AasimarTest (Second Turn)', 'NPC 2'])
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it.each([[''], [null], ['abc']])('rejects holder initiative %s (no entry, no spend)', (initiative) => {
    const cs = makeSummary()
    cs.creatures.find(c => c.name === 'AasimarTest').initiative = initiative
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, makeCharacters())).toBe(false)
    expect(cs.creatures.some(c => c.secondTurn)).toBe(false)
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
  })

  it('never triggers when invoked with a second-turn entry name itself', () => {
    const cs = makeSummary()
    cs.creatures.push({ name: 'AasimarTest (Second Turn)', type: 'player', initiative: '8', targetName: null, concentration: null, secondTurn: true, holderName: 'AasimarTest' })
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest (Second Turn)', campaignName, makeCharacters())).toBe(false)
    expect(cs.creatures.filter(c => c.secondTurn).length).toBe(1)
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('isSecondTurnEntry flags only structural second-turn entries', () => {
    expect(isSecondTurnEntry({ secondTurn: true })).toBe(true)
    expect(isSecondTurnEntry({ name: 'AasimarTest' })).toBe(false)
    expect(isSecondTurnEntry(null)).toBe(false)
  })
})
