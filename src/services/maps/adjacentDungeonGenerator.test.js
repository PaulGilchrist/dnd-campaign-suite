// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { generateAdjacentDungeon } from './adjacentDungeonGenerator.js';

// LANE: ADJACENT-DUNGEON GENERATION — seeded room-by-room builder (seed room → adjacent rooms
// joined by carved door cells, cluster corridors, per-type furnishing, NPCs/secrets/traps,
// position dedupe). Owned by GenerateDungeonModal, which MOCKS this module and pins only its
// call tuple (#1010 transport exact-if-fetch) — the generator's own bytes are owned HERE.
// Adjacency/grid neighbors owned by reachability.test.js (editor movement lane, invented
// grids); base generative dungeonGenerator.test.js is ticket-distinct (#976). Not re-tested here.
// RNG SEAM (#1072): mulberry32(seed) consumed seed-rect → placeRooms → connectClusters →
// assignRoomTypes → furnish* → NPCs → stairs → secrets → traps → name → description, in that
// order. Any change to draw order, room recipe, or furnishing tables breaks the name/description
// bytes or the ASCII/roster pins below (#815). No wall-clock anywhere — output is a pure
// function of inputs (§ No Game Timers). Zero mocks; nothing to restore (#1161).
// Range-only "different seeds differ" and same-seed self-compares are banned (#1160/#1076):
// byte-exact pins subsume them — a constant-seed bug breaks multiple fixtures at once (#1022).
//
// old → new map (35 its → 5 its + 1 it.each table):
//   options handling (7 its: defaults/custom gridSize, density clamp, layoutStyle loop,
//     seed echo, random seed, empty/undefined opts) → coercions+clamp-reach test (density -1≡0
//     and 2≡1 byte-exact, clamped ≠ default 0.5, #1035; seed 0 honored #959; unseeded seed =
//     integer ≥ 0 and distinct) + layoutStyle loop → it.each ASCII table below
//   output structure (4 its: required keys, mode, players/zoom/pan, name/desc) → flagship
//     envelope toEqual (exact key set, byte name/description — RNG-order tripwire #1076)
//   deterministic output (3 its: same-seed self-compares, diff-seed, unseeded-differs) →
//     removed (#1160): flagship + layout + degenerate fixtures are all byte-pinned; random-seed
//     leg kept honestly (generator discards the random RNG draw, so a seedless map is NOT
//     reproducible from its seed field — asserted, not hidden)
//   walls bounds/not-full + placedItems (16 its: fields, dedupe, stairs/torches/doors/NPCs
//     presence, rotations, secret-door/trap prefixes, caps 3/2/7) → flagship full roster pin
//     (every item id/type/pos/rotation/name/visible) + dense g30 census sweep (exact type
//     census subsumes all caps and presence loops; connectivity flood-fill is the "adjacent"
//     promise as one structural tripwire #1099; secrets sit on wall cells, everything else on
//     floor)
//   grid extremes (g10/g40) + edge cases (roomCount 0/1, stairs, no doors) → degenerate g12
//     honest pin (#945): roomCount 0 and 1 collapse to the identical one-room map — stairs at
//     entrance center, zero doors, zero NPCs, secrets capped at 3 on wall cells

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

