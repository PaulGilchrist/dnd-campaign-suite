// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { generateAdjacentDungeon } from './adjacentDungeonGenerator.js';

describe('adjacentDungeonGenerator', () => {
  describe('options handling', () => {
    it('should default gridSize to 30 when omitted', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.gridSize).toBe(30);
    });

    it('should accept and preserve a custom gridSize', () => {
      const map = generateAdjacentDungeon({ gridSize: 25, seed: 42 });
      expect(map.gridSize).toBe(25);
    });

    it('should clamp density to [0, 1]', () => {
      const lowDensity = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: -1 });
      expect(lowDensity.gridSize).toBe(30);
      expect(lowDensity.walls.length).toBeGreaterThan(0);

      const highDensity = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 2 });
      expect(highDensity.walls.length).toBeGreaterThan(0);
    });

    it('should accept layoutStyle options', () => {
      for (const layout of ['linear', 'forking', 'winding', 'balanced']) {
        const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: layout });
        expect(map.generationMode).toBe('adjacent');
        expect(map.walls.length).toBeGreaterThan(0);
      }
    });

    it('should use provided seed for deterministic RNG', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 999 });
      expect(map.seed).toBe(999);
    });

    it('should generate a random seed when none provided', () => {
      const map = generateAdjacentDungeon({ gridSize: 20 });
      expect(typeof map.seed).toBe('number');
      expect(map.seed).toBeGreaterThan(0);
    });

    it('should accept empty or undefined opts', () => {
      expect(generateAdjacentDungeon({}).gridSize).toBe(30);
      expect(generateAdjacentDungeon().gridSize).toBe(30);
    });
  });

  describe('output structure', () => {
    const requiredKeys = ['name', 'description', 'gridSize', 'seed', 'walls', 'placedItems', 'players', 'zoom', 'panX', 'panY', 'generationMode'];

    it('should return an object with all required top-level fields', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const key of requiredKeys) {
        expect(map).toHaveProperty(key);
      }
    });

    it('should set generationMode to adjacent', () => {
      expect(generateAdjacentDungeon({ seed: 42 }).generationMode).toBe('adjacent');
    });

    it('should have players as an empty array and default zoom/pan', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.players).toEqual([]);
      expect(map.zoom).toBe(1);
      expect(map.panX).toBe(0);
      expect(map.panY).toBe(0);
    });

    it('should generate a non-empty name and description', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(typeof map.name).toBe('string');
      expect(map.name.length).toBeGreaterThan(0);
      expect(typeof map.description).toBe('string');
      expect(map.description.length).toBeGreaterThan(0);
    });
  });

  describe('deterministic output', () => {
    it('should produce identical output with the same seed', () => {
      const map1 = generateAdjacentDungeon({ gridSize: 20, seed: 123 });
      const map2 = generateAdjacentDungeon({ gridSize: 20, seed: 123 });
      expect(map1).toEqual(map2);
    });

    it('should produce different output with different seeds', () => {
      const map1 = generateAdjacentDungeon({ gridSize: 20, seed: 1 });
      const map2 = generateAdjacentDungeon({ gridSize: 20, seed: 2 });
      expect(map1).not.toEqual(map2);
    });

    it('should produce different output without seed', () => {
      const map1 = generateAdjacentDungeon({ gridSize: 20 });
      const map2 = generateAdjacentDungeon({ gridSize: 20 });
      expect(map1.seed).not.toBe(map2.seed);
    });
  });

  describe('walls', () => {
    it('should generate walls as coordinate strings within grid bounds', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeGreaterThan(0);
      for (const wall of map.walls) {
        expect(wall).toMatch(/^\d+,\d+$/);
        const [x, y] = wall.split(',').map(Number);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(map.gridSize);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(map.gridSize);
      }
    });

    it('should not fill the entire grid with walls', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeLessThan(map.gridSize * map.gridSize);
    });
  });

  describe('placedItems', () => {
    it('should generate placedItems with required fields within bounds', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(Array.isArray(map.placedItems)).toBe(true);
      expect(map.placedItems.length).toBeGreaterThan(0);
      for (const item of map.placedItems) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('gridX');
        expect(item).toHaveProperty('gridY');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('visible');
        expect(item.gridX).toBeGreaterThanOrEqual(0);
        expect(item.gridX).toBeLessThan(map.gridSize);
        expect(item.gridY).toBeGreaterThanOrEqual(0);
        expect(item.gridY).toBeLessThan(map.gridSize);
      }
    });

    it('should deduplicate placed items by position', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const positions = map.placedItems.map(i => i.gridX + ',' + i.gridY);
      expect(new Set(positions).size).toBe(positions.length);
    });

    it('should include entrance stairs', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const stairs = map.placedItems.filter(i => i.type === 'stairs');
      expect(stairs.length).toBeGreaterThanOrEqual(1);
      expect(stairs[0].id).toBe('entrance-stairs');
    });

    it('should include torches', () => {
      expect(generateAdjacentDungeon({ gridSize: 20, seed: 42 }).placedItems.some(i => i.type === 'torch')).toBe(true);
    });

    it('should include doors between rooms', () => {
      expect(generateAdjacentDungeon({ gridSize: 20, seed: 42 }).placedItems.some(i => i.type === 'door')).toBe(true);
    });

    it('should have doors with valid rotation values (0 or 90)', () => {
      const doors = generateAdjacentDungeon({ gridSize: 20, seed: 42 }).placedItems.filter(i => i.type === 'door');
      for (const door of doors) {
        expect([0, 90]).toContain(door.rotation);
      }
    });

    it('should include NPCs when enough rooms exist', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const npcs = map.placedItems.filter(i => i.type === 'npc');
      expect(npcs.length).toBeGreaterThan(0);
      for (const npc of npcs) {
        expect(npc).toHaveProperty('name');
        expect(npc).toHaveProperty('rotation');
        expect(npc.visible).toBe(false);
      }
    });

    it('should have NPCs with valid rotation values (0, 90, 180, 270)', () => {
      const npcs = generateAdjacentDungeon({ gridSize: 30, seed: 42 }).placedItems.filter(i => i.type === 'npc');
      for (const npc of npcs) {
        expect([0, 90, 180, 270]).toContain(npc.rotation);
      }
    });

    it('should include secret doors with secret-door prefix IDs', () => {
      const secretDoors = generateAdjacentDungeon({ gridSize: 30, seed: 42 }).placedItems.filter(i => i.type === 'secretdoor');
      for (const sd of secretDoors) {
        expect(sd.id).toMatch(/^secret-door-\d+$/);
      }
    });

    it('should include trap IDs with trap prefix', () => {
      const traps = generateAdjacentDungeon({ gridSize: 30, seed: 42 }).placedItems.filter(i => i.type === 'trap');
      for (const trap of traps) {
        expect(trap.id).toMatch(/^trap-\d+$/);
      }
    });

    it('should limit secret doors to maximum 3', () => {
      const secretDoors = generateAdjacentDungeon({ gridSize: 30, seed: 42 }).placedItems.filter(i => i.type === 'secretdoor');
      expect(secretDoors.length).toBeLessThanOrEqual(3);
    });

    it('should limit traps to maximum 2', () => {
      const traps = generateAdjacentDungeon({ gridSize: 30, seed: 42 }).placedItems.filter(i => i.type === 'trap');
      expect(traps.length).toBeLessThanOrEqual(2);
    });

    it('should limit NPCs to maximum 7', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const npcs = map.placedItems.filter(i => i.type === 'npc');
      expect(npcs.length).toBeLessThanOrEqual(7);
    });
  });

  describe('grid size extremes', () => {
    it('should handle small grid size (10)', () => {
      const map = generateAdjacentDungeon({ gridSize: 10, seed: 42 });
      expect(map.gridSize).toBe(10);
      expect(map.walls.length).toBeGreaterThan(0);
      expect(map.placedItems.length).toBeGreaterThan(0);
    });

    it('should handle large grid size (40)', () => {
      const map = generateAdjacentDungeon({ gridSize: 40, seed: 42 });
      expect(map.gridSize).toBe(40);
      expect(map.walls.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle roomCount of 0 or 1', () => {
      const map0 = generateAdjacentDungeon({ gridSize: 20, seed: 42, roomCount: 0 });
      expect(map0.walls.length).toBeGreaterThan(0);
      const map1 = generateAdjacentDungeon({ gridSize: 20, seed: 42, roomCount: 1 });
      expect(map1.walls.length).toBeGreaterThan(0);
    });

    it('should have entrance stairs in single room dungeon', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, roomCount: 1 });
      expect(map.placedItems.some(i => i.type === 'stairs')).toBe(true);
    });

    it('should have no doors in a single room dungeon', () => {
      const doors = generateAdjacentDungeon({ gridSize: 20, seed: 42, roomCount: 1 }).placedItems.filter(i => i.type === 'door');
      expect(doors.length).toBe(0);
    });
  });
});
