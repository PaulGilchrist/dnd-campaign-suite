import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMonsterData, getMonsterImageUrl } from './monsterUtils.js';

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
  });

  describe('getMonsterImageUrl', () => {
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

    it('should return null for non-existent monster', async () => {
      const result = await getMonsterImageUrl('Unicorn');
      expect(result).toBeNull();
    });

    it('should check campaign NPCs first for avatar image', async () => {
      const npcs = [
        { name: 'Goblin', imagePath: '/custom/goblin.png' },
        { name: 'Orc', imagePath: '/custom/orc.png' },
      ];
      const result = await getMonsterImageUrl('Goblin', npcs);
      expect(result).toBe('/custom/goblin.png');
    });

    it('should check campaign NPCs with case-insensitive matching', async () => {
      const npcs = [
        { name: 'GOBLIN', imagePath: '/custom/goblin.png' },
      ];
      const result = await getMonsterImageUrl('goblin', npcs);
      expect(result).toBe('/custom/goblin.png');
    });

    it('should match campaign NPC when input has trailing number', async () => {
      const npcs = [
        { name: 'Goblin', imagePath: '/custom/goblin.png' },
      ];
      const result = await getMonsterImageUrl('Goblin 1', npcs);
      expect(result).toBe('/custom/goblin.png');
    });

    it('should fall back to monster data when campaign NPC has no image', async () => {
      const npcs = [
        { name: 'Goblin' },
      ];
      const result = await getMonsterImageUrl('Goblin', npcs);
      expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg');
    });

    it('should skip campaign NPCs without imagePath', async () => {
      const npcs = [
        { name: 'Goblin', imagePath: null },
        { name: 'Orc', imagePath: '/custom/orc.png' },
      ];
      const result = await getMonsterImageUrl('Orc', npcs);
      expect(result).toBe('/custom/orc.png');
    });

    it('should skip campaign NPCs when npcs array is empty', async () => {
      const result = await getMonsterImageUrl('Goblin', []);
      expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg');
    });

    it('should skip campaign NPCs when npcs is null', async () => {
      const result = await getMonsterImageUrl('Goblin', null);
      expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg');
    });

    it('should skip campaign NPCs when npcs is undefined', async () => {
      const result = await getMonsterImageUrl('Goblin', undefined);
      expect(result).toBe('https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg');
    });
  });

  describe('getMonsterData', () => {
    it('should return null for empty name', async () => {
      const result = await getMonsterData('');
      expect(result).toBeNull();
    });

    it('should return null for null name', async () => {
      const result = await getMonsterData(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined name', async () => {
      const result = await getMonsterData(undefined);
      expect(result).toBeNull();
    });

    it('should return monster data for matching monster', async () => {
      const result = await getMonsterData('Goblin');
      expect(result).toEqual({ index: 'goblin', name: 'Goblin' });
    });

    it('should do case-insensitive lookup', async () => {
      const result = await getMonsterData('gObLiN');
      expect(result).toEqual({ index: 'goblin', name: 'Goblin' });
    });

    it('should strip trailing numbers from name', async () => {
      const result = await getMonsterData('Goblin 1');
      expect(result).toEqual({ index: 'goblin', name: 'Goblin' });
    });

    it('should return null for non-existent monster', async () => {
      const result = await getMonsterData('Unicorn');
      expect(result).toBeNull();
    });

    it('should check campaign NPCs with stat blocks first', async () => {
      const npcs = [
        { name: 'Goblin', armorClass: 15 },
        { name: 'Orc', armorClass: 12 },
      ];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ name: 'Goblin', armorClass: 15, formatted: true });
    });

    it('should skip campaign NPCs without armorClass number', async () => {
      const npcs = [
        { name: 'Goblin', armorClass: '15' },
      ];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ index: 'goblin', name: 'Goblin' });
    });

    it('should skip campaign NPCs without armorClass property', async () => {
      const npcs = [
        { name: 'Goblin' },
      ];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ index: 'goblin', name: 'Goblin' });
    });

    it('should fall back to monster data when campaign NPC has no stat block', async () => {
      const npcs = [
        { name: 'Goblin' },
      ];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ index: 'goblin', name: 'Goblin' });
    });

    it('should check campaign NPCs with case-insensitive matching', async () => {
      const npcs = [
        { name: 'GOBLIN', armorClass: 15 },
      ];
      const result = await getMonsterData('goblin', npcs);
      expect(result).toEqual({ name: 'GOBLIN', armorClass: 15, formatted: true });
    });

    it('should skip campaign NPCs when npcs array is empty', async () => {
      const result = await getMonsterData('Goblin', []);
      expect(result).toEqual({ index: 'goblin', name: 'Goblin' });
    });
  });
});
