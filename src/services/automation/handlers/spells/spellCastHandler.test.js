// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../feats/magicInitiateHandler.js', () => ({
  getMagicInitiateLevel1Spell: vi.fn(),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './spellCastHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as magicInitiateHandler from '../feats/magicInitiateHandler.js';
import * as postCastRiderService from '../../../../services/rules/spells/postCastRiderService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Magic Initiate',
    automation: {
      type: 'spell',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('spellCastHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('Magic Initiate spell resolution', () => {
    it('should use action.name when auto.spell is empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: '' });

      magicInitiateHandler.getMagicInitiateLevel1Spell.mockReturnValue('Magic Missile');

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Magic Missile');
    });

    it('should use action.name when auto.spell is undefined', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      delete action.automation.spell;

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Magic Initiate');
    });

    it('should use auto.spell directly when set to a non-empty value', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: 'Fire Bolt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Fire Bolt');
    });

    it('should fall back to action.name when Magic Initiate returns no spell', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: '' });

      magicInitiateHandler.getMagicInitiateLevel1Spell.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Magic Initiate');
    });
  });

  describe('Channel Divinity cost', () => {
    it('should return popup when channel divinity charges are 0', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    });

    it('should return popup when channel divinity charges are negative', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(-1);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should default to max charges when no runtime value stored', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });

    it('should decrement channel divinity charges on use', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });

    it('should handle missing class_levels gracefully', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const ps = makePlayerStats({
        class: {},
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });

    it('should use class_specific channel_divinity_charges as fallback when level entry lacks it', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const ps = makePlayerStats({
        level: 1,
        class: {
          class_levels: [{ level: 1, class_specific: { channel_divinity_charges: 3 } }],
        },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        'channelDivinityCharges',
        2,
        campaignName,
      );
    });
  });

  describe('Uses expression (counter-based free casts)', () => {
    it('should return popup when free casts are 0', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const action = makeAction({
        uses_expression: 'WIS modifier_min_1',
        usesMax: 1,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
    });

    it('should return popup when free casts are negative', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(-2);

      const action = makeAction({
        uses_expression: 'CHA modifier_min_1',
        usesMax: 3,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should default to usesMax when no runtime value stored', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({
        uses_expression: 'WIS modifier_min_1',
        usesMax: 3,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('2 remaining');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Magic_Initiate_freeCastCount',
        2,
        campaignName,
      );
    });

    it('should decrement free cast count and show remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);

      const action = makeAction({
        uses_expression: 'WIS modifier_min_1',
        usesMax: 2,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('1 remaining');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Magic_Initiate_freeCastCount',
        1,
        campaignName,
      );
    });

    it('should decrement to zero and show 0 remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction({
        uses_expression: 'WIS modifier_min_1',
        usesMax: 1,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('0 remaining');
    });

    it('should use the action name in the runtime key', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = {
        name: 'Divine Smite',
        automation: {
          type: 'spell',
          uses_expression: 'STR modifier_min_1',
          usesMax: 2,
        },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Divine_Smite_freeCastCount',
        1,
        campaignName,
      );
    });
  });

  describe('Multi-spell automation with perSpellTracking', () => {
    it('should show available spells when none used yet', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
        perSpellTracking: true,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Available free casts');
      expect(result.payload.html).toContain('Fire Bolt');
      expect(result.payload.html).toContain('Light');
    });

    it('should show only unused spells', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(true).mockReturnValueOnce(null);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
        perSpellTracking: true,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.html).toContain('Light');
      expect(result.payload.html).not.toContain('Fire Bolt');
    });

    it('should return all used popup when all spells used', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(true);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
        perSpellTracking: true,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('All spells from this feature have been used');
    });

    it('should mark a spell as used when available', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce(null);

      const action = makeAction({
        spell: ['Fire Bolt'],
        perSpellTracking: true,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.html).toContain('Fire Bolt');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalled();
    });

    it('should show long rest recharge text by default', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(true);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
        perSpellTracking: true,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Long Rest');
    });

    it('should show short or long rest recharge text when specified', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(true);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
        perSpellTracking: true,
        recharge: 'short_or_long_rest',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Short or Long Rest');
    });
  });

  describe('Multi-spell automation without perSpellTracking', () => {
    it('should show channel divinity expended popup on first use', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Channel Divinity expended');
    });

    it('should not set runtime value when spells already stored', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(['Fire Bolt', 'Light']);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
      });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should join multiple spells with " or " in the label', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light', 'Mage Hand'],
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.html).toContain('Fire Bolt or Light or Mage Hand');
    });
  });

  describe('Spell damage with empowered evocation', () => {
    it('should return roll payload when spell has damage', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

      const action = makeAction({ spell: 'Fire Bolt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.rollType).toBe('damage');
      expect(result.payload.name).toBe('Fire Bolt');
      expect(result.payload.total).toBe(7);
    });

    it('should add Empowered Evocation modifier for evocation spell', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', school: 'Evocation', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [9], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);

      const action = makeAction({ spell: 'Fire Bolt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('Empowered Evocation');
      expect(result.payload.total).toBe(9);
    });

    it('should NOT add Empowered Evocation for non-evocation spells', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Chill Touch', school: 'Necromancy', damage: { damage_at_slot_level: { '1': '1d8' }, damage_type: 'Necrotic' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);

      const action = makeAction({ spell: 'Chill Touch' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).not.toContain('Empowered Evocation');
      expect(result.payload.total).toBe(5);
    });

    it('should NOT add Empowered Evocation when modifier is 0', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', school: 'Evocation', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(0);

      const action = makeAction({ spell: 'Fire Bolt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).not.toContain('Empowered Evocation');
      expect(result.payload.total).toBe(7);
    });

    it('should use spell data from playerStats.spellAbilities first', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

      const action = makeAction({ spell: 'Fire Bolt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.contextConfig.damageType).toBe('Fire');
    });

    it('should default damage_type to Radiant when not specified', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Scorching Ray', damage: { damage_at_slot_level: { '1': '2d6' } } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

      const action = makeAction({ spell: 'Scorching Ray' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.contextConfig.damageType).toBe('Radiant');
    });

    it('should fall back to spells.json when spell not in playerStats', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

      const mockResponse = {
        json: vi.fn().mockResolvedValue([
          { name: 'Ray of Frost', damage: { damage_at_slot_level: { '1': '1d8' }, damage_type: 'Cold' } },
        ]),
      };
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const action = makeAction({ spell: 'Ray of Frost' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.contextConfig.damageType).toBe('Cold');

      global.fetch = originalFetch;
    });

    it('should return popup when rollExpression returns null', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue(null);
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

      const action = makeAction({ spell: 'Fire Bolt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should return popup when spell has damage object but no damage_at_slot_level', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Weird Spell', damage: { damage_type: 'Psychic' } }],
        },
      });
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);

      const action = makeAction({ spell: 'Weird Spell' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should not call rollExpression when spell has no damage', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });

      const action = makeAction({ spell: 'Light' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });
  });

  describe('Free cast popup (no damage or fallback spell)', () => {
    it('should return popup with free cast info when spell has no damage', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ spell: 'Light' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Free cast of');
      expect(result.payload.html).toContain('Light');
    });

    it('should set freeCast runtime value on first cast', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ spell: 'Light' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_Magic_Initiate_freeCast',
        ['Light'],
        campaignName,
      );
    });

    it('should not set runtime value when already expended', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(['Light']);

      const action = makeAction({ spell: 'Light' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return popup when spell not found in playerStats or spells.json', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue([]),
      });

      const action = makeAction({ spell: 'NonExistentSpell' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');

      global.fetch = originalFetch;
    });
  });

  describe('Concentration and duration labels', () => {
    it('should include "Does not require Concentration" when noConcentration is true', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ spell: 'Light', noConcentration: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).toContain('Does not require Concentration');
    });

    it('should NOT include concentration label when noConcentration is false', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ spell: 'Light', noConcentration: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).not.toContain('Does not require Concentration');
    });

    it('should include duration when provided', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ spell: 'Light', duration: '1_hour' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).toContain('Duration: 1 hour');
    });

    it('should NOT include duration when not provided', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ spell: 'Light' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).not.toContain('Duration:');
    });

    it('should replace first underscore with space in duration', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Hold Monster' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ spell: 'Hold Monster', duration: 'concentration_till_end_of_turn' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).toContain('concentration till_end_of_turn');
    });
  });

  describe('Action description rendering', () => {
    it('should include action description in popup html', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = {
        name: 'Magic Initiate',
        description: 'Learn a cantrip from the wizard spell list',
        automation: {
          type: 'spell',
          spell: 'Light',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.html).toContain('Learn a cantrip from the wizard spell list');
    });

    it('should handle missing action.description gracefully', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = {
        name: 'Magic Initiate',
        automation: {
          type: 'spell',
          spell: 'Light',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Magic Initiate');
    });
  });

  describe('_mapName parameter', () => {
    it('should accept and ignore the mapName parameter', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Light' }],
        },
      });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ spell: 'Light' });

      const result = await handle(action, ps, campaignName, 'combat-map-1');

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Light');
    });
  });
});
