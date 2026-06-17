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
  hasEmpoweredEvocation: vi.fn(),
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
    vi.clearAllMocks();
  });

  describe('Magic Initiate spell resolution', () => {
    it('should use action.name when auto.spell is not set', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: '' });

      magicInitiateHandler.getMagicInitiateLevel1Spell.mockReturnValue('Magic Missile');

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Magic Missile');
    });

    it('should use auto.spell directly when set', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ spell: 'Fire Bolt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Fire Bolt');
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

    it('should decrement free cast count', async () => {
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
  });

  describe('Multi-spell automation', () => {
    it('should show available spells when perSpellTracking is enabled', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
        perSpellTracking: true,
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Available free casts');
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
    });

    it('should show channel divinity expended popup for multi-spell without perSpellTracking', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({
        spell: ['Fire Bolt', 'Light'],
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.html).toContain('Channel Divinity expended');
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
      postCastRiderService.hasEmpoweredEvocation.mockReturnValue(false);

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
      postCastRiderService.hasEmpoweredEvocation.mockReturnValue(true);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);

      const action = makeAction({ spell: 'Fire Bolt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('Empowered Evocation');
    });

    it('should NOT add Empowered Evocation for non-evocation spells', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Chill Touch', school: 'Necromancy', damage: { damage_at_slot_level: { '1': '1d8' }, damage_type: 'Necrotic' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      postCastRiderService.hasEmpoweredEvocation.mockReturnValue(true);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);

      const action = makeAction({ spell: 'Chill Touch' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).not.toContain('Empowered Evocation');
    });

    it('should use spell data from playerStats.spellAbilities first', async () => {
      const ps = makePlayerStats({
        spellAbilities: {
          spells: [{ name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' } }],
        },
      });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      postCastRiderService.hasEmpoweredEvocation.mockReturnValue(false);

      const action = makeAction({ spell: 'Fire Bolt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.contextConfig.damageType).toBe('Fire');
    });
  });

  describe('Free cast popup (no damage spell)', () => {
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
  });


});
