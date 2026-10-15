// @maintained-by-ai — deterministic unit tests for the sacredWeaponHandler.js public contract
// (handle / applyDamageTypeChoice / cancelSacredWeapon). Every side-effect seam (runtime
// store, expirations, log service) is mocked, so the suite is stable as the app moves.
// CLA-301 prose assertions pin the specified activation-log content by design.
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

function mockRuntime(map = {}) {
  getRuntimeValue.mockImplementation((name, key) => (key in map ? map[key] : null));
}

describe('sacredWeaponHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('opens the damage-type picker and spends the Channel Divinity charge before returning', async () => {
      mockRuntime({ activeBuffs: [], channelDivinityCharges: 2 });

      const action = makeAction();
      const playerStats = makePlayerStats();
      const result = await handle(action, playerStats, campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('sacredWeaponDamageType');
      expect(result.payload.action).toEqual(action);
      expect(result.payload.playerStats).toEqual(playerStats);
      expect(result.payload.campaignName).toBe(campaignName);
      // Charge is spent BEFORE the picker opens (CLA-301 refund pairs with this write)
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, campaignName);
      // Buff is not granted un-typed while the picker is still open
      expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'activeBuffs', expect.anything(), campaignName);
    });

    it('activates immediately (no picker) when options are empty, spending the charge and logging the activation', async () => {
      mockRuntime({ activeBuffs: [], channelDivinityCharges: 3 });

      const action = makeAction({ automation: { options: [] } });
      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Sacred Weapon activated');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, campaignName);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ type: 'ability_use', abilityName: 'Sacred Weapon' }),
      );
    });

    it('toggles off: removes only the Sacred Weapon buff, clears its queued expiry, and logs the end', async () => {
      mockRuntime({
        activeBuffs: [
          { name: 'Other Buff', effect: 'other' },
          { name: 'Sacred Weapon', effect: 'sacred_weapon' },
        ],
        pendingExpirations: [
          { target: 'TestHero', effects: [{ type: 'remove_active_buff', buffName: 'Sacred Weapon' }], appliedRound: 1, expiryRounds: 100 },
          { target: 'TestHero', effects: [{ type: 'remove_active_buff', buffName: 'Other Buff' }], appliedRound: 2, expiryRounds: 10 },
        ],
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
      // Queued remove_active_buff expiry must not survive to kill a future re-activation
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

    it('uses class_specific.channel_divinity_charges fallback when stored charges are null', async () => {
      mockRuntime({ activeBuffs: [], channelDivinityCharges: null });

      const action = makeAction({ automation: { options: [] } });
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

    it('refuses at zero charges: popup, no spend, no expiry, no log (CLA-301)', async () => {
      mockRuntime({ activeBuffs: [], channelDivinityCharges: 0 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.automationType).toBe('temp_buff');
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('applyDamageTypeChoice', () => {
    it('activates with the chosen damage type: writes the buff, registers the 100-round expiry, logs prose (CLA-301)', async () => {
      mockRuntime({ activeBuffs: [], channelDivinityCharges: 2 });

      const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Radiant Damage');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Radiant');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        [expect.objectContaining({ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Radiant', duration: '10_minutes' })],
        campaignName,
      );
      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestHero', targetName: 'TestHero', effects: [{ type: 'remove_active_buff', buffName: 'Sacred Weapon' }], campaignName, rounds: 100 });
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

    it('replaces an existing Sacred Weapon buff without duplicating it, preserving other buffs', async () => {
      mockRuntime({
        activeBuffs: [
          { name: 'Other Buff', effect: 'other' },
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'normal' },
        ],
      });

      await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, 'Radiant Damage');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        [
          expect.objectContaining({ name: 'Other Buff', effect: 'other' }),
          expect.objectContaining({ name: 'Sacred Weapon', damageTypeChoice: 'Radiant' }),
        ],
        campaignName,
      );
    });

    it('sets damageTypeChoice to null when no option chosen', async () => {
      mockRuntime({ activeBuffs: [{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Radiant' }] });

      const result = await applyDamageTypeChoice(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).not.toContain('Damage type set to');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'activeBuffs',
        [expect.objectContaining({ damageTypeChoice: null })],
        campaignName,
      );
    });
  });

  describe('cancelSacredWeapon (CLA-301 refund)', () => {
    it('refunds the charge spent before the picker opened', async () => {
      mockRuntime({ channelDivinityCharges: 1 });

      await cancelSacredWeapon(makeAction(), makePlayerStats(), campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, campaignName);
    });

    it('does not write when charges store is untouched (nothing was spent)', async () => {
      mockRuntime({});

      await cancelSacredWeapon(makeAction(), makePlayerStats(), campaignName);

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
