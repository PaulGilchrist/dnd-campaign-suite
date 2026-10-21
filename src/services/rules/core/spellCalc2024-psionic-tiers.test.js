// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';
import classes2024 from '../../../../public/data/2024/classes.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, _prop) => null),
}));

// CLA-272 owner: Aberrant Sorcery psionic TIER GATING end-to-end contract —
// at each char-unlock tier boundary (disk tiers 3/5/7/9) the sheet renders exactly
// the disk spells whose tier <= level, always-prepared, at their spells-DB level.
// Cited, not re-pinned here: feature-name grant/deny gate + automation payload bytes
// → spellCalc2024-automation.test.js (#1266); slot-table math → spellCalc2024.test.js.
//
// Fixture discipline: the tier table (major.spells[].level), the passive spell list,
// the full-caster slot ladder and the spells-DB rows are ALL read from disk —
// nothing hand-transcribed, so a classes.json/spells.json edit re-drives these rows.

const sorcerer = classes2024.find(c => c.name === 'Sorcerer');
const aberrant = sorcerer.majors.find(m => m.name === 'Aberrant Sorcery');
const psionicFeature = aberrant.features.find(f => f.automation?.type === 'psionic_spells_list');

// major.spells[].level is the CHAR-UNLOCK TIER (3/5/7/9), distinct from the
// spells-DB spell level each granted row resolves to.
const TIER_ROWS = aberrant.spells;
const PSIONIC_NAMES = psionicFeature.automation.psionic_spells;
const PSIONIC_DB_ROWS = spells2024.filter(s => PSIONIC_NAMES.includes(s.name));

// Sheet contract rows: "dbLevel:name" pins presence, tier gating and the DB-level
// remap byte-for-byte (an undefined level renders "undefined:Name" and fails).
function expectedRowsAt(level) {
  return TIER_ROWS
    .filter(r => r.level <= level)
    .map(r => `${PSIONIC_DB_ROWS.find(s => s.name === r.name).level}:${r.name}`)
    .sort();
}

// Runtime-faithful Aberrant Sorcery sorcerer: class_levels/proficiency/ability come
// verbatim from disk; the passive uses the collector's camelCase shape
// (automationInfoBuilder/psionic.js: psionicSpells ← automation.psionic_spells).
function aberrantSorcerer(level) {
  return {
    name: 'AberrantSorcerer',
    level,
    proficiency: sorcerer.class_levels[level - 1].proficiency_bonus,
    class: {
      name: 'Sorcerer',
      class_levels: sorcerer.class_levels,
      spell_casting_ability: sorcerer.spell_casting_ability,
      major: {
        name: aberrant.name,
        spells: TIER_ROWS,
        features: aberrant.features,
      },
    },
    abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
    spells: [],
    automation: {
      passives: [
        { type: 'psionic_spells_list', name: psionicFeature.name, psionicSpells: PSIONIC_NAMES, hasAutomation: true },
      ],
    },
  };
}

// Disk unlock tiers → falsifying pair (tier-1 absent, tier present) per tier.
// The lv2 row is the non-vacuous passive-gate falsifier: addMajorSubclassSpells is
// inert below lv3 (spellCalc2024.js `level > 2` guard), so ONLY the psionic_spells_list
// tier gate can keep the lv2 sheet empty. lv3+ rows pin the merged end-to-end sheet.
const BOUNDARY_LEVELS = [...new Set(TIER_ROWS.map(r => r.level))].sort((a, b) => a - b).flatMap(tier => [tier - 1, tier]);

describe('spellCalc2024 psionic_spells_list tier gating (CLA-272)', () => {
  it.each(BOUNDARY_LEVELS)(
    'lv%i: sheet carries exactly the disk psionic spells whose unlock tier <= level, always-prepared at their DB level',
    (level) => {
      const result = getSpellAbilities(PSIONIC_DB_ROWS, aberrantSorcerer(level));

      expect(result).not.toBeNull();
      const granted = result.spells.map(s => `${s.level}:${s.name}`).sort();
      expect(granted).toEqual(expectedRowsAt(level));
      result.spells.forEach(s => expect(s.prepared).toBe('Always'));
    }
  );

  it('skips passive names that fail to resolve in the spells DB with console.error, leaving no blank-level row', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stats = aberrantSorcerer(6);
    // 'Evar's…' (typo) is in neither the spells DB nor the disk tier table: the
    // absent tier row bypasses the gate, so the DB-resolution guard must catch it.
    stats.automation.passives[0].psionicSpells = ['Arms of Hadar', 'Evar\'s Black Tentacles'];

    const result = getSpellAbilities(PSIONIC_DB_ROWS, stats);

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('psionic_spells_list'), 'Evar\'s Black Tentacles');
    expect(result.spells.map(s => `${s.level}:${s.name}`).sort()).toEqual(expectedRowsAt(6));
    consoleError.mockRestore();
  });
});
