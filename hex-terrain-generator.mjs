/**
 * Hex Terrain Generator — CLI entry point
 *
 * Thin wrapper around src/services/hexTerrainGenerator.js.
 *
 * Usage:
 *   node hex-terrain-generator.mjs --grid-size 20 --seed 42
 *   node hex-terrain-generator.mjs --grid-size 20 --seed 42 --output terrain.json
 *   node hex-terrain-generator.mjs --grid-size 20 --count 3 --output batch.json
 *   node hex-terrain-generator.mjs --grid-size 20 --weights '{"water":0.5,"forest":1.5}'
 */

import { generateHexTerrain } from './src/services/hexTerrainGenerator.js';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const gridSize = parseInt(get('--grid-size') || get('-g') || '20', 10);
const seed = get('--seed') ? parseInt(get('--seed'), 10) : undefined;
const output = get('--output') || get('-o');
const count = parseInt(get('--count') || get('-c') || '1', 10);

let weights = null;
const weightsRaw = get('--weights') || get('-w');
if (weightsRaw) {
  try {
    weights = JSON.parse(weightsRaw);
  } catch (e) {
    console.error('Invalid JSON for --weights:', e.message);
    process.exit(1);
  }
}

for (let i = 0; i < count; i++) {
  const result = generateHexTerrain({
    gridSize,
    seed: seed != null ? seed + i : undefined,
    weights,
  });

  const json = JSON.stringify(result, null, 2);
  const terrainCount = Object.keys(result.terrain).length;
  const riverCount = result.rivers.length;

  if (output) {
    const filename =
      count > 1
        ? output.replace(/\.json$/, '-' + (i + 1) + '.json')
        : output;
    const fs = await import('fs');
    fs.writeFileSync(filename, json);
    console.log(`Generated: ${filename} (${terrainCount} hexes, ${riverCount} rivers)`);
  } else if (count > 1) {
    console.log(`=== Map ${i + 1} ===`);
    console.log(json);
  } else {
    console.log(json);
  }
}
