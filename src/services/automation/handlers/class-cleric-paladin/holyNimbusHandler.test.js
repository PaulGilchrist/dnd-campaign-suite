import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { handle } from './holyNimbusHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    proficiency: 3,
    class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Holy Nimbus',
    automation: { type: 'holy_nimbus', ...automation },
  };
}

describe('holyNimbusHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should toggle off when already active', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return true;
      if (key === 'activeBuffs') return [{ name: 'Holy Nimbus', effect: 'sunlight_aura' }];
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Holy Nimbus ended.');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'holyNimbusActive', false, campaignName);
  });

  it('should remove sunlight_aura buff when toggling off', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return true;
      if (key === 'activeBuffs') return [
        { name: 'Other Buff', effect: 'other' },
        { name: 'Holy Nimbus', effect: 'sunlight_aura' },
      ];
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCleric',
      'activeBuffs',
      [{ name: 'Other Buff', effect: 'other' }],
      campaignName,
    );
  });

  it('should return popup when no charges remaining', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'channelDivinityCharges') return 0;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
  });

  it('should return popup when charges are negative', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'channelDivinityCharges') return -1;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
  });

  it('should use stored charges when available', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'channelDivinityCharges') return 1;
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 0, campaignName);
  });

  it('should default charges to maxCharges when stored is null', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 1, campaignName);
  });

  it('should activate and spend a charge', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'activeBuffs') return [];
      if (key === 'channelDivinityCharges') return 2;
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'holyNimbusActive', true, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 1, campaignName);
  });

  it('should add sunlight_aura buff', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'activeBuffs') return [];
      if (key === 'channelDivinityCharges') return 2;
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCleric',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Holy Nimbus',
          effect: 'sunlight_aura',
          duration: '10_minutes',
          distance: '10_ft',
        }),
      ]),
      campaignName,
    );
  });

  it('should not duplicate buff if already present', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'activeBuffs') return [{ name: 'Holy Nimbus', effect: 'sunlight_aura', duration: '10_minutes', distance: '10_ft' }];
      if (key === 'channelDivinityCharges') return 2;
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCleric',
      'activeBuffs',
      [{ name: 'Holy Nimbus', effect: 'sunlight_aura', duration: '10_minutes', distance: '10_ft' }],
      campaignName,
    );
  });

  it('should call addEntry on activation', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'activeBuffs') return [];
      if (key === 'channelDivinityCharges') return 2;
      return null;
    });

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestCleric',
      abilityName: 'Holy Nimbus',
      timestamp: now,
    }));
  });

  it('should return success popup with description', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'activeBuffs') return [];
      if (key === 'channelDivinityCharges') return 2;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('activated');
    expect(result.payload.description).toContain('holy power');
    expect(result.payload.description).toContain('10 minutes');
  });

  it('should use channel_divinity from class_specific when channel_divinity is not set', async () => {
    const ps = makePlayerStats({
      class: { class_levels: [{ level: 5, channel_divinity_charges: 3 }] },
    });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });

    await handle(makeAction(), ps, campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 1, campaignName);
  });

  it('should default maxCharges to 2 when no class level data', async () => {
    const ps = makePlayerStats({
      class: { class_levels: [{ level: 5 }] },
    });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'activeBuffs') return [];
      return null;
    });

    await handle(makeAction(), ps, campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 1, campaignName);
  });

  it('should include automationType in popup payload', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'activeBuffs') return [];
      if (key === 'channelDivinityCharges') return 2;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.automationType).toBe('holy_nimbus');
  });

  it('should include automation in popup payload', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return false;
      if (key === 'activeBuffs') return [];
      if (key === 'channelDivinityCharges') return 2;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.automation).toEqual(makeAction().automation);
  });

  it('should handle deactivation without removing duplicate buff', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'holyNimbusActive') return true;
      if (key === 'activeBuffs') return [{ name: 'Holy Nimbus', effect: 'sunlight_aura' }];
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCleric',
      'activeBuffs',
      [],
      campaignName,
    );
  });
});
