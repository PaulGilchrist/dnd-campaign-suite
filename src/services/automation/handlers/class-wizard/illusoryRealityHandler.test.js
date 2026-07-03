// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  handle,
  confirmIllusoryReality,
  getActiveObject,
  clearObject,
} from './illusoryRealityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
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
    if (key === 'illusoryRealityUsedRound') return null;
    return null;
  });
  setRuntimeValue.mockResolvedValue(undefined);
  getCurrentCombatRound.mockReturnValue(1);
  addEntry.mockResolvedValue();
}

describe('illusoryRealityHandler.handle', () => {
  beforeEach(setupMocks);

  it('should return popup with per-round guard when already used this round', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityUsedRound') return 1;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Illusory Reality');
    expect(result.payload.description).toBe('Illusory Reality: Can only be used once per round.');
    expect(result.payload.automation).toEqual(makeAction().automation);
  });

  it('should return modal when no existing object and feature not used this round', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityUsedRound') return 2;
      if (key === 'illusoryRealityObject') return null;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('illusoryReality');
    expect(result.payload.action).toEqual(makeAction());
    expect(result.payload.playerStats).toEqual(makePlayerStats());
    expect(result.payload.campaignName).toBe(campaignName);
  });

  it('should return popup when an object is already real', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityUsedRound') return null;
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

  it('should default featureName when action.name is missing', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityUsedRound') return null;
      if (key === 'illusoryRealityObject') return null;
      return null;
    });
    const noNameAction = { automation: { type: 'illusory_reality' } };

    const result = await handle(noNameAction, makePlayerStats(), campaignName);

    expect(result.type).toBe('modal');
    expect(result.payload.action).toEqual(noNameAction);
  });

  it('should use custom featureName from action.name in popup descriptions', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityUsedRound') return null;
      if (key === 'illusoryRealityObject') return 'Ladder';
      return null;
    });
    const customAction = makeAction({}, 'Custom Feature');

    const result = await handle(customAction, makePlayerStats(), campaignName);

    expect(result.payload.name).toBe('Custom Feature');
    expect(result.payload.description).toContain('Custom Feature');
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
  ])('should return error popup when objectName is $label', async ({ objectName }) => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, objectName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Illusory Reality');
    expect(result.payload.description).toContain('You must specify an inanimate');
    expect(result.payload.automation).toEqual(makeAction().automation);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('should store object name and used round on success', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 'Ladder');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWizard', 'illusoryRealityObject', 'Ladder', campaignName, true);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestWizard', 'illusoryRealityUsedRound', 1, campaignName, true);
  });

  it('should trim object name before storing', async () => {
    await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, '  Ladder  ');

    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWizard', 'illusoryRealityObject', 'Ladder', campaignName, true);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestWizard', 'illusoryRealityUsedRound', 1, campaignName, true);
  });

  it('should call addEntry with ability_use log entry', async () => {
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 'Candle');

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestWizard',
      abilityName: 'Illusory Reality',
      timestamp: now,
    }));

    dateSpy.mockRestore();
  });

  it('should return success popup with expected HTML description', async () => {
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

  it('should use custom featureName from action.name in success popup', async () => {
    const customAction = makeAction({}, 'Custom Illusory');
    const result = await confirmIllusoryReality(customAction, makePlayerStats(), campaignName, 'Ladder');

    expect(result.payload.name).toBe('Custom Illusory');
    expect(result.payload.description).toContain('Custom Illusory');
  });
});

describe('illusoryRealityHandler.getActiveObject', () => {
  beforeEach(setupMocks);

  it('should return null when no object stored', async () => {
    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toBeNull();
  });

  it('should return object when one exists', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityObject') return 'Ladder';
      return null;
    });

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toEqual({ name: 'Ladder' });
  });

  it('should return null when object exists but round has changed', async () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'illusoryRealityObject') return 'Ladder';
      if (key === 'illusoryRealityUsedRound') return 2;
      return null;
    });

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toEqual({ name: 'Ladder' });
  });
});

describe('illusoryRealityHandler.clearObject', () => {
  beforeEach(setupMocks);

  it('should clear both runtime values', async () => {
    const result = await clearObject('TestWizard', campaignName);

    expect(result).toBeUndefined();
    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWizard', 'illusoryRealityObject', null, campaignName);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestWizard', 'illusoryRealityUsedRound', null, campaignName);
  });
});
