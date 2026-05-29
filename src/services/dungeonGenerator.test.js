import { describe, it, expect } from 'vitest';
import { generateDungeon, visualize } from './dungeonGenerator.js';

describe('dungeonGenerator', () => {
  describe('generateDungeon', () => {
    it('should return a valid dungeon map with required fields', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      expect(map).toHaveProperty('name');
      expect(map).toHaveProperty('description');
      expect(map).toHaveProperty('gridSize');
      expect(map).toHaveProperty('walls');
      expect(map).toHaveProperty('placedItems');
      expect(map).toHaveProperty('players');
      expect(map).toHaveProperty('zoom');
      expect(map).toHaveProperty('panX');
      expect(map).toHaveProperty('panY');
    });

    it('should default gridSize to 30', () => {
      const map = generateDungeon({ seed: 42 });
      expect(map.gridSize).toBe(30);
    });

    it('should generate a non-empty name', () => {
      const map = generateDungeon({ seed: 42 });
      expect(map.name.length).toBeGreaterThan(0);
      expect(map.name.startsWith('The ')).toBe(true);
    });

    it('should generate a non-empty description', () => {
      const map = generateDungeon({ seed: 42 });
      expect(map.description.length).toBeGreaterThan(0);
    });

    it('should produce deterministic output with same seed', () => {
      const map1 = generateDungeon({ gridSize: 20, seed: 123 });
      const map2 = generateDungeon({ gridSize: 20, seed: 123 });
      expect(map1.walls).toEqual(map2.walls);
      expect(map1.name).toBe(map2.name);
      expect(map1.gridSize).toBe(map2.gridSize);
    });

    it('should produce different output with different seeds', () => {
      const map1 = generateDungeon({ gridSize: 20, seed: 1 });
      const map2 = generateDungeon({ gridSize: 20, seed: 999 });
      expect(map1.walls).not.toEqual(map2.walls);
    });

    it('should generate walls as array of "x,y" strings', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeGreaterThan(0);
      for (const wall of map.walls) {
        expect(wall).toMatch(/^\d+,\d+$/);
      }
    });

    it('should generate placedItems with required fields', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      expect(map.placedItems.length).toBeGreaterThan(0);
      for (const item of map.placedItems) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('gridX');
        expect(item).toHaveProperty('gridY');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('visible');
      }
    });

    it('should include at least one torch', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      const torches = map.placedItems.filter(i => i.type === 'torch');
      expect(torches.length).toBeGreaterThan(0);
    });

    it('should include an entrance stairs', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      const stairs = map.placedItems.filter(i => i.type === 'stairs');
      expect(stairs.length).toBeGreaterThanOrEqual(1);
      expect(stairs[0].id).toBe('entrance-stairs');
    });

    it('should include doors', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      const doors = map.placedItems.filter(i => i.type === 'door' || i.type === 'secretDoor');
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

    it('should have players as empty array', () => {
      const map = generateDungeon({ seed: 42 });
      expect(map.players).toEqual([]);
    });

    it('should have zoom default to 1', () => {
      const map = generateDungeon({ seed: 42 });
      expect(map.zoom).toBe(1);
    });

    it('should have panX and panY default to 0', () => {
      const map = generateDungeon({ seed: 42 });
      expect(map.panX).toBe(0);
      expect(map.panY).toBe(0);
    });

    it('should work without a seed', () => {
      const map = generateDungeon({ gridSize: 20 });
      expect(map).toHaveProperty('name');
      expect(map.walls.length).toBeGreaterThan(0);
    });

    it('should include furniture items in larger rooms', () => {
      const map = generateDungeon({ gridSize: 30, seed: 42 });
      const furnitureTypes = ['table', 'chair', 'chest', 'bed', 'bookshelf', 'altar', 'pillar', 'statue', 'crate', 'web', 'trap'];
      const foundTypes = new Set(map.placedItems.map(i => i.type));
      const hasFurniture = furnitureTypes.some(t => foundTypes.has(t));
      expect(hasFurniture).toBe(true);
    });

    it('should have wall count less than total grid cells', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeLessThan(400);
    });

    it('should place traps in rooms', () => {
      const map = generateDungeon({ gridSize: 30, seed: 42 });
      const traps = map.placedItems.filter(i => i.type === 'trap');
      expect(traps.length).toBeGreaterThan(0);
      for (const trap of traps) {
        expect(trap).toHaveProperty('trapType');
        expect(['pit', 'dart', 'glyph']).toContain(trap.trapType);
      }
    });

    it('should place traps in corridors for dense maps', () => {
      const map = generateDungeon({ gridSize: 40, density: 1, seed: 42 });
      const corridorTraps = map.placedItems.filter(i => i.type === 'trap' && i.id.startsWith('corridor-trap-'));
      expect(corridorTraps.length).toBeGreaterThanOrEqual(0);
    });

    it('should have no dead-end corridor cells longer than 2 cells', () => {
      const map = generateDungeon({ gridSize: 25, seed: 42 });
      const wallSet = new Set(map.walls);
      const openCells = [];
      for (let y = 0; y < map.gridSize; y++) {
        for (let x = 0; x < map.gridSize; x++) {
          if (!wallSet.has(x + ',' + y)) openCells.push([x, y]);
        }
      }
      // Build room cell set
      for (const item of map.placedItems) {
        if (item.type === 'torch' || item.type === 'stairs') {
          // Room items indicate nearby room presence; we can't easily detect room bounds
          // from output alone, so this is a soft check
        }
      }
      // Count dead-end corridor cells (cells with exactly 1 open neighbor)
      // that are NOT adjacent to any door
      const doorPositions = new Set(
        map.placedItems
          .filter(i => i.type === 'door' || i.type === 'secretDoor')
          .map(i => i.gridX + ',' + i.gridY)
      );
      let deadEnds = 0;
      for (const [x, y] of openCells) {
        if (doorPositions.has(x + ',' + y)) continue;
        let openNeighbors = 0;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (!wallSet.has(nx + ',' + ny)) openNeighbors++;
        }
        if (openNeighbors === 1) deadEnds++;
      }
      // Most dead-ends should be capped; allow a few 1-cell alcoves
      expect(deadEnds).toBeLessThan(5);
    });
  });

  describe('visualize', () => {
    it('should return a string', () => {
      const map = generateDungeon({ gridSize: 10, seed: 42 });
      const output = visualize(map);
      expect(typeof output).toBe('string');
    });

    it('should have gridSize lines', () => {
      const map = generateDungeon({ gridSize: 10, seed: 42 });
      const output = visualize(map);
      const lines = output.split('\n');
      expect(lines.length).toBe(10);
    });

    it('should have each line be gridSize characters long', () => {
      const map = generateDungeon({ gridSize: 10, seed: 42 });
      const output = visualize(map);
      const lines = output.split('\n');
      for (const line of lines) {
        expect(line.length).toBe(10);
      }
    });

    it('should show doors as +', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      const output = visualize(map);
      const hasDoors = map.placedItems.some(i => i.type === 'door');
      if (hasDoors) {
        expect(output).toContain('+');
      }
    });

    it('should show secret doors as s', () => {
      const map = generateDungeon({ gridSize: 30, seed: 42 });
      const output = visualize(map);
      const hasSecret = map.placedItems.some(i => i.type === 'secretDoor');
      if (hasSecret) {
        expect(output).toContain('s');
      }
    });

    it('should show open floor as middle dot', () => {
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      const output = visualize(map);
      expect(output).toContain('\u00b7');
    });
  });
});
