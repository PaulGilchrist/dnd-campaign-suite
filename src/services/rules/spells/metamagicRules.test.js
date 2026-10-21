// @maintained-by-ai
// metamagicRules lane: OPTION CATALOG + COSTS owner (both rulesets share this one
// catalog; consumers cite, never re-drive): MetamagicPopup.jsx:78-89/148,
// useSpellMetamagicFlow/useMetamagicHandler.js, empoweredSpellService.js (chaMod
// consumer, #1449 lane), useLoggedDiceRollAttack.js:279 + handlePlainDamage.js:330
// (getChaModifier consumers), spellPreparationService.js + SpellDetailPopup.psionic
// -payment.test.jsx + automationInfoBuilder/{psionic,sorcery}.test.js (cite this
// suite for raw psionic predicates — kept below).
// Catalog-vs-disk census (public/data/classes.json Sorcerer L3 subfeature_options
// + details text, byte-exact): disk lists "Metamagic: Careful/Distant/Empowered/
// Extended/Heightened/Quickened/Subtle/Twinned Spell" with costs 1/1/1/1/3/2/1 SP
// and Twinned "number of sorcery points equal to the spell's level" — matches the
// 8-entry code catalog below exactly (prefix "Metamagic: " is disk-side only).
// 2024 disk (public/data/2024/classes.json) enumerates NO per-option rows — only
// prose ("You can use only one Metamagic option on a spell when you cast it",
// L6 "Sorcery Incarnate": "while your Innate Sorcery feature is active, you can
// use up to two of your Metamagic options on each spell you cast") — so the 8-option
// shared catalog and the lvl>=6+buff -> 2 gate in getMaxMetamagicPerSpell are
// disk-faithful. No apostrophe/punctuation in any option name (case gates are
// plain exact-byte). NO-CLOCK POLICY: source has zero setTimeout/Date.now — SP
// recovery is long-rest-owner (buffService/rest seams, #1302-#1312), cited only.
// Apotheosis drift (report-only): disk 2024 L20 Arcane Apotheosis says "one free
// Metamagic option on each of your turns"; code models "waive highest-cost option
// per cast while Innate Sorcery buff active" — pinned as CODE STANCE below.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Only the runtime store is mocked (network side-effect); abilityLookup is REAL —
// getChaModifier's delegation is behavior under test, not a mock echo.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
}));

import {
  METAMAGIC_EFFECTS,
  METAMAGIC_OPTIONS,
  getMetamagicCost,
  getPreCastOptions,
  getChaModifier,
  getMaxMetamagicPerSpell,
  isPreCastOption,
  hasArcaneApotheosis,
  computeMetamagicCost,
  getPsionicSpellsList,
  isPsionicSpell,
  hasPsionicSorcery,
} from './metamagicRules.js';

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const buffs = vi.mocked(getRuntimeValue);

const SORCERER = { class: { name: 'Sorcerer' } };

beforeEach(() => {
  buffs.mockClear();
  buffs.mockReturnValue(undefined);
});

// ── Catalog goldens (drift pins; byte-for-byte vs disk census above) ─────────

describe('catalog goldens', () => {
  it('METAMAGIC_EFFECTS maps exactly the 8 canonical effect strings', () => {
    expect(METAMAGIC_EFFECTS).toEqual({
      CAREFUL: 'ally_auto_succeed_save',
      DISTANT: 'double_range',
      EMPOWERED: 'reroll_damage_dice',
      EXTENDED: 'double_duration',
      HEIGHTENED: 'disadvantage_on_save',
      QUICKENED: 'cast_spell_as_bonus_action',
      SUBTLE: 'no_verbal_somatic',
      TWINNED: 'target_two_creatures',
    });
  });

  it('METAMAGIC_OPTIONS is the full disk-faithful 8-option catalog with mutually distinguishable costs', () => {
    expect(METAMAGIC_OPTIONS).toEqual([
      { name: 'Careful Spell', cost: 1, effect: 'ally_auto_succeed_save', description: 'Allies automatically succeed on saving throws against your spell.' },
      { name: 'Distant Spell', cost: 1, effect: 'double_range', description: 'Double the range of the spell, or turn a touch spell into 30 ft.' },
      { name: 'Empowered Spell', cost: 1, effect: 'reroll_damage_dice', description: 'Reroll a number of damage dice up to your Charisma modifier.' },
      { name: 'Extended Spell', cost: 1, effect: 'double_duration', description: 'Double the duration of the spell, up to 24 hours.' },
      { name: 'Heightened Spell', cost: 3, effect: 'disadvantage_on_save', description: 'Give one target disadvantage on its first saving throw against the spell.' },
      { name: 'Quickened Spell', cost: 2, effect: 'cast_spell_as_bonus_action', description: 'Change the casting time to 1 bonus action.' },
      { name: 'Subtle Spell', cost: 1, effect: 'no_verbal_somatic', description: 'Cast the spell without somatic or verbal components.' },
      { name: 'Twinned Spell', cost: 'spell_level', effect: 'target_two_creatures', description: 'Target a second creature in range with the same spell.' },
    ]);
  });

  it('isPreCastOption excludes exactly Empowered across the real catalog (zero production callers — dormant export pin)', () => {
    const preCast = METAMAGIC_OPTIONS.filter(isPreCastOption);
    expect(preCast.map((o) => o.name)).toEqual([
      'Careful Spell', 'Distant Spell', 'Extended Spell', 'Heightened Spell',
      'Quickened Spell', 'Subtle Spell', 'Twinned Spell',
    ]);
    expect(isPreCastOption({ effect: METAMAGIC_EFFECTS.EMPOWERED })).toBe(false);
    // golden unguarded-deref (never-executed-guard census: no optional chaining here)
    expect(() => isPreCastOption(undefined)).toThrow(TypeError);
  });
});

