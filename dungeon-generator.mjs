/**
 * Dungeon Map Generator — CLI entry point
 *
 * This is a thin wrapper around the canonical ES module at
 * src/services/dungeonGenerator.js. All generation logic lives there.
 *
 * Usage:
 *   node dungeon-generator.mjs --grid-size 30 --rooms 6-10 --seed 42 --ascii
 *   node dungeon-generator.mjs --grid-size 30 --rooms 6-10 --seed 42 --output dungeon.json
 *   node dungeon-generator.mjs --grid-size 30 --rooms 6-10 --count 5 --output batch.json
 */

const { generateDungeon, visualize } = await import('./src/services/dungeonGenerator.js');

const args = process.argv.slice(2);
const get = function (flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const gridSize = parseInt(get('--grid-size') || get('-g') || '30', 10);
const roomStr = get('--rooms') || get('-r') || '6-10';
const parts = roomStr.split('-').map(Number);
const seed = get('--seed') ? parseInt(get('--seed'), 10) : undefined;
const showAscii = args.includes('--ascii') || args.includes('-a');
const output = get('--output') || get('-o');
const count = parseInt(get('--count') || get('-c') || '1', 10);
const displayName = get('--name') || get('-n');
const toKebabCase = (s) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const sanitizeFilename = (s) => {
  const base = s.replace(/\.json$/, '');
  return toKebabCase(base) + '.json';
};

for (let i = 0; i < count; i++) {
  const map = generateDungeon({
    gridSize,
    numRooms: [parts[0], parts[1] || parts[0]],
    seed: seed != null ? seed + i : undefined,
  });

  if (displayName) {
    map.displayName = displayName;
    map.name = toKebabCase(displayName);
  }

  const json = JSON.stringify(map, null, 2);

  if (output) {
    const filename =
      count > 1
        ? sanitizeFilename(output.replace(/\.json$/, '-' + (i + 1) + '.json'))
        : sanitizeFilename(output);
    const fs = await import('fs');
    fs.writeFileSync(filename, json);
    console.log(
      'Generated: ' +
        filename +
        ' (' +
        map.walls.length +
        ' walls, ' +
        map.placedItems.length +
        ' items)'
    );
  } else if (count > 1) {
    console.log('=== ' + map.name + ' ===');
    console.log(json);
  } else {
    console.log(json);
  }

  if (showAscii) {
    console.log('\nASCII Map:\n');
    console.log(visualize(map));
    console.log();
  }
}
