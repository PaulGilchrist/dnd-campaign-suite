// @maintained-by-ai
// Regression pin for bug-character-delete-sanitizer-mismatch: character DELETE
// derived `name.toLowerCase().replace(/\s+/g,'-')+'.json'` while the server
// create route wrote `name.replace(/[^a-zA-Z0-9]/g,'_')+'.json'`, so every
// multi-word character name was permanently undeletable from the UI (DELETE
// 404'd on a nonexistent path). All client lanes (delete, edit PUT, SSE
// delete-mirror, healing target fetch) now derive through characterFileName —
// this test pins the recipe AND proves it never drifts from the server's.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { characterFileName, normalizeCharacterName } from './characterFileName.js';
import { characterFileName as serverCharacterFileName, normalizeCharacterName as serverNormalizeCharacterName } from '../../../server/utils/characterName.js';

describe('characterFileName (canonical create === delete recipe)', () => {
  it('sanitizes every non-alphanumeric char to "_" while preserving case', () => {
    // The exact repro name from the bug report.
    expect(characterFileName('QA RunV Wizard')).toBe('QA_RunV_Wizard.json');
    // Apostrophes, hyphens and repeated separators each become "_".
    expect(characterFileName("Marta O'Neil")).toBe('Marta_O_Neil.json');
    expect(characterFileName('Jean-Luc Picard')).toBe('Jean_Luc_Picard.json');
    expect(characterFileName('Dr. Strange  Love')).toBe('Dr__Strange__Love.json');
    // camelCase single-word names keep their case (APFS masks lowercasing on
    // macOS; case-sensitive Linux filesystems would 404 any lowercasing lane).
    expect(characterFileName('AasimarTest')).toBe('AasimarTest.json');
    expect(characterFileName('War_Cleric')).toBe('War_Cleric.json');
  });

  it('is byte-identical with the server owner module', () => {
    // The bug class was two recipes drifting. The server moved its recipe
    // into server/utils/characterName.js (owned by both route lanes); pin
    // behavioral parity against the real server module for adversarial names.
    for (const name of ['QA RunV Wizard', "Tippy 'the Cat'", 'AasimarTest', 'a-b.c d', 'Ünïcödé ✦ Hero', 'Dr. Strange  Love']) {
      expect(characterFileName(name)).toBe(serverCharacterFileName(name));
      expect(normalizeCharacterName(name)).toBe(serverNormalizeCharacterName(name));
    }
    // And pin that the server routes actually consume that module (a route
    // re-inlining its own recipe fails this).
    const serverSrc = readFileSync('server/routes/campaigns-character.js', 'utf8');
    expect(serverSrc).toMatch(/from '\.\.\/utils\/characterName\.js'/);
    expect(serverSrc).toMatch(/const fileName = characterFileName\(name\);/);
    expect(serverSrc).toMatch(/const targetFile = characterFileName\(name\);/);
  });

  it('round-trips every on-disk character file in test-campaign (delete-lane contract)', () => {
    // Ground truth: on-disk files were written by the server create recipe.
    // Applying the helper to each file's embedded display name must reproduce
    // the exact filename — i.e. a UI delete always targets a real path.
    const dir = 'public/campaigns/test-campaign';
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const { name } = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
      if (typeof name !== 'string') continue;
      expect(characterFileName(name)).toBe(file);
    }
  });
});
