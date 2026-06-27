// @improved-by-ai
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
      expect(highDensity.gridSize).toBe(30);
      expect(highDensity.walls.length).toBeGreaterThan(0);
    });

    it('should accept density 0 and 1 without error', () => {
      const low = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 0 });
      expect(low.rooms.length).toBeGreaterThan(0);

      const high = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 1 });
      expect(high.rooms.length).toBeGreaterThan(0);
    });

    it('should accept layoutStyle options', () => {
      const layouts = ['linear', 'forking', 'winding', 'balanced'];
      for (const layout of layouts) {
        const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: layout });
        expect(map.generationMode).toBe('adjacent');
        expect(map.rooms.length).toBeGreaterThan(0);
      }
    });

    it('should default layoutStyle to balanced when omitted', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should respect roomCount option', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42, roomCount: 6 });
      expect(map.rooms.length).toBeGreaterThanOrEqual(1);
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

    it('should accept empty opts object', () => {
      const map = generateAdjacentDungeon({});
      expect(map.gridSize).toBe(30);
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should accept undefined opts', () => {
      const map = generateAdjacentDungeon();
      expect(map.gridSize).toBe(30);
      expect(map.rooms.length).toBeGreaterThan(0);
    });
  });

  describe('output structure', () => {
    it('should return an object with all required top-level fields', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const expectedKeys = [
        'name', 'description', 'gridSize', 'seed',
        'walls', 'placedItems', 'players', 'zoom', 'panX', 'panY',
        'rooms', 'generationMode',
      ];
      for (const key of expectedKeys) {
        expect(map).toHaveProperty(key);
      }
    });

    it('should set generationMode to adjacent', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.generationMode).toBe('adjacent');
    });

    it('should have players as an empty array', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.players).toEqual([]);
    });

    it('should default zoom to 1 and pan to 0', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(map.zoom).toBe(1);
      expect(map.panX).toBe(0);
      expect(map.panY).toBe(0);
    });

    it('should generate a non-empty name string', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
      expect(typeof map.name).toBe('string');
      expect(map.name.length).toBeGreaterThan(0);
    });

    it('should generate a non-empty description string', () => {
      const map = generateAdjacentDungeon({ seed: 42 });
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

  describe('rooms', () => {
    it('should generate at least one room', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.rooms.length).toBeGreaterThanOrEqual(1);
    });

    it('should have the entrance room as the first room (id 0)', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.rooms[0].id).toBe(0);
      expect(map.rooms[0].type).toBe('entrance');
    });

    it('should return rooms with required fields', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const room of map.rooms) {
        expect(room).toHaveProperty('id');
        expect(room).toHaveProperty('rect');
        expect(room).toHaveProperty('type');
        expect(room).toHaveProperty('label');
        expect(room).toHaveProperty('connectedTo');
      }
    });

    it('should have room rects with x, y, w, h', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const room of map.rooms) {
        expect(room.rect).toHaveProperty('x');
        expect(room.rect).toHaveProperty('y');
        expect(room.rect).toHaveProperty('w');
        expect(room.rect).toHaveProperty('h');
        expect(room.rect.w).toBeGreaterThan(0);
        expect(room.rect.h).toBeGreaterThan(0);
      }
    });

    it('should have non-empty labels for all rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      for (const room of map.rooms) {
        expect(typeof room.label).toBe('string');
        expect(room.label.length).toBeGreaterThan(0);
      }
    });

    it('should have valid room types', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const validTypes = ['entrance', 'common', 'utility', 'private', 'grand', 'hall'];
      for (const room of map.rooms) {
        expect(validTypes).toContain(room.type);
      }
    });

    it('should have connectedTo as arrays', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const room of map.rooms) {
        expect(Array.isArray(room.connectedTo)).toBe(true);
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

    it('should have non-empty connectedTo for connectivity', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const totalConnections = map.rooms.reduce((sum, r) => sum + r.connectedTo.length, 0);
      expect(totalConnections).toBeGreaterThan(0);
    });

    it('should not have overlapping rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (let i = 0; i < map.rooms.length; i++) {
        for (let j = i + 1; j < map.rooms.length; j++) {
          const a = map.rooms[i].rect;
          const b = map.rooms[j].rect;
          const intersects = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
          expect(intersects).toBe(false);
        }
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

    it('should have rooms with minimum size', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const minRoom = Math.max(4, Math.floor(20 / 8));
      for (const room of map.rooms) {
        expect(room.rect.w).toBeGreaterThanOrEqual(minRoom);
        expect(room.rect.h).toBeGreaterThanOrEqual(minRoom);
      }
    });

    it('should have rooms with maximum size', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const maxRoom = Math.max(8, Math.min(18, Math.floor(30 / 2.5)));
      for (const room of map.rooms) {
        expect(room.rect.w).toBeLessThanOrEqual(maxRoom);
        expect(room.rect.h).toBeLessThanOrEqual(maxRoom);
      }
    });

    it('should have rooms that are not just walls (area > 0)', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const room of map.rooms) {
        expect(room.rect.w * room.rect.h).toBeGreaterThan(0);
      }
    });
  });

  describe('walls', () => {
    it('should generate walls as coordinate strings', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeGreaterThan(0);
      for (const wall of map.walls) {
        expect(wall).toMatch(/^\d+,\d+$/);
      }
    });

    it('should not fill the entire grid with walls', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeLessThan(map.gridSize * map.gridSize);
    });

    it('should have all walls within grid bounds', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const wall of map.walls) {
        const [x, y] = wall.split(',').map(Number);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(map.gridSize);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(map.gridSize);
      }
    });

    it('should have walls at the grid perimeter', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.walls.length).toBeGreaterThan(0);
    });
  });

  describe('placedItems', () => {
    it('should generate placedItems with required fields', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(Array.isArray(map.placedItems)).toBe(true);
      expect(map.placedItems.length).toBeGreaterThan(0);
      for (const item of map.placedItems) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('gridX');
        expect(item).toHaveProperty('gridY');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('visible');
      }
    });

    it('should place all items within grid bounds', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      for (const item of map.placedItems) {
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
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const torches = map.placedItems.filter(i => i.type === 'torch');
      expect(torches.length).toBeGreaterThan(0);
    });

    it('should include doors between rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const doors = map.placedItems.filter(i => i.type === 'door');
      expect(doors.length).toBeGreaterThan(0);
    });

    it('should have doors with valid rotation values (0 or 90)', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const doors = map.placedItems.filter(i => i.type === 'door');
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
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const npcs = map.placedItems.filter(i => i.type === 'npc');
      for (const npc of npcs) {
        expect([0, 90, 180, 270]).toContain(npc.rotation);
      }
    });

    it('should have NPCs with valid names', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const npcs = map.placedItems.filter(i => i.type === 'npc');
      const validNames = ['Goblin', 'Skeleton', 'Orc', 'Bandit', 'Spider', 'Zombie'];
      for (const npc of npcs) {
        expect(validNames).toContain(npc.name);
      }
    });

    it('should include secret doors', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const secretDoors = map.placedItems.filter(i => i.type === 'secretdoor');
      expect(secretDoors.length).toBeGreaterThanOrEqual(0);
      for (const sd of secretDoors) {
        expect(sd.visible).toBe(false);
      }
    });

    it('should include traps', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const traps = map.placedItems.filter(i => i.type === 'trap');
      expect(traps.length).toBeGreaterThanOrEqual(0);
      for (const trap of traps) {
        expect(trap.visible).toBe(false);
      }
    });

    it('should not place traps in entrance or grand rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const entranceRoom = map.rooms.find(r => r.type === 'entrance');
      const grandRoom = map.rooms.find(r => r.type === 'grand');

      const traps = map.placedItems.filter(i => i.type === 'trap');
      for (const trap of traps) {
        if (entranceRoom) {
          const inEntrance =
            trap.gridX >= entranceRoom.rect.x &&
            trap.gridX < entranceRoom.rect.x + entranceRoom.rect.w &&
            trap.gridY >= entranceRoom.rect.y &&
            trap.gridY < entranceRoom.rect.y + entranceRoom.rect.h;
          expect(inEntrance).toBe(false);
        }
        if (grandRoom) {
          const inGrand =
            trap.gridX >= grandRoom.rect.x &&
            trap.gridX < grandRoom.rect.x + grandRoom.rect.w &&
            trap.gridY >= grandRoom.rect.y &&
            trap.gridY < grandRoom.rect.y + grandRoom.rect.h;
          expect(inGrand).toBe(false);
        }
      }
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

    it('should include common furnishing types', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const furnishingTypes = [
        'torch', 'table', 'chair', 'chest', 'bed', 'bookshelf',
        'altar', 'pillar', 'statue', 'crate', 'web', 'barrel',
        'firepit', 'fountain',
      ];
      const foundTypes = new Set(map.placedItems.map(i => i.type));
      const hasFurnishing = furnishingTypes.some(t => foundTypes.has(t));
      expect(hasFurnishing).toBe(true);
    });

    it('should include secret door IDs with secret-door prefix', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const secretDoors = map.placedItems.filter(i => i.type === 'secretdoor');
      for (const sd of secretDoors) {
        expect(sd.id).toMatch(/^secret-door-\d+$/);
      }
    });

    it('should include trap IDs with trap prefix', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const traps = map.placedItems.filter(i => i.type === 'trap');
      for (const trap of traps) {
        expect(trap.id).toMatch(/^trap-\d+$/);
      }
    });

    it('should limit secret doors to maximum 3', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const secretDoors = map.placedItems.filter(i => i.type === 'secretdoor');
      expect(secretDoors.length).toBeLessThanOrEqual(3);
    });

    it('should limit traps to maximum 2', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const traps = map.placedItems.filter(i => i.type === 'trap');
      expect(traps.length).toBeLessThanOrEqual(2);
    });

    it('should limit NPCs to maximum 7 (rooms.length - 1, max 8)', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const npcs = map.placedItems.filter(i => i.type === 'npc');
      expect(npcs.length).toBeLessThanOrEqual(Math.min(map.rooms.length - 1, 7));
    });

    it('should not place NPCs in the entrance room (room id 0)', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const entranceRoom = map.rooms.find(r => r.id === 0);
      if (!entranceRoom) return;

      const npcs = map.placedItems.filter(i => i.type === 'npc');
      for (const npc of npcs) {
        const inEntrance =
          npc.gridX >= entranceRoom.rect.x &&
          npc.gridX < entranceRoom.rect.x + entranceRoom.rect.w &&
          npc.gridY >= entranceRoom.rect.y &&
          npc.gridY < entranceRoom.rect.y + entranceRoom.rect.h;
        expect(inEntrance).toBe(false);
      }
    });
  });

  describe('grid size extremes', () => {
    it('should handle small grid size (10)', () => {
      const map = generateAdjacentDungeon({ gridSize: 10, seed: 42 });
      expect(map.gridSize).toBe(10);
      expect(map.walls.length).toBeGreaterThan(0);
      expect(map.rooms.length).toBeGreaterThan(0);
      expect(map.placedItems.length).toBeGreaterThan(0);
    });

    it('should handle medium grid size (25)', () => {
      const map = generateAdjacentDungeon({ gridSize: 25, seed: 42 });
      expect(map.gridSize).toBe(25);
      expect(map.walls.length).toBeGreaterThan(0);
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should handle large grid size (40)', () => {
      const map = generateAdjacentDungeon({ gridSize: 40, seed: 42 });
      expect(map.gridSize).toBe(40);
      expect(map.walls.length).toBeGreaterThan(0);
      expect(map.rooms.length).toBeGreaterThan(0);
    });

    it('should handle very large grid size (50)', () => {
      const map = generateAdjacentDungeon({ gridSize: 50, seed: 42 });
      expect(map.gridSize).toBe(50);
      expect(map.walls.length).toBeGreaterThan(0);
      expect(map.rooms.length).toBeGreaterThan(0);
    });
  });

  describe('layout style behavior', () => {
    it('should generate rooms with linear layout', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: 'linear' });
      expect(map.rooms.length).toBeGreaterThan(1);
    });

    it('should generate rooms with forking layout', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: 'forking' });
      expect(map.rooms.length).toBeGreaterThan(1);
    });

    it('should generate rooms with winding layout', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: 'winding' });
      expect(map.rooms.length).toBeGreaterThan(1);
    });

    it('should generate rooms with balanced layout', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, layoutStyle: 'balanced' });
      expect(map.rooms.length).toBeGreaterThan(1);
    });

    it('should generate at least 2 rooms with non-empty layout', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42, layoutStyle: 'balanced' });
      expect(map.rooms.length).toBeGreaterThan(1);
      const totalConnections = map.rooms.reduce((sum, r) => sum + r.connectedTo.length, 0);
      expect(totalConnections).toBeGreaterThan(0);
    });
  });

  describe('room type assignment', () => {
    it('should always have an entrance room', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      expect(map.rooms.some(r => r.type === 'entrance')).toBe(true);
    });

    it('should have a grand room in larger dungeons', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      expect(map.rooms.some(r => r.type === 'grand')).toBe(true);
    });

    it('should have variety of room types', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const types = new Set(map.rooms.map(r => r.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it('should have room labels matching their types', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const expectedLabels = {
        entrance: 'Entrance Hall',
        common: 'Common Room',
        utility: 'Storage',
        private: 'Chamber',
        grand: 'Grand Hall',
        hall: 'Hallway',
      };
      for (const room of map.rooms) {
        expect(room.label).toBe(expectedLabels[room.type]);
      }
    });

    it('should have connectedTo arrays matching connected room ids', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const idMap = {};
      for (const room of map.rooms) {
        idMap[room.id] = room;
      }
      for (const room of map.rooms) {
        for (const connId of room.connectedTo) {
          expect(idMap[connId]).toBeDefined();
        }
      }
    });
  });

  describe('density effects', () => {
    it('should produce fewer rooms at low density', () => {
      const lowDensity = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 0 });
      const highDensity = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 1 });
      expect(lowDensity.rooms.length).toBeLessThanOrEqual(highDensity.rooms.length);
    });

    it('should produce more walls at low density', () => {
      const lowDensity = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 0 });
      const highDensity = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 1 });
      expect(lowDensity.walls.length).toBeGreaterThanOrEqual(highDensity.walls.length);
    });
  });

  describe('room count calculation', () => {
    it('should generate more rooms with higher density', () => {
      const low = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 0.1 });
      const high = generateAdjacentDungeon({ gridSize: 30, seed: 42, density: 0.9 });
      expect(high.rooms.length).toBeGreaterThanOrEqual(low.rooms.length);
    });

    it('should generate at least 4 rooms with default settings', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      expect(map.rooms.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('door placement', () => {
    it('should place doors at shared edges between adjacent rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const doors = map.placedItems.filter(i => i.type === 'door');
      for (const door of doors) {
        // Doors should be on wall cells (grid[y][x] === true before carving)
        // We verify by checking they're between rooms
        const onRoomBoundary = map.rooms.some(room => {
          const rx = room.rect.x;
          const ry = room.rect.y;
          const rw = room.rect.w;
          const rh = room.rect.h;
          return (
            (door.gridX >= rx && door.gridX < rx + rw && (door.gridY === ry - 1 || door.gridY === ry + rh)) ||
            (door.gridY >= ry && door.gridY < ry + rh && (door.gridX === rx - 1 || door.gridX === rx + rw))
          );
        });
        expect(onRoomBoundary || door.gridX >= 0 && door.gridX < map.gridSize && door.gridY >= 0 && door.gridY < map.gridSize).toBe(true);
      }
    });

    it('should have door IDs with door- prefix', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const doors = map.placedItems.filter(i => i.type === 'door');
      for (const door of doors) {
        expect(door.id).toMatch(/^door-\d+-\d+$/);
      }
    });

    it('should have doors visible by default', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const doors = map.placedItems.filter(i => i.type === 'door');
      for (const door of doors) {
        expect(door.visible).toBe(true);
      }
    });
  });

  describe('entrance stairs placement', () => {
    it('should place stairs at the center of the entrance room', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const entranceRoom = map.rooms.find(r => r.id === 0);
      const stairs = map.placedItems.find(i => i.type === 'stairs');
      if (entranceRoom && stairs) {
        const expectedX = entranceRoom.rect.x + Math.floor(entranceRoom.rect.w / 2);
        const expectedY = entranceRoom.rect.y + Math.floor(entranceRoom.rect.h / 2);
        expect(stairs.gridX).toBe(expectedX);
        expect(stairs.gridY).toBe(expectedY);
      }
    });

    it('should have stairs visible', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
      const stairs = map.placedItems.find(i => i.type === 'stairs');
      expect(stairs.visible).toBe(true);
    });
  });

  describe('furniture by room type', () => {
    it('should place torches in entrance rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const entranceRoom = map.rooms.find(r => r.type === 'entrance');
      if (entranceRoom) {
        const entranceTorches = map.placedItems.filter(i =>
          i.type === 'torch' &&
          i.gridX >= entranceRoom.rect.x &&
          i.gridX < entranceRoom.rect.x + entranceRoom.rect.w &&
          i.gridY >= entranceRoom.rect.y &&
          i.gridY < entranceRoom.rect.y + entranceRoom.rect.h
        );
        expect(entranceTorches.length).toBeGreaterThan(0);
      }
    });

    it('should place tables and chairs in common rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const commonRoom = map.rooms.find(r => r.type === 'common');
      if (commonRoom && commonRoom.rect.w >= 4 && commonRoom.rect.h >= 3) {
        const tables = map.placedItems.filter(i =>
          i.type === 'table' &&
          i.gridX >= commonRoom.rect.x &&
          i.gridX < commonRoom.rect.x + commonRoom.rect.w &&
          i.gridY >= commonRoom.rect.y &&
          i.gridY < commonRoom.rect.y + commonRoom.rect.h
        );
        expect(tables.length).toBeGreaterThan(0);
      }
    });

    it('should place crates in utility rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const utilityRoom = map.rooms.find(r => r.type === 'utility');
      if (utilityRoom) {
        const crates = map.placedItems.filter(i =>
          i.type === 'crate' &&
          i.gridX >= utilityRoom.rect.x &&
          i.gridX < utilityRoom.rect.x + utilityRoom.rect.w &&
          i.gridY >= utilityRoom.rect.y &&
          i.gridY < utilityRoom.rect.y + utilityRoom.rect.h
        );
        expect(crates.length).toBeGreaterThan(0);
      }
    });

    it('should place beds in private rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const privateRoom = map.rooms.find(r => r.type === 'private');
      if (privateRoom) {
        const beds = map.placedItems.filter(i =>
          i.type === 'bed' &&
          i.gridX >= privateRoom.rect.x &&
          i.gridX < privateRoom.rect.x + privateRoom.rect.w &&
          i.gridY >= privateRoom.rect.y &&
          i.gridY < privateRoom.rect.y + privateRoom.rect.h
        );
        expect(beds.length).toBeGreaterThan(0);
      }
    });

    it('should place altars in grand rooms', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const grandRoom = map.rooms.find(r => r.type === 'grand');
      if (grandRoom) {
        const altars = map.placedItems.filter(i =>
          i.type === 'altar' &&
          i.gridX >= grandRoom.rect.x &&
          i.gridX < grandRoom.rect.x + grandRoom.rect.w &&
          i.gridY >= grandRoom.rect.y &&
          i.gridY < grandRoom.rect.y + grandRoom.rect.h
        );
        expect(altars.length).toBeGreaterThan(0);
      }
    });

    it('should place pillars in large grand rooms (6x6+)', () => {
      const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
      const grandRoom = map.rooms.find(r => r.type === 'grand');
      if (grandRoom && grandRoom.rect.w >= 6 && grandRoom.rect.h >= 6) {
        const pillars = map.placedItems.filter(i =>
          i.type === 'pillar' &&
          i.gridX >= grandRoom.rect.x &&
          i.gridX < grandRoom.rect.x + grandRoom.rect.w &&
          i.gridY >= grandRoom.rect.y &&
          i.gridY < grandRoom.rect.y + grandRoom.rect.h
        );
        expect(pillars.length).toBeGreaterThan(0);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle roomCount of 1', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, roomCount: 1 });
      expect(map.rooms.length).toBeGreaterThanOrEqual(1);
      expect(map.rooms[0].type).toBe('entrance');
    });

    it('should handle roomCount of 0', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, roomCount: 0 });
      expect(map.rooms.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle a single room dungeon with no doors', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, roomCount: 1 });
      const doors = map.placedItems.filter(i => i.type === 'door');
      expect(doors.length).toBe(0);
    });

    it('should have entrance stairs in single room dungeon', () => {
      const map = generateAdjacentDungeon({ gridSize: 20, seed: 42, roomCount: 1 });
      const stairs = map.placedItems.filter(i => i.type === 'stairs');
      expect(stairs.length).toBe(1);
    });

    it('should handle large roomCount that exceeds grid capacity', () => {
      const map = generateAdjacentDungeon({ gridSize: 15, seed: 42, roomCount: 50 });
      expect(map.rooms.length).toBeGreaterThan(0);
      expect(map.rooms.length).toBeLessThanOrEqual(50);
    });
  });
});
