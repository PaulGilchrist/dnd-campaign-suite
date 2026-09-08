// @improved-by-ai
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
const RESOURCE_KEY = "thief'sreflexesUses";

function makeCharacters(withFeature = true) {
  // The extra_action info lands under automation.actions in the live pipeline.
  const actions = withFeature
    ? [{ type: 'extra_action', name: "Thief's Reflexes", uses: 1, firstRoundOnly: true, oncePerCombat: true, resourceKey: RESOURCE_KEY }]
    : []
  return [{ name: 'AasimarTest', computedStats: { automation: { actions } } }]
}

function makeCharactersSpecialBucket() {
  return [{ name: 'AasimarTest', computedStats: { automation: { specialActions: [{ type: 'extra_action', name: "Thief's Reflexes", uses: 1, firstRoundOnly: true, resourceKey: RESOURCE_KEY }] } } }]
}

function makeSummary(round = 1, extra = []) {
  return {
    round,
    creatures: [
      { name: 'AasimarTest', type: 'player', initiative: '18', targetName: null, concentration: null },
      { name: 'NPC 1', type: 'npc', initiative: '13', targetName: null, concentration: null },
      { name: 'NPC 2', type: 'npc', initiative: '9', targetName: null, concentration: null },
      ...extra,
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useRuntimeState.getRuntimeValue.mockReturnValue(null)
})

describe('CLA-360 Thief’s Reflexes second-turn service', () => {
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
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', RESOURCE_KEY, 0, campaignName)
    expect(addEntry).toHaveBeenCalledTimes(1)
    const entry = addEntry.mock.calls[0][1]
    expect(entry.type).toBe('ability_use')
    expect(entry.characterName).toBe('AasimarTest')
    expect(entry.abilityName).toBe("Thief's Reflexes")
  })

  it('also finds the feature when routed under automation.specialActions', () => {
    const cs = makeSummary()
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, makeCharactersSpecialBucket())).toBe(true)
    expect(cs.creatures.find(c => c.name === 'AasimarTest (Second Turn)').initiative).toBe('8')
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', RESOURCE_KEY, 0, campaignName)
  })

  it('does not grant in round 2+', () => {
    const cs = makeSummary(2)
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, makeCharacters())).toBe(false)
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('does not grant without the extra_action firstRoundOnly feature', () => {
    const cs = makeSummary()
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, makeCharacters(false))).toBe(false)
    expect(cs.creatures.some(c => c.secondTurn)).toBe(false)
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('does not grant when uses are exhausted and spends nothing', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0)
    const cs = makeSummary()
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, makeCharacters())).toBe(false)
    expect(cs.creatures.some(c => c.secondTurn)).toBe(false)
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('is idempotent: a second grant attempt never re-spends', () => {
    const cs = makeSummary()
    const characters = makeCharacters()
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, characters)).toBe(true)
    useRuntimeState.setRuntimeValue.mockClear()
    addEntry.mockClear()
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, characters)).toBe(false)
    expect(cs.creatures.filter(c => c.secondTurn).length).toBe(1)
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('re-syncs the existing second entry when the holder initiative is adjusted', () => {
    const cs = makeSummary()
    const characters = makeCharacters()
    maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, characters)
    useRuntimeState.setRuntimeValue.mockClear()
    addEntry.mockClear()
    cs.creatures.find(c => c.name === 'AasimarTest').initiative = '20'
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, characters)).toBe(false)
    expect(cs.creatures.find(c => c.name === 'AasimarTest (Second Turn)').initiative).toBe('10')
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('ignores creatures without an initiative value', () => {
    const cs = makeSummary()
    cs.creatures.find(c => c.name === 'AasimarTest').initiative = ''
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest', campaignName, makeCharacters())).toBe(false)
  })

  it('never re-triggers when called with a second-turn entry name itself', () => {
    const cs = makeSummary(1, [{ name: 'AasimarTest (Second Turn)', type: 'player', initiative: '8', targetName: null, concentration: null, secondTurn: true, holderName: 'AasimarTest' }])
    expect(maybeGrantThiefsReflexesSecondTurn(cs, 'AasimarTest (Second Turn)', campaignName, makeCharacters())).toBe(false)
    expect(cs.creatures.filter(c => c.secondTurn).length).toBe(1)
  })

  it('isSecondTurnEntry flags only structural second-turn entries', () => {
    expect(isSecondTurnEntry({ secondTurn: true })).toBe(true)
    expect(isSecondTurnEntry({ name: 'AasimarTest' })).toBe(false)
    expect(isSecondTurnEntry(null)).toBe(false)
  })
})
