import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('An object is already real');
    expect(result.payload.description).toContain('Candle');
  });

  it('should return modal when no existing object', async () => {
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('illusoryReality');
    expect(result.payload.action).toEqual(makeAction());
    expect(result.payload.playerStats).toEqual(makePlayerStats());
    expect(result.payload.campaignName).toBe(campaignName);
  });

  it('should default featureName when action.name is missing', async () => {
    getRuntimeValue.mockReturnValue(null);
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

  it('should store object name and timestamp on success', async () => {
    const result = await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, 'Ladder');

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusoryRealityObject', 'Ladder', campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusoryRealityObject_timestamp', expect.any(Number), campaignName);
  });

  it('should trim object name before storing', async () => {
    await confirmIllusoryReality(makeAction(), makePlayerStats(), campaignName, '  Ladder  ');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusoryRealityObject', 'Ladder', campaignName);
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
    expect(result.payload.description).toContain('1 minute');
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

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toBeNull();
  });

  it('should return null when no timestamp stored', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'illusoryRealityObject') return 'Ladder';
      return null;
    });

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toBeNull();
  });

  it('should return object when within 1 minute duration', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 30000); // 30 seconds later

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'illusoryRealityObject') return 'Ladder';
      if (key === 'illusoryRealityObject_timestamp') return now;
      return null;
    });

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toEqual({
      name: 'Ladder',
      remainingMs: 30000,
    });
  });

  it('should return null and clean up when expired', async () => {
    const timestamp = Date.now() - 120000; // 2 minutes ago
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'illusoryRealityObject') return 'Ladder';
      if (key === 'illusoryRealityObject_timestamp') return timestamp;
      return null;
    });

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toBeNull();
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusoryRealityObject', null, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusoryRealityObject_timestamp', null, campaignName);
  });

  it('should return null when elapsed equals duration', async () => {
    const timestamp = Date.now() - 60000; // exactly 1 minute ago
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'illusoryRealityObject') return 'Ladder';
      if (key === 'illusoryRealityObject_timestamp') return timestamp;
      return null;
    });

    const result = await getActiveObject('TestWizard', campaignName);

    expect(result).toBeNull();
  });

});

describe('illusoryRealityHandler.clearObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear object and timestamp', async () => {
    await clearObject('TestWizard', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusoryRealityObject', null, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'illusoryRealityObject_timestamp', null, campaignName);
  });
});
