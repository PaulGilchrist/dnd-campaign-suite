// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';
import races from '../../../../public/data/2024/races.json';
import classes from '../../../../public/data/2024/classes.json';
import spellsDb from '../../../../public/data/2024/spells.json';

// ── 2024 spellCalc lineage lane ──
// Racial spell grants (elfish_lineage / gnomish_lineage / fiendish_legacy) flow
// through applyLineageFeatureSpells in getSpellAbilities. Every granted spell and
// option name below is read programmatically from public/data/2024/races.json —
// never hand-transcribed (drift precedents #1239/#1267). The automation rows mirror
// the collector shape (automationInfoBuilder/core-handlers.js): {type, name, options}.

// ── Module-level mocks for runtime/class-data-backed collaborators only ──
vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

// ── Fixtures ──

// Distinct bonus per ability so casting-ability overrides are falsifiable.
const ABILITY_BONUSES = { Strength: 1, Dexterity: 2, Constitution: 0, Intelligence: 3, Wisdom: 4, Charisma: 5 };
const SHORT_TO_LONG = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };

function makeAbilities() {
  return Object.entries(ABILITY_BONUSES).map(([name, bonus]) => ({
    name, baseScore: 12 + bonus * 2, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus,
  }));
}

// Wizard slot tables pulled straight from classes.json (indexed by level-1).
const wizardDisk = classes.find(c => c.name === 'Wizard');
const wizardClass = { name: 'Wizard', class_levels: wizardDisk.class_levels, spell_casting_ability: 'Intelligence' };

function wizardStats(level, automation) {
  return {
    name: 'TestCharacter',
    level,
    proficiency: 2,
    class: wizardClass,
    abilities: makeAbilities(),
    spells: ['Magic Missile'],
    automation,
  };
}

const LINEAGE_TYPES = ['elfish_lineage', 'gnomish_lineage', 'fiendish_legacy'];

function lineageTrait(raceName) {
  const race = races.find(r => r.name === raceName);
  const trait = race.traits.find(t => LINEAGE_TYPES.includes(t.automation?.type));
  return { race, trait };
}

// Collector-shaped automation row straight off the disk trait.
function lineageAutomation(raceName) {
  const { trait } = lineageTrait(raceName);
  return { specialActions: [{ type: trait.automation.type, name: trait.name, options: trait.automation.options }] };
}

// CLA-118/CLA-139 gate: levelNSpell keys unlock at the level encoded in the key.
function expectedLadder(option, level) {
  return [option.cantrip, level >= 3 ? option.level3Spell : null, level >= 5 ? option.level5Spell : null].filter(Boolean);
}

// Subrace-backed selectable lineages only (the wizard persists race.subrace, and
// resolveLineageName maps subrace → option, stripping the Tiefling legacy suffix).
const LINEAGE_ROWS = ['Elf', 'Gnome', 'Tiefling'].flatMap(raceName => {
  const { race, trait } = lineageTrait(raceName);
  return race.subraces.map(subrace => ({
    raceName,
    subrace: subrace.name,
    type: trait.automation.type,
    option: trait.automation.options.find(o => subrace.name === o.name || subrace.name.startsWith(`${o.name} `)),
  }));
});

