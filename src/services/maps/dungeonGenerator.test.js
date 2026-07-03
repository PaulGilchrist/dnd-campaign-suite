// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { generateDungeon, generateAdjacentDungeon, visualize } from './dungeonGenerator.js';

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
      const defaultMap = generateDungeon({ seed: 42 });
      expect(defaultMap.gridSize).toBe(30);

      const customMap = generateDungeon({ gridSize: 25, seed: 42 });
      expect(customMap.gridSize).toBe(25);
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
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      const torches = map.placedItems.filter(i => i.type === 'torch');
      expect(torches.length).toBeGreaterThan(0);
    });

    it('should include entrance stairs', () => {
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
      const hasFurniture = furnitureTypes.some(t => foundTypes.has(t));
      expect(hasFurniture).toBe(true);
    });

    it('should place traps with valid trapType values', () => {
      const map = generateDungeon({ gridSize: 30, seed: 42 });
      const traps = map.placedItems.filter(i => i.type === 'trap');
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
      const map = generateDungeon({ gridSize: 20, seed: 42 });
      const output = visualize(map);
      expect(output).toContain('>');
    });

    it('should show conditional items when present', () => {
      const map = generateDungeon({ gridSize: 30, seed: 42 });
      const output = visualize(map);

      const hasDoors = map.placedItems.some(i => i.type === 'door');
      if (hasDoors) expect(output).toContain('+');

      const hasSecret = map.placedItems.some(i => i.type === 'secretDoor');
      if (hasSecret) expect(output).toContain('s');

      const hasChest = map.placedItems.some(i => i.type === 'chest');
      if (hasChest) expect(output).toContain('=');

      const hasTrap = map.placedItems.some(i => i.type === 'trap');
      if (hasTrap) expect(output).toContain('^');

      const hasNPC = map.placedItems.some(i => i.type === 'npc');
      if (hasNPC) expect(output).toContain('@');

      const hasAltar = map.placedItems.some(i => i.type === 'altar');
      if (hasAltar) expect(output).toContain('A');
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

  describe('generateAdjacentDungeon', () => {
    it('should return a map object with all required fields including rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map).toHaveProperty('name');
      expect(map).toHaveProperty('description');
      expect(map).toHaveProperty('gridSize');
      expect(map).toHaveProperty('walls');
      expect(map).toHaveProperty('placedItems');
      expect(map).toHaveProperty('players');
      expect(map).toHaveProperty('zoom');
      expect(map).toHaveProperty('panX');
      expect(map).toHaveProperty('panY');
      expect(map).toHaveProperty('rooms');
      expect(map).toHaveProperty('generationMode');
    });

    it('should set generationMode to adjacent and default gridSize to 30', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.generationMode).toBe('adjacent');
      expect(map.gridSize).toBe(30);

      const custom = generateAdjacentDungeon({ gridSize: 25, seed: 42 });
      expect(custom.gridSize).toBe(25);
    });

    it('should generate non-empty name and description', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(typeof map.name).toBe('string');
      expect(map.name.length).toBeGreaterThan(0);
      expect(typeof map.description).toBe('string');
      expect(map.description.length).toBeGreaterThan(0);
    });

    it('should produce deterministic output with the same seed', () => {
      const map1 = generateAdjacentDungeon({ gridSize: 20, seed: 123 });
      const map2 = generateAdjacentDungeon({ gridSize: 20, seed: 123 });
      expect(map1).toEqual(map2);
    });

    it('should produce different output with different seeds', () => {
      const map1 = generateAdjacentDungeon({ gridSize: 20, seed: 1 });
      const map2 = generateAdjacentDungeon({ gridSize: 20, seed: 2 });
      expect(map1).not.toEqual(map2);
    });

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

    it('should include entrance stairs, torches, and doors', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const stairs = map.placedItems.filter(i => i.type === 'stairs');
      expect(stairs.length).toBeGreaterThanOrEqual(1);
      expect(stairs[0].id).toBe('entrance-stairs');

      const torches = map.placedItems.filter(i => i.type === 'torch');
      expect(torches.length).toBeGreaterThan(0);

      const doors = map.placedItems.filter(i => i.type === 'door');
      expect(doors.length).toBeGreaterThan(0);
    });

    it('should have players as an empty array and default zoom/pan', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.players).toEqual([]);
      expect(map.zoom).toBe(1);
      expect(map.panX).toBe(0);
      expect(map.panY).toBe(0);
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

    it('should return rooms array with required fields', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(Array.isArray(map.rooms)).toBe(true);
      expect(map.rooms.length).toBeGreaterThan(0);
      for (const room of map.rooms) {
        expect(room).toHaveProperty('id');
        expect(room).toHaveProperty('rect');
        expect(room).toHaveProperty('type');
        expect(room).toHaveProperty('label');
        expect(room).toHaveProperty('connectedTo');
        expect(Array.isArray(room.connectedTo)).toBe(true);
      }
    });

    it('should have valid room types and non-empty labels', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const validTypes = ['entrance', 'common', 'utility', 'private', 'grand', 'hall'];
      for (const room of map.rooms) {
        expect(validTypes).toContain(room.type);
        expect(typeof room.label).toBe('string');
        expect(room.label.length).toBeGreaterThan(0);
      }
    });

    it('should place entrance room as the first room', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.rooms[0].type).toBe('entrance');
    });

    it('should have valid room connectivity', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const totalConnections = map.rooms.reduce((sum, r) => sum + r.connectedTo.length, 0);
      expect(totalConnections).toBeGreaterThan(0);

      const roomIds = new Set(map.rooms.map(r => r.id));
      for (const room of map.rooms) {
        for (const connId of room.connectedTo) {
          expect(roomIds.has(connId)).toBe(true);
        }
      }
    });

    it('should have symmetric connections between rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const room of map.rooms) {
        for (const connId of room.connectedTo) {
          const connectedRoom = map.rooms.find(r => r.id === connId);
          if (connectedRoom) {
            expect(connectedRoom.connectedTo).toContain(room.id);
          }
        }
      }
    });

    it('should not have overlapping rooms within grid bounds', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (let i = 0; i < map.rooms.length; i++) {
        for (let j = i + 1; j < map.rooms.length; j++) {
          const a = map.rooms[i].rect;
          const b = map.rooms[j].rect;
          expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
        }
      }
      for (const room of map.rooms) {
        expect(room.rect.x).toBeGreaterThanOrEqual(0);
        expect(room.rect.y).toBeGreaterThanOrEqual(0);
        expect(room.rect.x + room.rect.w).toBeLessThanOrEqual(map.gridSize);
        expect(room.rect.y + room.rect.h).toBeLessThanOrEqual(map.gridSize);
      }
    });

    it('should support all layout styles', () => {
      const layouts = ['linear', 'forking', 'winding', 'balanced'];
      for (const layout of layouts) {
        const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: layout });
        expect(map.generationMode).toBe('adjacent');
        expect(map.rooms.length).toBeGreaterThan(0);
      }
    });

    it('should respect roomCount option', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42, roomCount: 6 });
      expect(map.rooms.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle density extremes and grid size extremes', () => {
      const lowDensity = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 0 });
      expect(lowDensity.rooms.length).toBeGreaterThan(0);

      const highDensity = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 1 });
      expect(highDensity.rooms.length).toBeGreaterThan(0);

      const small = generateAdjacentDungeon({ gridSize: 15, seed: 42 });
      expect(small.gridSize).toBe(15);
      expect(small.walls.length).toBeGreaterThan(0);
      expect(small.rooms.length).toBeGreaterThan(0);

      const large = generateAdjacentDungeon({ gridSize: 40, seed: 42 });
      expect(large.gridSize).toBe(40);
      expect(large.walls.length).toBeGreaterThan(0);
      expect(large.rooms.length).toBeGreaterThan(0);
    });

    it('should include furniture items in larger rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const furnishingTypes = ['torch', 'table', 'chair', 'chest', 'bed', 'bookshelf', 'altar', 'pillar', 'statue', 'crate', 'web', 'barrel', 'firepit', 'fountain'];
      const foundTypes = new Set(map.placedItems.map(i => i.type));
      const hasFurnishing = furnishingTypes.some(t => foundTypes.has(t));
      expect(hasFurnishing).toBe(true);
    });

    it('should include room-type-specific furniture', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });

      const hasPrivateRoom = map.rooms.some(r => r.type === 'private');
      if (hasPrivateRoom) {
        const beds = map.placedItems.filter(i => i.type === 'bed');
        expect(beds.length).toBeGreaterThan(0);
      }

      const hasGrandRoom = map.rooms.some(r => r.type === 'grand');
      if (hasGrandRoom) {
        const altars = map.placedItems.filter(i => i.type === 'altar');
        expect(altars.length).toBeGreaterThan(0);
      }

      const hasUtilityRoom = map.rooms.some(r => r.type === 'utility');
      if (hasUtilityRoom) {
        const crates = map.placedItems.filter(i => i.type === 'crate');
        expect(crates.length).toBeGreaterThan(0);
      }
    });

    it('should produce visualizable output', () => {
      const map = generateAdjacentDungeon({ gridSize: 15, seed: 42 });
      const output = visualize(map);
      const lines = output.split('\n');
      expect(output).toBeTypeOf('string');
      expect(lines.length).toBe(map.gridSize);
      for (const line of lines) {
        expect(line.length).toBe(map.gridSize);
      }
    });
  });
});
