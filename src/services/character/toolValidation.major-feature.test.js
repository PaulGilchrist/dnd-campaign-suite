import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadEquipment: vi.fn(async () => [
    { name: "Alchemist's Supplies", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
    { name: "Smith's Tools", equipment_category: 'Tools', tool_category: "Artisan's Tools" },
    { name: 'Dice Set', equipment_category: 'Tools', tool_category: 'Gaming Sets' },
  ]),
  fetchBackgroundData: vi.fn(async () => ({})),
  fetchClassData: vi.fn(),
  loadFeatData: vi.fn(async () => []),
}));

import {
  getToolLimitsByCategory,
  validateTools,
} from './toolValidation.js';

const fighterClassData = {
  name: 'Fighter',
  majors: [
    {
      name: 'Battle Master',
      proficiency_choices: null,
      features: [
        {
          name: 'Student of War',
          level: 3,
          proficiency_choices: [
            { choose: 1, from: ["Tool: Alchemist's Supplies", "Tool: Smith's Tools"] },
            { choose: 1, from: ['Skill: Acrobatics', 'Skill: History'] },
          ],
        },
      ],
    },
  ],
};

describe('toolValidation - major feature (Student of War) tool grants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(fighterClassData);
  });

  it('grants +1 Artisan\'s Tools category limit for Battle Master lv18', async () => {
    const result = await getToolLimitsByCategory({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    });

    expect(result.categoryLimits.get("Artisan's Tools")).toBe(1);
  });

  it('grants nothing below feature level (lv2)', async () => {
    const result = await getToolLimitsByCategory({
      rules: '2024',
      level: 2,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    });

    expect(result.categoryLimits.get("Artisan's Tools")).toBeUndefined();
  });

  it('does not add limits from skill-only major choices', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      name: 'Fighter',
      majors: [{
        name: 'Some Major',
        features: [{
          name: 'Skill Only',
          level: 3,
          proficiency_choices: [{ choose: 1, from: ['Skill: History'] }],
        }],
      }],
    });

    const result = await getToolLimitsByCategory({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Some Major' } },
    });

    expect(result.categoryLimits.size).toBe(0);
  });

  it('accumulates with background limits', async () => {
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      tool_proficiencies: 'Choose one kind of Artisan\'s Tools',
    });

    const result = await getToolLimitsByCategory({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
      background: 'Guild Artisan',
    });

    expect(result.categoryLimits.get("Artisan's Tools")).toBe(2);
  });

  it('validateTools accepts one Artisan\'s tool covered by the Student of War grant', async () => {
    const warnings = await validateTools({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
      toolProficiencies: ["Smith's Tools"],
    });

    const artisanWarnings = warnings.filter(w => w.message.includes("Artisan's Tools"));
    expect(artisanWarnings).toHaveLength(0);
  });

  it('validateTools still warns over the major-inclusive limit', async () => {
    const warnings = await validateTools({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
      toolProficiencies: ["Smith's Tools", "Alchemist's Supplies"],
    });

    const artisanWarnings = warnings.filter(w => w.message.includes("Artisan's Tools"));
    expect(artisanWarnings.length).toBeGreaterThan(0);
  });
});
