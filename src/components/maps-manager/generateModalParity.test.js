// Twin-parity pin (UF backlog 2026-11-12): the Dungeon/Terrain generate modals
// share their child styling through the neutral `gen-modal-*` prefix, defined
// ONCE in gen-modal-shared.css. These greps keep the twins copy-identical:
//  1. No `dungeon-gen-*` CHILD class tokens survive in either modal's JSX/CSS —
//     the only permitted `dungeon-gen-` occurrence is the ROOT literal
//     `.dungeon-gen-modal` (harnesses scope the twins by the root; the
//     maps-file selector law depends on it).
//  2. Both twin JSX files import the shared stylesheet EXPLICITLY (never rely
//     on MapsManager happening to load both components) and reference the
//     identical shared child-token set.
//  3. The shared child ruleset lives once: neither modal CSS file redefines a
//     shared token.
//  4. The seed field's placeholder copy is likewise unified (VG backlog
//     2026-11-12: the twins drifted to "Random if empty" vs "Random" over the
//     same parseSeedInput law): both JSX files must reference the shared
//     SEED_INPUT_PLACEHOLDER constant from services/maps/seedInput.js, and
//     neither may hard-code a loose placeholder literal.
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { SEED_INPUT_PLACEHOLDER } from '../../services/maps/seedInput.js';

// Vitest runs from the repo root; import.meta.url is Vite-transformed here, so
// resolve the twin files against cwd explicitly.
const DIR = path.join(process.cwd(), 'src/components/maps-manager');
const read = (name) => readFileSync(path.join(DIR, name), 'utf8');

const dungeonJsx = read('GenerateDungeonModal.jsx');
const terrainJsx = read('GenerateTerrainModal.jsx');
const dungeonCss = read('GenerateDungeonModal.css');
const terrainCss = read('GenerateTerrainModal.css');
const sharedCss = read('gen-modal-shared.css');

// Child classes used by BOTH twins' JSX — their rules must resolve from the
// single shared stylesheet.
const SHARED_TOKENS = [
  'gen-modal-form',
  'gen-modal-field',
  'gen-modal-hint',
  'gen-modal-generate-btn',
];

// All `dungeon-gen-<suffix>` captures that are NOT the allowed root literal.
const rogueChildTokens = (src) =>
  [...src.matchAll(/dungeon-gen-([a-z][a-z0-9-]*)/g)]
    .map((match) => match[1])
    .filter((suffix) => suffix !== 'modal');

describe('generate-modal twin class parity', () => {
  it.each([
    ['GenerateDungeonModal.jsx', dungeonJsx],
    ['GenerateTerrainModal.jsx', terrainJsx],
    ['GenerateDungeonModal.css', dungeonCss],
    ['GenerateTerrainModal.css', terrainCss],
    ['gen-modal-shared.css', sharedCss],
  ])('%s keeps no dungeon-gen- child-class tokens (root literal excepted)', (file, src) => {
    expect(rogueChildTokens(src)).toEqual([]);
  });

  it('keeps the per-modal ROOT identifiers exactly as the harnesses scope them', () => {
    expect(dungeonJsx).toContain('maps-manager-modal dungeon-gen-modal');
    expect(terrainJsx).toContain('maps-manager-modal terrain-gen-modal');
  });

  it.each([
    ['GenerateDungeonModal.jsx', dungeonJsx],
    ['GenerateTerrainModal.jsx', terrainJsx],
  ])('%s references the identical shared child-token set', (file, src) => {
    for (const token of SHARED_TOKENS) {
      expect(src, `${file} missing shared token ${token}`).toContain(token);
    }
  });

  it.each([
    ['GenerateDungeonModal.jsx', dungeonJsx],
    ['GenerateTerrainModal.jsx', terrainJsx],
  ])('%s imports the shared stylesheet explicitly', (file, src) => {
    expect(src).toContain("import './gen-modal-shared.css';");
  });

  it('defines every shared child rule exactly once, in the shared stylesheet', () => {
    const defines = (src, token) =>
      new RegExp(`\\.${token}(?![-a-z0-9])`).test(src);
    for (const token of SHARED_TOKENS) {
      expect(defines(sharedCss, token), `shared CSS must define .${token}`).toBe(true);
      expect(defines(dungeonCss, token), `dungeon CSS must not redefine .${token}`).toBe(false);
      expect(defines(terrainCss, token), `terrain CSS must not redefine .${token}`).toBe(false);
    }
  });

  it.each([
    ['GenerateDungeonModal.jsx', dungeonJsx],
    ['GenerateTerrainModal.jsx', terrainJsx],
  ])('%s sources its seed placeholder from the shared constant, never a literal', (file, src) => {
    expect(src, `${file} must import SEED_INPUT_PLACEHOLDER`).toContain('SEED_INPUT_PLACEHOLDER');
    expect(src, `${file} must use the constant as the seed placeholder`).toContain(
      'placeholder={SEED_INPUT_PLACEHOLDER}'
    );
    // No loose "Random…" placeholder strings may creep back into either twin.
    const looseSeedPlaceholders = [...src.matchAll(/placeholder="Random[^"]*"/g)]
      .map((match) => match[0]);
    expect(looseSeedPlaceholders, `${file} hard-codes a seed placeholder`).toEqual([]);
  });

  it('keeps the shared constant itself equal to the unified copy', () => {
    expect(SEED_INPUT_PLACEHOLDER).toBe('Random if empty');
  });
});
