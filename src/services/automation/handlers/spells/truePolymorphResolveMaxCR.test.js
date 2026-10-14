import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: { getName: (fullName) => fullName || 'Unknown' },
}));

import { resolveTruePolymorphMaxCR } from './truePolymorphHandler.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';

const campaignName = 'TestCampaign';
const targetName = 'Goblin';

describe('truePolymorphHandler.resolveTruePolymorphMaxCR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns player level for a matching PC', async () => {
    const characters = [{ name: targetName, computedStats: { level: 7 } }];

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(7);
  });

  it('falls back to creature level field for a PC', async () => {
    const characters = [{ name: targetName, level: 5 }];

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(5);
  });

  it('returns monster challenge rating for NPCs', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: 3 });

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(3);
  });

  it('parses fractional challenge ratings', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '1/2' });

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(0.5);
  });

  it('defaults to CR 1 for custom NPCs without a challenge rating', async () => {
    getMonsterData.mockResolvedValue(null);

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(1);
  });

  it('matches a PC by exact name', async () => {
    const characters = [{ name: 'Goblin the Brave', computedStats: { level: 9 } }];

    const maxCR = await resolveTruePolymorphMaxCR('Goblin the Brave', campaignName, characters);

    expect(maxCR).toBe(9);
  });

  it('prefers computedStats.level over level field', async () => {
    const characters = [{ name: targetName, level: 3, computedStats: { level: 8 } }];

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(8);
  });

  it('returns DEFAULT_MAX_CR (1) when character has no level', async () => {
    const characters = [{ name: targetName }];

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(1);
  });

  it('returns DEFAULT_MAX_CR when level is 0', async () => {
    const characters = [{ name: targetName, computedStats: { level: 0 } }];

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(1);
  });

  it('skips characters with non-number level', async () => {
    const characters = [{ name: targetName, computedStats: { level: 'unknown' } }];
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '2' });

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(2);
  });

  it('returns 0 for empty fractional CR like "0/1"', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '0/1' });

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(0);
  });

  it('returns 0 for invalid CR string', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: 'invalid' });

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(0);
  });

  it('handles null challenge_rating', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: null });

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(1);
  });

  it('handles empty string challenge_rating', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '' });

    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(1);
  });
});
