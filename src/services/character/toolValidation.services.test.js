import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadEquipment: vi.fn(async () => []),
  fetchBackgroundData: vi.fn(),
  fetchClassData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import * as dataLoader from '../ui/dataLoader.js';

import {
  getToolsByCategory,
  computeSkilledToolUsage,
} from './toolValidation.js';

describe('toolValidation - getToolsByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array for null/undefined/empty category', async () => {
    expect(await getToolsByCategory(null)).toEqual([]);
    expect(await getToolsByCategory(undefined)).toEqual([]);
    expect(await getToolsByCategory('')).toEqual([]);
  });

  it('should return tools matching the normalized category and exclude non-tools', async () => {
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: "Alchemist's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
      { name: "Brewer's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
      { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
      { name: 'Longsword', equipment_category: 'Weapons', tool_category: null },
      { name: 'Shield', equipment_category: 'Armor', tool_category: null },
    ]);

    const result = await getToolsByCategory("Artisan's Tools");
    expect(result).toHaveLength(2);
    expect(result.map(t => t.name)).toContain("Alchemist's Supplies");
    expect(result.map(t => t.name)).toContain("Brewer's Supplies");
  });

  it('should normalize category before filtering (Musical Instruments -> Musical Instrument)', async () => {
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
      { name: 'Drum', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
    ]);

    const result = await getToolsByCategory('Musical Instruments');
    expect(result).toHaveLength(2);
  });
});

