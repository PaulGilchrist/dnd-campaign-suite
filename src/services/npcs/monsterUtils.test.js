import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMonsterImageUrl } from './monsterUtils.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(() => Promise.resolve([
    { index: 'goblin', name: 'Goblin' },
    { index: 'orc', name: 'Orc' },
    { index: 'tarrasque', name: 'Tarrasque' },
    { index: 'dragon', name: 'Ancient Dragon' },
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

  it('should return image URL for monster without image property', async () => {
    const result = await getMonsterImageUrl('Tarrasque');
    expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/tarrasque.jpg');
   });

  it('should return null for non-existent monster', async () => {
    const result = await getMonsterImageUrl('Unicorn');
    expect(result).toBeNull();
  });

  it('should cache monsters after first call', async () => {
    vi.resetModules();
    const { getMonsterImageUrl: freshGetMonsterImageUrl } = await import('./monsterUtils.js');
    await freshGetMonsterImageUrl('Goblin');
    await freshGetMonsterImageUrl('Orc');
    const { loadMonsters } = await import('../ui/dataLoader.js');
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
