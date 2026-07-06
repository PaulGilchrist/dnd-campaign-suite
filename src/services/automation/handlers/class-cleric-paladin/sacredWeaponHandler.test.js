// // @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

import { handle, applyDamageTypeChoice } from './sacredWeaponHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
  return {
    name: 'Sacred Weapon',
    automation: {
      type: 'temp_buff',
      effect: 'sacred_weapon',
      duration: '10_minutes',
      resourceCost: 'channel_divinity',
      options: [
        { name: 'Normal Damage Type', damageType: 'normal' },
        { name: 'Radiant Damage', damageType: 'Radiant' },
      ],
      casting_time: '1_action',
      ...overrides.automation,
    },
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    class: {
      class_levels: [
        undefined, undefined, { channel_divinity: 2 },
        undefined, undefined,
      ],
    },
    abilities: [
      { name: 'Charisma', bonus: 3 },
    ],
    ...overrides,
  };
}

describe('sacredWeaponHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('should show damage type modal when activating with options and charges available', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'channelDivinityCharges') return 2;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('sacredWeaponDamageType');
      expect(result.payload.action).toEqual(makeAction());
      expect(result.payload.playerStats).toEqual(makePlayerStats());
      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('should show no-charges popup when channel divinity charges are insufficient', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'channelDivinityCharges') return 0;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.automationType).toBe('temp_buff');
    });

    it('should activate immediately when options array is empty', async () => {
      const action = makeAction({ automation: { ...makeAction().automation, options: [] } });

      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'channelDivinityCharges') return 2;
        return null;
      });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Sacred Weapon activated');
      expect(result.payload.description).toContain('bright light');
      expect(result.payload.description).toContain('Charisma modifier');
    });

    it('should decrement channel divinity charges on activation', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'channelDivinityCharges') return 3;
        return null;
      });

      const action = makeAction({ automation: { ...makeAction().automation, options: [] } });

      await handle(action, makePlayerStats(), campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, campaignName);
    });

    it('should toggle off when already active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Sacred Weapon', effect: 'sacred_weapon' }];
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Sacred Weapon ended');
      expect(result.payload.automationType).toBe('temp_buff');
    });

    it('should clear active buffs when toggling off', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [
          { name: 'Other Buff', effect: 'other' },
          { name: 'Sacred Weapon', effect: 'sacred_weapon' },
        ];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        [{ name: 'Other Buff', effect: 'other' }],
        campaignName,
      );
    });

    it('should use class_specific.channel_divinity_charges fallback when stored is null', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'channelDivinityCharges') return null;
        return null;
      });

      const action = makeAction({ automation: { ...makeAction().automation, options: [] } });
      const playerStats = makePlayerStats({
        level: 3,
        class: {
          class_levels: [
            undefined, undefined, { channel_divinity: 0, class_specific: { channel_divinity_charges: 3 } },
            undefined, undefined,
          ],
        },
      });

      await handle(action, playerStats, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, campaignName);
    });

  });

  describe('applyDamageTypeChoice', () => {
    it('should apply chosen damage type and update buff', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: null }];
        return null;
      });

      const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Radiant Damage');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Radiant');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ damageTypeChoice: 'Radiant' }),
        ]),
        campaignName,
      );
    });

    it('should preserve other buffs when updating sacred weapon', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [
          { name: 'Other Buff', effect: 'other' },
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: null },
        ];
        return null;
      });

      await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Radiant Damage');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Other Buff', effect: 'other' }),
          expect.objectContaining({ damageTypeChoice: 'Radiant' }),
        ]),
        campaignName,
      );
    });

    it('should set damageTypeChoice to null when no option chosen', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Radiant' }];
        return null;
      });

      const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).not.toContain('Damage type set to');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ damageTypeChoice: null }),
        ]),
        campaignName,
      );
    });
  });
});
