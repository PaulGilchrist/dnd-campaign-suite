// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  Lane: spellResolution.js RESOLVE face — numeric & damage-type      */
/*  resolution guard-bits.                                               */
/*                                                                      */
/*  ORPHAN-LIVE-BY-TESTS (re-verified 2026-10-21):                    */
/*   resolveSpellResolution (:129-189) has ZERO production importers  */
/*   (grep 'resolveSpellResolution' src, excl *.test.* -> only the    */
/*   export line :216). Consumers: this file + spellResolution.test.js */
/*   + spellResolution-log.test.js (cites this file at its :18 —       */
/*   PRESERVED). Kept as guard-bits against resurrection drift while   */
/*   the export stays on disk (CLA-391 byte-shape mirror mandate).     */
/*   getActiveBuffs re-export (:216) is LIVE via blockChecks.js:27    */
/*   dynamic import — its buff-blocking BEHAVIOR is pinned by the     */
/*   base sibling + blockChecks pair; this lane only rides past it.    */
/*   isInnateSorceryActive re-export (:216) is DEAD — REPORTED.        */
/*                                                                      */
/*  Split vs base spellResolution.test.js: base owns control flow     */
/*  (buff/silence block, ambush, globe target, psychic component        */
/*  reduction, Friends/Invisibility end, CLA-212 cantrip recompute,    */
/*  needsLookup, default key values). THIS file owns the numeric /    */
/*  damage-type arithmetic branches: damageInfo precedence, psychic     */
/*  effectiveDamageType override + no-damage guard, resolveSaveDc       */
/*  compute/throw, resolveCastingMod branch reachability incl the      */
/*  documented dead else-if quirk (:99-103).                          */
/*                                                                      */
/*  Mocks: full import census of spellResolution.js:1-9, line-by-line */
/*  complete — getRuntimeValue+setRuntimeValue (:1), addEntry (:2),    */
/*  isInnateSorceryActive+getActiveBuffs (:3), silence pair (:4),      */
/*  getPsychicSpellsConfig (:5), friends (:6), invisibility (:7),     */
/*  resolveSpellDamageWithTypes (:8). castingTimeUtils (:9) stays      */
/*  REAL — pure string util gating the :174 placeholder call.          */
/*  Fixtures are synthetic non-impersonating (generic Fireball shape,  */
/*  TestWizard); campaign lockdown 'test-campaign'.                     */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_playerName, _key, _campaignName) => undefined),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/class-warlock/psychicSpellsHandler.js', () => ({
  getPsychicSpellsConfig: vi.fn(() => null),
}));

vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => null),
}));

import { resolveSpellResolution } from './spellResolution.js';
import { getActiveBuffs, isInnateSorceryActive } from '../../../../combat/buffs/buffService.js';
import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { getPsychicSpellsConfig } from '../../../../automation/handlers/class-warlock/psychicSpellsHandler.js';
import { getSilenceSource, isCreatureInSilenceZone } from '../../../features/silenceService.js';
import { resolveSpellDamageWithTypes } from '../../../core/spellDamageUtils.js';

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '150 feet',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    dc: { dc_type: 'dex', dc_success: 'half' },
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    ...overrides,
  };
}

function resolve(spell, playerStats) {
  return resolveSpellResolution(spell, {}, playerStats, 'test-campaign', null);
}

