// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { loadMonsters } from '../ui/dataLoader.js';
import { npcToMonsterFormat } from '../encounters/npcStatBlockUtils.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadMonsters: vi.fn(() => Promise.resolve([
    { index: 'goblin', name: 'Goblin' },
    { index: 'orc', name: 'Orc' },
    { index: 'tarrasque', name: 'Tarrasque' },
    { index: 'dragon', name: 'Ancient Dragon' },
  ])),
}));

vi.mock('../encounters/npcStatBlockUtils.js', () => ({
  npcToMonsterFormat: vi.fn((npc) => ({
    name: npc.name,
    armorClass: npc.armorClass,
    formatted: true,
  })),
}));

const FAKE_MONSTERS = [
  { index: 'goblin', name: 'Goblin' },
  { index: 'orc', name: 'Orc' },
  { index: 'tarrasque', name: 'Tarrasque' },
  { index: 'dragon', name: 'Ancient Dragon' },
];

function makeNpc(name, overrides = {}) {
  return { name, armorClass: 15, ...overrides };
}

describe('monsterUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('getMonsterImageUrl', () => {
    it('returns null for falsy and whitespace-only names', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      for (const name of ['', null, undefined, '   ']) {
        await expect(getMonsterImageUrl(name)).resolves.toBeNull();
      }
    });

    it('looks up monster data case-insensitively with trailing number stripping', async () => {
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

    it('returns null when monster is not found in data or campaign NPCs', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      await expect(getMonsterImageUrl('Unicorn')).resolves.toBeNull();
      await expect(getMonsterImageUrl('Unicorn', [])).resolves.toBeNull();
      await expect(getMonsterImageUrl('Unicorn', [{ name: 'Goblin', imagePath: '/x.png' }])).resolves.toBeNull();
    });

    it('prefers campaign NPC avatar over monster data', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [makeNpc('Goblin', { imagePath: '/custom/goblin.png' })];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe('/custom/goblin.png');
    });

    it('falls back to monster data when campaign NPC has falsy imagePath', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [
        makeNpc('Goblin', { imagePath: null }),
        makeNpc('Orc', { imagePath: '' }),
        makeNpc('Ancient Dragon', { imagePath: false }),
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

    it('matches campaign NPCs case-insensitively with trailing number stripping', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [makeNpc('GOBLIN', { imagePath: '/custom/goblin.png' })];
      await expect(getMonsterImageUrl('goblin 1', npcs)).resolves.toBe('/custom/goblin.png');
    });

    it('uses first campaign NPC with matching name and valid imagePath', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [
        makeNpc('Goblin', { imagePath: null }),
        makeNpc('Goblin', { imagePath: '/custom/first.png' }),
        makeNpc('Goblin', { imagePath: '/custom/second.png' }),
      ];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe('/custom/first.png');
    });

    it('skips campaign NPCs with falsy or empty name and falls back to monster data', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [
        { name: '', imagePath: '/custom/empty.png' },
        { name: null, imagePath: '/custom/null.png' },
        { name: undefined, imagePath: '/custom/undef.png' },
        makeNpc('Goblin', { imagePath: '/custom/goblin.png' }),
      ];
      await expect(getMonsterImageUrl('Goblin', npcs)).resolves.toBe('/custom/goblin.png');
    });

    it('falls back to monster data when npcs is empty, null, or undefined', async () => {
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

    it('does not call loadMonsters when campaign NPC provides an image', async () => {
      const { getMonsterImageUrl } = await import('./monsterUtils.js');
      const npcs = [makeNpc('Goblin', { imagePath: '/custom/goblin.png' })];
      await getMonsterImageUrl('Goblin', npcs);
      expect(loadMonsters).not.toHaveBeenCalled();
    });
  });

  describe('getMonsterData', () => {
    it('returns null for falsy and whitespace-only names', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      for (const name of ['', null, undefined, '   ']) {
        await expect(getMonsterData(name)).resolves.toBeNull();
      }
    });

    it('returns null when monster is not found in data or campaign NPCs', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      await expect(getMonsterData('Unicorn')).resolves.toBeNull();
      await expect(getMonsterData('Unicorn', [])).resolves.toBeNull();
      await expect(getMonsterData('Unicorn', [{ name: 'Goblin', armorClass: 10 }])).resolves.toBeNull();
    });

    it('looks up monster data case-insensitively with trailing number stripping', async () => {
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
      const npcs = [makeNpc('Goblin', { armorClass: 15 })];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ name: 'Goblin', armorClass: 15, formatted: true });
      expect(npcToMonsterFormat).toHaveBeenCalled();
    });

    it('treats armorClass: 0 as a valid stat block', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [makeNpc('Orc', { armorClass: 0 })];
      const result = await getMonsterData('Orc', npcs);
      expect(result).toEqual({ name: 'Orc', armorClass: 0, formatted: true });
      expect(npcToMonsterFormat).toHaveBeenCalled();
    });

    it('skips campaign NPCs without numeric armorClass and falls back to monster data', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [
        makeNpc('Goblin', { armorClass: '15' }),
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

    it('matches campaign NPCs case-insensitively with trailing number stripping', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [makeNpc('GOBLIN', { armorClass: 15 })];
      const result = await getMonsterData('goblin 1', npcs);
      expect(result).toEqual({ name: 'GOBLIN', armorClass: 15, formatted: true });
    });

    it('uses first campaign NPC with matching name and numeric armorClass', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [
        makeNpc('Goblin', { armorClass: '10' }),
        makeNpc('Goblin', { armorClass: 15 }),
        makeNpc('Goblin', { armorClass: 20 }),
      ];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ name: 'Goblin', armorClass: 15, formatted: true });
    });

    it('skips campaign NPCs with falsy or empty name and falls back to monster data', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [
        { name: '', armorClass: 10 },
        { name: null, armorClass: 11 },
        { name: undefined, armorClass: 12 },
        makeNpc('Goblin', { armorClass: 12 }),
      ];
      const result = await getMonsterData('Goblin', npcs);
      expect(result).toEqual({ name: 'Goblin', armorClass: 12, formatted: true });
    });

    it('falls back to monster data when npcs is empty, null, or undefined', async () => {
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

    it('does not call loadMonsters when campaign NPC provides a stat block', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const npcs = [makeNpc('Goblin', { armorClass: 15 })];
      await getMonsterData('Goblin', npcs);
      expect(loadMonsters).not.toHaveBeenCalled();
    });

    it('calls loadMonsters and returns raw monster data when no campaign NPC match is found', async () => {
      const { getMonsterData } = await import('./monsterUtils.js');
      const result = await getMonsterData('Tarrasque');
      expect(loadMonsters).toHaveBeenCalled();
      expect(result).toEqual(FAKE_MONSTERS.find((m) => m.index === 'tarrasque'));
    });
  });
});
