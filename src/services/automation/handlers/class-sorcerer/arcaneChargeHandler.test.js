// CLA-010 regression: Arcane Charge is RAW-gated on "When you use Action
// Surge" — the surge latch (actionSurgeUsedThisRound === current round from
// a campaignName-threaded fresh combat-summary read, CLA-004 pattern) is the
// resource model. Ungated press refuses + logs arcane_charge_refused zero
// teleport; surged press opens the teleport modal; confirm logs ability_use.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { handle, confirmArcaneCharge } from './arcaneChargeHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
  return {
    name: 'Arcane Charge',
    automation: { type: 'arcane_charge', distance: '30 ft', casting_time: '1 action', ...overrides.automation },
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return { name: 'TestHero', ...overrides };
}

function seedLatch(latch) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'actionSurgeUsedThisRound') return latch;
    return undefined;
  });
}

function refusals() {
  return addEntry.mock.calls
    .map(([, e]) => e)
    .filter(e => e.automationType === 'arcane_charge_refused');
}

function spends() {
  return addEntry.mock.calls.map(([, e]) => e).filter(e => e.type === 'ability_use');
}

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeValue.mockReset();
  loadCombatSummary.mockReset().mockResolvedValue({ round: 1, creatures: [] });
  addEntry.mockReset().mockResolvedValue(undefined);
});

describe('CLA-010 Arcane Charge Action-Surge gate', () => {
  it('refuses with no surge used this turn: refusal popup + logged, no modal', async () => {
    loadCombatSummary.mockResolvedValue({ round: 2, creatures: [] });
    seedLatch(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.automationType).toBe('arcane_charge_refused');
    expect(result.payload.description).toContain('requires Action Surge used this turn.');
    const logged = refusals();
    expect(logged).toHaveLength(1);
    expect(logged[0].type).toBe('automation');
    expect(logged[0].characterName).toBe('TestHero');
    expect(logged[0].description).toContain('requires Action Surge used this turn.');
    expect(spends()).toHaveLength(0);
  });

  it('refuses on a stale surge latch from an earlier round (round-wrap re-gates)', async () => {
    loadCombatSummary.mockResolvedValue({ round: 3, creatures: [] });
    seedLatch(2);

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.payload.automationType).toBe('arcane_charge_refused');
    expect(refusals()).toHaveLength(1);
  });

  it('threads campaignName through the fresh combat-summary round read when a latch exists', async () => {
    loadCombatSummary.mockResolvedValue({ round: 4, creatures: [] });
    seedLatch(4);

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('modal');
    expect(loadCombatSummary).toHaveBeenCalledWith(campaignName);
  });

  it('opens the teleport modal when Action Surge was used this round', async () => {
    loadCombatSummary.mockResolvedValue({ round: 2, creatures: [] });
    seedLatch(2);

    const action = makeAction();
    const playerStats = makePlayerStats();
    const result = await handle(action, playerStats, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('arcaneCharge');
    expect(result.payload.action).toBe(action);
    expect(result.payload.playerStats).toBe(playerStats);
    expect(result.payload.campaignName).toBe(campaignName);
    expect(result.payload.distance).toBe('30 ft');
    expect(refusals()).toHaveLength(0);
  });

  it('uses the authored distance with a 30 ft default in the modal payload', async () => {
    seedLatch(1);

    const defaultResult = await handle(makeAction({ automation: { type: 'arcane_charge', casting_time: '1 action' } }), makePlayerStats(), campaignName);
    expect(defaultResult.payload.distance).toBe('30 ft');

    const customResult = await handle(makeAction({ automation: { type: 'arcane_charge', distance: '60 ft', casting_time: '1 action' } }), makePlayerStats(), campaignName);
    expect(customResult.payload.distance).toBe('60 ft');
  });
});

describe('CLA-010 Arcane Charge teleport resolution logging', () => {
  it('confirm logs ability_use with character, feature name and distance', async () => {
    const result = await confirmArcaneCharge(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Arcane Charge');
    expect(result.payload.automationType).toBe('arcane_charge');
    expect(result.payload.description).toBe('Arcane Charge: Teleported 30 ft to an unoccupied space you can see.');

    const logged = spends();
    expect(logged).toHaveLength(1);
    expect(logged[0].characterName).toBe('TestHero');
    expect(logged[0].abilityName).toBe('Arcane Charge');
    expect(logged[0].description).toContain('Teleported 30 ft');
  });

  it('confirm logs the custom distance and passes through action name', async () => {
    const action = { name: 'Custom Charge', automation: { type: 'arcane_charge', distance: '45 ft' } };

    const result = await confirmArcaneCharge(action, makePlayerStats(), campaignName);

    expect(result.payload.description).toBe('Custom Charge: Teleported 45 ft to an unoccupied space you can see.');
    expect(spends()[0].description).toContain('Teleported 45 ft');
  });
});
