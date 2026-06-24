// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { generateOutdoorEncounter } from './outdoorEncounterGenerator.js';

// ── Helpers ───────────────────────────────────────────────────────
const defaultPlayers = ['Finn', 'Zariel', 'Thorin', 'Lyra'];

function gen(terrainType, gridSize, marchingOrder, q, r) {
  return generateOutdoorEncounter(terrainType, gridSize, marchingOrder, q, r);
}

// ════════════════════════════════════════════════════════════════════
// Structural tests — return shape and default values
// ════════════════════════════════════════════════════════════════════
describe('generateOutdoorEncounter', () => {
  describe('return shape', () => {
    it('returns an object with all expected top-level keys', () => {
      const result = gen('forest', 10, defaultPlayers, 0, 0);
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('parentTerrain');
      expect(result).toHaveProperty('parentHex');
      expect(result).toHaveProperty('gridSize');
      expect(result).toHaveProperty('walls');
      expect(result).toHaveProperty('placedItems');
      expect(result).toHaveProperty('players');
      expect(result).toHaveProperty('fog');
      expect(result).toHaveProperty('zoom');
      expect(result).toHaveProperty('panX');
      expect(result).toHaveProperty('panY');
      expect(result).toHaveProperty('bgFill');
    });

    it('type is always "indoor"', () => {
      const result = gen('forest', 10, defaultPlayers, 0, 0);
      expect(result.type).toBe('indoor');
    });

    it('walls is an empty array', () => {
      const result = gen('forest', 10, defaultPlayers, 0, 0);
      expect(result.walls).toEqual([]);
    });

    it('fog is an empty array', () => {
      const result = gen('forest', 10, defaultPlayers, 0, 0);
      expect(result.fog).toEqual([]);
    });

    it('zoom defaults to 1', () => {
      const result = gen('forest', 10, defaultPlayers, 0, 0);
      expect(result.zoom).toBe(1);
    });

    it('panX and panY default to 0', () => {
      const result = gen('forest', 10, defaultPlayers, 0, 0);
      expect(result.panX).toBe(0);
      expect(result.panY).toBe(0);
    });

    it('parentTerrain echoes the input terrainType', () => {
      for (const t of ['forest', 'plains', 'mountains', 'desert']) {
        const result = gen(t, 10, defaultPlayers, 0, 0);
        expect(result.parentTerrain).toBe(t);
      }
    });

    it('parentHex echoes the input q and r values', () => {
      const result = gen('forest', 10, [], 5, -3);
      expect(result.parentHex).toEqual({ q: 5, r: -3 });
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Determinism — same seed always produces the same output
  // ════════════════════════════════════════════════════════════════════
  describe('determinism (seeded RNG)', () => {
    it('same terrain, gridSize, q, r produces identical placedItems', () => {
      const a = gen('forest', 10, defaultPlayers, 1, 2);
      const b = gen('forest', 10, defaultPlayers, 1, 2);
      expect(a.placedItems).toEqual(b.placedItems);
    });

    it('same terrain, gridSize, q, r produces identical players', () => {
      const a = gen('plains', 14, ['Alice', 'Bob'], 0, 0);
      const b = gen('plains', 14, ['Alice', 'Bob'], 0, 0);
      expect(a.players).toEqual(b.players);
    });

    it('different q/r produces different placedItems for same terrain', () => {
      const a = gen('forest', 20, [], 0, 0);
      const b = gen('forest', 20, [], 1, 2);
      expect(a.placedItems).not.toEqual(b.placedItems);
    });

    it('same q/r with different gridSize produces different placedItems', () => {
      const a = gen('plains', 14, [], 0, 0);
      const b = gen('plains', 20, [], 0, 0);
      expect(a.placedItems).not.toEqual(b.placedItems);
    });

    it('q=0,r=0 produces a repeatable bgFill for forest', () => {
      const result = gen('forest', 10, [], 0, 0);
      expect(result.bgFill).toBe('#2D5E37');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Terrain-to-biome mapping (via bgFill colours)
  // ════════════════════════════════════════════════════════════════════
  describe('biome bgFill mapping', () => {
    it('uses correct bgFill for each terrain type', () => {
      const expected = {
        forest: '#2D5E37',
        plains: '#7A9B6A',
        mountains: '#6F6F62',
        hills: '#6B8E50',
        swamp: '#4A6B3A',
        desert: '#C4B080',
        tundra: '#8CA0A0',
        beach: '#D4C080',
      };
      for (const [terrain, color] of Object.entries(expected)) {
        const result = gen(terrain, 10, [], 0, 0);
        expect(result.bgFill).toBe(color);
      }
    });

    it('falls back to plains bgFill for an unknown terrain type', () => {
      const result = gen('underwater', 10, [], 0, 0);
      expect(result.bgFill).toBe('#7A9B6A');
    });

    it('falls back to plains bgFill when terrainType is null', () => {
      const result = gen(null, 10, [], 0, 0);
      expect(result.bgFill).toBe('#7A9B6A');
    });

    it('falls back to plains bgFill when terrainType is empty string', () => {
      const result = gen('', 10, [], 0, 0);
      expect(result.bgFill).toBe('#7A9B6A');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Player positioning from marchingOrder
  // ════════════════════════════════════════════════════════════════════
  describe('player positioning', () => {
    it('empty marchingOrder produces no players', () => {
      const result = gen('forest', 10, [], 0, 0);
      expect(result.players).toEqual([]);
    });

    it('places a single player near the grid center', () => {
      const result = gen('forest', 10, ['Solo'], 0, 0);
      expect(result.players).toHaveLength(1);
      expect(result.players[0].name).toBe('Solo');
      expect(result.players[0].gridX).toBe(4);
      expect(result.players[0].gridY).toBe(4);
    });

    it('places four players in a 2x2 block near center (gridSize=10)', () => {
      const result = gen('forest', 10, defaultPlayers, 0, 0);
      expect(result.players).toHaveLength(4);
      expect(result.players[0].gridX).toBe(4);
      expect(result.players[0].gridY).toBe(4);
      expect(result.players[1].gridX).toBe(5);
      expect(result.players[1].gridY).toBe(4);
      expect(result.players[2].gridX).toBe(6);
      expect(result.players[2].gridY).toBe(4);
      expect(result.players[3].gridX).toBe(4);
      expect(result.players[3].gridY).toBe(5);
    });

    it('player id is derived from name (lowercase, spaces to dashes)', () => {
      const result = gen('forest', 10, ['Sir Lancelot', 'Lady Grey'], 0, 0);
      expect(result.players[0].id).toBe('sir-lancelot');
      expect(result.players[1].id).toBe('lady-grey');
    });

    it('handles seven players wrapping to more rows', () => {
      const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const result = gen('forest', 20, names, 0, 0);
      expect(result.players).toHaveLength(7);
      expect(result.players[3].gridX).toBe(9);
      expect(result.players[3].gridY).toBe(10);
      expect(result.players[6].gridX).toBe(9);
      expect(result.players[6].gridY).toBe(11);
    });

    it('handles odd grid size correctly (center=Math.floor)', () => {
      const result = gen('forest', 9, ['Only'], 0, 0);
      expect(result.players[0].gridX).toBe(3);
      expect(result.players[0].gridY).toBe(3);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Placed items — structure and constraints
  // ════════════════════════════════════════════════════════════════════
  describe('placed items', () => {
    it('each placedItem has required fields: id, type, gridX, gridY, visible', () => {
      const result = gen('forest', 20, [], 0, 0);
      for (const item of result.placedItems) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('gridX');
        expect(item).toHaveProperty('gridY');
        expect(item.visible).toBe(true);
      }
    });

    it('item type is one of the biome features types', () => {
      const result = gen('forest', 20, [], 0, 0);
      const allowedTypes = ['tree', 'boulder', 'bush'];
      for (const item of result.placedItems) {
        expect(allowedTypes).toContain(item.type);
      }
    });

    it('desert items only have boulder or bush types', () => {
      const result = gen('desert', 20, [], 0, 0);
      for (const item of result.placedItems) {
        expect(['boulder', 'bush']).toContain(item.type);
      }
    });

    it('item id follows pattern "type-counter"', () => {
      const result = gen('forest', 20, [], 1, 1);
      for (const item of result.placedItems) {
        expect(item.id).toMatch(/^(tree|boulder|bush)-\d+$/);
      }
    });

    it('item ids are unique within a single encounter', () => {
      const result = gen('forest', 20, [], 1, 1);
      const ids = result.placedItems.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('placed items are within grid bounds for gridSize=14', () => {
      const result = gen('plains', 14, [], 0, 0);
      for (const item of result.placedItems) {
        expect(item.gridX).toBeGreaterThanOrEqual(0);
        expect(item.gridX).toBeLessThan(14);
        expect(item.gridY).toBeGreaterThanOrEqual(0);
        expect(item.gridY).toBeLessThan(14);
      }
    });

    it('placed items never overlap (unique coordinates)', () => {
      const result = gen('forest', 30, [], 0, 0);
      const keys = result.placedItems.map((i) => `${i.gridX},${i.gridY}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('has at least 4 placed items on a large enough grid', () => {
      const result = gen('forest', 30, [], 0, 0);
      expect(result.placedItems.length).toBeGreaterThanOrEqual(4);
    });

    it('still generates at least 4 items on a medium grid', () => {
      const result = gen('plains', 15, [], 0, 0);
      expect(result.placedItems.length).toBeGreaterThanOrEqual(4);
    });

    it('on a very small grid items avoid the center clear zone', () => {
      const result = gen('forest', 10, [], 0, 0);
      for (const item of result.placedItems) {
        const inClearZoneX = item.gridX >= 1 && item.gridX <= 9;
        const inClearZoneY = item.gridY >= 1 && item.gridY <= 9;
        expect(inClearZoneX && inClearZoneY).toBe(false);
      }
    });

    it('water biome returns empty placedItems with correct bgFill', () => {
      const result = gen('water', 10, [], 0, 0);
      expect(result.placedItems).toEqual([]);
      expect(result.bgFill).toBe('#356090');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // GridSize edge cases
  // ════════════════════════════════════════════════════════════════════
  describe('gridSize edge cases', () => {
    it('uses the provided gridSize in the return value', () => {
      const result = gen('forest', 25, [], 0, 0);
      expect(result.gridSize).toBe(25);
    });

    it('handles a very large grid without exceeding max items (60)', () => {
      const result = gen('forest', 100, [], 0, 0);
      expect(result.placedItems.length).toBeLessThanOrEqual(60);
    });

    it('generates encounter data for a small grid (gridSize=5)', () => {
      const result = gen('plains', 5, ['Tiny'], 0, 0);
      expect(result.gridSize).toBe(5);
      expect(result.placedItems).toBeInstanceOf(Array);
    });

    it('generates encounter data for a default-size grid (gridSize=30)', () => {
      const result = gen('forest', 30, defaultPlayers, 0, 0);
      expect(result.gridSize).toBe(30);
      expect(result.players.length).toBe(4);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Negative / unusual q and r values
  // ════════════════════════════════════════════════════════════════════
  describe('negative and unusual hex coordinates', () => {
    it('handles negative q and r', () => {
      const result = gen('plains', 10, [], -5, -3);
      expect(result.parentHex.q).toBe(-5);
      expect(result.parentHex.r).toBe(-3);
      expect(result.placedItems).toBeInstanceOf(Array);
    });

    it('handles large q and r values without crashing', () => {
      const result = gen('mountains', 10, [], 999, -999);
      expect(result.placedItems).toBeInstanceOf(Array);
      expect(result.bgFill).toBe('#6F6F62');
    });
  });
});
