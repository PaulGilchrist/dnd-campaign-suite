// @maintained-by-ai
// Damage-formula resolution lane owner (cited by spellCalc2024-circle-of-land.test.js and
// useSpellUpcastFlow.cla050-fixed-level.test.js): this file is the ONLY unmocked coverage of
// spellDamageUtils.js — CharActions/CharReactions/CharBonusActions and the spellCastService
// execution suites all vi.mock this module, so the four exported resolvers must be pinned here.
// Damage canon: dice are never rolled — formula STRINGS are pinned byte-exact. Spell rows are
// read from disk (public/data/spells.json + 2024/spells.json) and deep-cloned before any
// mutation; synthetic rows are labeled as such (no disk spell carries both damage ladders, and
// no cantrip heal row exists on disk).
import { describe, it, expect } from 'vitest';
import { cloneDeep } from 'lodash';
import {
  resolveSpellDamageAtLevel,
  isAutoHitSpell,
  resolveSpellDamageWithTypes,
  resolveHealExpression,
} from './spellDamageUtils.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

const disk5e = (name) => {
  const spell = spells5e.find((s) => s.name === name);
  if (!spell) throw new Error(`spell missing from disk: ${name}`);
  return spell;
};
const disk2024 = (name) => {
  const spell = spells2024.find((s) => s.name === name);
  if (!spell) throw new Error(`spell missing from 2024 disk: ${name}`);
  return spell;
};