describe('spellResolution.complex — numeric & damage-type resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveBuffs.mockReturnValue([]);
    isInnateSorceryActive.mockReturnValue(false);
    getSilenceSource.mockReturnValue(null);
    isCreatureInSilenceZone.mockReturnValue(false);
    getPsychicSpellsConfig.mockReturnValue(null);
    getRuntimeValue.mockReturnValue([]);
    resolveSpellDamageWithTypes.mockReturnValue(null);
  });

  describe('result shape & damageInfo precedence', () => {
    it('returns the exact 17-key result with damageInfo values beating spell bytes', () => {
      // arity pin: resurrected callers must pass all five params (metaCtx unused)
      expect(resolveSpellResolution.length).toBe(5);

      const damageInfo = { formula: '8d6', primaryType: 'Cold' };
      resolveSpellDamageWithTypes.mockReturnValue(damageInfo);
      isInnateSorceryActive.mockReturnValue(true);
      const spell = makeSpell(); // spell.damage.damage_type is 'Fire' — must LOSE to primaryType

      const result = resolve(spell, makePlayerStats());

      expect(result).toStrictEqual({
        globeTargetName: null,
        magicalAmbush: false,
        casterConditions: [],
        hasInvisible: false,
        psychicSpellsConfig: null,
        spellLevel: 3,
        innateSorceryActive: true,
        damageInfo: { formula: '8d6', primaryType: 'Cold' },
        formula: '8d6',
        damageType: 'Cold',
        effectiveDamageType: 'Cold',
        cantripSpellAbility: 'Intelligence',
        spellToHit: 9, // recomputed: Int +5 + PB +4
        spellSaveDc: 17, // 8 + 5 + 4
        spellCastingMod: 5,
        fullSpell: spell,
        needsLookup: true,
      });
      expect(result.fullSpell).toBe(spell);
      expect(result.damageInfo).toBe(damageInfo);
    });
  });

  describe('fix#1501 damageLevel leg — resolveCantripLevel consumer boundary', () => {
    const disk = (arr, name) => {
      const s = arr.find((x) => x.name === name);
      if (!s) throw new Error(`disk row missing: ${name}`);
      return { ...s };
    };

    it('cantrip disks both rulesets hand the CASTER ladder to resolveSpellDamageWithTypes; leveled passthrough and undefined-level min-slot 1 keep the live index.js:59 fix#121 idiom bytes', () => {
      // Disk law: Fire Bolt 5e level 0 damage_at_character_level
      // {1:'1d10',5:'2d10',11:'3d10',17:'4d10'}; 2024 stores the same
      // ladder under damage_at_slot_level keyed from '0'.
      const fb5 = disk(spells5e, 'Fire Bolt');
      const fb24 = disk(spells2024, 'Fire Bolt');
      expect([fb5.level, fb24.level]).toStrictEqual([0, 0]); // disk drift alarm
      const caster20 = makePlayerStats({ level: 20 });

      // Cantrips scale at caster level (#121) — pre-fix #1501 baked 1 here.
      resolve(fb5, caster20);
      expect(resolveSpellDamageWithTypes).toHaveBeenLastCalledWith(fb5, 20);
      resolve(fb24, caster20);
      expect(resolveSpellDamageWithTypes).toHaveBeenLastCalledWith(fb24, 20);

      // Leveled spell: exact slot byte passthrough, unchanged.
      const fireball = makeSpell();
      resolve(fireball, caster20);
      expect(resolveSpellDamageWithTypes).toHaveBeenLastCalledWith(fireball, 3);

      // Undefined level: damage semantics take minimum-1st-slot 1 (|| 1,
      // live :59 byte); display/log stays RAW 0 — ONE resolver, per-consumed-
      // key canonical, never two independent falsy defaults again (#1501).
      const undef = makeSpell({ level: undefined });
      const undefResult = resolve(undef, caster20);
      expect(resolveSpellDamageWithTypes).toHaveBeenLastCalledWith(undef, 1);
      expect(undefResult.spellLevel).toBe(0);

      // Caster missing level on a cantrip: (playerStats.level || 1) floor.
      resolve(fb5, makePlayerStats());
      expect(resolveSpellDamageWithTypes).toHaveBeenLastCalledWith(fb5, 1);
    });
  });

  describe('damage-type fallback and psychic override', () => {    it('null damageInfo falls back to spell.damage.damage_type passthrough', () => {
      resolveSpellDamageWithTypes.mockReturnValue(null);
      const spell = makeSpell({ damage: { damage_type: 'Lightning' } });

      const result = resolve(spell, makePlayerStats());

      expect(result.damageInfo).toBeNull();
      expect(result.formula).toBeNull();
      expect(result.damageType).toBe('Lightning');
      expect(result.effectiveDamageType).toBe('Lightning');
    });

    it('psychicSpellsConfig overrides effectiveDamageType only — damageType keeps the resolved primary', () => {
      getPsychicSpellsConfig.mockReturnValue({ damageType: 'Psychic' });
      resolveSpellDamageWithTypes.mockReturnValue({ formula: '2d8', primaryType: 'Lightning' });

      const result = resolve(makeSpell(), makePlayerStats());

      expect(result.damageType).toBe('Lightning');
      expect(result.effectiveDamageType).toBe('Psychic');
    });

    it('psychic override cannot fabricate a type when the spell carries no damage — both falsy shapes stay empty', () => {
      getPsychicSpellsConfig.mockReturnValue({ damageType: 'Psychic' });
      const absent = resolve(makeSpell({ damage: undefined }), makePlayerStats());
      const empty = resolve(makeSpell({ damage: {} }), makePlayerStats());

      expect([absent.damageType, absent.effectiveDamageType]).toStrictEqual(['', '']);
      expect([empty.damageType, empty.effectiveDamageType]).toStrictEqual(['', '']);
    });
  });

  describe('save DC resolution', () => {
    it('computes 8 + proficiency when spellAbilities exists but saveDc is absent', () => {
      const playerStats = makePlayerStats({ spellAbilities: { toHit: 9, modifier: 5 } });

      const result = resolve(makeSpell(), playerStats);

      // cantripSpellAbility stays undefined (no spell or class override) — no recompute
      expect(result.cantripSpellAbility).toBeUndefined();
      expect(result.spellSaveDc).toBe(12);
    });

    it('throws the exact message when saveDc and proficiency are both missing', () => {
      const playerStats = makePlayerStats({
        spellAbilities: { toHit: 9, modifier: 5 },
        proficiency: null,
      });

      expect(() => resolve(makeSpell(), playerStats)).toThrow(
        'playerStats.proficiency is required for spell save DC calculation'
      );
    });
  });

  describe('spellToHit / spellCastingMod branch reachability', () => {
    it('missing spellAbilities resolves to toHit 0, computed DC 12, mod 0', () => {
      const playerStats = makePlayerStats({ spellAbilities: null });

      const result = resolve(makeSpell(), playerStats);

      expect({
        ability: result.cantripSpellAbility,
        toHit: result.spellToHit,
        dc: result.spellSaveDc,
        mod: result.spellCastingMod,
      }).toStrictEqual({ ability: undefined, toHit: 0, dc: 12, mod: 0 });
    });

    it('unmatched ability override keeps spellAbilities numbers and pins the dead else-if quirk at mod 0', () => {
      // cantripSpellAbility='Charisma' && abilities truthy enters the FIRST
      // casting-mod branch; find(Charisma) misses so mod becomes 0 — the
      // spellAbilities.modifier else-if (:101-102) is UNREACHABLE here.
      const playerStats = makePlayerStats({
        spellAbilities: { spellCastingAbility: 'Charisma', toHit: 99, saveDc: 99, modifier: 7 },
        abilities: [{ name: 'Intelligence', bonus: 5 }],
      });

      const result = resolve(makeSpell(), playerStats);

      expect({
        toHit: result.spellToHit,
        dc: result.spellSaveDc,
        mod: result.spellCastingMod,
      }).toStrictEqual({ toHit: 99, dc: 99, mod: 0 });
    });

    it('null abilities makes the spellAbilities.modifier else-if reachable', () => {
      const playerStats = makePlayerStats({
        spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 99, saveDc: 99, modifier: 7 },
        abilities: null,
      });

      const result = resolve(makeSpell(), playerStats);

      expect({
        toHit: result.spellToHit,
        dc: result.spellSaveDc,
        mod: result.spellCastingMod,
      }).toStrictEqual({ toHit: 99, dc: 99, mod: 7 });
    });

    it('spellCastingMod falls to 0 via "|| 0" on absent modifier and via default when spellAbilities is null', () => {
      const noModifier = resolve(
        makeSpell(),
        makePlayerStats({ spellAbilities: { toHit: 5 }, abilities: null })
      );
      const noSpellAbilities = resolve(
        makeSpell(),
        makePlayerStats({ spellAbilities: null, abilities: null })
      );

      expect(noModifier.spellCastingMod).toBe(0);
      expect(noSpellAbilities.spellCastingMod).toBe(0);
    });
  });
});
