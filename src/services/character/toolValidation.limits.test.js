import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadEquipment: vi.fn(async () => []),
  fetchBackgroundData: vi.fn(),
  fetchClassData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import {
  getToolLimitsByCategory,
  validateTools,
} from './toolValidation.js';

describe('toolValidation - getToolLimitsByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty limits for non-2024 ruleset', async () => {
    const result5e = await getToolLimitsByCategory({ rules: '5e' });
    expect(result5e.categoryLimits.size).toBe(0);
    expect(result5e.preSelected).toEqual([]);
    expect(result5e.skilledUsesAvailable).toBe(0);

    const resultMissing = await getToolLimitsByCategory({});
    expect(resultMissing.categoryLimits.size).toBe(0);
    expect(resultMissing.preSelected).toEqual([]);
    expect(resultMissing.skilledUsesAvailable).toBe(0);
  });

  it('should return empty limits when no class/background/feats on 2024', async () => {
    const result = await getToolLimitsByCategory({ rules: '2024' });
    expect(result.categoryLimits.size).toBe(0);
    expect(result.preSelected).toEqual([]);
    expect(result.skilledUsesAvailable).toBe(0);
  });

  it('should parse background tool choice with "Choose one type of A or B"', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: 'Choose one type of Gaming Sets or Musical Instruments',
    });

    const result = await getToolLimitsByCategory({
      rules: '2024',
      background: 'Charlatan',
    });

    expect(result.categoryLimits.get('Gaming Sets')).toBe(1);
    expect(result.categoryLimits.get('Musical Instrument')).toBe(1);
    expect(result.preSelected).toEqual([]);
  });

  it('should add preSelected for non-choice background tools', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: "Artisan's Tools",
    });

    const result = await getToolLimitsByCategory({
      rules: '2024',
      background: 'Artisan',
    });

    expect(result.categoryLimits.size).toBe(0);
    expect(result.preSelected).toContain("Artisan's Tools");
  });

  it('should parse class tool choice', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Gaming Sets or Musical Instruments",
    });

    const result = await getToolLimitsByCategory({
      rules: '2024',
      class: { name: 'Bard' },
    });

    expect(result.categoryLimits.get('Gaming Sets')).toBe(1);
    expect(result.categoryLimits.get('Musical Instrument')).toBe(1);
  });

  it('should add preSelected for non-choice class tools', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      tool_proficiencies: 'Gaming Sets',
    });

    const result = await getToolLimitsByCategory({
      rules: '2024',
      class: { name: 'Rogue' },
    });

    expect(result.preSelected).toContain('Gaming Sets');
  });

  it('should aggregate background + class tool limits for the same category', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Artisan's Tools",
    });
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Artisan's Tools",
    });

    const result = await getToolLimitsByCategory({
      rules: '2024',
      background: 'Artisan',
      class: { name: 'Rogue' },
    });

    expect(result.categoryLimits.get("Artisan's Tools")).toBe(2);
  });

  it('should handle Chef feat (auto-select Cook\'s Utensils, no limit)', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      {
        name: 'Chef',
        benefits: [
          { type: 'proficiency', description: 'You gain proficiency with Cook\'s Utensils' },
        ],
      },
    ]);

    const result = await getToolLimitsByCategory({
      rules: '2024',
      feats: ['Chef'],
    });

    expect(result.preSelected).toContain("Cook's Utensils");
    expect(result.categoryLimits.size).toBe(0);
  });

  it('should handle Skilled feat (isAny, tracked separately)', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      {
        name: 'Skilled',
        benefits: [
          { type: 'proficiency', description: 'You gain proficiency in any combination of three skills or tools of your choice' },
        ],
      },
    ]);

    const result = await getToolLimitsByCategory({
      rules: '2024',
      feats: ['Skilled'],
    });

    expect(result.skilledUsesAvailable).toBe(3);
    expect(result.categoryLimits.size).toBe(0);
  });

  it('should handle non-Skilled isAny feats (apply to all categories)', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      {
        name: 'Some Feat',
        benefits: [
          { type: 'proficiency', description: 'You gain proficiency in any combination of two skills or tools of your choice' },
        ],
      },
    ]);

    const result = await getToolLimitsByCategory({
      rules: '2024',
      feats: ['Some Feat'],
    });

    expect(result.categoryLimits.get("Artisan's Tools")).toBe(2);
    expect(result.categoryLimits.get('Gaming Sets')).toBe(2);
    expect(result.categoryLimits.get('Musical Instrument')).toBe(2);
    expect(result.categoryLimits.get('Other Tools')).toBe(2);
  });

  it('should handle feat with specific category (not isAny)', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      {
        name: 'Musician',
        benefits: [
          { type: 'proficiency', description: 'You gain proficiency with three Musical Instruments of your choice' },
        ],
      },
    ]);

    const result = await getToolLimitsByCategory({
      rules: '2024',
      feats: ['Musician'],
    });

    expect(result.categoryLimits.get('Musical Instrument')).toBe(3);
    expect(result.categoryLimits.has("Artisan's Tools")).toBe(false);
  });

  it('should skip feat that is not found in feat data', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

    const result = await getToolLimitsByCategory({
      rules: '2024',
      feats: ['NonExistentFeat'],
    });

    expect(result.categoryLimits.size).toBe(0);
    expect(result.skilledUsesAvailable).toBe(0);
  });

  it('should handle missing class/background gracefully (null or missing tools field)', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

    const resultNull = await getToolLimitsByCategory({
      rules: '2024',
      background: 'Unknown',
      class: { name: 'Unknown' },
    });

    expect(resultNull.categoryLimits.size).toBe(0);
    expect(resultNull.preSelected).toEqual([]);

    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

    const resultMissingField = await getToolLimitsByCategory({
      rules: '2024',
      background: 'Charlatan',
      class: { name: 'Bard' },
    });

    expect(resultMissingField.categoryLimits.size).toBe(0);
    expect(resultMissingField.preSelected).toEqual([]);
  });

  it('should aggregate multiple sources (background + class + feat)', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Artisan's Tools",
    });
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Artisan's Tools",
    });
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      {
        name: 'Musician',
        benefits: [{ type: 'proficiency', description: 'You gain proficiency with two Musical Instruments of your choice' }],
      },
    ]);

    const result = await getToolLimitsByCategory({
      rules: '2024',
      background: 'Artisan',
      class: { name: 'Rogue' },
      feats: ['Musician'],
    });

    expect(result.categoryLimits.get("Artisan's Tools")).toBe(2);
    expect(result.categoryLimits.get('Musical Instrument')).toBe(2);
  });

  it('should handle empty feats array and feats with no matching tool benefits', async () => {
    const resultEmpty = await getToolLimitsByCategory({
      rules: '2024',
      feats: [],
    });

    expect(resultEmpty.categoryLimits.size).toBe(0);
    expect(resultEmpty.skilledUsesAvailable).toBe(0);

    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      {
        name: 'Tough',
        benefits: [{ type: 'hit_points', description: 'Your hit point maximum increases' }],
      },
    ]);

    const resultNonTool = await getToolLimitsByCategory({
      rules: '2024',
      feats: ['Tough'],
    });

    expect(resultNonTool.categoryLimits.size).toBe(0);
    expect(resultNonTool.skilledUsesAvailable).toBe(0);
  });
});

