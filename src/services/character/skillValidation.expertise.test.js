import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchFeatData: vi.fn(),
  loadFeatData: vi.fn(),
  loadEquipment: vi.fn(async () => []),
}));

import { getExpertiseLimits } from './skillValidation.js';

describe('skillValidation — getExpertiseLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return expertise limits for a class with expertise feature', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [
        { level: 1, features: [] },
        {
          level: 2,
          features: [
            {
              name: 'Expertise',
              feature_specific: { expertise: { count: 2 } },
            },
          ],
        },
      ],
    });

    const result = await getExpertiseLimits({
      rules: '2024',
      class: { name: 'Rogue' },
      level: 2,
    });

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(2);
  });

  it('should return no expertise for class without expertise feature', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [
        { level: 1, features: [] },
        { level: 2, features: [{ name: 'Second Wind' }] },
      ],
    });

    const result = await getExpertiseLimits({
      rules: '2024',
      class: { name: 'Fighter' },
      level: 2,
    });

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(0);
  });

  it('should return no expertise when no class is selected', async () => {
    const result = await getExpertiseLimits({
      rules: '2024',
      level: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(0);
  });

  it('should parse expertise count from feature description', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [
        { level: 1, features: [] },
        {
          level: 2,
          features: [{ name: 'Expertise', desc: 'Choose 2 skills' }],
        },
      ],
    });

    const result = await getExpertiseLimits({
      rules: '2024',
      class: { name: 'Rogue' },
      level: 2,
    });

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(2);
  });

  it('should not count expertise if level is too low', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [
        { level: 1, features: [] },
        {
          level: 2,
          features: [
            {
              name: 'Expertise',
              feature_specific: { expertise: { count: 2 } },
            },
          ],
        },
      ],
    });

    const result = await getExpertiseLimits({
      rules: '2024',
      class: { name: 'Rogue' },
      level: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(0);
  });

  it('should handle subclass expertise for 2024 majors', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [{ level: 1, features: [] }],
      majors: [
        {
          name: 'Arcane Trickster',
          features: [
            { level: 3, name: 'Expertise', description: 'Choose 2 skills' },
          ],
        },
      ],
    });

    const result = await getExpertiseLimits({
      rules: '2024',
      class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } },
      level: 3,
    });

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(2);
  });

  it('should handle subclass expertise for 5e subclasses', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [{ level: 1, features: [] }],
      subclasses: [
        {
          name: 'Arcane Trickster',
          class_levels: [
            {
              level: 3,
              features: [
                { name: 'Expertise', description: 'Choose 2 skills' },
              ],
            },
          ],
        },
      ],
    });

    const result = await getExpertiseLimits({
      rules: '5e',
      class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } },
      level: 3,
    });

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(2);
  });

  it('should skip future class levels beyond current level', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [
        { level: 1, features: [] },
        { level: 2, features: [] },
        {
          level: 5,
          features: [
            { name: 'Expertise', feature_specific: { expertise: { count: 3 } } },
          ],
        },
      ],
    });

    const result = await getExpertiseLimits({
      rules: '2024',
      class: { name: 'Rogue' },
      level: 3,
    });

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(0);
  });

  it('should return no expertise when class data has no class_levels', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

    const result = await getExpertiseLimits({
      rules: '2024',
      class: { name: 'Wizard' },
      level: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(0);
  });

  it('should parse expertise from Ranger Deft Explorer feature description', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      class_levels: [
        { level: 1, features: [] },
        {
          level: 2,
          features: [
            {
              name: 'Deft Explorer',
              description: 'Expertise. Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill. Languages. You know two languages of your choice from the language tables.',
            },
          ],
        },
      ],
    });

    const result = await getExpertiseLimits({
      rules: '2024',
      class: { name: 'Ranger' },
      level: 2,
    });

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
  });
});