describe('toolValidation - computeSkilledToolUsage', () => {
  it('should return 0 for null/empty categoryLimits or null/undefined/empty selectedTools', () => {
    expect(computeSkilledToolUsage(null, ['Flute'], [], [])).toBe(0);
    expect(computeSkilledToolUsage(new Map(), ['Flute'], [], [])).toBe(0);
    expect(computeSkilledToolUsage(new Map([["Artisan's Tools", 2]]), null, [], [])).toBe(0);
    expect(computeSkilledToolUsage(new Map([["Artisan's Tools", 2]]), undefined, [], [])).toBe(0);
    expect(computeSkilledToolUsage(new Map([["Artisan's Tools", 2]]), [], [], [])).toBe(0);
  });

  it('should count tools allocated from Skilled when category limits are satisfied', () => {
    const limits = new Map([
      ["Artisan's Tools", 2],
      ['Gaming Sets', 1],
    ]);
    const selectedTools = ['Flute', "Alchemist's Supplies", "Brewer's Supplies", 'Dice'];
    const allTools = [
      { name: "Alchemist's Supplies", _category: "Artisan's Tools" },
      { name: "Brewer's Supplies", _category: "Artisan's Tools" },
      { name: 'Dice', _category: 'Gaming Sets' },
      { name: 'Flute', _category: 'Musical Instrument' },
    ];
    const toolCategories = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

    const result = computeSkilledToolUsage(limits, selectedTools, allTools, toolCategories);
    // Artisan's Tools: 2 selected in limit of 2 => 0 overflow
    // Gaming Sets: 1 selected in limit of 1 => 0 overflow
    // Musical Instrument: 1 selected (Flute) not in any category limit => counts as skilled
    expect(result).toBe(1);
  });

  it('should not count placeholder tools', () => {
    const limits = new Map([["Artisan's Tools", 1]]);
    const selectedTools = ['3 from: Flute', "Alchemist's Supplies"];
    const allTools = [
      { name: "Alchemist's Supplies", _category: "Artisan's Tools" },
    ];
    const toolCategories = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

    const result = computeSkilledToolUsage(limits, selectedTools, allTools, toolCategories);
    // Only "Alchemist's Supplies" is a user tool (1 in category limit of 1)
    // "3 from: Flute" is a placeholder, excluded
    // userSelectedTools = 1, categoryCovered = 1, result = max(0, 1-1) = 0
    expect(result).toBe(0);
  });

  it('should return excess when user selects more than category limits', () => {
    const limits = new Map([
      ["Artisan's Tools", 1],
    ]);
    const selectedTools = ["Alchemist's Supplies", "Brewer's Supplies", 'Dice'];
    const allTools = [
      { name: "Alchemist's Supplies", _category: "Artisan's Tools" },
      { name: "Brewer's Supplies", _category: "Artisan's Tools" },
      { name: 'Dice', _category: 'Gaming Sets' },
    ];
    const toolCategories = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

    const result = computeSkilledToolUsage(limits, selectedTools, allTools, toolCategories);
    // Artisan's Tools: 2 selected in limit of 1 => categoryCovered = 1
    // Gaming Sets: 1 selected not in any category limit
    // userSelectedTools = 3, categoryCovered = 1, result = max(0, 3-1) = 2
    expect(result).toBe(2);
  });

  it('should handle tools not in any known category', () => {
    const limits = new Map([["Artisan's Tools", 2]]);
    const selectedTools = ['Unknown Tool'];
    const allTools = [
      { name: "Alchemist's Supplies", _category: "Artisan's Tools" },
      { name: 'Unknown Tool', _category: 'Other Tools' },
    ];
    const toolCategories = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

    const result = computeSkilledToolUsage(limits, selectedTools, allTools, toolCategories);
    // Unknown Tool is in Other Tools which has no limit in the map
    // userSelectedTools = 1, categoryCovered = 0, result = max(0, 1-0) = 1
    expect(result).toBe(1);
  });

  it('should cap categoryCovered at the limit per category', () => {
    const limits = new Map([["Artisan's Tools", 2]]);
    const selectedTools = ["Alchemist's Supplies", "Brewer's Supplies", "Carver's Tools"];
    const allTools = [
      { name: "Alchemist's Supplies", _category: "Artisan's Tools" },
      { name: "Brewer's Supplies", _category: "Artisan's Tools" },
      { name: "Carver's Tools", _category: "Artisan's Tools" },
    ];
    const toolCategories = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

    const result = computeSkilledToolUsage(limits, selectedTools, allTools, toolCategories);
    // Artisan's Tools: 3 selected in limit of 2 => categoryCovered = min(3, 2) = 2
    // userSelectedTools = 3, categoryCovered = 2, result = max(0, 3-2) = 1
    expect(result).toBe(1);
  });

  it('should handle multiple categories with partial overflow', () => {
    const limits = new Map([
      ["Artisan's Tools", 1],
      ['Gaming Sets', 1],
    ]);
    const selectedTools = ["Alchemist's Supplies", "Brewer's Supplies", 'Dice', 'Cards', 'Flute'];
    const allTools = [
      { name: "Alchemist's Supplies", _category: "Artisan's Tools" },
      { name: "Brewer's Supplies", _category: "Artisan's Tools" },
      { name: 'Dice', _category: 'Gaming Sets' },
      { name: 'Cards', _category: 'Gaming Sets' },
      { name: 'Flute', _category: 'Musical Instrument' },
    ];
    const toolCategories = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

    const result = computeSkilledToolUsage(limits, selectedTools, allTools, toolCategories);
    // Artisan's Tools: 2 selected in limit of 1 => categoryCovered += 1
    // Gaming Sets: 2 selected in limit of 1 => categoryCovered += 1
    // Musical Instrument: 1 selected, no limit => not categoryCovered
    // userSelectedTools = 5, categoryCovered = 2, result = max(0, 5-2) = 3
    expect(result).toBe(3);
  });

  it('should handle selected tools that reference items not in allTools', () => {
    const limits = new Map([["Artisan's Tools", 2]]);
    const selectedTools = ['NonExistent Tool'];
    const allTools = [
      { name: "Alchemist's Supplies", _category: "Artisan's Tools" },
    ];
    const toolCategories = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

    const result = computeSkilledToolUsage(limits, selectedTools, allTools, toolCategories);
    // NonExistent Tool is not in any category set
    // userSelectedTools = 1, categoryCovered = 0, result = 1
    expect(result).toBe(1);
  });
});