// ── getMetamagicCost ───────────────────────────────────────────────────────────

describe('getMetamagicCost', () => {
  it('passes fixed numeric costs through and resolves spell_level with a floor of 1', () => {
    expect(getMetamagicCost({ cost: 1 }, 5)).toBe(1);
    expect(getMetamagicCost({ cost: 3 }, 10)).toBe(3);
    expect(getMetamagicCost({ cost: 2 }, 0)).toBe(2); // fixed cost ignores spell level
    expect(getMetamagicCost({ cost: 'spell_level' }, 3)).toBe(3);
    expect(getMetamagicCost({ cost: 'spell_level' }, 0)).toBe(1);  // cantrip -> 1 (2014 errata)
    expect(getMetamagicCost({ cost: 'spell_level' }, -2)).toBe(1);
    expect(getMetamagicCost({ cost: 'spell_level' }, undefined)).toBe(1);
  });
});

// ── getPreCastOptions ──────────────────────────────────────────────────────────

describe('getPreCastOptions', () => {
  it('returns [] for null stats, stats without class, and non-Sorcerer', () => {
    expect(getPreCastOptions(null, 10, 1)).toEqual([]);
    expect(getPreCastOptions({}, 10, 1)).toEqual([]);
    expect(getPreCastOptions({ class: { name: 'Wizard' } }, 10, 1)).toEqual([]);
  });

  it('produces the 7 pre-cast options (no Empowered) with resolved costs and an affordability boundary, as fresh objects', () => {
    const result = getPreCastOptions({ ...SORCERER }, 2, 2);
    expect(result.map((o) => [o.name, o.resolvedCost, o.affordable])).toEqual([
      ['Careful Spell', 1, true],
      ['Distant Spell', 1, true],
      ['Extended Spell', 1, true],
      ['Heightened Spell', 3, false],
      ['Quickened Spell', 2, true],
      ['Subtle Spell', 1, true],
      ['Twinned Spell', 2, true],
    ]);
    // exact key set — no fabricated keys
    for (const opt of result) {
      expect(Object.keys(opt).sort()).toEqual(
        ['affordable', 'cost', 'description', 'effect', 'name', 'resolvedCost'],
      );
    }
    // descriptions come byte-identical from the catalog
    expect(result.map((o) => o.description)).toEqual(
      METAMAGIC_OPTIONS.filter((o) => o.name !== 'Empowered Spell').map((o) => o.description),
    );
    // input purity: fresh objects, mutating output never poisons the catalog
    expect(result[0]).not.toBe(METAMAGIC_OPTIONS[0]);
    result[0].resolvedCost = 999;
    expect(getPreCastOptions({ ...SORCERER }, 2, 2)[0].resolvedCost).toBe(1);
    expect(METAMAGIC_OPTIONS[0].cost).toBe(1);
  });
});

// ── getChaModifier ─────────────────────────────────────────────────────────────

describe('getChaModifier', () => {
  it('delegates to the real abilityLookup and clamps negatives/missing to 0 (code stance: never negative)', () => {
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 3 }] })).toBe(3);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 0 }] })).toBe(0);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: -3 }] })).toBe(0); // clamp, not RAW max(cha,1)
    expect(getChaModifier(null)).toBe(0);
    expect(getChaModifier({})).toBe(0);
    expect(getChaModifier({ abilities: [] })).toBe(0);
    expect(getChaModifier({ abilities: [{ name: 'Strength', bonus: 3 }] })).toBe(0);
    // real abilityLookup (not a mock) resolves missing bonus via its ?? 0 fallback
    expect(getChaModifier({ abilities: [{ name: 'Charisma' }] })).toBe(0);
  });
});

