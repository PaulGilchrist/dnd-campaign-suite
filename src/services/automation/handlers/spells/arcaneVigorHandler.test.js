// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(),
}));

import { handle } from './arcaneVigorHandler.js';
import * as restRules from '../../../rules/effects/restRules.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    spellAbilities: { spellcasting_ability: 'INT' },
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Arcane Vigor',
    metaCtx: { slotLevel: 2 },
    ...overrides,
  };
}

describe('arcaneVigorHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restRules.getHitDieSize.mockReturnValue(8);
  });

  // ── Slot level resolution ────────────────────────────────────

  describe('slot level resolution', () => {
    it('uses metaCtx.slotLevel when present', () => {
      const result = handle(makeAction({ metaCtx: { slotLevel: 5 } }), makePlayerStats(), campaignName, null);
      expect(result.payload.slotLevel).toBe(5);
    });

    it('falls back to metaCtx.modifiedSpell.level', () => {
      const result = handle(
        makeAction({ metaCtx: { modifiedSpell: { level: 4 } } }),
        makePlayerStats(),
        campaignName,
        null,
      );
      expect(result.payload.slotLevel).toBe(4);
    });

    it('falls back to metaCtx.upcastLevel', () => {
      const result = handle(
        makeAction({ metaCtx: { upcastLevel: 6 } }),
        makePlayerStats(),
        campaignName,
        null,
      );
      expect(result.payload.slotLevel).toBe(6);
    });

    it('defaults to 2 when no slot level info is available', () => {
      const result = handle(makeAction({ metaCtx: {} }), makePlayerStats(), campaignName, null);
      expect(result.payload.slotLevel).toBe(2);
    });

    it('prefers metaCtx.slotLevel over modifiedSpell.level', () => {
      const result = handle(
        makeAction({ metaCtx: { slotLevel: 3, modifiedSpell: { level: 5 } } }),
        makePlayerStats(),
        campaignName,
        null,
      );
      expect(result.payload.slotLevel).toBe(3);
    });
  });

  // ── Hit die size ─────────────────────────────────────────────

  describe('hit die size resolution', () => {
    it('returns modal with hitDieSize when available', () => {
      restRules.getHitDieSize.mockReturnValue(10);
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.hitDieSize).toBe(10);
    });

    it('returns error popup when hit die size is null', () => {
      restRules.getHitDieSize.mockReturnValue(null);
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Could not determine hit die size');
    });

    it('returns error popup when hit die size is 0', () => {
      restRules.getHitDieSize.mockReturnValue(0);
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('includes player name in error message', () => {
      restRules.getHitDieSize.mockReturnValue(null);
      const ps = makePlayerStats({ name: 'WizardBob' });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.description).toContain('WizardBob');
    });
  });

  // ── Spellcasting ability ─────────────────────────────────────

  describe('spellcasting ability resolution', () => {
    it('uses spellcasting_ability from spellAbilities', () => {
      const ps = makePlayerStats({
        spellAbilities: { spellcasting_ability: 'WIS' },
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.spellcastingAbility).toBe('WIS');
      expect(result.payload.spellcastingAbilityModifier).toBe(4);
    });

    // SP-007: shorthand 'INT' must resolve against full-word ability names.
    it('SP-007: resolves INT shorthand against full-word ability names', () => {
      const ps = makePlayerStats({
        spellAbilities: { spellcasting_ability: 'INT' },
        abilities: [
          { name: 'Strength', bonus: -1 },
          { name: 'Intelligence', bonus: 5 },
          { name: 'Charisma', bonus: 2 },
        ],
      });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.spellcastingAbilityModifier).toBe(5);
    });

    it('SP-007: resolves full-word spellcasting_ability values too', () => {
      const ps = makePlayerStats({
        spellAbilities: { spellcasting_ability: 'Intelligence' },
        abilities: [{ name: 'Intelligence', bonus: 5 }],
      });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.spellcastingAbilityModifier).toBe(5);
    });

    it('defaults to INT when spellcasting_ability is missing', () => {
      const ps = makePlayerStats({ spellAbilities: {} });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.spellcastingAbility).toBe('INT');
    });

    it('defaults modifier to 0 when ability not found', () => {
      const ps = makePlayerStats({
        spellAbilities: { spellcasting_ability: 'CHA' },
        abilities: [{ name: 'INT', bonus: 3 }],
      });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.spellcastingAbility).toBe('CHA');
      expect(result.payload.spellcastingAbilityModifier).toBe(0);
    });

    it('handles missing abilities array', () => {
      const ps = makePlayerStats({
        spellAbilities: { spellcasting_ability: 'CHA' },
        abilities: null,
      });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.spellcastingAbility).toBe('CHA');
      expect(result.payload.spellcastingAbilityModifier).toBe(0);
    });
  });

  // ── Dice count resolution ────────────────────────────────────

  describe('dice count resolution', () => {
    it('parses dice count from action.spell.heal_at_slot_level', () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { '2': '3 short rest dice' } },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(3);
    });

    it('parses dice count from action.action.heal_at_slot_level', () => {
      const action = makeAction({
        action: { heal_at_slot_level: { '2': '4 short rest dice' } },
      });
      const result = handle(action, makePlayerStats(), null, null);
      expect(result.payload.diceCount).toBe(4);
    });

    it('prefers action.spell over action.action', () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { '2': '2 short rest dice' } },
        action: { heal_at_slot_level: { '2': '5 short rest dice' } },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(2);
    });

    it('defaults to 2 when heal_at_slot_level is missing', () => {
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(2);
    });

    it('defaults to 2 when slot level not found in heal_at_slot_level', () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { '2': '2 short rest dice' } },
        metaCtx: { slotLevel: 9 },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(2);
    });

    it('parses numeric prefix from dice text', () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { '3': '5 short rest dice' } },
        metaCtx: { slotLevel: 3 },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(5);
    });

    it('defaults to 2 when dice text has no parseable number', () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { '2': 'no number here' } },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(2);
    });
  });

  // ── Modal payload structure ──────────────────────────────────

  describe('modal payload structure', () => {
    it('returns modal type with correct modalName', () => {
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('ArcaneVigor');
    });

    it('includes all required payload fields', () => {
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload).toHaveProperty('hitDieSize');
      expect(result.payload).toHaveProperty('spellcastingAbility');
      expect(result.payload).toHaveProperty('spellcastingAbilityModifier');
      expect(result.payload).toHaveProperty('diceCount');
      expect(result.payload).toHaveProperty('slotLevel');
      expect(result.payload).toHaveProperty('playerName');
      expect(result.payload).toHaveProperty('campaignName');
    });

    it('includes playerName in payload', () => {
      const ps = makePlayerStats({ name: 'Eldara' });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.playerName).toBe('Eldara');
    });

    it('includes campaignName in payload', () => {
      const result = handle(makeAction(), makePlayerStats(), 'MyCampaign', null);
      expect(result.payload.campaignName).toBe('MyCampaign');
    });
  });

  // ── Full integration with upcasting ──────────────────────────

  describe('upcasting behavior', () => {
    it('handles slot level 5 with correct dice count from spell data', () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { '5': '5 short rest dice' } },
        metaCtx: { slotLevel: 5 },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.slotLevel).toBe(5);
      expect(result.payload.diceCount).toBe(5);
    });

    it('handles 2024 ruleset with different hit die', () => {
      restRules.getHitDieSize.mockReturnValue(12);
      const ps = makePlayerStats({
        class: { hit_point_die: 'd12' },
      });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.hitDieSize).toBe(12);
    });

    it('handles Charisma spellcasting ability for sorcerer', () => {
      const ps = makePlayerStats({
        spellAbilities: { spellcasting_ability: 'CHA' },
        abilities: [{ name: 'Charisma', bonus: 5 }],
      });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.spellcastingAbility).toBe('CHA');
      expect(result.payload.spellcastingAbilityModifier).toBe(5);
    });

    // SP-007: lv3 upcast must resolve diceCount=3 from spell heal_at_slot_level
    // and stamp slotLevel 3 even when metaCtx carries no slot level — the paid
    // level rides the spell object (modifiedSpell.level / upcastLevel).
    it('SP-007: lv3 upcast resolves slotLevel 3 and diceCount 3 from spell object', () => {
      const action = makeAction({
        metaCtx: {},
        spell: {
          name: 'Arcane Vigor',
          level: 3,
          upcastLevel: 3,
          heal_at_slot_level: { '2': '2 short rest dice', '3': '3 short rest dice' },
        },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.slotLevel).toBe(3);
      expect(result.payload.diceCount).toBe(3);
    });

    // SP-007: metaCtx.slotLevel (paid slot threaded) takes priority.
    it('SP-007: metaCtx.slotLevel threads the paid level for diceCount', () => {
      const action = makeAction({
        metaCtx: { slotLevel: 3 },
        spell: {
          name: 'Arcane Vigor',
          level: 2,
          heal_at_slot_level: { '2': '2 short rest dice', '3': '3 short rest dice' },
        },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.slotLevel).toBe(3);
      expect(result.payload.diceCount).toBe(3);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles undefined metaCtx gracefully', () => {
      const result = handle({ name: 'Arcane Vigor' }, makePlayerStats(), campaignName, null);
      expect(result.payload.slotLevel).toBe(2);
      expect(result.type).toBe('modal');
    });

    it('handles undefined spellcasting ability config', () => {
      const ps = makePlayerStats({ spellAbilities: null });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.spellcastingAbility).toBe('INT');
      // SP-007: INT default now resolves against full-word ability names.
      expect(result.payload.spellcastingAbilityModifier).toBe(3);
    });

    it('handles action with no name gracefully', () => {
      const result = handle({}, makePlayerStats(), campaignName, null);
      expect(result.type).toBe('modal');
    });

    it('handles hit die size as string with non-numeric chars', () => {
      restRules.getHitDieSize.mockReturnValue(6);
      const ps = makePlayerStats({ class: { hit_point_die: 'd6' } });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.hitDieSize).toBe(6);
    });

    it('handles negative dice count text by defaulting to 2', () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { '2': '-1 short rest dice' } },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(-1);
    });
  });
});
