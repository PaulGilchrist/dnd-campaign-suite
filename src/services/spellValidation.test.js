import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from './dataLoader.js';

// Mock the dataLoader module
vi.mock('./dataLoader.js', () => ({
  loadClassData: vi.fn(),
  loadRaceData: vi.fn(),
  loadBackgroundData: vi.fn(),
  loadFeatData: vi.fn(),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
}));

// Import after mocking
import { 
  getClassSpellList, 
  getSpellSources,
  validateSpells,
  getSpellValidationInfo
} from './spellValidation.js';

describe('spellValidation', () => {
  beforeEach(() => {
      vi.clearAllMocks();
    });

  describe('getClassSpellList', () => {
      it('should return class spell list', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([
                { name: 'Wizard', index: 'wizard' }
              ]);

          const result = await getClassSpellList('Wizard', '5e');

          expect(result).toContain('Wizard');
        });

      it('should return empty array for unknown class', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([
                 { name: 'Wizard', index: 'wizard' }
               ]);

          const result = await getClassSpellList('Fighter', '5e');

          expect(result).toEqual([]);
       });
       });

  describe('extractRaceSpells (via getSpellSources)', () => {
      it('should extract spells from race traits in 2024 format', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
               {
                  name: 'Tiefling',
                  traits: [
                         { description: '<em>Darkness</em> and <em>Misty Step</em>' }
                      ]
                  }
              ]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const result = await getSpellSources({
              class: { name: 'Wizard' },
              race: { name: 'Tiefling' },
              background: { name: 'Acolyte' }
            }, '2024');

          expect(result.race.spells).toContain('Darkness');
          expect(result.race.spells).toContain('Misty Step');
        });

      it('should extract cantrips from race traits', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
               {
                  name: 'Tiefling',
                  traits: [
                         { description: '<em>Thaumaturgy</em> cantrip' }
                      ]
                  }
              ]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const result = await getSpellSources({
              class: { name: 'Wizard' },
              race: { name: 'Tiefling' },
              background: { name: 'Acolyte' }
            }, '2024');

          expect(result.race.cantrips).toContain('Thaumaturgy');
        });

      it('should return empty spells when race has no spells', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
                 { name: 'Human', traits: [] }
              ]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const result = await getSpellSources({
              class: { name: 'Wizard' },
              race: { name: 'Human' },
              background: { name: 'Acolyte' }
            }, '2024');

          expect(result.race.spells).toEqual([]);
          expect(result.race.cantrips).toEqual([]);
       });
       });

  describe('extractBackgroundSpells (via getSpellSources)', () => {
      it('should extract spells from background features', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([
               {
                  name: 'Spellseeker',
                  features: [
                           { description: ['You know the <em>Prestidigitation</em> cantrip.'] }
                      ]
                  }
              ]);

          const result = await getSpellSources({
              class: { name: 'Wizard' },
              race: { name: 'Human' },
              background: { name: 'Spellseeker' }
            }, '5e');

          expect(result.background.cantrips).toContain('Prestidigitation');
        });

      it('should return empty spells when background has no spells', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([
                 { name: 'Acolyte', features: [] }
              ]);

          const result = await getSpellSources({
              class: { name: 'Wizard' },
              race: { name: 'Human' },
              background: { name: 'Acolyte' }
            }, '5e');

          expect(result.background.spells).toEqual([]);
          expect(result.background.cantrips).toEqual([]);
       });
       });

  describe('extractFeatSpells (via getSpellSources)', () => {
      it('should handle Magic Initiate feat', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
                 { name: 'Magic Initiate' }
              ]);

          const result = await getSpellSources({
              class: { name: 'Wizard' },
              race: { name: 'Human' },
              background: { name: 'Acolyte' },
              feats: ['Magic Initiate']
            }, '5e');

          // Magic Initiate doesn't add specific spells, just grants spell list access
          expect(result.feats.spellListAccess).toContain('Any class (chosen by player)');
       });

      it('should handle Fey Touched feat', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
                 { name: 'Fey Touched' }
              ]);

          const result = await getSpellSources({
              class: { name: 'Wizard' },
              race: { name: 'Human' },
              background: { name: 'Acolyte' },
              feats: ['Fey Touched']
            }, '2024');

          // Fey Touched grants Misty Step and one other spell
          expect(result.feats.grantedSpells.length).toBeGreaterThan(0);
        });

      it('should handle Shadow Touched feat', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
                 { name: 'Shadow Touched' }
              ]);

          const result = await getSpellSources({
              class: { name: 'Wizard' },
              race: { name: 'Human' },
              background: { name: 'Acolyte' },
              feats: ['Shadow Touched']
            }, '2024');

          // Shadow Touched grants Invisibility and one Illusion/Necromancy spell
          expect(result.feats.grantedSpells.length).toBeGreaterThan(0);
        });
       });

  describe('validateSpells', () => {
      it('should return valid when no spells selected', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const result = await validateSpells(
                 { class: { name: 'Wizard' } },
                 [],
                 [],
                 '5e'
              );

          expect(result.valid).toBe(true);
          expect(result.warnings).toEqual([]);
        });

      it('should warn when spell not found in database', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const result = await validateSpells(
                 { class: { name: 'Wizard' } },
                 ['Unknown Spell'],
                 [],
                 '5e'
              );

          expect(result.valid).toBe(false);
          expect(result.warnings.some(w => w.message.includes('not found'))).toBe(true);
        });

      it('should warn when spells outside class list', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([
                 { name: 'Wizard', class_levels: [{ level: 1, spellcasting: true }] }
              ]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const allSpells = [
                 { name: 'Fireball', classes: ['Sorcerer', 'Wizard'], level: 3 },
                 { name: 'Cure Wounds', classes: ['Cleric', 'Druid'], level: 1 }
              ];

          const result = await validateSpells(
                 { class: { name: 'Wizard' } },
                 ['Fireball', 'Cure Wounds'],
                 allSpells,
                 '5e'
              );

          expect(result.warnings.some(w => w.message.includes('outside of the class spell list'))).toBe(true);
        });

      it('should not warn when spell is in class list', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([
                 { name: 'Wizard', class_levels: [{ level: 1, spellcasting: true }] }
              ]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const allSpells = [
                 { name: 'Fireball', classes: ['Sorcerer', 'Wizard'], level: 3 }
              ];

          const result = await validateSpells(
                 { class: { name: 'Wizard' } },
                 ['Fireball'],
                 allSpells,
                 '5e'
              );

          expect(result.warnings.some(w => w.message.includes('outside of the class spell list'))).toBe(false);
        });

      it('should not warn when spell is granted by race', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([
                 { name: 'Fighter', class_levels: [] }
              ]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
                {
                    name: 'Tiefling',
                    traits: [{ description: '<em>Darkness</em>' }]
                  }
      ]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const allSpells = [
                 { name: 'Darkness', classes: ['Sorcerer', 'Warlock'], level: 3 }
              ];

          const result = await validateSpells(
                 { class: { name: 'Fighter' }, race: { name: 'Tiefling' } },
                 ['Darkness'],
                 allSpells,
                 '5e'
              );

          // Darkness is granted by race, so should not warn about class list
          expect(result.warnings.filter(w => w.message.includes('outside of the class spell list')).length).toBe(0);
        });
       });

  describe('getSpellValidationInfo', () => {
      it('should return validation info with spell count', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const result = await getSpellValidationInfo(
                 { class: { name: 'Wizard' } },
                 ['Fireball'],
                 [{ name: 'Fireball', classes: ['Wizard'], level: 3 }],
                 '5e'
              );

          expect(result.spellCount).toBe(1);
          expect(result.isSpellcaster).toBe(false);
        });

      it('should return spell count of 0 when no spells selected', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const result = await getSpellValidationInfo(
              { class: { name: 'Wizard' } },
              [],
              [],
              '5e'
          );

          expect(result.spellCount).toBe(0);
      });
       });

  describe('getSpellSourceName (via getSpellSources)', () => {
    it('should identify spell source as race', async () => {
        vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
        vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
            { name: 'Elf', traits: [{ description: 'You know the <em>Darkvision</em> spell.' }] }
        ]);
        vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);

          const result = await getSpellSources(
              { race: { name: 'Elf' } },
              '5e'
          );

          expect(result.race.cantrips).toBeDefined();
      });

      it('should identify spell source as background', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([
              { name: 'Acolyte', features: [{ desc: ['You learn the <em>Guidance</em> cantrip.'] }] }
          ]);

          const result = await getSpellSources(
              { background: { name: 'Acolyte' } },
              '5e'
          );

          expect(result.background.cantrips).toBeDefined();
      });

      it('should identify spell source as feat', async () => {
          vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadRaceData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
          vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
              { name: 'Magic Initiate', desc: ['You learn two cantrips.'] }
          ]);

          const result = await getSpellSources(
              { feats: ['Magic Initiate'] },
              '5e'
          );

          expect(result.feats.spellListAccess).toBeDefined();
      });
       });
});