// ── getMaxMetamagicPerSpell ────────────────────────────────────────────────────

describe('getMaxMetamagicPerSpell', () => {
  it('caps at 1 for every 5e level, every 2024 level below 6, and malformed stats — without touching the store', () => {
    expect(getMaxMetamagicPerSpell({ rules: '5e', level: 20 }, 'player')).toBe(1);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 5 }, 'player')).toBe(1);
    expect(getMaxMetamagicPerSpell(null, 'player')).toBe(1);
    expect(getMaxMetamagicPerSpell({ rules: '2024' }, 'player')).toBe(1); // level||0
    expect(buffs).not.toHaveBeenCalled(); // gate short-circuits below lvl-6/2024 — RAW "only one option"
  });

  it('2024 lvl-6 gate: 2 only when the Innate Sorcery buff is active, 1 otherwise, reading (playerName, activeBuffs) exactly', () => {
    // boundary below: lvl 5 stays 1 even with the buff, store never read
    buffs.mockReturnValue([{ name: 'Innate Sorcery' }]);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 5 }, 'player')).toBe(1);
    expect(buffs).not.toHaveBeenCalled();
    // boundary at/above: store read with exact 2-arg tuple (no campaignName — arity 2)
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'player')).toBe(2);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 12 }, 'player')).toBe(2);
    expect(buffs).toHaveBeenLastCalledWith('player', 'activeBuffs');
    // no buff / wrong-name buff / non-array store value -> 1
    buffs.mockReturnValue([{ name: 'Bless' }]);
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'player')).toBe(1);
    buffs.mockReturnValue(undefined); // store miss — the !Array.isArray guard is live
    expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'player')).toBe(1);
  });
});

// ── hasArcaneApotheosis ────────────────────────────────────────────────────────

describe('hasArcaneApotheosis', () => {
  it('is true only when the Arcane Apotheosis passive AND the Innate Sorcery buff are both present', () => {
    const withFeature = { automation: { passives: [{ name: 'Other Feature' }, { name: 'Arcane Apotheosis' }] } };
    buffs.mockReturnValue([{ name: 'Innate Sorcery' }]);
    expect(hasArcaneApotheosis(withFeature, 'player')).toBe(true);
    expect(hasArcaneApotheosis(withFeature, 'player')).toBe(true); // stable across repeated reads
    expect(buffs).toHaveBeenLastCalledWith('player', 'activeBuffs');
    // feature present, buff absent/wrong-name/non-array -> false
    buffs.mockReturnValue([]);
    expect(hasArcaneApotheosis(withFeature, 'player')).toBe(false);
    buffs.mockReturnValue([{ name: 'Bless' }]);
    expect(hasArcaneApotheosis(withFeature, 'player')).toBe(false);
    buffs.mockReturnValue(undefined);
    expect(hasArcaneApotheosis(withFeature, 'player')).toBe(false);
    // buff present, feature absent (any stats shape) -> false, store never consulted
    buffs.mockReturnValue([{ name: 'Innate Sorcery' }]);
    buffs.mockClear();
    expect(hasArcaneApotheosis(null, 'player')).toBe(false);
    expect(hasArcaneApotheosis({}, 'player')).toBe(false);
    expect(hasArcaneApotheosis({ automation: { passives: [] } }, 'player')).toBe(false);
    expect(buffs).not.toHaveBeenCalled(); // passive check short-circuits before the store read
  });
});

// ── computeMetamagicCost ───────────────────────────────────────────────────────

