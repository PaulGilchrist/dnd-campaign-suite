// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { generateDungeon, visualize } from './dungeonGenerator.js';

describe('dungeonGenerator', () => {
  describe('generateDungeon', () => {
    it('should return a map object with all required top-level fields', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      expect(map).toHaveProperty('name');
      expect(map).toHaveProperty('description');
      expect(map).toHaveProperty('gridSize');
      expect(map).toHaveProperty('seed');
      expect(map).toHaveProperty('walls');
      expect(map).toHaveProperty('placedItems');
      expect(map).toHaveProperty('players');
      expect(map).toHaveProperty('zoom');
      expect(map).toHaveProperty('panX');
      expect(map).toHaveProperty('panY');
    });

    it('should default gridSize to 30 and accept custom values', () => {
      expect(generateDungeon({ seed: 42 }).gridSize).toBe(30);
      expect(generateDungeon({ gridSize: 25, seed: 42 }).gridSize).toBe(25);
    });

    it('should return the seed used for generation', () => {
      const map = generateDungeon({ gridSize: 20, seed: 12345 });
      expect(map.seed).toBe(12345);
    });

    it('should generate non-empty name and description strings', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      expect(typeof map.name).toBe('string');
      expect(map.name.length).toBeGreaterThan(0);
      expect(typeof map.description).toBe('string');
      expect(map.description.length).toBeGreaterThan(0);
    });

    it('should produce deterministic output with the same seed', () => {
      const map1 = generateDungeon({ gridSize: 20, seed: 123 });
      const map2 = generateDungeon({ gridSize: 20, seed: 123 });
      expect(map1).toEqual(map2);
    });

    it('should produce different output with different seeds', () => {
      const map1 = generateDungeon({ gridSize: 20, seed: 1 });
      const map2 = generateDungeon({ gridSize: 20, seed: 2 });
      expect(map1).not.toEqual(map2);
    });

    it('should generate walls as coordinate strings within grid bounds', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
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
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeLessThan(map.gridSize * map.gridSize);
    });

    it('should generate placedItems with required fields within bounds', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
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
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      const positions = map.placedItems.map(i => i.gridX + ',' + i.gridY);
      expect(new Set(positions).size).toBe(positions.length);
    });

    it('should include at least one torch', () => {
      expect(generateDungeon({ gridSize: 20, seed: 42 }).placedItems.some(i => i.type === 'torch')).toBe(true);
    });

    it('should include entrance stairs', () => {
      const stairs = generateDungeon({ gridSize: 20, seed: 42 }).placedItems.filter(i => i.type === 'stairs');
      expect(stairs.length).toBeGreaterThanOrEqual(1);
      expect(stairs[0].id).toBe('entrance-stairs');
    });

    it('should include doors', () => {
      const doors = generateDungeon({ gridSize: 20, seed: 42 }).placedItems.filter(i => i.type === 'door' || i.type === 'secretDoor');
      expect(doors.length).toBeGreaterThan(0);
    });

    it('should include NPCs when enough rooms exist', () => {
      const map = generateDungeon({ gridSize: 30, seed: 42 });
      const npcs = map.placedItems.filter(i => i.type === 'npc');
      expect(npcs.length).toBeGreaterThan(0);
      for (const npc of npcs) {
        expect(npc).toHaveProperty('name');
        expect(npc).toHaveProperty('rotation');
        expect(npc.visible).toBe(false);
      }
    });

    it('should have players as an empty array and default zoom/pan', () => {
      const map = generateDungeon({ seed: 42 });
      expect(map.players).toEqual([]);
      expect(map.zoom).toBe(1);
      expect(map.panX).toBe(0);
      expect(map.panY).toBe(0);
    });

    it('should include furniture in larger rooms', () => {
      const map = generateDungeon({ gridSize: 30, seed: 42 });
      const furnitureTypes = ['table', 'chair', 'chest', 'bed', 'bookshelf', 'altar', 'pillar', 'statue', 'crate', 'web', 'trap'];
      const foundTypes = new Set(map.placedItems.map(i => i.type));
      expect(furnitureTypes.some(t => foundTypes.has(t))).toBe(true);
    });

    it('should place traps with valid trapType values', () => {
      const traps = generateDungeon({ gridSize: 30, seed: 42 }).placedItems.filter(i => i.type === 'trap');
      expect(traps.length).toBeGreaterThan(0);
      for (const trap of traps) {
        expect(trap).toHaveProperty('trapType');
        expect(['pit', 'dart', 'glyph']).toContain(trap.trapType);
      }
    });

    it('should handle small grids, large grids, and density extremes', () => {
      const small = generateDungeon({ gridSize: 10, seed: 42 });
      expect(small.gridSize).toBe(10);
      expect(small.walls.length).toBeGreaterThan(0);
      expect(small.placedItems.length).toBeGreaterThan(0);

      const large = generateDungeon({ gridSize: 40, seed: 42 });
      expect(large.gridSize).toBe(40);
      expect(large.walls.length).toBeGreaterThan(0);
      expect(large.placedItems.length).toBeGreaterThan(0);

      const lowDensity = generateDungeon({ gridSize: 30, seed: 42, density: 0 });
      expect(lowDensity.walls.length).toBeGreaterThan(0);

      const highDensity = generateDungeon({ gridSize: 30, seed: 42, density: 1 });
      expect(highDensity.walls.length).toBeGreaterThan(0);
    });
  });

  describe('visualize', () => {
    it('should return a string matching the map grid dimensions', () => {
      const map = generateDungeon({ gridSize: 10, seed: 42 });
      const output = visualize(map);
      expect(typeof output).toBe('string');
      const lines = output.split('\n');
      expect(lines.length).toBe(10);
      for (const line of lines) {
        expect(line.length).toBe(10);
      }
    });

    it('should show open floor as middle dot and walls as block', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      const output = visualize(map);
      expect(output).toContain('\u00b7');
      expect(output).toContain('\u2588');
    });

    it('should show stairs as greater-than', () => {
      const output = visualize(generateDungeon({ gridSize: 20, seed: 42 }));
      expect(output).toContain('>');
    });

    it('should show conditional items when present', () => {
      const map = generateDungeon({ gridSize: 30, seed: 42 });
      const output = visualize(map);

      if (map.placedItems.some(i => i.type === 'door')) expect(output).toContain('+');
      if (map.placedItems.some(i => i.type === 'secretDoor')) expect(output).toContain('s');
      if (map.placedItems.some(i => i.type === 'chest')) expect(output).toContain('=');
      if (map.placedItems.some(i => i.type === 'trap')) expect(output).toContain('^');
      if (map.placedItems.some(i => i.type === 'npc')) expect(output).toContain('@');
      if (map.placedItems.some(i => i.type === 'altar')) expect(output).toContain('A');
    });

    it('should handle small grids', () => {
      const map = generateDungeon({ gridSize: 5, seed: 42 });
      const output = visualize(map);
      const lines = output.split('\n');
      expect(lines.length).toBe(5);
      for (const line of lines) {
        expect(line.length).toBe(5);
      }
    });
  });
});
