// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import * as dungeonGenerator from './dungeonGenerator.js';
import { generateDungeon, visualize } from './dungeonGenerator.js';
import { generateAdjacentDungeon } from './adjacentDungeonGenerator.js';

// LANE: BASE CELLULAR DUNGEON GENERATION — BSP rooms, MST corridors, dead-end caps, seeded
// doors/furniture/NPCs, full-map JSON envelope. Ticket-distinct from #1167 adjacent lane
// (adjacentDungeonGenerator.test.js owns those bytes; this is the #1160 shape applied here).
// Owned by GenerateDungeonModal, which MOCKS this module and pins only its call tuple
// (#1010 transport exact-if-fetch) — the generator's own bytes are owned HERE, including the
// re-export wiring the Modal imports through this path (adjacent behavior NOT re-tested).
// RNG SEAM (#1076): mulberry32(seed) consumed BSP splits → room placement → corridor carve
// order → door types → torch shuffles → furniture rolls → trap picks → NPC picks → entrance
// shuffle → name → description, in that order. Any change to draw order, carve recipe, or
// furnishing tables breaks the ASCII maps, rosters, or name/description bytes below (#815).
// No wall-clock anywhere — output is a pure function of inputs (§ No Game Timers, MANDATORY).
// Zero mocks; nothing to restore (#1161). Dead-mock purge transitive (#1094/#1132): none left.
// Range-only "different seeds differ" and same-seed self-compares are banned (#1160/#1076):
// byte-exact pins subsume them — a constant-seed bug breaks multiple fixtures at once (#1022).
//
// old → new map (31 its → 6 its + 1 it.each × 3 legs):
//   required fields, seed echo, name/desc non-empty, players/zoom/pan defaults (4 its) →
//     flagship envelope toEqual exact key-set (no generationMode here — that's the adjacent
//     lane's field) + byte name/description RNG-order tripwire
//   determinism same-seed × 2, diff-seed, 100-seed sweep, multi-seed furniture/NPC/secret-door
//     coverage loops (8 its) → retired; 4 distinct seeds across 4 grid sizes are byte-pinned
//     below, which IS the determinism assertion (#1057 re-arm)
//   walls bounds/not-full + placedItems fields/dedupe/unique-ids + torch/stairs/door/
//     furniture/trap/NPC presence + NPC names/rotations + trapType enum (12 its) → flagship
//     full roster pin (id:type@x,y:rot:name:hidden) + dense g30 exact census (subsumes all
//     presence checks and the 7-NPC cap) + flood-fill connectivity (#1099) + exact NPC and
//     trap bytes
//   grid extremes g10/g40 + density 0/1 (1 it) → ASCII legs g10 s42, g16 s7, g40 s13 and
//     clamp-reach leg below (#1035)
//   density clamp, null/undefined/{}/seed-0 coercion (2 its) → coercion test (#959; note the
//     lanes' honest asymmetry: seed uses != null so seed 0 drives the RNG, gridSize uses ||
//     so 0 collapses to 30 — both asserted, not smoothed over)
//   corridor-trap no-fail placeholder (1 it) → corridor trap@4,7 pinned byte-exact in the
//     dense census leg
//   visualize dims × 2, floor/wall/stairs glyphs, conditional glyph loop (5 its) → synthetic
//     glyph-map exact-string pin + degenerate g5 visualize byte pin

// Walls as ASCII rows — one ASCII row pins the exact wall set for every cell of the map.
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

// Compact full-field serializer: id:type@x,y:rotation:name:visible.
const itemBytes = (i) =>
  `${i.id}:${i.type}@${i.gridX},${i.gridY}:${i.rotation ?? ''}${i.name ? `:${i.name}` : ''}${i.visible ? '' : ':hidden'}`;

