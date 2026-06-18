import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as combatData from '../../../../services/encounters/combatData.js';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyDamageTypeChoice } from './damageTypeModifierHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestFighter',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Empowered Strikes',
    automation: {
      type: 'damage_type_modifier',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageTypeModifierHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    combatData.setCombatSummaryCache(null);
  });

  it('returns modal when options are present', async () => {
    const action = makeAction({
      options: [
        { name: 'Thunder', damageType: 'Thunder' },
        { name: 'Lightning', damageType: 'Lightning' },
      ],
    });
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('damageTypeModifier');
    expect(result.payload.action).toBe(action);
    expect(result.payload.playerStats).toBe(ps);
    expect(result.payload.campaignName).toBe(campaignName);
  });

  it('returns info popup when no options', async () => {
    const action = makeAction({ options: [] });
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Empowered Strikes');
    expect(result.payload.automationType).toBe('damage_type_modifier');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('returns info popup when options is undefined', async () => {
    const action = makeAction({});
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
  });

  it('calls addEntry with ability_use type', async () => {
    const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
    const ps = makePlayerStats();

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestFighter',
        abilityName: 'Empowered Strikes',
      }),
    );
  });

  it('propagates addEntry errors', async () => {
    const action = makeAction({ options: [] });
    const ps = makePlayerStats();
    logService.addEntry.mockRejectedValue(new Error('network'));

    await expect(handle(action, ps, campaignName, null)).rejects.toThrow('network');
  });
});

describe('damageTypeModifierHandler.applyDamageTypeChoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    combatData.setCombatSummaryCache(null);
  });

  it('returns null when chosen option not found', async () => {
    const action = makeAction({
      options: [
        { name: 'Thunder', damageType: 'Thunder' },
        { name: 'Lightning', damageType: 'Lightning' },
      ],
    });
    const ps = makePlayerStats();

    const result = await applyDamageTypeChoice(action, ps, campaignName, 'Fire');

    expect(result).toBeNull();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('sets damage type and round for valid option', async () => {
    const action = makeAction({
      options: [
        { name: 'Thunder', damageType: 'Thunder' },
        { name: 'Lightning', damageType: 'Lightning' },
      ],
    });
    const ps = makePlayerStats();

    const result = await applyDamageTypeChoice(action, ps, campaignName, 'Thunder');

    expect(result).not.toBeNull();
    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Damage type set to Thunder for your next Unarmed Strike.');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestFighter', 'empoweredStrikesDamageType', 'Thunder', campaignName,
    );

    const roundCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1].includes('usedRound'),
    );
    expect(roundCall).toBeDefined();
  });

  it('calls addEntry with chosen damage type', async () => {
    const action = makeAction({
      options: [{ name: 'Lightning', damageType: 'Lightning' }],
    });
    const ps = makePlayerStats();

    await applyDamageTypeChoice(action, ps, campaignName, 'Lightning');

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Empowered Strikes',
        description: 'Empowered Strikes — damage type set to Lightning',
      }),
    );
  });

  it('returns popup with correct structure', async () => {
    const action = makeAction({
      options: [{ name: 'Thunder', damageType: 'Thunder' }],
    });
    const ps = makePlayerStats();

    const result = await applyDamageTypeChoice(action, ps, campaignName, 'Thunder');

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Empowered Strikes');
    expect(result.payload.automationType).toBe('damage_type_modifier');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('propagates addEntry errors', async () => {
    const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
    const ps = makePlayerStats();
    logService.addEntry.mockRejectedValue(new Error('network'));

    await expect(applyDamageTypeChoice(action, ps, campaignName, 'Thunder')).rejects.toThrow('network');
  });

  it('uses current combat round from cache', async () => {
    const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
    const ps = makePlayerStats();

    // Set the combat summary cache to round 5
    combatData.setCombatSummaryCache({ round: 5 });

    await applyDamageTypeChoice(action, ps, campaignName, 'Thunder');

    const roundCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1].includes('usedRound'),
    );
    expect(roundCall[2]).toBe(5);
  });

  it('defaults to round 1 when no combat summary in cache', async () => {
    const action = makeAction({ options: [{ name: 'Thunder', damageType: 'Thunder' }] });
    const ps = makePlayerStats();

    // Clear the cache
    combatData.setCombatSummaryCache(null);

    await applyDamageTypeChoice(action, ps, campaignName, 'Thunder');

    const roundCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1].includes('usedRound'),
    );
    expect(roundCall[2]).toBe(1);
  });
});