describe('spellCalc2024-lineage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getRuntimeValue.mockReturnValue(null);
  });

  it.each(LINEAGE_ROWS)('$subrace ($type): disk ladder grants exactly, gated by levelNSpell keys', ({ raceName, subrace, option }) => {
    const automation = lineageAutomation(raceName);
    const raceArg = { name: raceName, subrace: { name: subrace } };

    for (const level of [1, 3, 5]) {
      const result = getSpellAbilities(spellsDb, wizardStats(level, automation), { campaignName: 'test-campaign', race: raceArg });

      // Grant set is exact — rival lineage options never leak in (falsifying pair).
      const granted = expectedLadder(option, level);
      expect(result.spells.map(s => s.name).sort()).toEqual([...granted, 'Magic Missile'].sort());

      // Lineage grants stamp always-prepared; the wizard's persisted row stays 'Prepared'.
      for (const name of granted) {
        expect(result.spells.find(s => s.name === name).prepared).toBe('Always');
      }
      expect(result.spells.find(s => s.name === 'Magic Missile').prepared).toBe('Prepared');

      // Counters: cantrips track the key grant. spells_known stays NaN here — the
      // 2024 Wizard disk table (classes.json) carries no spells_known key, so the
      // += in applyLineageFeatureSpells starts from undefined; the sheet masks it
      // (CharSpells.jsx:79 prepared_spells || spells_known). Slotless-host counter
      // math is pinned below (#1262).
      expect(result.cantrips_known).toBe(wizardClass.class_levels[level - 1].spellcasting.cantrips_known + 1);

      // Casting ability: lineage override (short name) when the disk option declares
      // one, else the class ability — with header math recomputed off it.
      if (option.spellcastingAbility) {
        const bonus = ABILITY_BONUSES[SHORT_TO_LONG[option.spellcastingAbility]];
        expect(result.spellCastingAbility).toBe(option.spellcastingAbility);
        expect(result.modifier).toBe(bonus);
        expect(result.toHit).toBe(bonus + 2);
        expect(result.saveDc).toBe(8 + bonus + 2);
      } else {
        expect(result.spellCastingAbility).toBe('Intelligence');
        expect(result.modifier).toBe(3);
        expect(result.saveDc).toBe(13);
      }
    }
  });

  it('CLA-139: subrace is the authoritative legacy channel; runtime refines only when absent', () => {
    const automation = lineageAutomation('Tiefling');
    const trait = lineageTrait('Tiefling').trait;
    const chthonic = trait.automation.options.find(o => o.name === 'Chthonic');
    const infernal = trait.automation.options.find(o => o.name === 'Infernal');

    // Stale runtime selection must never override a set subrace.
    getRuntimeValue.mockImplementation((_name, key) => (key === '_fiendishLegacySelection' ? 'Infernal' : null));
    const withSubrace = getSpellAbilities(spellsDb, wizardStats(5, automation), { campaignName: 'test-campaign', race: { name: 'Tiefling', subrace: { name: 'Chthonic Tiefling' } } });
    expect(withSubrace.spells.map(s => s.name).sort()).toEqual([...expectedLadder(chthonic, 5), 'Magic Missile'].sort());
    expect(withSubrace.spells.map(s => s.name)).not.toContain(infernal.cantrip);
    expect(getRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', '_fiendishLegacySelection', 'test-campaign');

    // No subrace: the sheet-chooser runtime selection resolves the legacy (CLA-118 shape).
    const noSubrace = getSpellAbilities(spellsDb, wizardStats(5, automation), { campaignName: 'test-campaign', race: { name: 'Tiefling', subrace: null } });
    expect(noSubrace.spells.map(s => s.name).sort()).toEqual([...expectedLadder(infernal, 5), 'Magic Missile'].sort());
    expect(getRuntimeValue).toHaveBeenCalledWith('TestCharacter', '_fiendishLegacySelection', 'test-campaign');
  });

  it('non-casting host: lineage creates a slotless container and re-stamps the ability math', () => {
    const automation = lineageAutomation('Elf');
    const raceArg = { name: 'Elf', subrace: { name: 'Wood Elf' } };
    const fighterStats = (level) => ({
      name: 'TestCharacter',
      level,
      proficiency: 2,
      class: { name: 'Fighter', class_levels: [{ level: 3 }], spell_casting_ability: 'Intelligence' },
      abilities: makeAbilities(),
      spells: [],
      automation,
    });

    const lv1 = getSpellAbilities(spellsDb, fighterStats(1), { campaignName: 'test-campaign', race: raceArg });
    // No class spellcasting table → SLOTLESS container: no slot keys at all.
    expect(Object.keys(lv1).filter(k => k.startsWith('spell_slots_'))).toEqual([]);
    expect(lv1.spells.map(s => s.name)).toEqual(['Druidcraft']);
    expect(lv1.spells[0].prepared).toBe('Always');
    expect(lv1.cantrips_known).toBe(1);
    // lv1 quirk: ladder gated by key, so spells_known stays 0 (#1262).
    expect(lv1.spells_known).toBe(0);
    // Lineage ability WIS outranks the class Intelligence, math recomputed.
    expect(lv1.spellCastingAbility).toBe('WIS');
    expect(lv1.modifier).toBe(4);
    expect(lv1.toHit).toBe(6);
    expect(lv1.saveDc).toBe(14);

    const lv5 = getSpellAbilities(spellsDb, fighterStats(5), { campaignName: 'test-campaign', race: raceArg });
    expect(lv5.spells.map(s => s.name)).toEqual(['Druidcraft', 'Longstrider', 'Pass Without Trace']);
    expect(lv5.cantrips_known).toBe(1);
    expect(lv5.spells_known).toBe(2);
  });

  it('unresolvable lineage grants nothing', () => {
    const automation = lineageAutomation('Elf');

    // Elf with no subrace and no runtime fallback (only Tiefling refines via runtime).
    const noSubrace = getSpellAbilities(spellsDb, wizardStats(5, automation), { campaignName: 'test-campaign', race: { name: 'Elf', subrace: null } });
    expect(noSubrace.spells.map(s => s.name)).toEqual(['Magic Missile']);
    expect(noSubrace.cantrips_known).toBe(wizardClass.class_levels[4].spellcasting.cantrips_known);

    // Missing character level: cantrip still lands, gated ladder never does.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const noLevel = getSpellAbilities(spellsDb, { ...wizardStats(5, automation), level: undefined }, { campaignName: 'test-campaign', race: { name: 'Elf', subrace: { name: 'Wood Elf' } } });
    expect(noLevel.spells.map(s => s.name).sort()).toEqual(['Druidcraft', 'Magic Missile']);
    expect(noLevel.spells_known).toBe(0);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
