import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMonsterImageUrl } from '../../services/monsterUtils.js';

vi.mock('../../services/dataLoader.js', () => ({
  loadMonsters: vi.fn(() => Promise.resolve([
    { index: 'goblin', name: 'Goblin', image: true },
    { index: 'orc', name: 'Orc', image: true },
    { index: 'tarrasque', name: 'Tarrasque', image: false },
    { index: 'dragon', name: 'Ancient Dragon', image: true },
  ])),
}));

describe('monsterUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null for empty name', async () => {
    const result = await getMonsterImageUrl('');
    expect(result).toBeNull();
  });

  it('should return null for null name', async () => {
    const result = await getMonsterImageUrl(null);
    expect(result).toBeNull();
  });

  it('should return null for undefined name', async () => {
    const result = await getMonsterImageUrl(undefined);
    expect(result).toBeNull();
  });

  it('should return image URL for matching monster', async () => {
    const result = await getMonsterImageUrl('Goblin');
    expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg');
  });

  it('should do case-insensitive lookup', async () => {
    const result = await getMonsterImageUrl('gObLiN');
    expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg');
  });

  it('should strip trailing numbers from name', async () => {
    const result = await getMonsterImageUrl('Goblin 1');
    expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg');
  });

  it('should strip trailing multi-digit numbers', async () => {
    const result = await getMonsterImageUrl('Orc 42');
    expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/orc.jpg');
  });

  it('should return null when monster has image: false', async () => {
    const result = await getMonsterImageUrl('Tarrasque');
    expect(result).toBeNull();
  });

  it('should return null for non-existent monster', async () => {
    const result = await getMonsterImageUrl('Unicorn');
    expect(result).toBeNull();
  });

  it('should cache monsters after first call', async () => {
    await getMonsterImageUrl('Goblin');
    await getMonsterImageUrl('Orc');
    const { loadMonsters } = await import('../../services/dataLoader.js');
    expect(loadMonsters).toHaveBeenCalledTimes(1);
  });

  it('should handle multi-word monster names', async () => {
    const result = await getMonsterImageUrl('Ancient Dragon');
    expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/dragon.jpg');
  });

  it('should handle name with trailing number and multi-word base', async () => {
    const result = await getMonsterImageUrl('Ancient Dragon 3');
    expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/dragon.jpg');
  });
});
