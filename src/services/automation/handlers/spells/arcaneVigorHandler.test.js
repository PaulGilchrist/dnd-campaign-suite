import { describe, it, expect, vi, beforeEach } from 'vitest';

// Lane: arcaneVigorHandler.js — 2024 Arcane Vigor (Artificer), automation type
// 'arcane_vigor' (index.js dispatch, live). This is hit-dice-based HEALING, not
// temp HP: the handler is a pure payload builder that opens the ArcaneVigor modal
// (useSpellCastExecutor modalName→modalRouting). Actual HP application lives in
// ArcaneVigorModal.jsx via applyHealingToTarget (healing/ family) — tempHpService
// is NOT involved here; this suite is not the tempHpService coverage home.
//
// antimagicField Q1 recurrence check (hardcoded feature-name identity split):
// NOT present — the handler does no name/feature-string matching. The hardcoded
// 'ArcaneVigor' modalName and 'arcane_vigor' automationType below are exact-key
// pins against the dispatch/routing tables (index.js:351, useSpellCastExecutor.js:131).
//
// Purity: no runtime-store writes, no SSE, no timers. Inputs are asserted unmutated.
// makeAction note: callers replace metaCtx/spell WHOLESALE by design — the
// slot-level fallback-chain tests require metaCtx.slotLevel to be ABSENT, so a
// merging helper would defeat them. Verified intentional; do not "fix" to merge.

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

    it('falls back to spell.level when metaCtx carries no slot info', () => {
      const action = makeAction({
        metaCtx: {},
        spell: {
          name: 'Arcane Vigor',
          level: 3,
          heal_at_slot_level: { '2': '2 short rest dice', '3': '3 short rest dice' },
        },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.slotLevel).toBe(3);
      expect(result.payload.diceCount).toBe(3);
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

  // ── Hit die delegation ───────────────────────────────────────
  // getHitDieSize is mocked: hit-die parsing (d-string → number, fallback 8)
  // is owned by restRules-constants.js and its suites. This lane pins the
  // delegation contract only — call shape and verbatim passthrough.

  describe('hit die delegation to restRules', () => {
    it('delegates exactly once with the playerStats object and forwards the result verbatim', () => {
      const ps = makePlayerStats();
      restRules.getHitDieSize.mockReturnValue(12);
      const result = handle(makeAction(), ps, campaignName, null);
      expect(restRules.getHitDieSize).toHaveBeenCalledTimes(1);
      expect(restRules.getHitDieSize).toHaveBeenCalledWith(ps);
      expect(result.payload.hitDieSize).toBe(12);
    });

    // AV-Q3 (defensive-only branch): production restRules.getHitDieSize never
    // returns null/0 — it falls back to 8 (restRules-constants.js:11). These
    // popup branches guard a future restRules change; mocked to pin them.
    it('AV-Q3: returns error popup when hit die size is null', () => {
      restRules.getHitDieSize.mockReturnValue(null);
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Arcane Vigor');
      expect(result.payload.automationType).toBe('arcane_vigor');
      expect(result.payload.description).toBe('Error: Could not determine hit die size for TestCaster.');
    });

    it('AV-Q3: returns error popup when hit die size is 0', () => {
      restRules.getHitDieSize.mockReturnValue(0);
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('error popup composes the full own-description string', () => {
      restRules.getHitDieSize.mockReturnValue(null);
      const ps = makePlayerStats({ name: 'WizardBob' });
      const result = handle(makeAction(), ps, campaignName, null);
      expect(result.payload.description).toBe('Error: Could not determine hit die size for WizardBob.');
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

    // SP-007: shorthand 'INT' must resolve against full-word ability names
    // via shared abilityLookup (not mocked here — this seam is real).
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
      expect(result.payload.spellcastingAbilityModifier).toBe(3);
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

    it('parses dice count from action.action.heal_at_slot_level (defensive lane)', () => {
      const action = makeAction({
        action: { heal_at_slot_level: { '2': '4 short rest dice' } },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(4);
      expect(result.payload.campaignName).toBe(campaignName);
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

    // AV-Q1 (source quirk, flagged): `parseInt(diceText, 10) || 2` clamps NaN
    // and 0 to 2 but NOT negatives — '-1' parses truthy and leaks diceCount:-1
    // into the modal, where diceCapReached (rolledDice.length >= diceCount) is
    // instantly true and the roll button starts disabled (soft-lock). Unreachable
    // from real data: 2024 spells.json only ships positive "N short rest dice".
    it('AV-Q1: negative dice text leaks a negative diceCount (|| 2 does not clamp)', () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { '2': '-1 short rest dice' } },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(-1);
    });

    // AV-Q2: counterpart of AV-Q1 — 0 IS falsy, so zero text does clamp to 2.
    it('AV-Q2: zero dice text clamps to default 2 (|| 2 catches 0, unlike Q1)', () => {
      const action = makeAction({
        spell: { heal_at_slot_level: { '2': '0 short rest dice' } },
      });
      const result = handle(action, makePlayerStats(), campaignName, null);
      expect(result.payload.diceCount).toBe(2);
    });
  });

  // ── Modal payload structure ──────────────────────────────────

  describe('modal payload structure', () => {
    it('returns modal type with exact-key pin to useSpellCastExecutor ArcaneVigor routing', () => {
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('ArcaneVigor');
    });

    it('payload carries exactly the seven keys ArcaneVigorModal consumes', () => {
      const result = handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(Object.keys(result.payload).sort()).toEqual([
        'campaignName',
        'diceCount',
        'hitDieSize',
        'playerName',
        'slotLevel',
        'spellcastingAbility',
        'spellcastingAbilityModifier',
      ]);
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

    it('is pure: does not mutate the action or playerStats inputs', () => {
      const action = makeAction({ spell: { heal_at_slot_level: { '2': '2 short rest dice' } } });
      const ps = makePlayerStats();
      const actionSnapshot = JSON.parse(JSON.stringify(action));
      const psSnapshot = JSON.parse(JSON.stringify(ps));
      handle(action, ps, campaignName, null);
      expect(action).toEqual(actionSnapshot);
      expect(ps).toEqual(psSnapshot);
    });
  });

  // ── Full integration with upcasting ──────────────────────────

  describe('upcasting behavior', () => {
    // Mirrors public/data/2024/spells.json "Arcane Vigor": every paid slot
    // level 2..9 maps to "<level> short rest dice" — diceCount tracks the slot.
    it('full upcast table lv2..lv9 matches real 2024 spell data shape', () => {
      const healAtSlotLevel = Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [String(i + 2), `${i + 2} short rest dice`]),
      );
      for (let level = 2; level <= 9; level++) {
        const action = makeAction({
          metaCtx: { slotLevel: level },
          spell: { name: 'Arcane Vigor', level: 2, heal_at_slot_level: healAtSlotLevel },
        });
        const result = handle(action, makePlayerStats(), campaignName, null);
        expect(result.payload.slotLevel).toBe(level);
        expect(result.payload.diceCount).toBe(level);
      }
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
  });
});