describe('dungeonGenerator', () => {
  it('module surface: exactly generateDungeon + visualize, and re-exports the adjacent generator the Modal imports through here', () => {
    expect(Object.keys(dungeonGenerator).sort()).toEqual(['generateAdjacentDungeon', 'generateDungeon', 'visualize']);
    // Wiring pin only — adjacent behavior is owned by adjacentDungeonGenerator.test.js.
    expect(dungeonGenerator.generateAdjacentDungeon).toBe(generateAdjacentDungeon);
  });

  it('byte-exact flagship g20 seed 42: envelope, wall ASCII, and full placed-item roster', () => {
    const map = generateDungeon({ gridSize: 20, seed: 42 });
    expect(map).toEqual({
      name: 'The Sunken Vault of Despair',
      description: "The air is thick with dust and the smell of decay. Collapsed passages hint at the dungeon's age. The undead are said to wander these halls.",
      gridSize: 20,
      seed: 42,
      walls: expect.any(Array),
      placedItems: expect.any(Array),
      players: [],
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    // BSP rooms joined by MST corridors; secret door at 8,14 flipped back to wall before the
    // wall scan; 256 wall cells, walls not full. Subsumes bounds, order, dedupe-by-cell.
    expect(map.walls.length).toBe(256);
    expect(ascii(map)).toEqual([
      '####################',
      '####################',
      '####.........#######',
      '####.........#######',
      '####..........######',
      '####..........######',
      '######.######.######',
      '######.####....#####',
      '###.....###....#####',
      '###.....###....#####',
      '###.....###....#####',
      '###.....#####.....##',
      '#####.###.........##',
      '#####.###.........##',
      '##......#.........##',
      '##......#.........##',
      '##......############',
      '##......############',
      '####################',
      '####################',
    ]);
    // Full roster: torches/furniture/doors/NPCs/stairs with rotation, names, hidden flags.
    // npc-1 is genuinely absent: the entrance stairs landed on its room-center cell (5,16)
    // after placement, and position dedupe keeps the LAST placed item — the stairs win.
    expect(map.placedItems.map(itemBytes)).toEqual([
      'torch-0-7-5:torch@7,5:270',
      'torch-0-5-5:torch@5,5:270',
      'torch-0-5-2:torch@5,2:90',
      'table-0:table@5,4:0',
      'chair-0:chair@6,3:0',
      'torch-1-4-8:torch@4,8:90',
      'torch-1-4-11:torch@4,11:270',
      'torch-1-6-11:torch@6,11:270',
      'chest-1:chest@6,9:90',
      'torch-2-6-14:torch@6,14:90',
      'table-2:table@4,16:0',
      'chair-2:chair@5,15:0',
      'table-3:table@10,4:0',
      'chair-3:chair@11,3:0',
      'torch-4-11-9:torch@11,9:0',
      'statue-4:statue@13,9:0',
      'table-5:table@10,14:0',
      'chair-5:chair@11,13:0',
      'torch-6-16-11:torch@16,11:90',
      'torch-6-17-13:torch@17,13:180',
      'statue-6:statue@15,13:0',
      'npc-0:npc@5,10:180:Skeleton:hidden',
      'npc-2:npc@11,4:0:Orc:hidden',
      'npc-3:npc@12,9:0:Goblin:hidden',
      'npc-4:npc@11,14:0:Zombie:hidden',
      'npc-5:npc@14,13:90:Zombie:hidden',
      'entrance-stairs:stairs@5,16:',
      'door-0:door@6,6:90',
      'door-1:door@5,12:90',
      'door-2:secretDoor@8,14:0:hidden',
      'door-3:door@13,6:90',
      'door-4:door@13,11:90',
    ]);
  });

  it.each([
    // single BSP-culled room + filler at the smallest common size: one open pocket, no doors.
    [10, 42, [
      '##########',
      '##########',
      '###.....##',
      '###.....##',
      '###.....##',
      '###.....##',
      '###.....##',
      '###.....##',
      '##########',
      '##########',
    ]],
    // winding corridors through 4 rooms, joined by 3 doors.
    [16, 7, [
      '################',
      '################',
      '###.....##....##',
      '###.....##....##',
      '###.....##....##',
      '###.....##....##',
      '##....##....####',
      '##....##....####',
      '##..........####',
      '##....##....####',
      '##....##########',
      '##....##########',
      '##....##########',
      '##....##########',
      '################',
      '################',
    ]],
    // large-grid extreme: 12 rooms, bed/pillars/bookshelves, 8 doors incl. one secret.
    [40, 13, [
      '########################################',
      '########################################',
      '##.....####.....................########',
      '##.....####.....................########',
      '##.....####.....................########',
      '##.....####.....................########',
      '##.....####.....................########',
      '##......#.....##..........##.........###',
      '##......#.....##..........##.........###',
      '##............##..........##.........###',
      '##......#.....##..........##.........###',
      '##......#.....##..........##.........###',
      '#############.##..........##.........###',
      '#############.##.....................###',
      '#############.##..........##.........###',
      '#############.##..........##.........###',
      '#############.##..........##.........###',
      '#############.##..........##.........###',
      '#############.##..........##.........###',
      '#############.###.............##########',
      '#############.###.............##########',
      '####......###.###.............##########',
      '####......###.###.............##########',
      '####......###.###.............##########',
      '####............#.............##########',
      '####......#######.............##########',
      '####......#######.............##########',
      '#######.#########.............##########',
      '#######.#########.............##########',
      '##......########...........#############',
      '##......########...........#############',
      '##......########...........#############',
      '##......########...........#############',
      '##......########...........#############',
      '##......########...........#############',
      '##......########...........#############',
      '##......########...........#############',
      '################...........#############',
      '########################################',
      '########################################',
    ]],
  ])('g%i seed %i is byte-pinned (and echoes its seed)', (gridSize, seed, expected) => {
    const map = generateDungeon({ gridSize, seed });
    expect(map.seed).toBe(seed);
    expect(ascii(map)).toEqual(expected);
  });

  it('dense g30 seed 42: single connected dungeon, exact census, hidden-set invariants', () => {
    const map = generateDungeon({ gridSize: 30, seed: 42 });
    const walls = new Set(map.walls);
    expect(walls.size).toBe(map.walls.length);

    const open = new Set();
    for (let y = 0; y < map.gridSize; y++) {
      for (let x = 0; x < map.gridSize; x++) {
        if (!walls.has(`${x},${y}`)) open.add(`${x},${y}`);
      }
    }
    // Structural tripwire (#1099): flood from the entrance stairs reaches every open cell —
    // MST connection plus loop corridors leave no isolated pocket.
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
    expect(seen).toEqual(open);

    const census = {};
    const positions = new Set();
    const ids = new Set();
    for (const item of map.placedItems) {
      census[item.type] = (census[item.type] || 0) + 1;
      positions.add(`${item.gridX},${item.gridY}`);
      ids.add(item.id);
      expect(item.gridX).toBeGreaterThanOrEqual(0);
      expect(item.gridX).toBeLessThan(map.gridSize);
      expect(item.gridY).toBeGreaterThanOrEqual(0);
      expect(item.gridY).toBeLessThan(map.gridSize);
      // Hidden set is exactly {npc, trap, secretDoor}; secret doors sit on WALL cells (the
      // item placer re-walls them so the corridor closes until revealed), NPCs/traps hide on
      // carved floor, and everything else stands visible on floor.
      const onWall = walls.has(`${item.gridX},${item.gridY}`);
      const expectedPair = item.type === 'secretDoor' ? [true, false]
        : ['npc', 'trap'].includes(item.type) ? [false, false]
          : [false, true];
      expect([onWall, item.visible]).toEqual(expectedPair);
    }
    expect(positions.size).toBe(map.placedItems.length);
    expect(ids.size).toBe(map.placedItems.length);
    // Exact census subsumes every former presence/cap loop: rooms 1-7 yield the max 7 NPCs,
    // this seed rolls exactly 1 trap, and no secret door here (the flagship pins one at 8,14).
    expect(census).toEqual({
      torch: 20, bookshelf: 3, table: 4, chair: 7, chest: 2, bed: 1, statue: 3, altar: 1,
      trap: 1, npc: 7, stairs: 1, door: 13,
    });
    // NPC draws land on the name/rotation tables; junction trap is a corridor pit.
    expect(map.placedItems.filter((i) => i.type === 'npc').map(itemBytes)).toEqual([
      'npc-0:npc@9,4:0:Spider:hidden',
      'npc-1:npc@4,9:0:Goblin:hidden',
      'npc-2:npc@7,18:0:Zombie:hidden',
      'npc-3:npc@4,23:180:Goblin:hidden',
      'npc-4:npc@9,24:180:Goblin:hidden',
      'npc-5:npc@15,4:0:Bandit:hidden',
      'npc-6:npc@24,6:270:Orc:hidden',
    ]);
    expect(map.placedItems.filter((i) => i.type === 'trap')
      .map((i) => `${i.id}@${i.gridX},${i.gridY}:${i.trapType}`))
      .toEqual(['corridor-trap-4-7@4,7:pit']);
  });

  it('options coerce honestly: density ±saturate to 0/1 byte-exact, seed 0 honored, gridSize 0 falls back to 30', () => {
    const gen = (opts) => generateDungeon({ gridSize: 30, seed: 42, ...opts });
    // Clamp reach-branch (#1035): saturated values are indistinguishable from their bounds…
    expect(ascii(gen({ density: -1 }))).toEqual(ascii(gen({ density: 0 })));
    expect(ascii(gen({ density: 2 }))).toEqual(ascii(gen({ density: 1 })));
    // …and clamping actually changed the map vs the 0.5 default BSP target-split count.
    expect(ascii(gen({ density: -1 }))).not.toEqual(ascii(gen({})));
    expect(ascii(gen({ density: 2 }))).not.toEqual(ascii(gen({})));
    // seed 0 is falsy but must still echo AND drive mulberry32 (#959 coercion honesty)…
    const zero = generateDungeon({ gridSize: 20, seed: 0 });
    expect(zero.seed).toBe(0);
    expect(zero.name).toBe('The Iron Vault of Eternal Night');
    // …while gridSize 0 hits the || default and collapses to 30 (asserted, not smoothed over).
    expect(generateDungeon({ gridSize: 0, seed: 42 }).gridSize).toBe(30);
    // Missing opts coerce to an empty object; the map is still carved, not collapsed.
    for (const opts of [null, undefined, {}]) {
      const map = generateDungeon(opts);
      expect(map.gridSize).toBe(30);
      expect(map.walls.length).toBeGreaterThan(0);
      expect(map.walls.length).toBeLessThan(900);
      expect(map.placedItems.length).toBeGreaterThan(0);
    }
    // Unseeded runs draw a random integer seed and differ run-to-run. The seed field is
    // decorative here: the RNG was Math.random when it was stamped, so an unseeded map is
    // NOT reproducible from its reported seed (source limitation, asserted not hidden).
    const unseeded = generateDungeon({ gridSize: 20 });
    expect(Number.isInteger(unseeded.seed) && unseeded.seed >= 0).toBe(true);
    expect(generateDungeon({ gridSize: 20 }).seed).not.toBe(unseeded.seed);
  });

  it('degenerate g5 seed 42 honest: minRoom clamps to a 3x2 carve, one torch, stairs inside, nothing else', () => {
    const map = generateDungeon({ gridSize: 5, seed: 42 });
    expect(ascii(map)).toEqual([
      '#####',
      '#####',
      '##...',
      '##...',
      '#####',
    ]);
    // One room survives (filler), nothing to connect: no doors, no NPCs — just a torch and
    // the entrance stairs fallback onto the room. Name bytes keep the RNG-order tripwire.
    expect(map.placedItems.map(itemBytes)).toEqual([
      'torch-0-2-3:torch@2,3:0',
      'entrance-stairs:stairs@3,3:',
    ]);
    expect(map.name).toBe('The Shadow Keep');
    expect(visualize(map)).toBe('█████\n█████\n██···\n██·>·\n█████');
  });

  it('visualize maps a synthetic grid byte-exactly: block walls, dot floor, glyph overlay on wall cells too', () => {
    const map = {
      gridSize: 4,
      walls: ['0,0', '1,0', '2,2', '3,3'],
      placedItems: [
        { id: 't', type: 'torch', gridX: 0, gridY: 1, visible: true, rotation: 90 },
        { id: 'd', type: 'door', gridX: 1, gridY: 0, visible: true, rotation: 90 },
        { id: 's', type: 'secretDoor', gridX: 2, gridY: 2, visible: false },
        { id: 'st', type: 'stairs', gridX: 3, gridY: 0, visible: true },
        { id: 'n', type: 'npc', gridX: 0, gridY: 3, visible: false, name: 'Goblin', rotation: 0 },
        { id: 'c', type: 'chest', gridX: 1, gridY: 1, visible: true },
        { id: 'a', type: 'altar', gridX: 2, gridY: 0, visible: true },
        { id: 'tr', type: 'trap', gridX: 3, gridY: 1, visible: false },
        { id: 'w', type: 'web', gridX: 2, gridY: 3, visible: true },
      ],
    };
    // Every glyph mapped once: + door, s secret, > stairs, @ npc, = chest, A altar, ^ trap.
    // Wall-cell glyphs (door at 1,0; secret at 2,2; wall at 3,3) overlay; torch and web have
    // no glyph and leave floor as '·' / walls as '█'.
    expect(visualize(map)).toBe(
      '█+A>\n' +
      '·=·^\n' +
      '··s·\n' +
      '@··█',
    );
  });
});
