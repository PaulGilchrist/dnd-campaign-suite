// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import { getPreSelectedSpells } from './getPreSelectedSpells.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadClassData: vi.fn(),
  loadRaceData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import { loadClassData, loadRaceData, loadFeatData } from '../ui/dataLoader.js';

describe('getPreSelectedSpells', () => {
  const mockClasses = [
    { name: 'Wizard', index: 'wizard', subclasses: [{ name: 'School of Evocation', index: 'school_of_evocation', spells: [{ spell: { name: 'Magic Missile' }, prerequisites: [{ type: 'level', name: '2nd-level spell slot' }] }] }] },
    { name: 'Cleric', index: 'cleric', subclasses: [{ name: 'Light Domain', index: 'light_domain', spells: [{ spell: { name: 'Burning Hands' }, prerequisites: [] }] }] },
  ];

  const mockRaces = [
    { name: 'High Elf', index: 'high-elf', traits: [{ description: '<em>Fire Bolt</em> cantrip' }], subraces: [{ name: 'Grey Elf', racial_traits: [{ description: '<em>Light</em> cantrip' }], description: 'Learn <em>Guidance</em>' }] },
    { name: 'Human', index: 'human', traits: [], subraces: [] },
  ];

  const mockFeats = [
    { name: 'Magic Initiate', index: 'magic-initiate', description: 'Learn <em>Guidance</em> cantrip' },
    { name: 'Fey Touched', index: 'fey-touched', description: '' },
    { name: 'Shadow Touched', index: 'shadow-touched', description: '' },
    { name: 'War Caster', index: 'war-caster', description: '<em>Shield</em> cantrip', benefits: [{ type: 'spell', description: '<em>Burning Hands</em>' }] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadClassData).mockResolvedValue(mockClasses);
    vi.mocked(loadRaceData).mockResolvedValue(mockRaces);
    vi.mocked(loadFeatData).mockResolvedValue(mockFeats);
  });

  describe('null/undefined/empty input handling', () => {
    it.each([
      [null, 'null formData'],
      [undefined, 'undefined formData'],
      [{}, 'empty object formData'],
    ])('returns empty array for %s (%s)', async (input) => {
      const result = await getPreSelectedSpells(input);
      expect(result).toEqual([]);
    });
  });

  describe('class/subclass spell extraction', () => {
    it('extracts subclass spells when class and subclass are provided', async () => {
      const formData = {
        rules: '5e',
        level: 3,
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Magic Missile');
    });

    it('does not extract subclass spells when only class is provided', async () => {
      const formData = {
        rules: '5e',
        level: 3,
        class: { name: 'Wizard' },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).not.toContain('Magic Missile');
    });

    it('filters subclass spells by character level', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).not.toContain('Magic Missile');
    });

    it('uses default level 1 when level is missing', async () => {
      const formData = {
        rules: '5e',
        class: { name: 'Cleric', subclass: { name: 'Light Domain' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Burning Hands');
    });

    it('handles invalid class name gracefully', async () => {
      const formData = {
        rules: '5e',
        level: 3,
        class: { name: 'NonExistentClass', subclass: { name: 'Subclass' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
    });

    it('finds class by index when name does not match', async () => {
      const formData = {
        rules: '5e',
        level: 3,
        class: { name: 'wizard', subclass: { name: 'School of Evocation' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Magic Missile');
    });

    it('handles missing class or subclass properties gracefully', async () => {
      const noClass = { rules: '5e', level: 3 };
      expect(await getPreSelectedSpells(noClass)).toEqual([]);

      const noSubclass = { rules: '5e', level: 3, class: { name: 'Wizard' } };
      expect(await getPreSelectedSpells(noSubclass)).toEqual([]);
    });
  });

  describe('race spell extraction', () => {
    it('extracts cantrips from race traits', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        race: { name: 'High Elf' },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Fire Bolt');
    });

    it('extracts cantrips from subrace traits and description', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        race: { name: 'High Elf', subrace: { name: 'Grey Elf' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Light');
      expect(result).toContain('Guidance');
    });

    it('handles missing race data or property gracefully', async () => {
      const noRace = { rules: '5e', level: 1 };
      expect(await getPreSelectedSpells(noRace)).toEqual([]);

      const missingRaceData = { rules: '5e', level: 1, race: { name: 'NonExistentRace' } };
      expect(await getPreSelectedSpells(missingRaceData)).toEqual([]);
    });

    it('finds subrace in 2024 from parent race subraces', async () => {
      const formData = {
        rules: '2024',
        level: 1,
        race: { name: 'High Elf', subrace: { name: 'Grey Elf' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Light');
    });

    it('finds subrace as separate race entry in 5e', async () => {
      const extendedRaces = [
        ...mockRaces,
        { name: 'Grey Elf', index: 'grey-elf', traits: [{ description: '<em>Acid Splash</em>' }], subraces: [] },
      ];
      vi.mocked(loadRaceData).mockResolvedValue(extendedRaces);

      const formData = {
        rules: '5e',
        level: 1,
        race: { name: 'High Elf', subrace: { name: 'Grey Elf' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Acid Splash');
    });
  });

  describe('feat spell extraction', () => {
    it('extracts cantrips from Magic Initiate feat description', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        feats: ['Magic Initiate'],
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Guidance');
    });

    it('extracts Misty Step from Fey Touched', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        feats: ['Fey Touched'],
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Misty Step');
    });

    it('extracts Invisibility from Shadow Touched', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        feats: ['Shadow Touched'],
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Invisibility');
    });

    it('extracts spells from War Caster feat benefits', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        feats: ['War Caster'],
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Burning Hands');
    });

    it('combines spells from multiple feats', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        feats: ['Magic Initiate', 'Fey Touched'],
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Guidance');
      expect(result).toContain('Misty Step');
    });

    it('handles missing, null, or empty feats gracefully', async () => {
      const noFeats = { rules: '5e', level: 1 };
      expect(await getPreSelectedSpells(noFeats)).toEqual([]);

      const nullFeats = { rules: '5e', level: 1, feats: null };
      expect(await getPreSelectedSpells(nullFeats)).toEqual([]);

      const emptyFeats = { rules: '5e', level: 1, feats: [] };
      expect(await getPreSelectedSpells(emptyFeats)).toEqual([]);
    });

    it('handles non-existent feat gracefully', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        feats: ['NonExistentFeat'],
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
    });
  });

  describe('deduplication and combined sources', () => {
    it('deduplicates spells that appear from multiple sources', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        class: { name: 'Cleric', subclass: { name: 'Light Domain' } },
        race: { name: 'High Elf' },
        feats: ['War Caster'],
      };
      const result = await getPreSelectedSpells(formData);
      const burningHandsCount = result.filter(s => s === 'Burning Hands').length;
      expect(burningHandsCount).toBe(1);
    });

    it('combines spells from class, race, and feats into a single deduplicated set', async () => {
      const formData = {
        rules: '5e',
        level: 3,
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
        race: { name: 'High Elf' },
        feats: ['Fey Touched'],
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Magic Missile');
      expect(result).toContain('Fire Bolt');
      expect(result).toContain('Misty Step');
      expect(new Set(result).size).toBe(result.length);
    });

    it('deduplicates cantrips from race and feats', async () => {
      const extendedRaces = [
        ...mockRaces,
        { name: 'Half-Elf', index: 'half-elf', traits: [{ description: '<em>Guidance</em> cantrip' }], subraces: [] },
      ];
      vi.mocked(loadRaceData).mockResolvedValue(extendedRaces);

      const formData = {
        rules: '5e',
        level: 1,
        race: { name: 'Half-Elf' },
        feats: ['Magic Initiate'],
      };
      const result = await getPreSelectedSpells(formData);
      const guidanceCount = result.filter(s => s === 'Guidance').length;
      expect(guidanceCount).toBe(1);
    });
  });

  describe('level parsing', () => {
    it('parses numeric and string levels', async () => {
      const base = { class: { name: 'Wizard', subclass: { name: 'School of Evocation' } } };
      const numeric = await getPreSelectedSpells({ rules: '5e', level: 3, ...base });
      expect(numeric).toContain('Magic Missile');

      const stringLevel = await getPreSelectedSpells({ rules: '5e', level: '3', ...base });
      expect(stringLevel).toContain('Magic Missile');
    });

    it('defaults to level 1 for invalid, zero, or empty string levels', async () => {
      const base = { rules: '5e', class: { name: 'Wizard', subclass: { name: 'School of Evocation' } } };
      const invalid = await getPreSelectedSpells({ ...base, level: 'invalid' });
      expect(invalid).not.toContain('Magic Missile');

      const zero = await getPreSelectedSpells({ ...base, level: 0 });
      expect(zero).not.toContain('Magic Missile');

      const empty = await getPreSelectedSpells({ ...base, level: '' });
      expect(empty).not.toContain('Magic Missile');
    });
  });

  describe('ruleset selection', () => {
    it('defaults to 5e when rules is missing', async () => {
      await getPreSelectedSpells({ level: 1, race: { name: 'High Elf' } });
      expect(loadRaceData).toHaveBeenCalledWith('5e');
    });

    it('uses 2024 rules when specified for race, class, and feats', async () => {
      await getPreSelectedSpells({ rules: '2024', level: 1, race: { name: 'High Elf' } });
      expect(loadRaceData).toHaveBeenCalledWith('2024');

      await getPreSelectedSpells({ rules: '2024', level: 3, class: { name: 'Wizard', subclass: { name: 'School of Evocation' } } });
      expect(loadClassData).toHaveBeenCalledWith('2024');

      await getPreSelectedSpells({ rules: '2024', level: 1, feats: ['Magic Initiate'] });
      expect(loadFeatData).toHaveBeenCalledWith('2024');
    });
  });

  describe('Druidic feature (2024 ruleset)', () => {
    it('adds Speak with Animals for Druid in 2024 but not 5e', async () => {
      const druid2024 = await getPreSelectedSpells({ rules: '2024', level: 1, class: { name: 'Druid' } });
      expect(druid2024).toContain('Speak with Animals');

      const druid5e = await getPreSelectedSpells({ rules: '5e', level: 1, class: { name: 'Druid' } });
      expect(druid5e).not.toContain('Speak with Animals');
    });

    it('does not add Speak with Animals for non-Druid classes in 2024', async () => {
      const result = await getPreSelectedSpells({ rules: '2024', level: 1, class: { name: 'Wizard' } });
      expect(result).not.toContain('Speak with Animals');
    });
  });

  describe('2024 Barbarian Path of the Wild Heart', () => {
    it('extracts Animal Speaker spells from major spells array', async () => {
      const classes = [
        {
          name: 'Barbarian',
          majors: [
            {
              name: 'Path of the Wild Heart',
              spells: [
                { name: 'Speak with Animals', level: 1 },
                { name: 'Beast Sense', level: 2 },
                { name: 'Commune with Nature', level: 10 },
              ],
            },
          ],
        },
      ];
      vi.mocked(loadClassData).mockResolvedValue(classes);

      const result = await getPreSelectedSpells({ rules: '2024', level: 3, class: { name: 'Barbarian', major: { name: 'Path of the Wild Heart' } } });
      expect(result).toContain('Speak with Animals');
      expect(result).toContain('Beast Sense');
      expect(result).not.toContain('Commune with Nature');
    });

    it('includes Commune with Nature when level 10 or higher', async () => {
      const classes = [
        {
          name: 'Barbarian',
          majors: [
            {
              name: 'Path of the Wild Heart',
              spells: [
                { name: 'Speak with Animals', level: 1 },
                { name: 'Beast Sense', level: 2 },
                { name: 'Commune with Nature', level: 10 },
              ],
            },
          ],
        },
      ];
      vi.mocked(loadClassData).mockResolvedValue(classes);

      const result = await getPreSelectedSpells({ rules: '2024', level: 10, class: { name: 'Barbarian', major: { name: 'Path of the Wild Heart' } } });
      expect(result).toContain('Commune with Nature');
    });

    it('does not extract spells for non-Wild Heart Barbarian majors', async () => {
      const classes = [
        {
          name: 'Barbarian',
          majors: [
            { name: 'Path of the Berserker' },
            {
              name: 'Path of the Wild Heart',
              spells: [
                { name: 'Speak with Animals', level: 1 },
                { name: 'Beast Sense', level: 2 },
              ],
            },
          ],
        },
      ];
      vi.mocked(loadClassData).mockResolvedValue(classes);

      const result = await getPreSelectedSpells({ rules: '2024', level: 3, class: { name: 'Barbarian', major: { name: 'Path of the Berserker' } } });
      expect(result).not.toContain('Speak with Animals');
      expect(result).not.toContain('Beast Sense');
    });
  });
});
