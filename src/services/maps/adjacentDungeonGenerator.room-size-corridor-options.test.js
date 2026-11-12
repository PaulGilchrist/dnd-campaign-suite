// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { generateAdjacentDungeon } from './adjacentDungeonGenerator.js';

// LANE: ROOM-SIZE / CORRIDOR-LENGTH OPTION CONSUMPTION (bug-adjacent-room-size-corridor-controls-inert).
// The Room-Adjacent generator used to recompute minRoom/maxRoom from gridSize alone and never read
// opts.minRoom/opts.maxRoom/opts.corridorLength, so the modal's Room Size and Corridor Length
// controls were inert: Cramped vs Spacious vs +Sprawling at the same seed produced byte-identical
// maps. These pins lock that the passed options now drive the layout. General generator lanes
// (flagship bytes, layouts, census, sweep) live in adjacentDungeonGenerator.test.js — not re-tested here.

// Same normalize as the live repro: walls + item positions/types only.
const ascii = (map) => {
  const walls = new Set(map.walls);
  const rows = [];
  for (let y = 0; y < map.gridSize; y++) {
    let row = '';
    for (let x = 0; x < map.gridSize; x++) row += walls.has(`${x},${y}`) ? '#' : '.';
    rows.push(row);
  }
  return rows;
};

const itemBytes = (map) => map.placedItems.map((i) => `${i.type}@${i.gridX},${i.gridY}`);

// Values the modal computes for grid 20 (baseMin 4 / baseMax 8, 0.7x/1.0x/1.3x floors).
const ROOM_SIZE = {
  cramped: { minRoom: 3, maxRoom: 6 },
  standard: { minRoom: 4, maxRoom: 8 },
  spacious: { minRoom: 5, maxRoom: 10 },
};

const modalOpts = (seed, { minRoom, maxRoom }, corridorLength) => ({
  gridSize: 20,
  density: 0.5,
  seed,
  roomCount: 8,
  corridorLength,
  layoutStyle: 'balanced',
  minRoom,
  maxRoom,
});

describe('generateAdjacentDungeon room-size / corridor-length options', () => {
  it('Room Size drives the layout: cramped vs standard vs spacious (same seed) all differ', () => {
    const gen = (size) => generateAdjacentDungeon(modalOpts(42, ROOM_SIZE[size], 'compact'));
    const cram = gen('cramped');
    const std = gen('standard');
    const spc = gen('spacious');
    // The bug's exact face: these three used to be byte-for-byte identical.
    expect(ascii(cram)).not.toEqual(ascii(std));
    expect(ascii(std)).not.toEqual(ascii(spc));
    expect(ascii(cram)).not.toEqual(ascii(spc));
    expect(itemBytes(cram)).not.toEqual(itemBytes(spc));
  });

  it('opts equal to the internal gridSize floors are an honest no-op (byte-identical to default)', () => {
    // g20 internal floors are minRoom 4 / maxRoom 8 — passing exactly them must not change bytes.
    const withOpts = generateAdjacentDungeon({ gridSize: 20, seed: 42, minRoom: 4, maxRoom: 8 });
    const defaultMap = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
    expect(ascii(withOpts)).toEqual(ascii(defaultMap));
    expect(withOpts.placedItems).toEqual(defaultMap.placedItems);
  });

  it('overshoot minRoom:99 clamps to the grid and differs from default without breaking bounds', () => {
    const clamped = generateAdjacentDungeon({ gridSize: 20, seed: 42, minRoom: 99 });
    const defaultMap = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
    expect(ascii(clamped)).not.toEqual(ascii(defaultMap));
    // Room spans saturate at roomMaxSpan (gridSize-2): the map is one huge
    // carve but walls and floors still account for every cell exactly once.
    const walls = new Set(clamped.walls);
    let floors = 0;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        if (!walls.has(`${x},${y}`)) floors++;
      }
    }
    expect(floors).toBeGreaterThan(0);
    expect(walls.size).toBe(400 - floors);
    for (const wall of clamped.walls) {
      const [x, y] = wall.split(',').map(Number);
      expect(x >= 0 && x < 20 && y >= 0 && y < 20).toBe(true);
    }
  });

  it('Corridor Length drives the layout: compact vs moderate vs sprawling (same seed) all differ', () => {
    const gen = (len) => generateAdjacentDungeon(modalOpts(42, ROOM_SIZE.standard, len));
    const compact = gen('compact');
    const moderate = gen('moderate');
    const sprawling = gen('sprawling');
    expect(ascii(compact)).not.toEqual(ascii(moderate));
    expect(ascii(moderate)).not.toEqual(ascii(sprawling));
    expect(ascii(compact)).not.toEqual(ascii(sprawling));
    // Compact is the legacy behavior: byte-identical whether or not it is named.
    expect(ascii(compact)).toEqual(ascii(generateAdjacentDungeon(modalOpts(42, ROOM_SIZE.standard, undefined))));
    // Wider gaps join rooms by carved halls instead of single door cells, and
    // the spacing eats grid capacity — fewer rooms fit, so fewer doors.
    const doors = (map) => map.placedItems.filter((i) => i.type === 'door').length;
    expect(doors(sprawling)).toBeLessThan(doors(compact));
  });

  it('sprawling stays one connected dungeon (halls actually join the rooms)', () => {
    const map = generateAdjacentDungeon(modalOpts(42, ROOM_SIZE.spacious, 'sprawling'));
    const walls = new Set(map.walls);
    const stairs = map.placedItems.find((i) => i.type === 'stairs');
    const seen = new Set([`${stairs.gridX},${stairs.gridY}`]);
    const queue = [[stairs.gridX, stairs.gridY]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${x + dx},${y + dy}`;
        if (!seen.has(key) && !walls.has(key)) {
          seen.add(key);
          queue.push([x + dx, y + dy]);
        }
      }
    }
    let open = 0;
    for (let y = 0; y < map.gridSize; y++) {
      for (let x = 0; x < map.gridSize; x++) if (!walls.has(`${x},${y}`)) open++;
    }
    expect(seen.size).toBe(open);
  });

  it('options keep the seed contract: same opts twice replay byte-identical, different seeds differ', () => {
    const opts = modalOpts(42, ROOM_SIZE.spacious, 'sprawling');
    expect(ascii(generateAdjacentDungeon(opts))).toEqual(ascii(generateAdjacentDungeon(opts)));
    expect(ascii(generateAdjacentDungeon(opts))).not.toEqual(
      ascii(generateAdjacentDungeon(modalOpts(1337, ROOM_SIZE.spacious, 'sprawling'))),
    );
  });
});
