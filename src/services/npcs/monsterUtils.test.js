import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(() => Promise.resolve([
    { index: 'goblin', name: 'Goblin' },
    { index: 'orc', name: 'Orc' },
    { index: 'tarrasque', name: 'Tarrasque' },
    { index: 'dragon', name: 'Ancient Dragon' },
  ])),
}));

vi.mock('../encounters/npcStatBlockUtils.js', () => ({
  npcToMonsterFormat: vi.fn((npc) => ({ ...npc, formatted: true })),
}));

describe('monsterUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('getMonsterImageUrl', () => {
    it('returns null for falsy or whitespace-only names', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      await Promise.all([
        expect(getMonsterImageUrl('')).resolves.toBeNull(),
        expect(getMonsterImageUrl(null)).resolves.toBeNull(),
        expect(getMonsterImageUrl(undefined)).resolves.toBeNull(),
        expect(getMonsterImageUrl('   ')).resolves.toBeNull(),
      ]);
    });

    it('returns null when monster is not in data and no campaign NPC image exists', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [{ name: 'Ghost', imagePath: null }];
      await expect(getMonsterImageUrl('Ghost', npcs)).resolves.toBeNull();
    });

    it('performs case-insensitive lookup on monster data with trailing number stripping', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      await expect(getMonsterImageUrl('gObLiN')).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
      await expect(getMonsterImageUrl('Goblin 1')).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
      await expect(getMonsterImageUrl('Orc 42')).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/orc.jpg'
      );
    });

    it('prefers campaign NPC avatar over monster data', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [{ name: 'Goblin', imagePath: '/custom/goblin.png' }];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe('/custom/goblin.png');
    });

    it('skips campaign NPCs with falsy imagePath and falls back to monster data', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [
        { name: 'Goblin', imagePath: null },
        { name: 'Orc', imagePath: '' },
        { name: 'Ancient Dragon', imagePath: false },
      ];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
      await expect(getMonsterImageUrl('Orc', npcs)).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/orc.jpg'
      );
      await expect(getMonsterImageUrl('Ancient Dragon', npcs)).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/dragon.jpg'
      );
    });

    it('prefers campaign NPC with valid imagePath even when monster data exists', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [{ name: 'Orc', imagePath: '/custom/orc.png' }];
      await expect(getMonsterImageUrl('Orc', npcs)).resolves.toBe('/custom/orc.png');
    });

    it('matches campaign NPCs case-insensitively with trailing number stripping', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [{ name: 'GOBLIN', imagePath: '/custom/goblin.png' }];
      await expect(getMonsterImageUrl('goblin 1', npcs)).resolves.toBe('/custom/goblin.png');
    });

    it('falls back to monster data when npcs array is empty, null, or undefined', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      await expect(getMonsterImageUrl('Goblin', [])).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
      await expect(getMonsterImageUrl('Goblin', null)).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
      await expect(getMonsterImageUrl('Goblin', undefined)).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
    });

    it('uses first campaign NPC with matching name and valid imagePath', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [
        { name: 'Goblin', imagePath: null },
        { name: 'Goblin', imagePath: '/custom/first.png' },
        { name: 'Goblin', imagePath: '/custom/second.png' },
      ];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe('/custom/first.png');
    });

    it('skips campaign NPCs with empty name and falls back to monster data', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [{ name: '', imagePath: '/custom/empty.png' }, { name: 'Goblin', imagePath: '/custom/goblin.png' }];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe('/custom/goblin.png');
    });
  });

  describe('getMonsterData', () => {
    it('returns null for falsy or whitespace-only names', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await Promise.all([
        expect(getMonsterData('')).resolves.toBeNull(),
        expect(getMonsterData(null)).resolves.toBeNull(),
        expect(getMonsterData(undefined)).resolves.toBeNull(),
        expect(getMonsterData('   ')).resolves.toBeNull(),
      ]);
    });

    it('returns null when monster is not found in data or campaign NPCs', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await expect(getMonsterData('Unicorn')).resolves.toBeNull();
      await expect(getMonsterData('Unicorn', [])).resolves.toBeNull();
    });

    it('performs case-insensitive lookup on monster data with trailing number stripping', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await expect(getMonsterData('gObLiN')).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
      await expect(getMonsterData('Goblin 1')).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
    });

    it('prefers campaign NPC with numeric armorClass over monster data', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [{ name: 'Goblin', armorClass: 15 }];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ name: 'Goblin', armorClass: 15, formatted: true });
    });

    it('skips campaign NPCs without numeric armorClass and falls back to monster data', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [
        { name: 'Goblin', armorClass: '15' },
        { name: 'Ancient Dragon' },
      ];
      await expect(getMonsterData('Goblin', npcs)).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
      await expect(getMonsterData('Ancient Dragon', npcs)).resolves.toEqual({
        index: 'dragon',
        name: 'Ancient Dragon',
      });
    });

    it('treats armorClass: 0 as a valid stat block', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [{ name: 'Orc', armorClass: 0 }];
      const result = await getMonsterData('Orc', npcs);
      expect(result).toEqual({ name: 'Orc', armorClass: 0, formatted: true });
    });

    it('matches campaign NPCs case-insensitively with trailing number stripping', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [{ name: 'GOBLIN', armorClass: 15 }];
      const result = await getMonsterData('goblin 1', npcs);
      expect(result).toEqual({ name: 'GOBLIN', armorClass: 15, formatted: true });
    });

    it('falls back to monster data when npcs array is empty, null, or undefined', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await expect(getMonsterData('Goblin', [])).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
      await expect(getMonsterData('Goblin', null)).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
      await expect(getMonsterData('Goblin', undefined)).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
    });

    it('uses first campaign NPC with matching name and numeric armorClass', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [
        { name: 'Goblin', armorClass: '10' },
        { name: 'Goblin', armorClass: 15 },
        { name: 'Goblin', armorClass: 20 },
      ];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ name: 'Goblin', armorClass: 15, formatted: true });
    });

    it('skips campaign NPCs with empty name and falls back to monster data', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [{ name: '', armorClass: 10 }, { name: 'Goblin', armorClass: 12 }];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ name: 'Goblin', armorClass: 12, formatted: true });
    });
  });
});