describe('toolValidation - validateTools', () => {
  it('should return empty warnings for non-2024 ruleset', async () => {
    const warnings = await validateTools({ rules: '5e', toolProficiencies: ['Flute'] });
    expect(warnings).toEqual([]);
  });

  it('should return empty warnings when no tools selected (empty or missing)', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

    const warningsEmpty = await validateTools({
      rules: '2024',
      toolProficiencies: [],
    });
    expect(warningsEmpty).toEqual([]);

    const warningsMissing = await validateTools({
      rules: '2024',
    });
    expect(warningsMissing).toEqual([]);
  });

  it('should warn when selecting more tools than allowed in a category', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Artisan's Tools",
    });
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: "Alchemist's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
      { name: "Brewer's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
      { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
    ]);

    const warnings = await validateTools({
      rules: '2024',
      class: { name: 'Bard' },
      background: 'Artisan',
      toolProficiencies: ["Alchemist's Supplies", "Brewer's Supplies"],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('warning');
    expect(warnings[0].message).toContain('Artisan\'s Tools');
    expect(warnings[0].message).toContain('2');
    expect(warnings[0].message).toContain('1');
  });

  it('should warn when selecting tools from a category with 0 allowed', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
      { name: 'Drum', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
    ]);

    const warnings = await validateTools({
      rules: '2024',
      toolProficiencies: ['Flute', 'Drum'],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('warning');
    expect(warnings[0].message).toContain('Musical Instrument');
    expect(warnings[0].message).toContain('do not grant any');
  });

  it('should not warn when Skilled covers the overflow', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      {
        name: 'Skilled',
        benefits: [{ type: 'proficiency', description: 'You gain proficiency in any combination of three skills or tools of your choice' }],
      },
    ]);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
      { name: 'Drum', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
    ]);

    const warnings = await validateTools({
      rules: '2024',
      toolProficiencies: ['Flute', 'Drum'],
      feats: ['Skilled'],
    });

    expect(warnings).toEqual([]);
  });

  it('should not warn for pre-selected or placeholder tools', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: "Artisan's Tools",
    });
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: "Alchemist's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
    ]);

    const warningsPreSelected = await validateTools({
      rules: '2024',
      background: 'Artisan',
      toolProficiencies: ["Artisan's Tools"],
    });
    expect(warningsPreSelected).toEqual([]);

    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});

    const warningsPlaceholder = await validateTools({
      rules: '2024',
      toolProficiencies: ['3 from: Flute'],
    });
    expect(warningsPlaceholder).toEqual([]);

    const warningsMultiPlaceholder = await validateTools({
      rules: '2024',
      toolProficiencies: ['1 from: Flute', '2 from: Drum'],
    });
    expect(warningsMultiPlaceholder).toEqual([]);
  });

  it('should not warn when overflow is within Skilled pool', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Artisan's Tools",
    });
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Artisan's Tools",
    });
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      {
        name: 'Skilled',
        benefits: [{ type: 'proficiency', description: 'You gain proficiency in any combination of two skills or tools of your choice' }],
      },
    ]);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: "Alchemist's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
      { name: "Brewer's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
      { name: 'Painting Kit', equipment_category: 'Tools', tool_category: "Artisan's Tools" },
    ]);

    const warnings = await validateTools({
      rules: '2024',
      background: 'Artisan',
      class: { name: 'Rogue' },
      toolProficiencies: ["Alchemist's Supplies", "Brewer's Supplies", 'Painting Kit'],
      feats: ['Skilled'],
    });

    expect(warnings).toEqual([]);
  });

  it('should generate warning when overflow exceeds Skilled pool', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Artisan's Tools",
    });
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      tool_proficiencies: "Choose one type of Artisan's Tools",
    });
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      {
        name: 'Skilled',
        benefits: [{ type: 'proficiency', description: 'You gain proficiency in any combination of two skills or tools of your choice' }],
      },
    ]);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: "Alchemist's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
      { name: "Brewer's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
      { name: 'Painting Kit', equipment_category: 'Tools', tool_category: "Artisan's Tools" },
      { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
      { name: 'Drum', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
    ]);

    const warnings = await validateTools({
      rules: '2024',
      background: 'Artisan',
      class: { name: 'Rogue' },
      toolProficiencies: ["Alchemist's Supplies", "Brewer's Supplies", 'Painting Kit', 'Flute', 'Drum'],
      feats: ['Skilled'],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('Musical Instrument');
  });

  it('should combine warnings from multiple categories', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
      { name: 'Drum', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
      { name: 'Dice', equipment_category: 'Tools', tool_category: 'Gaming Sets' },
      { name: 'Cards', equipment_category: 'Tools', tool_category: 'Gaming Sets' },
    ]);

    const warnings = await validateTools({
      rules: '2024',
      toolProficiencies: ['Flute', 'Drum', 'Dice', 'Cards'],
    });

    expect(warnings).toHaveLength(2);
    const musicalWarning = warnings.find(w => w.message.includes('Musical Instrument'));
    const gamingWarning = warnings.find(w => w.message.includes('Gaming Sets'));
    expect(musicalWarning).toBeDefined();
    expect(gamingWarning).toBeDefined();
  });

  it('should list selected tool names in the warning message', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: 'Flute', equipment_category: 'Tools', tool_category: 'Musical Instrument' },
    ]);

    const warnings = await validateTools({
      rules: '2024',
      toolProficiencies: ['Flute'],
    });

    expect(warnings[0].message).toContain('Flute');
  });

  it('should warn when pre-selected tools leave user selections over the limit', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: "Artisan's Tools",
    });
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
    vi.mocked(dataLoader.loadEquipment).mockResolvedValue([
      { name: "Alchemist's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
    ]);

    const warnings = await validateTools({
      rules: '2024',
      background: 'Artisan',
      toolProficiencies: ["Alchemist's Supplies", "Artisan's Tools"],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('Artisan\'s Tools');
  });

  it('should handle missing formData gracefully', async () => {
    const warnings = await validateTools({});
    expect(warnings).toEqual([]);
  });
});