describe('spellDamageUtils', () => {
  describe('resolveSpellDamageAtLevel', () => {
    it('returns empty string when spell or damage data is absent', () => {
      expect(resolveSpellDamageAtLevel(null, 5)).toBe('');
      expect(resolveSpellDamageAtLevel(undefined, 5)).toBe('');
      expect(resolveSpellDamageAtLevel({ name: 'Mage Hand' }, 5)).toBe('');
      expect(resolveSpellDamageAtLevel({ level: 1, damage: null }, 5)).toBe('');
      expect(
        resolveSpellDamageAtLevel({ level: 1, damage: { damage_at_slot_level: {}, damage_at_character_level: null } }, 5)
      ).toBe('');
      expect(resolveSpellDamageAtLevel({ level: 1, damage: {} }, 5)).toBe('');
    });

    it('scales cantrips across the published ladders of both rulesets', () => {
      // 5e disk Fire Bolt: damage_at_character_level ladder {1,5,11,17}.
      const fireBolt5e = disk5e('Fire Bolt');
      expect([1, 5, 11, 17, 20].map((lv) => resolveSpellDamageAtLevel(fireBolt5e, lv)))
        .toEqual(['1d10', '2d10', '3d10', '4d10', '4d10']);

      // 2024 disk Fire Bolt: damage_at_slot_level ladder starting at rung '0', which also
      // covers the below-all-tiers fallback (lv 1 has no '1' key; '0' is the first key).
      const fireBolt2024 = disk2024('Fire Bolt');
      expect([1, 5, 12, 17].map((lv) => resolveSpellDamageAtLevel(fireBolt2024, lv)))
        .toEqual(['1d10', '2d10', '3d10', '4d10']);
    });

    it('pins leveled spells to the base slot tier regardless of character level', () => {
      const acidArrow = disk5e('Acid Arrow'); // slot ladder {2:'4d4'...9:'11d4'}
      expect([2, 5, 20].map((lv) => resolveSpellDamageAtLevel(acidArrow, lv)))
        .toEqual(['4d4', '4d4', '4d4']);
    });

    it('prefers damage_at_slot_level when both ladders are present (synthetic row)', () => {
      // No disk spell carries both ladders — synthetic shape pinning the selection branch.
      // If char-level were chosen instead, lv 5 would return '2d10' and lv 1 '1d6'.
      const both = {
        name: 'Both Ladders',
        level: 0,
        damage: {
          damage_type: 'Fire',
          damage_at_slot_level: { '0': '1d10', '5': '2d10' },
          damage_at_character_level: { '1': '1d6', '5': '2d6' },
        },
      };
      expect(resolveSpellDamageAtLevel(both, 1)).toBe('1d10');
      expect(resolveSpellDamageAtLevel(both, 5)).toBe('2d10');
    });
  });

  // CLA-050: Circle of the Land fixed-level rows resolve their damage formula
  // at the stamped level, not the spells-DB base level.
  describe('resolveSpellDamageAtLevel — CLA-050 fixed-level rows', () => {
    it('resolves the formula at the fixed level for stamped rows', () => {
      const burningHands = { ...cloneDeep(disk5e('Burning Hands')), _circleOfTheLandFixedLevel: 3 };
      expect(resolveSpellDamageAtLevel(burningHands, 20)).toBe('5d6');
    });

    it('keeps character-level scaling for a fixed-level cantrip-tier ladder (Fire Bolt)', () => {
      // Stamped as a level 3 row (not a cantrip); the '0/5/11/17' ladder has no '3' rung,
      // so resolution falls back to character-level scaling.
      const fireBolt = { ...cloneDeep(disk2024('Fire Bolt')), level: 3, _circleOfTheLandFixedLevel: 3 };
      expect(resolveSpellDamageAtLevel(fireBolt, 20)).toBe('4d10');
      expect(resolveSpellDamageAtLevel(fireBolt, 4)).toBe('1d10');
    });

    it('leaves unstamped rows at the base tier (paired control)', () => {
      expect(resolveSpellDamageAtLevel(disk5e('Burning Hands'), 20)).toBe('3d6');
    });
  });

  describe('isAutoHitSpell', () => {
    it('auto-hits healing spells and Magic Missile in any casing', () => {
      expect(isAutoHitSpell(disk5e('Magic Missile'))).toBe(true);
      expect(isAutoHitSpell({ name: 'magic missile' })).toBe(true);
      expect(isAutoHitSpell({ name: 'MAGIC MISSILE' })).toBe(true);
      expect(isAutoHitSpell(disk5e('Cure Wounds'))).toBe(true);
      expect(isAutoHitSpell(disk5e('Healing Word'))).toBe(true);
    });

    it('does not auto-hit attack-roll spells, lookalike names, or empty input', () => {
      expect(isAutoHitSpell(null)).toBe(false);
      expect(isAutoHitSpell(undefined)).toBe(false);
      expect(isAutoHitSpell({})).toBe(false);
      expect(isAutoHitSpell(disk5e('Fire Bolt'))).toBe(false);
      expect(isAutoHitSpell(disk5e('Thunderwave'))).toBe(false);
      expect(isAutoHitSpell({ name: 'Big Missile' })).toBe(false);
      expect(isAutoHitSpell({ name: 'Healing Word', damage: { damage_at_slot_level: {} } })).toBe(false);
      expect(isAutoHitSpell({ name: 'Cure Wounds', heal_at_slot_level: null })).toBe(false);
    });
  });

  describe('resolveSpellDamageWithTypes', () => {
    it('splits monster-style dual damage and scales the secondary die per slot level', () => {
      // Disk Ice Knife ladder: {1:'1d10 plus 1d6'...9:'1d10 plus 9d6'} — the secondary die is
      // re-parsed from the slot formula, overriding the stored damage_dice_secondary ('1d6').
      const iceKnife = disk5e('Ice Knife');
      expect([1, 3, 9].map((lv) => resolveSpellDamageWithTypes(iceKnife, lv))).toEqual([
        { formula: '1d10 plus 1d6', primaryDice: '1d10', primaryType: 'Piercing', secondaryDice: '1d6', secondaryType: 'Cold' },
        { formula: '1d10 plus 3d6', primaryDice: '1d10', primaryType: 'Piercing', secondaryDice: '3d6', secondaryType: 'Cold' },
        { formula: '1d10 plus 9d6', primaryDice: '1d10', primaryType: 'Piercing', secondaryDice: '9d6', secondaryType: 'Cold' },
      ]);

      // Disk Ice Storm: ladder starts at slot 4 — casting below the minimum falls back to the
      // first ladder rung (still dual-dice, still scaled at '4').
      const iceStorm = disk5e('Ice Storm');
      expect(resolveSpellDamageWithTypes(iceStorm, 3)).toEqual({
        formula: '2d8 plus 4d6', primaryDice: '2d8', primaryType: 'Bludgeoning', secondaryDice: '4d6', secondaryType: 'Cold',
      });
    });

    it('uses the slot formula directly when it has no secondary die (synthetic row)', () => {
      // No disk spell has damage_dice_primary plus a single-dice ladder; synthetic shape pin.
      const spell = {
        level: 6,
        damage: {
          damage_dice_primary: '2d6',
          damage_type_primary: 'Fire',
          damage_at_slot_level: { '6': '6d6' },
        },
      };
      const resolved = resolveSpellDamageWithTypes(spell, 6);
      expect(resolved).toMatchObject({ formula: '6d6', primaryDice: '6d6', primaryType: 'Fire' });
      expect(resolved.secondaryDice).toBeUndefined();
      expect(resolved.secondaryType).toBeUndefined();
    });

    it('falls back to legacy formula resolution and upcasts leveled spells by slot', () => {
      // Cantrip (no dice_primary): scales with the spellLevel argument over the char ladder.
      expect(resolveSpellDamageWithTypes(disk5e('Fire Bolt'), 5)).toEqual({
        formula: '2d10', primaryDice: '2d10', primaryType: 'Fire', secondaryDice: null, secondaryType: null,
      });
      // Leveled legacy upcast table — unlike resolveSpellDamageAtLevel, this resolver honors
      // the slot level: Acid Arrow {2:'4d4'...5:'7d4'}.
      const acidArrow = disk5e('Acid Arrow');
      expect([2, 5].map((lv) => resolveSpellDamageWithTypes(acidArrow, lv).formula)).toEqual(['4d4', '7d4']);
      expect(resolveSpellDamageWithTypes(acidArrow, 2).primaryType).toBe('Acid');
      expect(resolveSpellDamageWithTypes(null, 1)).toBeNull();
      expect(resolveSpellDamageWithTypes({ name: 'Shield' }, 1)).toBeNull();
    });
  });

  describe('resolveHealExpression', () => {
    it('resolves leveled heals to the base tier with MOD replaced and spaces collapsed', () => {
      // Disk Cure Wounds: {1:'1d8 + MOD'...9:'9d8 + MOD'} — leveled spells take the FIRST key
      // regardless of character level, and byte spacing of the source is normalized.
      const cureWounds = disk5e('Cure Wounds');
      expect(resolveHealExpression(cureWounds, 5, 3)).toBe('1d8+3');
      expect(resolveHealExpression(cureWounds, 20, 3)).toBe('1d8+3');
      expect(resolveHealExpression(disk5e('Healing Word'), 1, 5)).toBe('1d4+5');
      // No modifier provided: the literal MOD token survives untouched.
      expect(resolveHealExpression(cureWounds, 5, null)).toBe('1d8+MOD');
    });

    it('returns empty string for spells without a usable heal_at_slot_level', () => {
      expect(resolveHealExpression(disk5e('Fire Bolt'), 5, 3)).toBe('');
      expect(resolveHealExpression({ level: 1, heal_at_slot_level: '1d8' }, 1, 1)).toBe('');
      expect(resolveHealExpression({ level: 1, heal_at_slot_level: {} }, 1, 1)).toBe('');
    });

    it('scales a cantrip heal ladder by player level and substitutes MOD (synthetic row)', () => {
      // Defensive branch: no level-0 heal row exists on disk today.
      const cantrip = { level: 0, heal_at_slot_level: { '0': '1d4 + MOD', '5': '2d4 + MOD' } };
      expect(resolveHealExpression(cantrip, 4, 2)).toBe('1d4+2');
      expect(resolveHealExpression(cantrip, 5, 2)).toBe('2d4+2');
    });
  });
});
