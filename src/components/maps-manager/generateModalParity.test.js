// @maintained-by-ai 2026-11-14
// Twin-parity pin (UF backlog 2026-11-12): the Dungeon/Terrain generate modals
// share their child styling through the neutral `gen-modal-*` prefix, defined
// ONCE in gen-modal-shared.css. jsdom cannot resolve the CSS cascade, so these
// source greps are the only way to keep the twins copy-identical:
//  1. No `dungeon-gen-*` CHILD class tokens survive in either modal's JSX/CSS
//     or in the shared stylesheet — child styling must resolve from the shared
//     prefix. The twins are scoped only by their ROOT identifiers
//     (`dungeon-gen-modal` / `terrain-gen-modal`), which the harnesses and the
//     maps-file selector law depend on.
//  2. Each twin JSX file imports the shared stylesheet EXPLICITLY (never rely
//     on MapsManager happening to load both components), references the
//     identical shared child-token set, and sources its seed placeholder from
//     the shared SEED_INPUT_PLACEHOLDER constant — one constant makes drift
//     impossible (VG backlog 2026-11-12: the twins had drifted to "Random if
//     empty" vs "Random" over the same parseSeedInput law).
//  3. The shared child ruleset lives once: neither modal CSS file redefines a
//     shared token.
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

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

  it('keeps both ROOT identifiers present for the harnesses to scope by', () => {
    // Token-presence only: class order/formatting is free, the roots must exist.
    for (const [file, src, root] of [
      ['GenerateDungeonModal.jsx', dungeonJsx, 'dungeon-gen-modal'],
      ['GenerateTerrainModal.jsx', terrainJsx, 'terrain-gen-modal'],
    ]) {
      expect(src, `${file} must keep the shared maps-manager-modal root`).toContain(
        'maps-manager-modal'
      );
      expect(src, `${file} must keep its ${root} scoping root`).toContain(root);
    }
  });

  it.each([
    ['GenerateDungeonModal.jsx', dungeonJsx],
    ['GenerateTerrainModal.jsx', terrainJsx],
  ])('%s matches its twin: shared CSS import, shared tokens, shared seed placeholder', (file, src) => {
    expect(src, `${file} must import the shared stylesheet`).toContain(
      "import './gen-modal-shared.css';"
    );
    for (const token of SHARED_TOKENS) {
      expect(src, `${file} missing shared token ${token}`).toContain(token);
    }
    expect(src, `${file} must use the shared constant as the seed placeholder`).toContain(
      'placeholder={SEED_INPUT_PLACEHOLDER}'
    );
    // No loose "Random…" placeholder strings may creep back into either twin.
    const looseSeedPlaceholders = [...src.matchAll(/placeholder="Random[^"]*"/g)]
      .map((match) => match[0]);
    expect(looseSeedPlaceholders, `${file} hard-codes a seed placeholder`).toEqual([]);
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
});
