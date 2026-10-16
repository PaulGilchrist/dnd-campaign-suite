// @maintained-by-ai
// getPreSelectedSpells — spells auto-granted by class/subclass, race/subrace, and feats.
// Fixtures are anchored to the real disk data (public/data/[2024/]classes|races|feats.json)
// and outputs are pinned exactly, so fabricated rules can never sneak back in.
// Production caller is useWizardSpells; its own test mocks this module, so the
// extraction behavior is covered only here.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPreSelectedSpells } from './getPreSelectedSpells.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadClassData: vi.fn(),
  loadRaceData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import { loadClassData, loadRaceData, loadFeatData } from '../ui/dataLoader.js';

import classes5e from '../../../public/data/classes.json';
import races5e from '../../../public/data/races.json';
import feats5e from '../../../public/data/feats.json';
import classes2024 from '../../../public/data/2024/classes.json';
import races2024 from '../../../public/data/2024/races.json';
import feats2024 from '../../../public/data/2024/feats.json';

describe('getPreSelectedSpells', () => {
  beforeEach(() => {
    // Version-discriminating loaders: every rules:'2024' row below only passes if
    // the module forwards the ruleset correctly to each data loader.
    loadClassData.mockImplementation(v => Promise.resolve(v === '2024' ? classes2024 : classes5e));
    loadRaceData.mockImplementation(v => Promise.resolve(v === '2024' ? races2024 : races5e));
    loadFeatData.mockImplementation(v => Promise.resolve(v === '2024' ? feats2024 : feats5e));
  });

  it('returns [] for formData without any spell-granting selection', async () => {
    for (const input of [null, undefined, {}, { rules: '5e' }, { rules: '2024' }, { level: '5' }, { feats: null }, { feats: [] }]) {
      expect(await getPreSelectedSpells(input), `input: ${JSON.stringify(input)}`).toEqual([]);
    }
  });

  // Real 5e disk data: Cleric → Light Domain has bonus spell tiers at cleric 1
  // (Burning Hands, Faerie Fire), cleric 3 (Flaming Sphere, Scorching Ray),
  // cleric 5 (Daylight, Fireball). Wizard subclasses have NO spells arrays on disk.
  describe.each([
    { label: 'defaults to level 1 when level is missing', formData: { rules: '5e', class: { name: 'Cleric', subclass: { name: 'Light' } } }, expected: ['Burning Hands', 'Faerie Fire'] },
    { label: 'level 0 falls back to level 1', formData: { rules: '5e', level: 0, class: { name: 'Cleric', subclass: { name: 'Light' } } }, expected: ['Burning Hands', 'Faerie Fire'] },
    { label: 'unparseable level falls back to level 1', formData: { rules: '5e', level: 'invalid', class: { name: 'Cleric', subclass: { name: 'Light' } } }, expected: ['Burning Hands', 'Faerie Fire'] },
    { label: 'level 1 includes only cleric-1 prereq spells', formData: { rules: '5e', level: 1, class: { name: 'Cleric', subclass: { name: 'Light' } } }, expected: ['Burning Hands', 'Faerie Fire'] },
    { label: 'level 2 stays at the cleric-1 tier', formData: { rules: '5e', level: 2, class: { name: 'Cleric', subclass: { name: 'Light' } } }, expected: ['Burning Hands', 'Faerie Fire'] },
    { label: 'level 3 adds the cleric-3 tier', formData: { rules: '5e', level: 3, class: { name: 'Cleric', subclass: { name: 'Light' } } }, expected: ['Burning Hands', 'Faerie Fire', 'Flaming Sphere', 'Scorching Ray'] },
    { label: 'string level "3" parses like numeric 3', formData: { rules: '5e', level: '3', class: { name: 'Cleric', subclass: { name: 'Light' } } }, expected: ['Burning Hands', 'Faerie Fire', 'Flaming Sphere', 'Scorching Ray'] },
    { label: 'resolves class and subclass by lowercase index', formData: { rules: '5e', level: 3, class: { name: 'cleric', subclass: { name: 'light' } } }, expected: ['Burning Hands', 'Faerie Fire', 'Flaming Sphere', 'Scorching Ray'] },
    { label: 'level 5 adds the cleric-5 tier', formData: { rules: '5e', level: 5, class: { name: 'Cleric', subclass: { name: 'Light' } } }, expected: ['Burning Hands', 'Faerie Fire', 'Flaming Sphere', 'Scorching Ray', 'Daylight', 'Fireball'] },
    { label: 'class without subclass grants no spells', formData: { rules: '5e', level: 5, class: { name: 'Cleric' } }, expected: [] },
    { label: 'Wizard subclasses carry no authored spells on disk', formData: { rules: '5e', level: 5, class: { name: 'Wizard', subclass: { name: 'Evocation' } } }, expected: [] },
    { label: 'unknown class resolves to nothing', formData: { rules: '5e', level: 5, class: { name: 'NonExistentClass', subclass: { name: 'NonExistent' } } }, expected: [] },
  ])('5e class/subclass (%s)', ({ formData, expected }) => {
    it('returns exactly the spells available at that level', async () => {
      expect(await getPreSelectedSpells(formData)).toEqual(expected);
    });
  });

  // Race extraction pulls spell names from <em> markup and "know/learn X cantrip"
  // phrases in real disk trait text — outputs are pinned verbatim.
  describe.each([
    {
      label: 'Tiefling Infernal Legacy surfaces the thaumaturgy cantrip phrase verbatim (lowercase)',
      formData: { rules: '5e', level: 1, race: { name: 'Tiefling' } },
      expected: ['thaumaturgy'],
    },
    {
      label: '5e Elf+High Elf resolves subrace via parent fallback; trait text "know one cantrip of your choice" yields only the bogus fragment "one" (known regex quirk — reported, not a real spell grant)',
      formData: { rules: '5e', level: 1, race: { name: 'Elf', subrace: { name: 'High Elf' } } },
      expected: ['one'],
    },
    {
      label: '2024 Elf traits surface nothing (lineage traits skipped, no spell-name phrases)',
      formData: { rules: '2024', level: 1, race: { name: 'Elf' } },
      expected: [],
    },
  ])('race/subrace extraction (%s)', ({ formData, expected }) => {
    it('returns exactly the disk-derived spell list', async () => {
      expect(await getPreSelectedSpells(formData)).toEqual(expected);
    });
  });

  // 2024 Barbarian Path of the Wild Heart majors spell tiers on disk:
  // Speak with Animals (lvl 1), Beast Sense (lvl 2), Commune with Nature (lvl 10).
  describe.each([
    { level: 1, expected: ['Speak with Animals'] },
    { level: 2, expected: ['Speak with Animals', 'Beast Sense'] },
    { level: 9, expected: ['Speak with Animals', 'Beast Sense'] },
    { level: 10, expected: ['Speak with Animals', 'Beast Sense', 'Commune with Nature'] },
  ])('2024 Path of the Wild Heart majors at level %s', ({ level, expected }) => {
    it('gates major spells by their disk level, exactly', async () => {
      expect(await getPreSelectedSpells({ rules: '2024', level, class: { name: 'Barbarian', major: { name: 'Path of the Wild Heart' } } })).toEqual(expected);
    });
  });

  it('does not pull spells from other majors of the same class', async () => {
    expect(await getPreSelectedSpells({ rules: '2024', level: 10, class: { name: 'Barbarian', major: { name: 'Path of the Berserker' } } })).toEqual([]);
  });

  describe.each([
    { label: '2024 Druid gets Druidic (Speak with Animals)', formData: { rules: '2024', level: 1, class: { name: 'Druid' } }, expected: ['Speak with Animals'] },
    { label: '5e Druid does not', formData: { rules: '5e', level: 1, class: { name: 'Druid' } }, expected: [] },
    { label: '2024 non-Druid classes do not', formData: { rules: '2024', level: 1, class: { name: 'Wizard' } }, expected: [] },
    { label: '2024 Fey Touched grants exactly Misty Step', formData: { rules: '2024', level: 1, feats: ['Fey Touched'] }, expected: ['Misty Step'] },
    { label: '2024 Shadow Touched grants exactly Invisibility', formData: { rules: '2024', level: 1, feats: ['Shadow Touched'] }, expected: ['Invisibility'] },
    { label: '2024 Magic Initiate grants no real spell — only the bogus "two" fragment from "learn two cantrips" (user-chosen spells stay un-preselected; reported quirk)', formData: { rules: '2024', level: 1, feats: ['Magic Initiate'] }, expected: ['two'] },
    { label: '5e Magic Initiate contributes nothing (disk descriptions are string arrays, extraction gate never fires)', formData: { rules: '5e', level: 1, feats: ['Magic Initiate'] }, expected: [] },
    { label: '5e feats scope is version-correct: Fey Touched does not exist in 5e disk data', formData: { rules: '5e', level: 1, feats: ['Fey Touched'] }, expected: [] },
  ])('hardcoded and feat grants (%s)', ({ formData, expected }) => {
    it('returns exactly the granted spell list', async () => {
      expect(await getPreSelectedSpells(formData)).toEqual(expected);
    });
  });

  it('merges class, race, and feat sources in order, deduplicated', async () => {
    const formData = {
      rules: '2024',
      level: 3,
      class: { name: 'Barbarian', major: { name: 'Path of the Wild Heart' } },
      race: { name: 'Elf' },
      feats: ['Fey Touched', 'Fey Touched'],
    };
    const result = await getPreSelectedSpells(formData);
    expect(result).toEqual(['Speak with Animals', 'Beast Sense', 'Misty Step']);
    expect(new Set(result).size).toBe(result.length);
  });
});
