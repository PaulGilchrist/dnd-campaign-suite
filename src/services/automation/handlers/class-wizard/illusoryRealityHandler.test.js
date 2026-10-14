import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  handle,
  confirmIllusoryReality,
  getActiveObject,
  clearObject,
} from './illusoryRealityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../../services/rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockReturnValue(undefined),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 14,
    proficiency: 6,
    ...overrides,
  };
}

function makeAction(automation = {}, name = 'Illusory Reality') {
  return { name, automation: { type: 'illusory_reality', ...automation } };
}

function setupMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'illusoryRealityObject') return null;
    return null;
  });
  getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestWizard' });
  addEntry.mockResolvedValue(undefined);
}

describe('illusoryRealityHandler.handle', () => {
  beforeEach(setupMocks);

  it('returns popup when feature was already used this turn', async () => {
    getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestWizard' });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityUsedRound') return { round: 1, activeCreature: 'TestWizard' };
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Illusory Reality');
    expect(result.payload.description).toBe('Illusory Reality can only be used once per turn.');
  });

  it('returns modal with action, playerStats, and campaignName when available', async () => {
    getCombatContext.mockResolvedValue({ round: 2, activeCreatureName: 'TestWizard' });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityUsedRound') return { round: 1, activeCreature: 'TestWizard' };
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('illusoryReality');
    expect(result.payload.action).toEqual(makeAction());
    expect(result.payload.playerStats).toEqual(makePlayerStats());
    expect(result.payload.campaignName).toBe(campaignName);
  });

  it('returns popup with object name when an object is already real', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityObject') return 'Candle';
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Illusory Reality');
    expect(result.payload.description).toContain('An object is already real');
    expect(result.payload.description).toContain('Candle');
    expect(result.payload.automation).toEqual(makeAction().automation);
  });

  it('defaults featureName to "Illusory Reality" when action.name is missing', async () => {
    const noNameAction = { automation: { type: 'illusory_reality' } };
    const result = await handle(noNameAction, makePlayerStats(), campaignName);

    expect(result.type).toBe('modal');
    expect(result.payload.action).toEqual(noNameAction);
  });

  it('uses custom featureName from action.name in popup and modal', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityObject') return 'Ladder';
      return null;
    });
    const customAction = makeAction({}, 'Custom Feature');

    const popupResult = await handle(customAction, makePlayerStats(), campaignName);
    expect(popupResult.payload.name).toBe('Custom Feature');
    expect(popupResult.payload.description).toContain('Custom Feature');
  });

  it('uses custom featureName in modal payload when action.name is provided', async () => {
    const customAction = makeAction({}, 'Custom Feature');
    const result = await handle(customAction, makePlayerStats(), campaignName);

    expect(result.type).toBe('modal');
    expect(result.payload.action.name).toBe('Custom Feature');
  });
});

describe('illusoryRealityHandler.confirmIllusoryReality', () => {
  beforeEach(setupMocks);

  it.each([
    { objectName: '', label: 'empty string' },
    { objectName: null, label: 'null' },
    { objectName: undefined, label: 'undefined' },
    { objectName: 123, label: 'non-string' },
    { objectName: '   ', label: 'whitespace only' },
  ])('returns error popup when objectName is $label', async ({ objectName }) => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, objectName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Illusory Reality');
    expect(result.payload.description).toContain('You must specify an inanimate');
    expect(result.payload.automation).toEqual(makeAction().automation);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('stores trimmed object name and marks used round on success', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 'Ladder');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard',
      'illusoryRealityObject',
      'Ladder',
      campaignName,
      true,
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestWizard',
      'illusoryRealityUsedRound',
      { round: 1, activeCreature: 'TestWizard' },
      campaignName,
    );
  });

  it('calls addEntry with ability_use log entry', async () => {
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 'Candle');

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestWizard',
      abilityName: 'Illusory Reality',
      timestamp: expect.any(Number),
    }));

    dateSpy.mockRestore();
  });

  it('uses custom featureName from action.name in success popup', async () => {
    const customAction = makeAction({}, 'Custom Illusory');
    const result = await confirmIllusoryReality(customAction, makePlayerStats(), campaignName, 'Ladder');

    expect(result.payload.name).toBe('Custom Illusory');
    expect(result.payload.description).toContain('Custom Illusory');
  });
});

describe('illusoryRealityHandler.getActiveObject', () => {
  beforeEach(setupMocks);

  it('returns null when no object stored', async () => {
    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toBeNull();
  });

  it('returns object wrapper when one exists', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityObject') return 'Ladder';
      return null;
    });

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toEqual({ name: 'Ladder' });
  });
});

describe('illusoryRealityHandler.clearObject', () => {
  beforeEach(setupMocks);

  it('clears both runtime values', async () => {
    const result = await clearObject('TestWizard', campaignName);

    expect(result).toBeUndefined();
    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWizard', 'illusoryRealityObject', null, campaignName);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestWizard', 'illusoryRealityUsedRound', null, campaignName);
  });
});
