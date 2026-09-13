// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
  KEY: 'pendingExpirations',
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { handle, applyDamageTypeChoice, cancelSacredWeapon } from './sacredWeaponHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

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

    it('should activate immediately and decrement charges when options array is empty', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'channelDivinityCharges') return 3;
        return null;
      });

      const action = makeAction({ automation: { ...makeAction().automation, options: [] } });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Sacred Weapon activated');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, campaignName);
    });

    it('should toggle off when already active and remove only that buff', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [
          { name: 'Other Buff', effect: 'other' },
          { name: 'Sacred Weapon', effect: 'sacred_weapon' },
        ];
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Sacred Weapon ended');
      expect(result.payload.automationType).toBe('temp_buff');
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

    it('should replace (not duplicate) an existing Sacred Weapon buff on double activate', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'normal' }];
        return null;
      });

      await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Radiant Damage');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        [expect.objectContaining({ name: 'Sacred Weapon', damageTypeChoice: 'Radiant' })],
        campaignName,
      );
    });

    it('should register a 10-minute (100 round) expiration on activation (CLA-301)', async () => {
      getRuntimeValue.mockReturnValue([]);

      await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Radiant Damage');

      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestHero', targetName: 'TestHero', effects: [{ type: 'remove_active_buff', buffName: 'Sacred Weapon' }], campaignName, rounds: 100 });
    });

    it('should emit an ability_use activation log with CD spend and light prose (CLA-301)', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'channelDivinityCharges') return 2;
        return null;
      });

      await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Radiant Damage');

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestHero',
          abilityName: 'Sacred Weapon',
          description: expect.stringContaining('Channel Divinity'),
        }),
      );
      const desc = addEntry.mock.calls[addEntry.mock.calls.length - 1][1].description;
      expect(desc).toContain('+3 to attack rolls');
      expect(desc).toContain('bright light in a 20-foot radius');
      expect(desc).toContain('Radiant');
    });

    it('should emit an ability_use log on direct (no-options) activation too (CLA-301)', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'channelDivinityCharges') return 3;
        return null;
      });

      const action = makeAction({ automation: { ...makeAction().automation, options: [] } });
      await handle(action, makePlayerStats(), campaignName);

      const logged = addEntry.mock.calls.some(([, e]) => e.type === 'ability_use' && e.abilityName === 'Sacred Weapon');
      expect(logged).toBe(true);
    });
  });

  describe('zero-charge refusal (CLA-301)', () => {
    it('spends nothing, registers nothing and logs nothing when charges are 0', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'channelDivinityCharges') return 0;
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('cancelSacredWeapon (CLA-301 refund)', () => {
    it('refunds the charge spent before the picker opened', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'channelDivinityCharges') return 1;
        return null;
      });

      await cancelSacredWeapon(makeAction(), makePlayerStats(), campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, campaignName);
    });

    it('does not write when charges store is untouched (nothing was spent)', async () => {
      getRuntimeValue.mockReturnValue(null);

      await cancelSacredWeapon(makeAction(), makePlayerStats(), campaignName);

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('toggle off cleanup (CLA-301)', () => {
    it('removes the queued remove_active_buff expiration when ending the buff', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Sacred Weapon', effect: 'sacred_weapon' }];
        if (key === 'pendingExpirations') return [
          { target: 'TestHero', effects: [{ type: 'remove_active_buff', buffName: 'Sacred Weapon' }], appliedRound: 1, expiryRounds: 100 },
          { target: 'TestHero', effects: [{ type: 'remove_active_buff', buffName: 'Other Buff' }], appliedRound: 2, expiryRounds: 10 },
        ];
        return null;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe('Sacred Weapon ended');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'pendingExpirations',
        [expect.objectContaining({ effects: [{ type: 'remove_active_buff', buffName: 'Other Buff' }] })],
        campaignName,
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ type: 'ability_use', description: expect.stringContaining('ended Sacred Weapon') }),
      );
    });
  });
});
