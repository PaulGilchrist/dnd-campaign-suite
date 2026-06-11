import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './spellCastHandler.js';
import * as diceRoller from '../../dice/diceRoller.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiencyBonus: 2,
    class: {
      class_levels: [
        {},
        {},
        { channel_divinity: 3 },
      ],
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Divine Smite',
    description: 'A powerful strike.',
    automation: {
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('spellCastHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Channel Divinity resource cost', () => {
    it('should return no-charges popup when channel_divinity and charges are 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resourceCost: 'channel_divinity' });

      runtimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should decrement channelDivinityCharges when channel_divinity and charges > 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resourceCost: 'channel_divinity' });

      runtimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(undefined);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });

    it('should use maxCharges from class_levels when storedCharges is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resourceCost: 'channel_divinity' });

      runtimeState.getRuntimeValue.mockReturnValue(null);
      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, campaignName, null);

      // storedCharges is null => currentCharges = maxCharges = 3
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'channelDivinityCharges',
        2,
        campaignName,
      );
    });

    it('should use channel_divinity_charges from class_specific when channel_divinity is missing', async () => {
      const ps = makePlayerStats({
        class: {
          class_levels: [
            {},
            {},
            { class_specific: { channel_divinity_charges: 4 } },
          ],
        },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      runtimeState.getRuntimeValue.mockReturnValue(null);
      // After channel divinity block, auto.spell is undefined so spellNames = [action.name]
      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, campaignName, null);

      // storedCharges is null => currentCharges = maxCharges = 4, new = 3
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'channelDivinityCharges',
        3,
        campaignName,
      );
    });

    it('should default to 2 max charges when class_levels data is missing', async () => {
      const ps = makePlayerStats({ class: undefined });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      runtimeState.getRuntimeValue.mockReturnValue(null);
      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });
  });

  describe('Multiple spells (auto.spell as array)', () => {
    it('should return popup with Channel Divinity expended when spellNames.length > 1', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: ['Burning Hands', 'Fire Bolt'] });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Channel Divinity expended.');
      expect(result.payload.html).toContain('Burning Hands or Fire Bolt');
    });

    it('should store freeCastKey with spellNames array when not already stored', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: ['Burning Hands', 'Fire Bolt'] });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        '_Divine_Smite_freeCast',
        ['Burning Hands', 'Fire Bolt'],
        campaignName,
      );
    });

    it('should include noConcentration label when auto.noConcentration is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: ['Burning Hands', 'Fire Bolt'], noConcentration: true });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).toContain('Does not require Concentration.');
    });

    it('should include duration label when auto.duration is set', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: ['Burning Hands', 'Fire Bolt'], duration: 'concentration_up_to_1_min' });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      // replace('_', ' ') only replaces the first underscore
      expect(result.payload.html).toContain('Duration: concentration up_to_1_min.');
    });

    it('should not include duration label when auto.duration is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: ['Burning Hands', 'Fire Bolt'] });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).not.toContain('Duration:');
    });
  });

  describe('Single spell with damage', () => {
    it('should return roll payload when spellData has damage with formula', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [
            {
              name: 'Fire Bolt',
              damage: {
                damage_type: 'Fire',
                damage_at_slot_level: {
                  '1': '1d10',
                  '2': '2d10',
                },
              },
            },
          ],
        },
      });
      const action = makeAction({ spell: 'Fire Bolt' });

      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.rollType).toBe('damage');
      expect(result.payload.name).toBe('Fire Bolt');
      expect(result.payload.formula).toBe('1d10');
      expect(result.payload.total).toBe(7);
      expect(result.payload.rolls).toEqual([7]);
      expect(result.payload.modifier).toBe(0);
    });

    it('should use first slot damage formula from spellData.damage_at_slot_level', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [
            {
              name: 'Magic Missile',
              damage: {
                damage_type: 'Force',
                damage_at_slot_level: {
                  '1': '3d4+3',
                  '2': '4d4+3',
                },
              },
            },
          ],
        },
      });
      const action = makeAction({ spell: 'Magic Missile' });

      diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [3, 4, 5], modifier: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toBe('3d4+3');
    });

    it('should include correct roll payload structure', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [
            {
              name: 'Chill Touch',
              damage: {
                damage_type: 'Necrotic',
                damage_at_slot_level: {
                  '1': '1d8',
                },
              },
            },
          ],
        },
      });
      const action = makeAction({ spell: 'Chill Touch' });

      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload).toMatchObject({
        rollType: 'damage',
        name: 'Chill Touch',
        formula: '1d8',
        total: 5,
        rolls: [5],
        modifier: 0,
        contextConfig: {
          damageType: 'Necrotic',
          attackerName: 'TestHero',
        },
      });
    });

    it('should use spellData.damage_type for damageType in contextConfig', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [
            {
              name: 'Sacred Flame',
              damage: {
                damage_type: 'Radiant',
                damage_at_slot_level: {
                  '1': '1d8',
                },
              },
            },
          ],
        },
      });
      const action = makeAction({ spell: 'Sacred Flame' });

      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.contextConfig.damageType).toBe('Radiant');
    });

    it('should fallback to Radiant when damage_type is missing', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [
            {
              name: 'Mystic Bolt',
              damage: {
                damage_at_slot_level: {
                  '1': '1d6',
                },
              },
            },
          ],
        },
      });
      const action = makeAction({ spell: 'Mystic Bolt' });

      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.contextConfig.damageType).toBe('Radiant');
    });

    it('should not return roll payload when rollExpression returns null', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [
            {
              name: 'Fire Bolt',
              damage: {
                damage_type: 'Fire',
                damage_at_slot_level: {
                  '1': '1d10',
                },
              },
            },
          ],
        },
      });
      const action = makeAction({ spell: 'Fire Bolt' });

      diceRoller.rollExpression.mockReturnValue(null);
      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Free cast of:');
    });

    it('should fetch spells from 2024 data path when rules is 2024', async () => {
      const ps = makePlayerStats({ rules: '2024' });
      const action = makeAction({ spell: 'Fire Bolt' });

      // No local spells match, so it will try to fetch
      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const mockResponse = {
        json: async () => [
          {
            name: 'Fire Bolt',
            damage: {
              damage_type: 'Fire',
              damage_at_slot_level: {
                '1': '1d10',
              },
            },
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(global.fetch).toHaveBeenCalledWith('/data/2024/spells.json');
      expect(result.type).toBe('roll');
    });

    it('should fetch spells from 5e data path when rules is not 2024', async () => {
      const ps = makePlayerStats({ rules: '5e' });
      const action = makeAction({ spell: 'Fire Bolt' });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const mockResponse = {
        json: async () => [
          {
            name: 'Fire Bolt',
            damage: {
              damage_type: 'Fire',
              damage_at_slot_level: {
                '1': '1d10',
              },
            },
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });

      await handle(action, ps, campaignName, null);

      expect(global.fetch).toHaveBeenCalledWith('/data/spells.json');
    });

    it('should handle fetch failure gracefully', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: 'Fire Bolt' });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Free cast of:');
    });
  });

  describe('Single spell without damage', () => {
    it('should return popup with Free cast of when spell has no damage', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [
            {
              name: 'Healing Word',
            },
          ],
        },
      });
      const action = makeAction({ spell: 'Healing Word' });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('<b>Free cast of:</b> Healing Word');
    });

    it('should store freeCastKey when not already stored for single spell without damage', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [
            {
              name: 'Healing Word',
            },
          ],
        },
      });
      const action = makeAction({ spell: 'Healing Word' });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        '_Divine_Smite_freeCast',
        ['Healing Word'],
        campaignName,
      );
    });

    it('should use action.name as fallback spell name when auto.spell is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).toContain('<b>Free cast of:</b> Divine Smite');
    });
  });

  describe('Spell name resolution', () => {
    it('should join multiple spell names with or in labels', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: ['Burning Hands', 'Fire Bolt', 'Scorching Burst'] });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).toContain('Burning Hands or Fire Bolt or Scorching Burst');
    });

    it('should use single spell name from auto.spell when it is a string', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [
            {
              name: 'Fire Bolt',
              damage: {
                damage_type: 'Fire',
                damage_at_slot_level: {
                  '1': '1d10',
                },
              },
            },
          ],
        },
      });
      const action = makeAction({ spell: 'Fire Bolt' });

      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Fire Bolt');
    });

    it('should use action.name when auto.spell is undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).toContain('<b>Free cast of:</b> Divine Smite');
    });
  });

  describe('freeCastKey skip when already stored', () => {
    it('should not store freeCastKey when already stored for multiple spells', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: ['Burning Hands', 'Fire Bolt'] });

      runtimeState.getRuntimeValue.mockReturnValue(['Burning Hands', 'Fire Bolt']);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should not store freeCastKey when already stored for single spell', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: 'Fire Bolt' });

      runtimeState.getRuntimeValue.mockReturnValue(['Fire Bolt']);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('Channel Divinity with no resourceCost', () => {
    it('should skip channel divinity logic when resourceCost is not channel_divinity', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: 'Fire Bolt', resourceCost: 'spell_slot' });

      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.getRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'channelDivinityCharges');
    });
  });
});
