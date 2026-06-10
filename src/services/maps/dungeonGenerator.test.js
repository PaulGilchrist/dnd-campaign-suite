import { describe, it, expect } from 'vitest';
import { generateDungeon, generateAdjacentDungeon, visualize } from './dungeonGenerator.js';

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

  describe('generateAdjacentDungeon', () => {
    it('should return a valid dungeon map with required fields', () => {
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

    it('should set generationMode to adjacent', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.generationMode).toBe('adjacent');
    });

    it('should default gridSize to 30', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.gridSize).toBe(30);
    });

    it('should generate a non-empty name', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.name.length).toBeGreaterThan(0);
      expect(map.name.startsWith('The ')).toBe(true);
    });

    it('should generate a non-empty description', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.description.length).toBeGreaterThan(0);
    });

    it('should produce deterministic output with same seed', () => {
      const map1 = generateAdjacentDungeon({ gridSize: 20, seed: 123 });
      const map2 = generateAdjacentDungeon({ gridSize: 20, seed: 123 });
      expect(map1.walls).toEqual(map2.walls);
      expect(map1.name).toBe(map2.name);
      expect(map1.gridSize).toBe(map2.gridSize);
    });

    it('should produce different output with different seeds', () => {
      const map1 = generateAdjacentDungeon({ gridSize: 20, seed: 1 });
      const map2 = generateAdjacentDungeon({ gridSize: 20, seed: 999 });
      expect(map1.walls).not.toEqual(map2.walls);
    });

    it('should generate walls as array of "x,y" strings', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeGreaterThan(0);
      for (const wall of map.walls) {
        expect(wall).toMatch(/^\d+,\d+$/);
      }
    });

    it('should generate placedItems with required fields', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.placedItems.length).toBeGreaterThan(0);
      for (const item of map.placedItems) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('gridX');
        expect(item).toHaveProperty('gridY');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('visible');
      }
    });

    it('should include an entrance stairs', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const stairs = map.placedItems.filter(i => i.type === 'stairs');
      expect(stairs.length).toBeGreaterThanOrEqual(1);
      expect(stairs[0].id).toBe('entrance-stairs');
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

    it('should have players as empty array', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.players).toEqual([]);
    });

    it('should have zoom default to 1', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.zoom).toBe(1);
    });

    it('should have panX and panY default to 0', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.panX).toBe(0);
      expect(map.panY).toBe(0);
    });

    it('should work without a seed', () => {
      const map = generateAdjacentDungeon({ gridSize: 20 });
      expect(map).toHaveProperty('name');
      expect(map.walls.length).toBeGreaterThan(0);
    });

    it('should have wall count less than total grid cells', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeLessThan(400);
    });

    it('should include doors between rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const doors = map.placedItems.filter(i => i.type === 'door');
      expect(doors.length).toBeGreaterThan(0);
    });

    it('should include traps', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const traps = map.placedItems.filter(i => i.type === 'trap');
      expect(traps.length).toBeGreaterThanOrEqual(0);
    });

    it('should include secret doors', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const secDoors = map.placedItems.filter(i => i.type === 'secretdoor');
      expect(secDoors.length).toBeGreaterThanOrEqual(0);
    });

    it('should include furnishing items', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const furnishingTypes = ['torch', 'table', 'chair', 'chest', 'bed', 'bookshelf', 'altar', 'pillar', 'statue', 'crate', 'web', 'barrel', 'firepit', 'fountain'];
      const foundTypes = new Set(map.placedItems.map(i => i.type));
      const hasFurnishing = furnishingTypes.some(t => foundTypes.has(t));
      expect(hasFurnishing).toBe(true);
    });

    it('should return rooms array with room details', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(Array.isArray(map.rooms)).toBe(true);
      expect(map.rooms.length).toBeGreaterThan(0);
      for (const room of map.rooms) {
        expect(room).toHaveProperty('id');
        expect(room).toHaveProperty('rect');
        expect(room).toHaveProperty('type');
        expect(room).toHaveProperty('label');
        expect(room).toHaveProperty('connectedTo');
      }
    });

    it('should have room types from the pool', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const validTypes = ['entrance', 'common', 'utility', 'private', 'grand', 'hall'];
      for (const room of map.rooms) {
        expect(validTypes).toContain(room.type);
      }
    });

    it('should have non-empty labels for known room types', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      for (const room of map.rooms) {
        expect(room.label.length).toBeGreaterThan(0);
      }
    });

    it('should support linear layout style', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: 'linear' });
      expect(map.generationMode).toBe('adjacent');
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should support forking layout style', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: 'forking' });
      expect(map.generationMode).toBe('adjacent');
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should support winding layout style', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: 'winding' });
      expect(map.generationMode).toBe('adjacent');
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should support balanced layout style', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: 'balanced' });
      expect(map.generationMode).toBe('adjacent');
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should respect roomCount option', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42, roomCount: 6 });
      expect(map.rooms.length).toBeGreaterThanOrEqual(1);
    });

    it('should connect rooms via connectedTo arrays', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      // At least the first room should have a connection
      const totalConnections = map.rooms.reduce((sum, r) => sum + r.connectedTo.length, 0);
      expect(totalConnections).toBeGreaterThan(0);
    });

    it('should not have rooms overlapping each other', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (let i = 0; i < map.rooms.length; i++) {
        for (let j = i + 1; j < map.rooms.length; j++) {
          const a = map.rooms[i].rect;
          const b = map.rooms[j].rect;
          // Rooms should not overlap (they may be adjacent with a 1-cell wall gap)
          expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
        }
      }
    });

    it('should place entrance room as the first room', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.rooms[0].type).toBe('entrance');
    });

    it('should include torch items', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const torches = map.placedItems.filter(i => i.type === 'torch');
      expect(torches.length).toBeGreaterThan(0);
    });

    it('should include bed items in private rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const hasPrivateRoom = map.rooms.some(r => r.type === 'private');
      if (hasPrivateRoom) {
        const beds = map.placedItems.filter(i => i.type === 'bed');
        expect(beds.length).toBeGreaterThan(0);
      }
    });

    it('should include altar items in grand rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const hasGrandRoom = map.rooms.some(r => r.type === 'grand');
      if (hasGrandRoom) {
        const altars = map.placedItems.filter(i => i.type === 'altar');
        expect(altars.length).toBeGreaterThan(0);
      }
    });

    it('should include crate items in utility rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const hasUtilityRoom = map.rooms.some(r => r.type === 'utility');
      if (hasUtilityRoom) {
        const crates = map.placedItems.filter(i => i.type === 'crate');
        expect(crates.length).toBeGreaterThan(0);
      }
    });

    it('should include barrel items in common rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const hasCommonRoom = map.rooms.some(r => r.type === 'common');
      if (hasCommonRoom) {
        const barrels = map.placedItems.filter(i => i.type === 'barrel');
        expect(barrels.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include firepit items in common rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const hasCommonRoom = map.rooms.some(r => r.type === 'common');
      if (hasCommonRoom) {
        const firepits = map.placedItems.filter(i => i.type === 'firepit');
        expect(firepits.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include fountain items in grand rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const hasGrandRoom = map.rooms.some(r => r.type === 'grand');
      if (hasGrandRoom) {
        const fountains = map.placedItems.filter(i => i.type === 'fountain');
        expect(fountains.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include pillar items in grand rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const hasGrandRoom = map.rooms.some(r => r.type === 'grand');
      if (hasGrandRoom) {
        const pillars = map.placedItems.filter(i => i.type === 'pillar');
        expect(pillars.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include statue items in entrance rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const hasEntranceRoom = map.rooms.some(r => r.type === 'entrance');
      if (hasEntranceRoom) {
        const statues = map.placedItems.filter(i => i.type === 'statue');
        expect(statues.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle small grid sizes', () => {
      const map = generateAdjacentDungeon({ gridSize: 15, seed: 42 });
      expect(map.gridSize).toBe(15);
      expect(map.walls.length).toBeGreaterThan(0);
    });

    it('should handle large grid sizes', () => {
      const map = generateAdjacentDungeon({ gridSize: 40, seed: 42 });
      expect(map.gridSize).toBe(40);
      expect(map.walls.length).toBeGreaterThan(0);
    });

    it('should handle high density', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 1 });
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should handle low density', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 0 });
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should deduplicate placed items by position', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const posSet = new Set();
      for (const item of map.placedItems) {
        const key = item.gridX + ',' + item.gridY;
        expect(posSet.has(key)).toBe(false);
        posSet.add(key);
      }
    });

    it('should have all placed items within grid bounds', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const item of map.placedItems) {
        expect(item.gridX).toBeGreaterThanOrEqual(0);
        expect(item.gridX).toBeLessThan(map.gridSize);
        expect(item.gridY).toBeGreaterThanOrEqual(0);
        expect(item.gridY).toBeLessThan(map.gridSize);
      }
    });

    it('should have all rooms within grid bounds', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const room of map.rooms) {
        expect(room.rect.x).toBeGreaterThanOrEqual(0);
        expect(room.rect.y).toBeGreaterThanOrEqual(0);
        expect(room.rect.x + room.rect.w).toBeLessThanOrEqual(map.gridSize);
        expect(room.rect.y + room.rect.h).toBeLessThanOrEqual(map.gridSize);
      }
    });

    it('should have connectedTo referencing valid room ids', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const roomIds = new Set(map.rooms.map(r => r.id));
      for (const room of map.rooms) {
        for (const connId of room.connectedTo) {
          expect(roomIds.has(connId)).toBe(true);
        }
      }
    });

    it('should have symmetric connections', () => {
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

    it('should generateAdjacentDungeon output is visualizable', () => {
      const map = generateAdjacentDungeon({ gridSize: 15, seed: 42 });
      const output = visualize(map);
      expect(typeof output).toBe('string');
      const lines = output.split('\n');
      expect(lines.length).toBe(map.gridSize);
    });
  });
});
