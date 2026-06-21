// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import { getPreSelectedSpells } from './getPreSelectedSpells.js';

vi.mock('../ui/dataLoader.js', () => ({
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

    it('handles missing class property gracefully', async () => {
      const formData = {
        rules: '5e',
        level: 3,
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
    });

    it('handles missing subclass property gracefully', async () => {
      const formData = {
        rules: '5e',
        level: 3,
        class: { name: 'Wizard' },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
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

    it('handles race with no traits', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        race: { name: 'Human' },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
    });

    it('handles missing race data gracefully', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        race: { name: 'NonExistentRace' },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
    });

    it('handles missing race property gracefully', async () => {
      const formData = {
        rules: '5e',
        level: 1,
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
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

    it('handles non-existent feat gracefully', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        feats: ['NonExistentFeat'],
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
    });

    it('handles empty feats array', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        feats: [],
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
    });

    it('handles missing feats property gracefully', async () => {
      const formData = {
        rules: '5e',
        level: 1,
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toEqual([]);
    });

    it('handles null feats property gracefully', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        feats: null,
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
    it('parses numeric level as number', async () => {
      const formData = {
        rules: '5e',
        level: 3,
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Magic Missile');
    });

    it('parses level from numeric string', async () => {
      const formData = {
        rules: '5e',
        level: '3',
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Magic Missile');
    });

    it('defaults to level 1 for invalid level string', async () => {
      const formData = {
        rules: '5e',
        level: 'invalid',
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).not.toContain('Magic Missile');
    });

    it('defaults to level 1 for zero level', async () => {
      const formData = {
        rules: '5e',
        level: 0,
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).not.toContain('Magic Missile');
    });

    it('defaults to level 1 for empty string level', async () => {
      const formData = {
        rules: '5e',
        level: '',
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).not.toContain('Magic Missile');
    });
  });

  describe('ruleset selection', () => {
    it('defaults to 5e when rules is missing', async () => {
      const formData = {
        level: 1,
        race: { name: 'High Elf' },
      };
      await getPreSelectedSpells(formData);
      expect(loadRaceData).toHaveBeenCalledWith('5e');
    });

    it('uses 2024 rules when specified', async () => {
      const formData = {
        rules: '2024',
        level: 1,
        race: { name: 'High Elf' },
      };
      await getPreSelectedSpells(formData);
      expect(loadRaceData).toHaveBeenCalledWith('2024');
    });

    it('loads class data with the correct ruleset version', async () => {
      const formData = {
        rules: '2024',
        level: 3,
        class: { name: 'Wizard', subclass: { name: 'School of Evocation' } },
      };
      await getPreSelectedSpells(formData);
      expect(loadClassData).toHaveBeenCalledWith('2024');
    });

    it('loads feat data with the correct ruleset version', async () => {
      const formData = {
        rules: '2024',
        level: 1,
        feats: ['Magic Initiate'],
      };
      await getPreSelectedSpells(formData);
      expect(loadFeatData).toHaveBeenCalledWith('2024');
    });
  });

  describe('Druidic feature (2024 ruleset)', () => {
    it('adds Speak with Animals for Druid in 2024 ruleset', async () => {
      const formData = {
        rules: '2024',
        level: 1,
        class: { name: 'Druid' },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Speak with Animals');
    });

    it('does not add Speak with Animals for Druid in 5e ruleset', async () => {
      const formData = {
        rules: '5e',
        level: 1,
        class: { name: 'Druid' },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).not.toContain('Speak with Animals');
    });

    it('adds Speak with Animals for Druid with subclass in 2024', async () => {
      const mockClassesWithDruid = [
        ...mockClasses,
        { name: 'Druid', index: 'druid', subclasses: [{ name: 'Circle of the Land' }] },
      ];
      vi.mocked(loadClassData).mockResolvedValue(mockClassesWithDruid);

      const formData = {
        rules: '2024',
        level: 1,
        class: { name: 'Druid', subclass: { name: 'Circle of the Land' } },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).toContain('Speak with Animals');
    });

    it('does not add Speak with Animals for non-Druid classes in 2024', async () => {
      const formData = {
        rules: '2024',
        level: 1,
        class: { name: 'Wizard' },
      };
      const result = await getPreSelectedSpells(formData);
      expect(result).not.toContain('Speak with Animals');
    });
  });
});
