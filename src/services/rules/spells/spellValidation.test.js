// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../../ui/dataLoader.js';

vi.mock('../../ui/dataLoader.js', () => ({
  loadClassData: vi.fn(),
  loadRaceData: vi.fn(),
  loadBackgroundData: vi.fn(),
  loadFeatData: vi.fn(),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
}));

import {
  getClassSpellList,
  getSpellSources,
  validateSpells,
  getSpellValidationInfo,
} from './spellValidation.js';

// --- Helpers ---

function mockAllLoadersEmpty() {
  vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
}

function mockWizardSpellcaster() {
  vi.mocked(dataLoader.loadClassData).mockResolvedValue([
    { name: 'Wizard', class_levels: [{ level: 1, spellcasting: true }] },
  ]);
  vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
}

const wizardFormData = { class: { name: 'Wizard' } };
const allSpells = [
  { name: 'Fireball', classes: ['Sorcerer', 'Wizard'], level: 3 },
  { name: 'Cure Wounds', classes: ['Cleric', 'Druid'], level: 1 },
  { name: 'Darkness', classes: ['Sorcerer', 'Warlock'], level: 3 },
  { name: 'Misty Step', classes: ['Sorcerer', 'Warlock'], level: 2 },
  { name: 'Invisibility', classes: ['Bard', 'Sorcerer', 'Wizard'], level: 2 },
  { name: 'Detect Thoughts', classes: ['Bard', 'Wizard'], level: 2 },
  { name: 'Prestidigitation', classes: ['Bard', 'Sorcerer', 'Wizard'], level: 0 },
  { name: 'Guidance', classes: ['Cleric'], level: 0 },
  { name: 'Thaumaturgy', classes: ['Cleric'], level: 0 },
];

// --- Tests ---

