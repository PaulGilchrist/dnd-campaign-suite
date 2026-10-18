// @maintained-by-ai
// MA-1202 data lock: Mummy Lord Spellcasting rode the MA-0421/MA-0532/
// MA-0576/MA-0611 plain-text zero-affordance template. Pre-fix ONLY the
// tier headers carried <strong>; Dispel Magic/Thaumaturgy/Animate Dead/
// Harm/Insect Plague were plain text — extractSpellNamesFromSpellcasting
// returned [] and extractSpellcastingSpellUses returned {} → SpellCastLinks
// null → zero chips; the row-name XOR fork (MA-0532) kept the authored
// row-level save_dc 17/save_type Wisdom off every lane. DATA fix mirrors
// the ghast-gravecaller MA-0777 byte-shape: <strong> on EACH spell name,
// tier headers byte-kept, "(level 7 version)" parenthetical OUTSIDE the
// tag, strip-tags byte-equality vs the pre-fix plain text (markup-only).
import { describe, it, expect } from 'vitest';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, spellCastLevelFromSpellcasting, spellDamageFormulaAtLevel } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';
import spellsData from '../../../public/data/spells.json';

const mummyLord = monstersData.find(m => m.index === 'mummy-lord');
const row = mummyLord.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Dispel Magic', 'Thaumaturgy', 'Animate Dead', 'Harm', 'Insect Plague'];

const PLAIN_ORIGINAL = 'The mummy casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks):\nAt Will: Dispel Magic, Thaumaturgy\n1/Day Each: Animate Dead, Harm, Insect Plague (level 7 version)';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

describe('MA-1202 Mummy Lord Spellcasting extraction', () => {
  it('extracts the five spell names verbatim from the marked-up description', () => {
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(NAMES);
  });

  it('binds the 1/Day Each tier to {Animate Dead:1, Harm:1, Insect Plague:1} and leaves At Will ungated', () => {
    // Full-object toEqual: any leaked At-Will gate fails here too.
    expect(extractSpellcastingSpellUses(row.description)).toEqual({ 'Animate Dead': 1, 'Harm': 1, 'Insect Plague': 1 });
  });
});

describe('MA-1202 monsters.json data lock: Mummy Lord Spellcasting row', () => {
  it('is a markup-only diff — strip-tags byte-equals the pre-fix plain text, save_dc 17/save_type Wisdom pair kept (§167)', () => {
    expect(stripTags(row.description)).toBe(PLAIN_ORIGINAL);
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Wisdom');
  });

  it('every extracted name resolves in 5e spells.json; "(level 7 version)" OUTSIDE the tag drives the MA-0033 upcast lane', () => {
    for (const name of NAMES) {
      expect(spellsData.some(s => s.name === name)).toBe(true);
    }
    const harm = spellsData.find(s => s.name === 'Harm');
    expect(harm.dc.dc_type).toBe('CON');
    expect(harm.dc.dc_success).toBe('half');
    const plague = spellsData.find(s => s.name === 'Insect Plague');
    // Tag-inside regression: extract would yield "Insect Plague (level 7
    // version)" and the resolve loop above fails first, with a sharper diff.
    const castLevel = spellCastLevelFromSpellcasting(row.description, 'Insect Plague', plague);
    expect(castLevel).toBe(7);
    expect(spellDamageFormulaAtLevel(plague, castLevel)).toBe('6d10');
    expect(plague.damage.damage_type).toBe('Piercing');
  });
});
