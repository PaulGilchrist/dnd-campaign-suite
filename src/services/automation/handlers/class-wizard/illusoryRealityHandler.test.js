import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import {
  handle,
  confirmIllusoryReality,
  getActiveObject,
  clearObject,
} from './illusoryRealityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 14,
    proficiency: 6,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Illusory Reality',
    automation: { type: 'illusory_reality', ...automation },
  };
}

describe('illusoryRealityHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup when object already exists', async () => {
    getRuntimeValue.mockReturnValue('Candle');
    getCurrentCombatRound.mockReturnValue(1);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('An object is already real');
    expect(result.payload.description).toContain('Candle');
  });

  it('should return modal when no existing object', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCurrentCombatRound.mockReturnValue(1);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('illusoryReality');
    expect(result.payload.action).toEqual(makeAction());
    expect(result.payload.playerStats).toEqual(makePlayerStats());
    expect(result.payload.campaignName).toBe(campaignName);
  });

  it('should default featureName when action.name is missing', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCurrentCombatRound.mockReturnValue(1);
    const noNameAction = { automation: { type: 'illusory_reality' } };

    const result = await handle(noNameAction, makePlayerStats(), campaignName, null);

    expect(result.payload.description).toBeUndefined();
    expect(result.type).toBe('modal');
  });
});

describe('illusoryRealityHandler.confirmIllusoryReality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when objectName is empty string', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, '');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('You must specify an inanimate');
  });

  it('should return error when objectName is null', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('You must specify an inanimate');
  });

  it('should return error when objectName is not a string', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 123);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('You must specify an inanimate');
  });

  it('should return error when objectName is whitespace only', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, '   ');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('You must specify an inanimate');
  });

  it('should store object name on success', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 'Ladder');

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWizard', 'illusoryRealityObject', 'Ladder', campaignName, true);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestWizard', 'illusoryRealityUsedRound', 1, campaignName, true);
  });

  it('should trim object name before storing', async () => {
    await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, '  Ladder  ');

    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWizard', 'illusoryRealityObject', 'Ladder', campaignName, true);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestWizard', 'illusoryRealityUsedRound', 1, campaignName, true);
  });

  it('should call addEntry with ability_use', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 'Candle');

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestWizard',
      abilityName: 'Illusory Reality',
      timestamp: now,
    }));
  });

  it('should return success popup with HTML description', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 'Ladder');

    expect(result.payload.description).toContain('<b>Illusory Reality</b>');
    expect(result.payload.description).toContain('Ladder');
    expect(result.payload.description).toContain('persists until you roll initiative');
    expect(result.payload.description).toContain('cannot deal damage');
  });

  it('should include automation in popup payload', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 'Ladder');

    expect(result.payload.automation).toEqual(makeAction().automation);
  });

  it('should use custom featureName from action.name', async () => {
    const customAction = {
      name: 'Custom Illusory',
      automation: { type: 'illusory_reality' },
    };

    const result = await confirmIllusoryReality(customAction, makePlayerStats(), campaignName, 'Ladder');

    expect(result.payload.name).toBe('Custom Illusory');
    expect(result.payload.description).toContain('Custom Illusory');
  });
});

describe('illusoryRealityHandler.getActiveObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no object stored', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCurrentCombatRound.mockReturnValue(1);

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toBeNull();
  });

  it('should return object when one exists', async () => {
    getRuntimeValue.mockReturnValueOnce('Ladder').mockReturnValueOnce(1);
    getCurrentCombatRound.mockReturnValue(1);

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toEqual({
      name: 'Ladder',
    });
  });

});

describe('illusoryRealityHandler.clearObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear object', async () => {
    await clearObject('TestWizard', campaignName);

    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWizard', 'illusoryRealityObject', null, campaignName);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestWizard', 'illusoryRealityUsedRound', null, campaignName);
  });
});
