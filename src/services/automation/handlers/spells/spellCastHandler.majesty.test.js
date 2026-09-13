// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

import { handle } from './spellCastHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logPoster from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

describe('spellCastHandler - Mantle of Majesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('sets activeBuffs and shows popup when Mantle of Majesty is activated', async () => {
    const ps = makePlayerStats({ name: 'GlamourBard', spellAbilities: { saveDc: 15 }, proficiency: 5 });
    combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'GlamourBard' }] });
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');


    const action = {
      name: 'Mantle of Majesty',
      description: 'You always have the Command spell prepared...',
      automation: {
        type: 'free_spell',
        spell: 'Command',
        freeCasts: 'at_will_while_active',
        action: 'bonus_action',
        duration: '1_minute',
        concentration: true,
        casting_time: '1 bonus action',
      },
    };

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('Mantle of Majesty activated');
    expect(result.payload.description).toContain('Command is now available as a free bonus action');

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('GlamourBard', 'activeBuffs', campaignName);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('GlamourBard', 'activeBuffs', expect.arrayContaining([
      expect.objectContaining({ name: 'Mantle of Majesty' }),
    ]), campaignName);

    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'GlamourBard', targetName: 'GlamourBard', effects: expect.arrayContaining([
        expect.objectContaining({ type: 'remove_active_buff', buffName: 'Mantle of Majesty' }),
      ]), campaignName });

    expect(combatData.getCombatSummary).toHaveBeenCalledWith(campaignName);
    expect(concentrationService.addConcentration).toHaveBeenCalledWith(
      { creatures: [{ name: 'GlamourBard' }] },
      'GlamourBard',
      'Mantle of Majesty',
      15
    );
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    dispatchSpy.mockRestore();

    expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'GlamourBard',
      abilityName: 'Mantle of Majesty',
    }));
  });

  it('returns already active popup when Mantle of Majesty is already active', async () => {
    const ps = makePlayerStats({ name: 'GlamourBard' });
    runtimeState.getRuntimeValue.mockReturnValue([{ name: 'Mantle of Majesty' }]);

    const action = {
      name: 'Mantle of Majesty',
      automation: {
        type: 'free_spell',
        spell: 'Command',
        concentration: true,
      },
    };

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('already active');
  });

  it('does not intercept normal free_spell features', async () => {
    const ps = makePlayerStats();
    runtimeState.getRuntimeValue.mockReturnValue(null);

    const action = {
      name: 'Channel Divinity: Charm',
      automation: {
        type: 'free_spell',
        spell: 'Charm Person',
        resourceCost: 'channel_divinity',
      },
    };

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.html).toContain('Charm Person');
  });

  it('skips concentration when combatSummary is null', async () => {
    const ps = makePlayerStats({ name: 'GlamourBard' });
    runtimeState.getRuntimeValue.mockReturnValue(null);
    combatData.getCombatSummary.mockReturnValue(null);

    const action = {
      name: 'Mantle of Majesty',
      automation: {
        type: 'free_spell',
        spell: 'Command',
        concentration: true,
      },
    };

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('calculates DC with no spellAbilities.saveDc, falling back to proficiency', async () => {
    const ps = makePlayerStats({ name: 'GlamourBard', proficiency: 3 });
    runtimeState.getRuntimeValue.mockReturnValue(null);
    combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'GlamourBard' }] });

    const action = {
      name: 'Mantle of Majesty',
      automation: {
        type: 'free_spell',
        spell: 'Command',
        concentration: true,
      },
    };

    await handle(action, ps, campaignName, null);

    expect(concentrationService.addConcentration).toHaveBeenCalledWith(
      expect.any(Object),
      'GlamourBard',
      'Mantle of Majesty',
      11,
    );
  });

  it('calculates DC with no spellAbilities.saveDc and no proficiency, defaulting to 10', async () => {
    const ps = makePlayerStats({ name: 'GlamourBard' });
    runtimeState.getRuntimeValue.mockReturnValue(null);
    combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'GlamourBard' }] });

    const action = {
      name: 'Mantle of Majesty',
      automation: {
        type: 'free_spell',
        spell: 'Command',
        concentration: true,
      },
    };

    await handle(action, ps, campaignName, null);

    expect(concentrationService.addConcentration).toHaveBeenCalledWith(
      expect.any(Object),
      'GlamourBard',
      'Mantle of Majesty',
      10,
    );
  });
});