describe('computeMetamagicCost', () => {
  const opts = (pairs) => pairs.map(([name, resolvedCost]) => ({ name, resolvedCost }));

  it('empty selection costs nothing; unknown names silently cost 0; null selection throws', () => {
    expect(computeMetamagicCost([], [], {}, 'player')).toEqual({ totalCost: 0, waivedName: null });
    // :0-swallow quirk pin — option missing from optionsList contributes 0, still listed in selection
    expect(computeMetamagicCost(['Unknown'], opts([['Careful Spell', 1]]), {}, 'player'))
      .toEqual({ totalCost: 0, waivedName: null });
    expect(() => computeMetamagicCost(null, [], {}, 'player')).toThrow(TypeError);
  });

  it('sums all resolved costs without waiver when Apotheosis is inactive, including zero-cost options', () => {
    expect(computeMetamagicCost(
      ['Careful Spell', 'Distant Spell', 'Heightened Spell'],
      opts([['Careful Spell', 1], ['Distant Spell', 1], ['Heightened Spell', 3]]),
      {}, 'player',
    )).toEqual({ totalCost: 5, waivedName: null });
    expect(computeMetamagicCost(
      ['Careful Spell', 'Heightened Spell'],
      opts([['Careful Spell', 0], ['Heightened Spell', 3]]),
      {}, 'player',
    )).toEqual({ totalCost: 3, waivedName: null });
  });

  it('waives exactly the highest-cost selected option when active, down to a 0 total for a lone option', () => {
    buffs.mockReturnValue([{ name: 'Innate Sorcery' }]);
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    expect(computeMetamagicCost(
      ['Careful Spell', 'Heightened Spell'],
      opts([['Careful Spell', 1], ['Heightened Spell', 3]]),
      stats, 'player',
    )).toEqual({ totalCost: 1, waivedName: 'Heightened Spell' });
    expect(computeMetamagicCost(
      ['Heightened Spell'], opts([['Heightened Spell', 3]]), stats, 'player',
    )).toEqual({ totalCost: 0, waivedName: 'Heightened Spell' });
  });

  it('breaks cost ties by first-in-selection-order, not optionsList order', () => {
    buffs.mockReturnValue([{ name: 'Innate Sorcery' }]);
    const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } };
    const list = opts([['Quickened Spell', 3], ['Heightened Spell', 3]]); // optionsList order reversed
    expect(computeMetamagicCost(['Heightened Spell', 'Quickened Spell'], list, stats, 'player'))
      .toEqual({ totalCost: 3, waivedName: 'Heightened Spell' });
    expect(computeMetamagicCost(['Quickened Spell', 'Heightened Spell'], list, stats, 'player'))
      .toEqual({ totalCost: 3, waivedName: 'Quickened Spell' });
  });
});

// ── Psionic raw predicates (cited by SpellDetailPopup.psionicPayment,
//    automationInfoBuilder psionic/sorcery lanes — passive shapes match
//    automationInfoBuilder/psionic.js producer: { type, psionicSpells }) ──────

describe('psionic predicates', () => {
  it('getPsionicSpellsList returns the list from psionic_spells_list OR psionic_sorcery passives, first match wins', () => {
    expect(getPsionicSpellsList({
      automation: { passives: [{ type: 'psionic_spells_list', psionicSpells: ['Bolt', 'Shield'] }] },
    })).toEqual(['Bolt', 'Shield']);
    expect(getPsionicSpellsList({
      automation: { passives: [{ type: 'psionic_sorcery', psionicSpells: ['Telekinetic Strike'] }] },
    })).toEqual(['Telekinetic Strike']);
    // first matching passive wins, arrays with no list are skipped
    expect(getPsionicSpellsList({
      automation: { passives: [
        { type: 'psionic_spells_list' },
        { type: 'psionic_spells_list', psionicSpells: ['Magic'] },
      ] },
    })).toEqual(['Magic']);
    expect(getPsionicSpellsList({ automation: { passives: [{ type: 'other' }] } })).toEqual([]);
  });

  it('psionic list readers throw with the console-logged shape when the passives array is missing', () => {
    for (const [bad, passives, msg] of [
      [{ automation: { passives: null } }, null, 'Expected array, got null'],
      [{ automation: {} }, undefined, 'Expected array, got undefined'],
      [{}, undefined, 'Expected array, got undefined'],
      [null, undefined, 'Expected array, got undefined'],
    ]) {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => getPsionicSpellsList(bad)).toThrow(msg);
      expect(spy).toHaveBeenCalledWith('[metamagicRules] Missing array:', passives);
      expect(() => hasPsionicSorcery(bad)).toThrow(msg);
      spy.mockRestore();
    }
  });

  it('isPsionicSpell is an exact-case membership test on false-y-guarded names', () => {
    const stats = { automation: { passives: [{ type: 'psionic_spells_list', psionicSpells: ['Bolt'] }] } };
    expect(isPsionicSpell(stats, 'Bolt')).toBe(true);
    expect(isPsionicSpell(stats, 'bolt')).toBe(false); // case gate is exact-byte
    expect(isPsionicSpell(stats, 'Fireball')).toBe(false);
    expect(isPsionicSpell({ automation: { passives: [] } }, 'Bolt')).toBe(false);
    for (const falsy of [null, undefined, '']) {
      expect(isPsionicSpell(stats, falsy)).toBe(false); // guard short-circuits before list lookup
    }
  });

  it('hasPsionicSorcery is a type-membership test over the passive array', () => {
    expect(hasPsionicSorcery({ automation: { passives: [{ type: 'other' }, { type: 'psionic_sorcery' }] } })).toBe(true);
    expect(hasPsionicSorcery({ automation: { passives: [{ type: 'psionic_spells_list' }] } })).toBe(false);
    expect(hasPsionicSorcery({ automation: { passives: [] } })).toBe(false);
  });
});