describe('generateAdjacentDungeon', () => {
  it('byte-exact flagship g20 seed 42: envelope, wall ASCII, and full placed-item roster', () => {
    const map = generateAdjacentDungeon({ gridSize: 20, seed: 42 });
    expect(map).toEqual({
      name: 'The Hidden Mines of Doom',
      description: 'Torchlight flickers across walls carved with strange symbols. Rooms branch off in multiple directions, each more foreboding than the last. The undead are said to wander these halls.',
      gridSize: 20,
      seed: 42,
      walls: expect.any(Array),
      placedItems: expect.any(Array),
      players: [],
      zoom: 1,
      panX: 0,
      panY: 0,
      generationMode: 'adjacent',
    });
    // 4 rooms (default density 0.5 → max(4, floor(16/3·0.75)) = 4 rooms joined by 3 doors),
    // grand room 1 (altar + fountain), private rooms 2-3 (bed/chest/bookshelf), walls not full.
    expect(ascii(map)).toEqual([
      '####################',
      '###......###########',
      '###......#......####',
      '###.............####',
      '###......#......####',
      '###......#......####',
      '####....##......####',
      '####....####.#######',
      '####....#.......####',
      '####............####',
      '####....#.......####',
      '####....#.......####',
      '#########.......####',
      '#########.......####',
      '####################',
      '####################',
      '####################',
      '####################',
      '####################',
      '####################',
    ]);
    // Subsumes torch/door/stairs/NPC presence, door rotation ∈ {0,90}, NPC rotations,
    // secret-door-N/trap-N id prefixes, caps 3/2/7, position dedupe, bounds.
    expect(map.placedItems.map(itemBytes)).toEqual([
      'door-0-1:door@12,7:90',
      'door-0-2:door@8,9:0',
      'door-1-3:door@9,3:0',
      'torch-0-0:torch@12,8:90',
      'torch-0-1:torch@10,8:90',
      'statue-0:statue@12,9:',
      'altar-1:altar@12,4:0',
      'torch-1-0:torch@13,2:90',
      'torch-1-1:torch@13,6:270',
      'fountain-1:fountain@13,5:',
      'bed-2:bed@4,6:0',
      'chest-2:chest@7,6:',
      'bookshelf-2:bookshelf@4,11:180',
      'bed-3:bed@3,1:0',
      'chest-3:chest@8,1:',
      'bookshelf-3:bookshelf@3,5:180',
      'npc-0:npc@13,4:270:Goblin:hidden',
      'npc-1:npc@6,9:270:Orc:hidden',
      'npc-2:npc@6,3:0:Goblin:hidden',
      'entrance-stairs:stairs@12,11:',
      'secret-door-0:secretdoor@10,14::hidden',
      'secret-door-1:secretdoor@10,7::hidden',
      'secret-door-2:secretdoor@8,7::hidden',
      'trap-0:trap@5,10::hidden',
      'trap-1:trap@5,9::hidden',
    ]);
  });

  it.each([
    // last-room expansion, rng-aligned: 3 doors.
    ['linear', 42, [
      '################',
      '#....#.......###',
      '#............###',
      '#....#.......###',
      '#....#.......###',
      '##.######.######',
      '#............###',
      '#............###',
      '#............###',
      '#............###',
      '#............###',
      '#............###',
      '#.....##########',
      '################',
      '################',
      '################',
    ]],
    // no first-placement rng draw — diverges from linear downstream.
    ['winding', 42, [
      '################',
      '################',
      '################',
      '################',
      '#....###########',
      '#....###########',
      '#....#.......###',
      '#............###',
      '#....#.......###',
      '#....#.......###',
      '##.###.......###',
      '#....#.......###',
      '#....###########',
      '#....###########',
      '#....###########',
      '################',
    ]],
    // uniform source pick; byte-identical to forking at this seed (forking@6 below).
    ['balanced', 42, [
      '################',
      '######.......###',
      '######.......###',
      '######.......###',
      '######.......###',
      '#....####.######',
      '#....#.......###',
      '#....#.......###',
      '#............###',
      '#....#.......###',
      '#....#.......###',
      '#....#.......###',
      '#....###########',
      '################',
      '################',
      '################',
    ]],
  ])('layout %s g16 seed %i is byte-pinned', (layoutStyle, seed, expected) => {
    expect(ascii(generateAdjacentDungeon({ gridSize: 16, seed, layoutStyle }))).toEqual(expected);
  });

  it('forking layout g16 seed 6: genuinely branches (3 doors) and differs from balanced', () => {
    const map = generateAdjacentDungeon({ gridSize: 16, seed: 6, layoutStyle: 'forking' });
    expect(map.placedItems.filter((i) => i.type === 'door').map(itemBytes)).toEqual([
      'door-0-1:door@5,7:90',
      'door-0-2:door@8,7:90',
      'door-1-3:door@3,7:90',
    ]);
    expect(ascii(map)).toEqual([
      '################',
      '#....###########',
      '#....###########',
      '#..........#####',
      '#..........#####',
      '#..........#####',
      '#..........#####',
      '###.#.##.#######',
      '###.........####',
      '###.........####',
      '###.........####',
      '###.........####',
      '#######.....####',
      '################',
      '################',
      '################',
    ]);
  });

  it('options saturate honestly: density ±saturate to 0/1 byte-exact, seed 0 honored, gridSize defaults to 30', () => {
    const gen = (opts) => generateAdjacentDungeon({ gridSize: 30, seed: 42, ...opts });
    // Clamp reach-branch (#1035): saturated values are indistinguishable from their bounds…
    expect(ascii(gen({ density: -1 }))).toEqual(ascii(gen({ density: 0 })));
    expect(ascii(gen({ density: 2 }))).toEqual(ascii(gen({ density: 1 })));
    // …and clamping actually changed the map vs the 0.5 default (4 vs 8 vs 6 target rooms).
    expect(ascii(gen({ density: -1 }))).not.toEqual(ascii(gen({})));
    expect(ascii(gen({ density: 2 }))).not.toEqual(ascii(gen({})));
    // seed 0 is falsy but must still echo and drive mulberry32 (#959 coercion honesty).
    expect(gen({ seed: 0 }).seed).toBe(0);
    // Missing opts coerce to an empty object; gridSize lands on 30.
    expect(generateAdjacentDungeon({}).gridSize).toBe(30);
    expect(generateAdjacentDungeon().gridSize).toBe(30);
    // Unseeded runs draw a random integer seed and differ run-to-run. The seed field is
    // decorative here: the RNG was already Math.random when it was stamped, so the map is
    // NOT reproducible from the reported seed (source limitation, asserted not hidden).
    const unseeded = generateAdjacentDungeon({ gridSize: 20 });
    expect(Number.isInteger(unseeded.seed) && unseeded.seed >= 0).toBe(true);
    expect(generateAdjacentDungeon({ gridSize: 20 }).seed).not.toBe(unseeded.seed);
  });

  it('degenerate g12 seed 7: roomCount 0 and 1 collapse to the identical one-room map', () => {
    const rc0 = generateAdjacentDungeon({ gridSize: 12, seed: 7, roomCount: 0 });
    const rc1 = generateAdjacentDungeon({ gridSize: 12, seed: 7, roomCount: 1 });
    expect(ascii(rc0)).toEqual([
      '############',
      '############',
      '############',
      '############',
      '#####....###',
      '#####....###',
      '#####....###',
      '#####....###',
      '############',
      '############',
      '############',
      '############',
    ]);
    // Stairs at entrance center; zero doors, zero NPCs — nothing to connect or guard.
    expect(rc0.placedItems.map(itemBytes)).toEqual([
      'torch-0-0:torch@7,4:90',
      'torch-0-1:torch@6,4:90',
      'entrance-stairs:stairs@7,6:',
      'secret-door-0:secretdoor@4,7::hidden',
      'secret-door-1:secretdoor@9,4::hidden',
      'secret-door-2:secretdoor@6,8::hidden',
    ]);
    expect(ascii(rc1)).toEqual(ascii(rc0));
    expect(rc1.placedItems.map(itemBytes)).toEqual(rc0.placedItems.map(itemBytes));
  });

  it('dense g30 seed 42: single connected dungeon, exact type census, secrets on walls', () => {
    const map = generateAdjacentDungeon({ gridSize: 30, seed: 42 });
    const walls = new Set(map.walls);
    expect(walls.size).toBe(map.walls.length);

    const open = new Set();
    for (let y = 0; y < map.gridSize; y++) {
      for (let x = 0; x < map.gridSize; x++) {
        if (!walls.has(`${x},${y}`)) open.add(`${x},${y}`);
      }
    }
    // The "adjacent" promise: flood from the entrance stairs reaches every open cell —
    // room carving, doorways, and cluster corridors leave no isolated pocket (#1099).
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
    for (const item of map.placedItems) {
      census[item.type] = (census[item.type] || 0) + 1;
      positions.add(`${item.gridX},${item.gridY}`);
      expect(item.gridX).toBeGreaterThanOrEqual(0);
      expect(item.gridX).toBeLessThan(map.gridSize);
      expect(item.gridY).toBeGreaterThanOrEqual(0);
      expect(item.gridY).toBeLessThan(map.gridSize);
      // Hidden set is exactly {npc, secretdoor, trap}; secret doors sit on WALL cells
      // (unseen until the editor lane reveals them), NPCs/traps hide on carved floor,
      // and everything else stands visible on floor.
      const onWall = walls.has(`${item.gridX},${item.gridY}`);
      const expectedPair = item.type === 'secretdoor' ? [true, false]
        : ['npc', 'trap'].includes(item.type) ? [false, false]
          : [false, true];
      expect([onWall, item.visible]).toEqual(expectedPair);
    }
    expect(positions.size).toBe(map.placedItems.length);
    // Exact census subsumes all former presence + cap checks (secretdoor ≤ 3, trap ≤ 2,
    // npc ≤ 7 — here 6 rooms give 5 NPC slots, and 6 rooms are joined by 5 doors).
    expect(census).toEqual({
      door: 5, torch: 4, altar: 1, pillar: 4, bed: 3, chest: 3, bookshelf: 3, chair: 2,
      crate: 3, barrel: 1, npc: 5, stairs: 1, secretdoor: 3, trap: 2,
    });
  });
});
