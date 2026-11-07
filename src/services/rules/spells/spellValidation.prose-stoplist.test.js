// @maintained-by-ai
// spellValidation.js prose-stoplist channel (backlog 2026-11-06): the cantrip-capture guard
// split into two drop channels — benign RAW quantifier prose ('two', 'another', …) is dropped
// at console.debug (sheet-open noise, zero app fault), while a real catalog miss on a
// plausible spell name KEEPS console.error (#1530 loud-drop contract preserved). Extraction is
// unregressed: catalog hits still canonicalize exactly as before.
//
// Sibling split: spellValidation.test.js owns the full extraction/contract matrix (STRUCT
// fixtures pinned there are not re-grown here); THIS file locks only the drop-channel split
// and the hit/junk pair across BOTH ruleset versions.
//
// Fixtures: the spell catalog is the REAL disk data for both versions (drift throws at load);
// feature prose appears ONLY as clearly-labeled STRUCT fixtures — they impersonate no real
// entity. Mock census: spellValidation.js:7 imports exactly 5 dataLoader exports.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../ui/dataLoader.js', () => ({
  loadClassData: vi.fn(),
  loadRaceData: vi.fn(),
  loadBackgroundData: vi.fn(),
  loadFeatData: vi.fn(),
  loadSpells: vi.fn(),
}));

import * as dataLoader from '../../ui/dataLoader.js';
import { getSpellSources } from './spellValidation.js';

const disk = (p) => JSON.parse(readFileSync(resolve(process.cwd(), 'public', p), 'utf8'));
const spells5e = disk('data/spells.json');
const spells2024 = disk('data/2024/spells.json');

// Precondition: the fixture tokens must actually sit on / off BOTH catalogs, or the rows below
// prove nothing. Thaumaturgy is lowercase prose on disk (case-fold rescue); 'Mend' is a
// plausible near-miss existing in NEITHER catalog.
expect(spells5e.some((s) => s.name === 'Thaumaturgy')).toBe(true);
expect(spells2024.some((s) => s.name === 'Thaumaturgy')).toBe(true);
expect(spells5e.some((s) => s.index === 'mend' || s.name === 'Mend')).toBe(false);
expect(spells2024.some((s) => s.index === 'mend' || s.name === 'Mend')).toBe(false);

// Race-armed fixture: the race extractor threads `version` into the catalog lookup for BOTH
// rulesets (string descriptions coerce identically — no version quirk in play here).
const raceWith = (description) => async (version) => {
  vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
    { name: 'STRUCT Race', traits: [{ description }] },
  ]);
  return getSpellSources({ class: { name: 'Wizard' }, race: { name: 'STRUCT Race' } }, version);
};

let consoleError;
let consoleDebug;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dataLoader.loadClassData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
  vi.mocked(dataLoader.loadSpells).mockImplementation(async (version = '5e') =>
    version === '2024' ? spells2024 : spells5e,
  );
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('spellValidation prose-stoplist drop channel', () => {
  it.each(['5e', '2024'])(
    '%s: catalog hits extract unchanged while stoplisted "two" debug-drops with zero console.error',
    async (version) => {
      const sources = await raceWith(
        'You know the thaumaturgy cantrip. You learn two cantrips of your choice.',
      )(version);

      // hit leg: lowercase prose still canonicalized to the titled disk name (AC3, unregressed)
      expect(sources.race.cantrips).toStrictEqual(['Thaumaturgy']);
      // junk leg: 'two' dropped quietly, message unchanged apart from the channel
      expect(consoleDebug).toHaveBeenCalledTimes(1);
      expect(consoleDebug).toHaveBeenCalledWith(
        expect.stringContaining(`dropping non-spell token "two" captured from feature text (not in ${version} spell catalog)`),
      );
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it.each(['5e', '2024'])(
    '%s: a real catalog miss on a plausible spell name still fires console.error (debug stays clean)',
    async (version) => {
      const sources = await raceWith('You know the Mend cantrip.')(version);

      expect(sources.race.cantrips).toStrictEqual([]);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining(`dropping non-spell token "Mend" captured from feature text (not in ${version} spell catalog)`),
      );
      expect(consoleDebug).not.toHaveBeenCalled();
    },
  );

  it('stoplisted quantifiers (one/three/another) all drop at console.debug, nothing stored', async () => {
    const sources = await raceWith(
      'You know one cantrip of your choice. You learn three cantrips at 5th level. You learn another cantrip later.',
    )('5e');

    expect(sources.race.cantrips).toStrictEqual([]);
    expect(consoleDebug).toHaveBeenCalledTimes(3);
    expect(consoleDebug).toHaveBeenNthCalledWith(1, expect.stringContaining('"one"'));
    expect(consoleDebug).toHaveBeenNthCalledWith(2, expect.stringContaining('"three"'));
    expect(consoleDebug).toHaveBeenNthCalledWith(3, expect.stringContaining('"another"'));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('non-stoplisted multi-word clause fragments keep console.error (real parse failures stay loud)', async () => {
    const sources = await raceWith('You know the mending light cantrip.')('5e');

    expect(sources.race.cantrips).toStrictEqual([]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"mending light"'));
    expect(consoleDebug).not.toHaveBeenCalled();
  });
});