describe('spellValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getClassSpellList', () => {
    it('returns the class name when the class exists', async () => {
      vi.mocked(dataLoader.loadClassData).mockResolvedValue([
        { name: 'Wizard', index: 'wizard' },
      ]);

      const result = await getClassSpellList('Wizard', '5e');

      expect(result).toEqual(['Wizard']);
    });

    it('returns empty array when class is not found', async () => {
      vi.mocked(dataLoader.loadClassData).mockResolvedValue([
        { name: 'Wizard', index: 'wizard' },
      ]);

      const result = await getClassSpellList('Fighter', '5e');

      expect(result).toEqual([]);
    });
  });

  describe('getSpellSources', () => {
    describe('class spellcasting detection', () => {
      it('marks a spellcaster class correctly', async () => {
        mockWizardSpellcaster();

        const result = await getSpellSources(wizardFormData, '5e');

        expect(result.class.isSpellcaster).toBe(true);
        expect(result.class.spellList).toEqual(['Wizard']);
      });

      it('marks a non-spellcaster class correctly', async () => {
        vi.mocked(dataLoader.loadClassData).mockResolvedValue([
          { name: 'Fighter', class_levels: [{ level: 1 }] },
        ]);
        vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

        const result = await getSpellSources({ class: { name: 'Fighter' } }, '5e');

        expect(result.class.isSpellcaster).toBe(false);
      });

      it('returns empty class data when no class provided', async () => {
        mockAllLoadersEmpty();

        const result = await getSpellSources({}, '5e');

        expect(result.class.name).toBe('');
        expect(result.class.isSpellcaster).toBe(false);
        expect(result.class.spellList).toEqual([]);
      });
    });

    describe('race spell extraction', () => {
      it('extracts spells from 2024 race traits using <em> tags', async () => {
        vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
          {
            name: 'Tiefling',
            traits: [{ description: '<em>Darkness</em> and <em>Misty Step</em>' }],
          },
        ]);
        vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, race: { name: 'Tiefling' } },
          '2024',
        );

        expect(result.race.spells).toContain('Darkness');
        expect(result.race.spells).toContain('Misty Step');
      });

      it('extracts cantrips from 2024 race traits using cantrip keyword', async () => {
        vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
          {
            name: 'Tiefling',
            traits: [{ description: '<em>Thaumaturgy</em> cantrip' }],
          },
        ]);
        vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, race: { name: 'Tiefling' } },
          '2024',
        );

        expect(result.race.cantrips).toContain('Thaumaturgy');
      });

      it('extracts spells from 5e race traits with array descriptions', async () => {
        vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
          {
            name: 'Elf',
            traits: [
              { description: ['You know the <em>Guidance</em> cantrip.'] },
            ],
          },
        ]);
        vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, race: { name: 'Elf' } },
          '5e',
        );

        expect(result.race.cantrips).toContain('Guidance');
      });

      it('extracts spells from subraces', async () => {
        vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
          {
            name: 'Tiefling',
            subraces: [
              {
                name: 'Asimov',
                description: '<em>Invisibility</em> at will',
              },
            ],
          },
        ]);
        vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, race: { name: 'Tiefling' } },
          '2024',
        );

        expect(result.race.spells).toContain('Invisibility');
      });

      it('returns empty arrays when race data is missing or null', async () => {
        mockAllLoadersEmpty();

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, race: null },
          '5e',
        );

        expect(result.race.spells).toEqual([]);
        expect(result.race.cantrips).toEqual([]);
      });
    });

    describe('background spell extraction', () => {
      it('extracts cantrips from background features', async () => {
        vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([
          {
            name: 'Spellseeker',
            features: [
              { description: ['You know the <em>Prestidigitation</em> cantrip.'] },
            ],
          },
        ]);
        vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, background: { name: 'Spellseeker' } },
          '5e',
        );

        expect(result.background.cantrips).toContain('Prestidigitation');
      });

      it('returns empty arrays when background data is missing', async () => {
        mockAllLoadersEmpty();

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, background: { name: 'Nonexistent' } },
          '5e',
        );

        expect(result.background.spells).toEqual([]);
        expect(result.background.cantrips).toEqual([]);
      });
    });

    describe('feat spell extraction', () => {
      it('grants spell list access for Magic Initiate', async () => {
        mockAllLoadersEmpty();
        vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
          { name: 'Magic Initiate' },
        ]);

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, feats: ['Magic Initiate'] },
          '5e',
        );

        expect(result.feats.spellListAccess).toContain(
          'Any class (chosen by player)',
        );
      });

      it('grants specific spells for feat-based spell sources', async () => {
        mockAllLoadersEmpty();
        vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
          { name: 'Fey Touched' },
          { name: 'Shadow Touched' },
          { name: 'Telepathy' },
        ]);

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, feats: ['Fey Touched', 'Shadow Touched', 'Telepathy'] },
          '2024',
        );

        expect(result.feats.grantedSpells).toContain('Misty Step');
        expect(result.feats.grantedSpells).toContain('Invisibility');
        expect(result.feats.grantedSpells).toContain('Detect Thoughts');
      });

      it('handles unknown feat names gracefully', async () => {
        mockAllLoadersEmpty();

        const result = await getSpellSources(
          { class: { name: 'Wizard' }, feats: ['Nonexistent Feat'] },
          '5e',
        );

        expect(result.feats.grantedSpells).toEqual([]);
        expect(result.feats.grantedCantrips).toEqual([]);
      });

      it('returns empty arrays when no feats provided', async () => {
        mockAllLoadersEmpty();

        const result = await getSpellSources(
          { class: { name: 'Wizard' } },
          '5e',
        );

        expect(result.feats.grantedSpells).toEqual([]);
        expect(result.feats.grantedCantrips).toEqual([]);
        expect(result.feats.spellListAccess).toEqual([]);
      });
    });
  });

  describe('validateSpells', () => {
    it('returns valid when no spells selected', async () => {
      mockAllLoadersEmpty();

      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        [],
        [],
        '5e',
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('warns when a spell is not found in the database', async () => {
      mockAllLoadersEmpty();

      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Unknown Spell'],
        [],
        '5e',
      );

      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Unknown Spell');
      expect(result.warnings[0].message).toContain('not found');
    });

    it('warns when a spell is outside the class spell list', async () => {
      mockWizardSpellcaster();

      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Cure Wounds'],
        allSpells,
        '5e',
      );

      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('outside of the class spell list');
    });

    it('does not warn when a spell is on the class spell list', async () => {
      mockWizardSpellcaster();

      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Fireball'],
        allSpells,
        '5e',
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('does not warn when a spell is granted by race', async () => {
      vi.mocked(dataLoader.loadClassData).mockResolvedValue([
        { name: 'Fighter', class_levels: [] },
      ]);
      vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
        {
          name: 'Tiefling',
          traits: [{ description: '<em>Darkness</em>' }],
        },
      ]);
      vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

      const result = await validateSpells(
        { class: { name: 'Fighter' }, race: { name: 'Tiefling' } },
        ['Darkness'],
        allSpells,
        '5e',
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('does not warn when a spell is granted by background', async () => {
      mockWizardSpellcaster();
      vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([
        {
          name: 'Spellseeker',
          features: [
            { description: ['You know the <em>Prestidigitation</em> cantrip.'] },
          ],
        },
      ]);

      const result = await validateSpells(
        { class: { name: 'Wizard' }, background: { name: 'Spellseeker' } },
        ['Prestidigitation'],
        allSpells,
        '5e',
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('does not warn when a spell is granted by feat', async () => {
      mockWizardSpellcaster();
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
        { name: 'Fey Touched' },
      ]);

      const result = await validateSpells(
        { class: { name: 'Wizard' }, feats: ['Fey Touched'] },
        ['Misty Step'],
        allSpells,
        '2024',
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('warns about multiple spells outside the class list in a single warning', async () => {
      mockWizardSpellcaster();

      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Cure Wounds', 'Guidance'],
        allSpells,
        '5e',
      );

      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('2');
      expect(result.warnings[0].message).toContain('Spell(s)');
    });

    it('allows Fighter and Rogue classes to use Wizard spells', async () => {
      for (const className of ['Fighter', 'Rogue']) {
        vi.mocked(dataLoader.loadClassData).mockResolvedValue([
          { name: className, class_levels: [] },
        ]);
        vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

        const result = await validateSpells(
          { class: { name: className } },
          ['Fireball'],
          allSpells,
          '5e',
        );

        expect(result.valid).toBe(true);
        expect(result.warnings).toEqual([]);
      }
    });

    it('handles explicitly granted spells via grantedSpells parameter', async () => {
      mockWizardSpellcaster();

      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Darkness'],
        allSpells,
        '5e',
        ['Darkness'],
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('warns when both unknown and off-list spells are selected', async () => {
      mockAllLoadersEmpty();

      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Unknown Spell', 'Cure Wounds'],
        allSpells,
        '5e',
      );

      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(2);
    });

    it('allows cantrips from class spell list', async () => {
      mockWizardSpellcaster();

      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Prestidigitation'],
        allSpells,
        '5e',
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('handles null selectedSpells gracefully', async () => {
      mockAllLoadersEmpty();

      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        null,
        [],
        '5e',
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('getSpellValidationInfo', () => {
    it('returns validation info with spell count and sources', async () => {
      mockAllLoadersEmpty();

      const result = await getSpellValidationInfo(
        { class: { name: 'Wizard' } },
        ['Fireball'],
        [{ name: 'Fireball', classes: ['Wizard'], level: 3 }],
        '5e',
      );

      expect(result.spellCount).toBe(1);
      expect(result.isSpellcaster).toBe(false);
      expect(result.sources).toBeDefined();
      expect(result.sources.class).toBeDefined();
      expect(result.sources.race).toBeDefined();
      expect(result.sources.background).toBeDefined();
      expect(result.sources.feats).toBeDefined();
      expect(result.classSpellList).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.valid).toBeDefined();
    });

    it('returns spell count of 0 when no spells are selected or selectedSpells is null', async () => {
      mockAllLoadersEmpty();

      const result1 = await getSpellValidationInfo(
        { class: { name: 'Wizard' } },
        [],
        [],
        '5e',
      );

      expect(result1.spellCount).toBe(0);

      const result2 = await getSpellValidationInfo(
        { class: { name: 'Wizard' } },
        null,
        [],
        '5e',
      );

      expect(result2.spellCount).toBe(0);
    });

    it('includes validation warnings from validateSpells', async () => {
      mockAllLoadersEmpty();

      const result = await getSpellValidationInfo(
        { class: { name: 'Wizard' } },
        ['Unknown Spell'],
        [],
        '5e',
      );

      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('not found');
    });
  });
});
