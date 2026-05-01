import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getSpellLimits, 
  validateSpellSelection, 
  getAllSpellLimits,
  resetClassDataCache
} from './spell-limits';

// Mock fetch for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('spell-limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetClassDataCache();
   });
  describe('getSpellLimits', () => {
    it('should return default limits for non-spellcasting class', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Barbarian',
            index: 'barbarian',
            class_levels: [{ level: 1, spellcasting: null }]
            }
          ])
        });

      const limits = await getSpellLimits('Barbarian', 1, '5e');
      
      expect(limits.cantrip).toBe(2); // Barbarians get 2 cantrips
      expect(limits.level1).toBe(0);
      expect(limits.level9).toBe(0);
     });

    it('should return default limits for unknown class', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
       });

      const limits = await getSpellLimits('UnknownClass', 1, '5e');
      
      expect(limits.cantrip).toBe(0);
      expect(limits.level1).toBe(0);
     });

    it('should return spell limits for spellcasting class', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 3,
                  spell_slots_level_1: 2
                  }
                }
              ]
            }
          ])
        });

      const limits = await getSpellLimits('Wizard', 1, '5e');
      
      expect(limits.cantrip).toBe(3);
      expect(limits.level1).toBe(2);
      expect(limits.level2).toBe(0);
     });

    it('should handle class found by index', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 3,
                  spell_slots_level_1: 2
                  }
                }
              ]
            }
          ])
        });

      const limits = await getSpellLimits('wizard', 1, '5e');
      
      expect(limits.cantrip).toBe(3);
      expect(limits.level1).toBe(2);
     });

    it('should return default limits when no spellcasting at level', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Rogue',
            index: 'rogue',
            class_levels: [
               { level: 1, spellcasting: null },
               { level: 3, spellcasting: null }
             ]
           }
         ])
       });

      const limits = await getSpellLimits('Rogue', 3, '5e');
      
      expect(limits.cantrip).toBe(2); // Rogues get 2 cantrips
      expect(limits.level1).toBe(0);
     });

    it('should handle 2024 version with required_major mismatch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  required_major: 'Abjuration',
                  cantrips_known: 3,
                  spell_slots_level_1: 2
                 }
               }
             ]
           }
         ])
       });

      const limits = await getSpellLimits('Wizard', 1, '2024', 'Conjuration');
      
      expect(limits.cantrip).toBe(0); // Wrong major, should get defaults
      expect(limits.level1).toBe(0);
     });

    it('should handle 2024 version with matching required_major', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  required_major: 'Abjuration',
                  cantrips_known: 3,
                  spell_slots_level_1: 2
                 }
               }
             ]
           }
         ])
       });

      const limits = await getSpellLimits('Wizard', 1, '2024', 'Abjuration');
      
      expect(limits.cantrip).toBe(3);
      expect(limits.level1).toBe(2);
     });

    it('should handle fetch error gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const limits = await getSpellLimits('Wizard', 1, '5e');
      
      expect(limits.cantrip).toBe(0);
      expect(limits.level1).toBe(0);
     });

    it('should handle non-OK response', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const limits = await getSpellLimits('Wizard', 1, '5e');
      
      expect(limits.cantrip).toBe(0);
      expect(limits.level1).toBe(0);
     });

    it('should find spellcasting in subclass features for 2024', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Rogue',
            index: 'rogue',
            class_levels: [
               { level: 1, spellcasting: null },
               { level: 3, spellcasting: null }
             ],
            subclass: {
              name: 'Arcane Trickster',
              features: [
                 {
                  spellcasting: {
                    cantrips_known: 3,
                    spell_slots_level_1: 2
                   }
                 }
               ]
             }
           }
         ])
       });

      const limits = await getSpellLimits('Rogue', 3, '2024', 'Arcane Trickster');
      
      expect(limits.cantrip).toBe(3);
      expect(limits.level1).toBe(2);
     });

    it('should handle missing class_levels property', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           { name: 'Wizard', index: 'wizard' }
         ])
       });

      const limits = await getSpellLimits('Wizard', 1, '5e');
      
      expect(limits.cantrip).toBe(0);
      expect(limits.level1).toBe(0);
     });

    it('should convert all spell slot levels correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 9, 
                spellcasting: {
                  cantrips_known: 4,
                  spell_slots_level_1: 4,
                  spell_slots_level_2: 3,
                  spell_slots_level_3: 3,
                  spell_slots_level_4: 0,
                  spell_slots_level_5: 0,
                  spell_slots_level_6: 0,
                  spell_slots_level_7: 0,
                  spell_slots_level_8: 0,
                  spell_slots_level_9: 0
                 }
               }
             ]
           }
         ])
       });

      const limits = await getSpellLimits('Wizard', 9, '5e');
      
      expect(limits.cantrip).toBe(4);
      expect(limits.level1).toBe(4);
      expect(limits.level2).toBe(3);
      expect(limits.level3).toBe(3);
      expect(limits.level4).toBe(0);
      expect(limits.level9).toBe(0);
     });
   });

  describe('validateSpellSelection', () => {
    const mockSpells = [
       { name: 'Fire Bolt', level: 0 },
       { name: 'Magic Missile', level: 1 },
       { name: 'Fireball', level: 3 },
       { name: 'Light', level: 0 },
       { name: 'Shield', level: 1 }
     ];

    it('should return valid when within limits', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 3,
                  spell_slots_level_1: 2
                 }
               }
             ]
           }
         ])
       });

      const result = await validateSpellSelection(
         ['Fire Bolt', 'Magic Missile'],
        mockSpells,
         'Wizard',
         1,
         '5e'
       );

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.counts.cantrip).toBe(1);
      expect(result.counts.level1).toBe(1);
     });

    it('should detect cantrip limit violation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 2,
                  spell_slots_level_1: 2
                 }
               }
             ]
           }
         ])
       });

      const result = await validateSpellSelection(
         ['Fire Bolt', 'Light'], // 2 cantrips
        mockSpells,
         'Wizard',
         1,
         '5e'
       );

      expect(result.valid).toBe(true); // Exactly at limit
      expect(result.violations).toHaveLength(0);
     });

    it('should detect cantrip limit exceeded', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 1,
                  spell_slots_level_1: 2
                 }
               }
             ]
           }
         ])
       });

      const result = await validateSpellSelection(
         ['Fire Bolt', 'Light'], // 2 cantrips but limit is 1
        mockSpells,
         'Wizard',
         1,
         '5e'
       );

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('Cantrips: 2/1');
     });

    it('should detect level 1 spell limit violation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 3,
                  spell_slots_level_1: 1
                 }
               }
             ]
           }
         ])
       });

      const result = await validateSpellSelection(
         ['Magic Missile', 'Shield'], // 2 level 1 spells but limit is 1
        mockSpells,
         'Wizard',
         1,
         '5e'
       );

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('1st level: 2/1');
     });

    it('should detect multiple violations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 1,
                  spell_slots_level_1: 1,
                  spell_slots_level_3: 0
                 }
               }
             ]
           }
         ])
       });

      const result = await validateSpellSelection(
         ['Fire Bolt', 'Light', 'Magic Missile', 'Shield', 'Fireball'],
        mockSpells,
         'Wizard',
         1,
         '5e'
       );

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(1);
     });

    it('should handle empty spell selection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 3,
                  spell_slots_level_1: 2
                 }
               }
             ]
           }
         ])
       });

      const result = await validateSpellSelection(
         [],
        mockSpells,
         'Wizard',
         1,
         '5e'
       );

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
     });

    it('should handle null spell selection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 3,
                  spell_slots_level_1: 2
                 }
               }
             ]
           }
         ])
       });

      const result = await validateSpellSelection(
        null,
        mockSpells,
         'Wizard',
         1,
         '5e'
       );

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
     });

    it('should count spells by index when name not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 3,
                  spell_slots_level_1: 2
                 }
               }
             ]
           }
         ])
       });

      const result = await validateSpellSelection(
         ['fire-bolt'], // Using index instead of name
         [{ index: 'fire-bolt', level: 0 }],
         'Wizard',
         1,
         '5e'
       );

      expect(result.valid).toBe(true);
      expect(result.counts.cantrip).toBe(1);
     });

    it('should ignore unknown spells', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: [
               { 
                level: 1, 
                spellcasting: {
                  cantrips_known: 3,
                  spell_slots_level_1: 2
                 }
               }
             ]
           }
         ])
       });

      const result = await validateSpellSelection(
         ['Unknown Spell'],
        mockSpells,
         'Wizard',
         1,
         '5e'
       );

      expect(result.valid).toBe(true);
      expect(result.counts.cantrip).toBe(0);
     });
   });

  describe('getAllSpellLimits', () => {
    it('should return limits for all 20 levels', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
           {
            name: 'Wizard',
            index: 'wizard',
            class_levels: Array.from({ length: 20 }, (_, i) => ({
              level: i + 1,
              spellcasting: {
                cantrips_known: 3,
                spell_slots_level_1: 2
               }
             }))
           }
         ])
       });

      const limits = await getAllSpellLimits('Wizard', '5e');
      
      expect(Object.keys(limits)).toHaveLength(20);
      expect(limits[1]).toBeDefined();
      expect(limits[20]).toBeDefined();
     });

    it('should handle errors for each level gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const limits = await getAllSpellLimits('Wizard', '5e');
      
      expect(Object.keys(limits)).toHaveLength(20);
       // Each level should return default limits
      expect(limits[1].cantrip).toBe(0);
      expect(limits[20].cantrip).toBe(0);
     });
   });
});

