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
    // Reset module-level cache between tests
    vi.resetModules();
  });

  describe('getMonsterImageUrl', () => {
    it('returns null for empty, null, undefined, and whitespace-only names', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      await Promise.all([
        expect(getMonsterImageUrl('')).resolves.toBeNull(),
        expect(getMonsterImageUrl(null)).resolves.toBeNull(),
        expect(getMonsterImageUrl(undefined)).resolves.toBeNull(),
        expect(getMonsterImageUrl('   ')).resolves.toBeNull(),
      ]);
    });

    it('returns null for non-existent monster', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      await expect(getMonsterImageUrl('Unicorn')).resolves.toBeNull();
    });

    it('performs case-insensitive lookup on monster data', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      await expect(getMonsterImageUrl('gObLiN')).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
    });

    it('strips trailing numbers from name before lookup', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
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

    it('skips campaign NPCs without imagePath', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [
        { name: 'Goblin', imagePath: null },
        { name: 'Orc', imagePath: '/custom/orc.png' },
      ];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
      await expect(getMonsterImageUrl('Orc', npcs)).resolves.toBe('/custom/orc.png');
    });

    it('skips campaign NPCs with falsy imagePath values', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [
        { name: 'Goblin', imagePath: '' },
        { name: 'Orc', imagePath: 0 },
        { name: 'Dragon', imagePath: false },
      ];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
      await expect(getMonsterImageUrl('Orc', npcs)).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/orc.jpg'
      );
      await expect(getMonsterImageUrl('Dragon', npcs)).resolves.toBeNull();
    });

    it('falls back to monster data when campaign NPC has no image', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [{ name: 'Goblin' }];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe(
        'https://paulgilchrist.github.io/dnd-tools/images/goblin.jpg'
      );
    });

    it('matches campaign NPCs case-insensitively with trailing number stripping', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [{ name: 'GOBLIN', imagePath: '/custom/goblin.png' }];
      await expect(getMonsterImageUrl('goblin 1', npcs)).resolves.toBe('/custom/goblin.png');
    });

    it('falls back gracefully when npcs is empty, null, or undefined', async () => {
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

    it('handles campaign NPCs with empty name by falling back to monster data', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [{ name: '', imagePath: '/custom/empty.png' }, { name: 'Goblin', imagePath: '/custom/goblin.png' }];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe('/custom/goblin.png');
    });

    it('returns null when campaign NPC name exists but monster data lookup also fails', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [{ name: 'Ghost', imagePath: '/custom/ghost.png' }];
      await expect(getMonsterImageUrl('Ghost', npcs)).resolves.toBe('/custom/ghost.png');
    });
  });

  describe('getMonsterData', () => {
    it('returns null for empty, null, undefined, and whitespace-only names', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await Promise.all([
        expect(getMonsterData('')).resolves.toBeNull(),
        expect(getMonsterData(null)).resolves.toBeNull(),
        expect(getMonsterData(undefined)).resolves.toBeNull(),
        expect(getMonsterData('   ')).resolves.toBeNull(),
      ]);
    });

    it('returns null for non-existent monster', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await expect(getMonsterData('Unicorn')).resolves.toBeNull();
    });

    it('performs case-insensitive lookup on monster data', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await expect(getMonsterData('gObLiN')).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
    });

    it('strips trailing numbers from name before lookup', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await expect(getMonsterData('Goblin 1')).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
    });

    it('prefers campaign NPC with stat block over monster data', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const { npcToMonsterFormat } = await import('../encounters/npcStatBlockUtils.js');
      const npcs = [{ name: 'Goblin', armorClass: 15 }];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ name: 'Goblin', armorClass: 15, formatted: true });
      expect(npcToMonsterFormat).toHaveBeenCalledWith({ name: 'Goblin', armorClass: 15 });
    });

    it('skips campaign NPCs without armorClass or with non-number armorClass', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [
        { name: 'Goblin', armorClass: '15' },
        { name: 'Orc', armorClass: 0 },
        { name: 'Dragon' },
      ];
      await expect(getMonsterData('Goblin', npcs)).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
      // armorClass: 0 is a valid number, so Orc should match
      await expect(getMonsterData('Orc', npcs)).resolves.toEqual({
        name: 'Orc',
        armorClass: 0,
        formatted: true,
      });
    });

    it('falls back to monster data when campaign NPC has no stat block', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [{ name: 'Goblin' }];
      await expect(getMonsterData('Goblin', npcs)).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
    });

    it('matches campaign NPCs case-insensitively with trailing number stripping', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const { npcToMonsterFormat } = await import('../encounters/npcStatBlockUtils.js');
      const npcs = [{ name: 'GOBLIN', armorClass: 15 }];
      const result = await getMonsterData('goblin 1', npcs);
      expect(result).toEqual({ name: 'GOBLIN', armorClass: 15, formatted: true });
      expect(npcToMonsterFormat).toHaveBeenCalledWith({ name: 'GOBLIN', armorClass: 15 });
    });

    it('falls back gracefully when npcs array is empty', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await expect(getMonsterData('Goblin', [])).resolves.toEqual({
        index: 'goblin',
        name: 'Goblin',
      });
    });

    it('handles campaign NPCs with empty name by falling back to monster data', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [{ name: '', armorClass: 10 }, { name: 'Goblin', armorClass: 12 }];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ name: 'Goblin', armorClass: 12, formatted: true });
    });
  });
});
