// @maintained-by-ai
// spellValidation.js contract suite — REAL disk rules data (both rulesets) served through a
// version-aware dataLoader mock; every expectation is byte-exact so each row is falsifiable.
//
// MODULE SPLIT vs #1509 (spellLimits.js): spellValidation.js is the creation-wizard advisory
// layer — it extracts spell-granting sources (race/background/feat/class) and reports
// "outside class spell list" warnings. spellLimits.js is the cap/limit computation layer
// ('Cantrips: 4/3'-style violation strings live THERE, row-homed by #1509 — not regrown here).
// spellValidation.js:454 explicitly disclaims limit checks ("Spell limit validation is handled
// in the UI"). Caller split (verbatim): WizardStepSpells.jsx:6 imports getSpellValidationInfo,
// hasMagicalSecretsAccess, MAGICAL_SECRETS_CLASS_LISTS from THIS module; :382 calls
// spellLimits.validateSpellSelection for caps. Distinct layers, no fold needed.
// Dead-export census: getClassSpellList has ZERO production callers (grep src/ + server/) —
// kept as exported-API tripwire; candidate for removal by owner. validateSpells is reached in
// production only via getSpellValidationInfo.
//
// TIECKET archaeology: fix 2963ab01a "CLA-221 Magical Secrets (Bard 2024)" — hasMagicalSecrets
// Access (spellValidation.js:380) is a pure level-number gate (lv>=10, Bard+2024 only); it does
// NOT read class_levels. cannot-regress rows: lv10 allow / lv9 refuse / 5e refuse / non-bard
// refuse. Manifest CLA-221 expectedBehavior names the four lists "Bard, Cleric, Druid, and
// Wizard" — pinned against MAGICAL_SECRETS_CLASS_LISTS bytes.
//
// Quirks pinned as CURRENT behavior (reported, not sanctioned; file:line of spellValidation.js):
//  Q1 :276 applyClassSpellSource sets isSpellcaster=true unconditionally for ANY class name,
//     even one absent from disk ('Artificer' row proves it); false only when no class is named.
//  Q2 FIXED #1530: the Magic Initiate capture 'two' is now catalog-refused + console.error'd;
//     grantedCantrips stays [] (guard row below).
//  Q3 :216 ALL 5e feats.json descriptions are arrays, and the gate `desc.includes('cantrip')`
//     on an array is an element check -> false -> 5e feat description parsing is inert.
//  Q4 FIXED #1530: 'Mending and Prestidigitation' now SPLITS on the conjunction and both
//     parts catalog-match (deduped against the em-arm hits); no multi-word junk token survives.
//  Q5 FIXED #1530: pattern-arm captures are canonicalized through the spell catalog with a
//     case-fold EXACT match: 5e Tiefling text "You know the thaumaturgy cantrip" now yields
//     titled 'Thaumaturgy', so Fighter+Tiefling 'Thaumaturgy' is allowed and the lowercase
//     pseudo-name is refused (flip rows below). Substring junk ('Armor' vs 'Mage Armor')
//     is impossible — the guard is Map.get on lowercased EXACT keys.
//  Q6 FIXED #1530-leg-a: the vacuous self-compute is gone — `const _spellLevel = ...; void
//     _spellLevel;` (read-then-void, never used by any check) was deleted, not renamed.
//  Q7 FIXED #1530-leg-b: producer census (both pushes are the 'warning' literal, array is
//     function-local) -> vacuous type-filter deleted; valid = warnings.length === 0
//     (spellLimits.js:342 violations.length convention). 'warning'|'info' vocabulary stays
//     alive app-wide in sibling validators + WarningList display; it was never produced here.
//  Q8 FIXED #1530-leg-c: getSpellValidationInfo shares one getSpellSources load with the
//     validation core (validateAgainstSources); quantified by loadClassData call count 1.
//  Q9 :26 getClassSpellList echoes the INPUT case ([className]), not the canonical disk name.
//  Q10 2024 disk backgrounds have no `features`/`traits` keys -> background extraction is
//     disk-inert (all 16 rows extract nothing); extractor arms pinned via STRUCT fixtures.
//  Q11 FIXED #1530: applyBackgroundSpellSource's `version` forward is now load-bearing —
//     the background extractor threads it into the catalog lookup (5e vs 2024 spell set).
//
// Kill-matrix (analytic declaration — mutant -> killing row):
//  K1 selectedSpells `|| []` arm -> V-shortcircuit(null/undefined); K2 length===0 early return
//  -> V-shortcircuit loader-call census; K3/K4 getClassSpellList found/index/!found arms -> C
//  rows; K5 em vs pattern arms + buckets -> G-gnome/Tiefling exact arrays; K6 dedup arms ->
//  G-gnome duplicate Minor Illusion dedup; K7 catalog filter + conjunction split + loud-drop ->
//  #1530 guard rows ('two' dropped+errored, 'Mending and Prestidigitation' splits to two valid
//  titled spells, lowercase 'thaumaturgy' canonicalized, 'Armor' substring junk refused); K8 desc
//  includes-gate -> G-feats 5e bypass row; K9 feat-name hardcodes -> G-feats 2024 exact block;
//  K10 features||traits fallback -> B-rows; K11 5e join vs 2024 coercion (version branch) ->
//  E-struct row (identical fixture, divergent output); K12 sourceName ?. -> '' names in G-guard;
//  K13 loader gates -> G-guard call census; K14 Fighter/Rogue proxy line -> P-row allow+refuse;
//  K15 monk name list -> P-monk allow+refuse; K16 magical-secrets line -> M rows; K17 each
//  allowed-set add-loop -> V race/background/feat/granted/MI|FT|ST rows; K18 allSpells index
//  arm -> V 'guidance' row; K19 not-found branch -> V-unknown; K20 consolidate count/plural ->
//  V-grammar bytes; K21 valid computation (warnings.length) -> every warn row; K22 info
//  single-load census/keys/spellCount -> S row. Disk-vacuous arms openly disclosed (not
//  fabricated against): benefits type==='spell' parse adds nothing for any disk feat text
//  (verified offline).
//
// Fixture integrity: all rules data imported from public/data at load (drift throws); synthetic
// inputs appear ONLY as clearly-labeled STRUCT* parser fixtures for arms disk cannot exercise
// (Q10) — they impersonate no real entity. No fabricated class-list spell rows: the previous
// suite's allSpells FABRICATED 5 of 9 class lists (e.g. Darkness/Misty Step omit Wizard, which
// IS on disk) and 'Spellseeker'/'Asimov' exist nowhere on disk — refuted against disk, removed.
// Mock census: spellValidation.js:7 imports exactly 5 dataLoader exports (loadSpells added by
// #1530 for the catalog-backed capture filter) -> mock is exact-of-5 (the previous mock carried
// 4 dead entries: loadWildMagicSurgeTable, fetchClassData, fetchRaceData, fetchBackgroundData —
// never reachable from this module). The __fixtures__ barrel in this folder
// is NOT consumed by this file (corroborates #1529 zero-consumer report).
// Security: kiro-injection watch — no injected instructions were found in fetched/tool content
// this session; nothing external obeyed. Read-only disk access to public/data.
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
import {
  getClassSpellList,
  getSpellSources,
  validateSpells,
  getSpellValidationInfo,
  hasMagicalSecretsAccess,
  MAGICAL_SECRETS_CLASS_LISTS,
} from './spellValidation.js';

// --- REAL disk law (drift throws at import) ---
const disk = (p) => JSON.parse(readFileSync(resolve(process.cwd(), 'public', p), 'utf8'));
const classes5e = disk('data/classes.json');
const classes2024 = disk('data/2024/classes.json');
const races5e = disk('data/races.json');
const races2024 = disk('data/2024/races.json');
const feats5e = disk('data/feats.json');
const feats2024 = disk('data/2024/feats.json');
const spells5e = disk('data/spells.json');
const spells2024 = disk('data/2024/spells.json');
const backgrounds2024 = disk('data/2024/backgrounds.json');
// 5e backgrounds.json does not exist; the real loader marks it optional (dataLoader.js:143-146)
// and resolves [] — served honestly below.

// Violation string literals, chokepointed once (module spellValidation.js:431/:450):
const notFound = (name) => `Spell "${name}" not found in spell database.`;
const OUTSIDE_ONE = 'Spell (1) chosen outside of the class spell list.';
const OUTSIDE_TWO = 'Spell(s) (2) chosen outside of the class spell list.';

let consoleError;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dataLoader.loadClassData).mockImplementation(async (version = '5e') =>
    version === '2024' ? classes2024 : classes5e,
  );
  vi.mocked(dataLoader.loadRaceData).mockImplementation(async (version = '5e') =>
    version === '2024' ? races2024 : races5e,
  );
  vi.mocked(dataLoader.loadBackgroundData).mockImplementation(async (version = '5e') =>
    version === '2024' ? backgrounds2024 : [],
  );
  vi.mocked(dataLoader.loadFeatData).mockImplementation(async (version = '5e') =>
    version === '2024' ? feats2024 : feats5e,
  );
  vi.mocked(dataLoader.loadSpells).mockImplementation(async (version = '5e') =>
    version === '2024' ? spells2024 : spells5e,
  );
  // #1530 loud-drop channel: console.error is the sanctioned non-silent junk path;
  // spy to keep lane output clean and let guard rows assert the exact drop messages.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('spellValidation', () => {
  it('pins exported arity against the REAL functions (#1510 runtime canon)', () => {
    expect(getClassSpellList.length).toBe(1); // rest excluded; 'version' default trims to 1
    expect(getSpellSources.length).toBe(1);
    expect(validateSpells.length).toBe(3);
    expect(getSpellValidationInfo.length).toBe(3);
    expect(hasMagicalSecretsAccess.length).toBe(3);
  });

  describe('getClassSpellList (dead export — zero production callers, API tripwire)', () => {
    it.each([
      ['Wizard', '5e', ['Wizard']],
      ['wizard', '5e', ['wizard']], // Q9: echoes input case, index match finds row
      ['Artificer', '2024', []], // disk census: absent from both classes.json files
    ])('getClassSpellList(%s, %s)', async (className, version, expected) => {
      await expect(getClassSpellList(className, version)).resolves.toEqual(expected);
    });
  });

  describe('getSpellSources — disk-backed extraction', () => {
    it('extracts the full 2024 sources shape for Wizard + Gnome, byte-exact arrays', async () => {
      const result = await getSpellSources(
        { class: { name: 'Wizard' }, race: { name: 'Gnome' } },
        '2024',
      );

      expect(result).toStrictEqual({
        class: { name: 'Wizard', spellList: ['Wizard'], isSpellcaster: true },
        race: {
          name: 'Gnome',
          spells: ['Speak with Animals'],
          // #1530: the Rock Gnome capture 'Mending and Prestidigitation' splits on the
          // conjunction; both parts catalog-match and are deduped against the trait hits.
          cantrips: ['Minor Illusion', 'Mending', 'Prestidigitation'],
        },
        background: { name: '', spells: [], cantrips: [] },
        feats: { grantedSpells: [], grantedCantrips: [], spellListAccess: [] },
      });
      // catalog loaded exactly once (module-level cache) even with multiple captures
      expect(dataLoader.loadSpells).toHaveBeenCalledTimes(1);
      expect(dataLoader.loadSpells).toHaveBeenCalledWith('2024');
    });

    it.each([
      [
        '2024',
        ['Magic Initiate', 'Fey Touched', 'Shadow Touched', 'Telepathy', 'Not A Feat'],
        {
          grantedSpells: ['Misty Step', 'Invisibility', 'Detect Thoughts'],
          // #1530: disk text "You learn two cantrips" captured 'two' as a pseudo-cantrip;
          // the token is now catalog-refused (console.error'd twice: desc + spell benefit).
          grantedCantrips: [],
          spellListAccess: ['Any class (chosen by player)'],
        },
      ],
      [
        '5e',
        ['Magic Initiate'],
        // Q3: 5e feats.json descriptions are arrays -> desc-parse arm inert; only the
        // name-hardcoded block contributes. 'Not A Feat' is silently skipped (:261 find-miss).
        { grantedSpells: [], grantedCantrips: [], spellListAccess: ['Any class (chosen by player)'] },
      ],
    ])('%s feats %j aggregate exactly', async (version, feats, expected) => {
      const result = await getSpellSources({ class: { name: 'Wizard' }, feats }, version);

      expect(result.feats).toStrictEqual(expected);
    });

    it('guards absent sources and pins the unconditional-isSpellcaster quirk (Q1)', async () => {
      const empty = await getSpellSources({}, '5e');
      expect(empty).toStrictEqual({
        class: { name: '', spellList: [], isSpellcaster: false },
        race: { name: '', spells: [], cantrips: [] },
        background: { name: '', spells: [], cantrips: [] },
        feats: { grantedSpells: [], grantedCantrips: [], spellListAccess: [] },
      });
      expect(dataLoader.loadClassData).not.toHaveBeenCalled();
      expect(dataLoader.loadRaceData).not.toHaveBeenCalled();
      expect(dataLoader.loadBackgroundData).not.toHaveBeenCalled();
      expect(dataLoader.loadFeatData).not.toHaveBeenCalled();

      // Named-but-off-disk class + anonymous race/background entries: only the class loader
      // runs, spellList is empty, yet isSpellcaster stays true (Q1). Anonymous entries carry
      // '' names and never reach their loaders.
      const offDisk = await getSpellSources(
        { class: { name: 'Artificer' }, race: {}, background: {}, feats: [] },
        '5e',
      );
      expect(offDisk.class).toStrictEqual({ name: 'Artificer', spellList: [], isSpellcaster: true });
      expect(offDisk.race).toStrictEqual({ name: '', spells: [], cantrips: [] });
      expect(dataLoader.loadClassData).toHaveBeenCalledTimes(1);
      expect(dataLoader.loadRaceData).not.toHaveBeenCalled();
      expect(dataLoader.loadBackgroundData).not.toHaveBeenCalled();
      expect(dataLoader.loadFeatData).not.toHaveBeenCalled();
    });

    it('branches on version: 5e joins array descriptions, 2024 does not (STRUCT fixture)', async () => {
      // Same two-element array description through both version arms: 5e joins to
      // "…Guidance cantrip." (capture fires); 2024 reads it raw and exec-coercion inserts a
      // comma that breaks the \s+ gate -> no capture. Kills the version-branch mutant.
      const structRace = {
        name: 'STRUCT Race',
        traits: [{ description: ['You know the Guidance', 'cantrip.'] }],
        subraces: [{ description: ['You know the Light', 'cantrip.'] }],
      };
      vi.mocked(dataLoader.loadRaceData).mockResolvedValue([structRace]);

      const s5e = await getSpellSources({ class: { name: 'Wizard' }, race: { name: 'STRUCT Race' } }, '5e');
      expect(s5e.race).toStrictEqual({ name: 'STRUCT Race', spells: [], cantrips: ['Guidance', 'Light'] });

      const s24 = await getSpellSources({ class: { name: 'Wizard' }, race: { name: 'STRUCT Race' } }, '2024');
      expect(s24.race).toStrictEqual({ name: 'STRUCT Race', spells: [], cantrips: [] });
    });

    it.each([
      ['features', [{ description: ['You know the <em>Guidance</em> cantrip.'] }]],
      ['traits', [{ description: 'You know the Produce Flame cantrip' }]], // features||traits fallback
    ])('extracts background spells via the %s key (STRUCT fixture, Q10)', async (key, entries) => {
      vi.mocked(dataLoader.loadBackgroundData).mockResolvedValue([
        { name: 'STRUCT Background', [key]: entries },
      ]);
      const formData = { class: { name: 'Wizard' }, background: { name: 'STRUCT Background' } };

      const sources = await getSpellSources(formData, '5e');
      // pattern-arm captures are cantrip-bucket by construction and catalog-canonicalized (#1530)
      expect(sources.background.spells).toEqual([]);
      expect(sources.background.cantrips).toEqual(key === 'features' ? ['Guidance'] : ['Produce Flame']);

      // same grant flows through validateSpells' allowed set (off both Wizard and Fighter):
      const fighter = await validateSpells(
        { ...formData, class: { name: 'Fighter' } },
        key === 'features' ? ['Guidance'] : ['Produce Flame'],
        spells5e,
        '5e',
      );
      expect(fighter.warnings).toEqual([]);
      expect(fighter.valid).toBe(true);
    });

    it('2024 disk backgrounds extract nothing (disk-inert tripwire, Q10)', async () => {
      for (const bg of backgrounds2024) {
        const sources = await getSpellSources(
          { class: { name: 'Wizard' }, background: { name: bg.name } },
          '2024',
        );
        expect(sources.background.spells).toEqual([]);
        expect(sources.background.cantrips).toEqual([]);
      }
    });
  });

  describe('#1530 catalog-backed capture filter (ARM A at the prose parser)', () => {
    // Structured-vs-parser verdict (disk census): the junk rows carry NO structured spell field
    // (5e Tiefling Infernal Legacy keys = index,name,description,proficiencies; 2024 Rock Gnome
    // subrace keys = name,description,languages; 2024 Magic Initiate benefits automation.spell is
    // the empty-string player-choice placeholder) — prose is the only source there, so the fix
    // arms the PARSER with catalog validation rather than delegating to a structured field.

    it('5e Tiefling disk prose "thaumaturgy" is canonicalized to titled, zero junk dropped', async () => {
      const sources = await getSpellSources(
        { class: { name: 'Fighter' }, race: { name: 'Tiefling' } },
        '5e',
      );
      expect(sources.race.cantrips).toStrictEqual(['Thaumaturgy']); // case-fold rescue, titled bytes
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("'two' from Magic Initiate prose is refused loudly and never enters grantedCantrips", async () => {
      const sources = await getSpellSources(
        { class: { name: 'Wizard' }, feats: ['Magic Initiate'] },
        '2024',
      );
      expect(sources.feats.grantedCantrips).toStrictEqual([]);
      // desc arm + benefits[type==='spell'] arm each capture 'two' -> two loud drops
      expect(consoleError).toHaveBeenCalledTimes(2);
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"two"'));
    });

    it("'Mending and Prestidigitation' splits on the conjunction into two valid titled cantrips", async () => {
      vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
        {
          name: 'STRUCT Race',
          traits: [{ description: 'You know the mending and thaumaturgy cantrips of your choice.' }],
        },
      ]);
      const sources = await getSpellSources(
        { class: { name: 'Wizard' }, race: { name: 'STRUCT Race' } },
        '5e',
      );
      // split + case-fold catalog match, canonical titled output, no conjunction fragment survives
      expect(sources.race.cantrips).toStrictEqual(['Mending', 'Thaumaturgy']);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('slash-joined prose fragments split before catalog matching', async () => {
      vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
        { name: 'STRUCT Race', traits: [{ description: 'You know the light/thaumaturgy cantrip.' }] },
      ]);
      const sources = await getSpellSources(
        { class: { name: 'Wizard' }, race: { name: 'STRUCT Race' } },
        '5e',
      );
      expect(sources.race.cantrips).toStrictEqual(['Light', 'Thaumaturgy']);
    });

    it('substring junk never sneaks in: "Armor" is refused, not matched to "Mage Armor" (#120/#1348 exact-match contract)', async () => {
      expect(spells5e.some((s) => s.name === 'Mage Armor')).toBe(true); // disk precondition
      expect(spells5e.some((s) => s.name === 'Armor')).toBe(false); // junk is a strict substring only
      vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
        { name: 'STRUCT Race', traits: [{ description: 'You know the Armor cantrip.' }] },
      ]);
      const sources = await getSpellSources(
        { class: { name: 'Wizard' }, race: { name: 'STRUCT Race' } },
        '5e',
      );
      expect(sources.race.cantrips).toStrictEqual([]);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"Armor"'));
    });

    it('quantifier junk ("another cantrip") is dropped; real prose captures across traits each validate', async () => {
      vi.mocked(dataLoader.loadRaceData).mockResolvedValue([
        {
          name: 'STRUCT Race',
          traits: [
            { description: 'You know the Guidance cantrip. When you level, you learn another cantrip.' },
            { description: 'You know two cantrips of your choice.' },
          ],
        },
      ]);
      const sources = await getSpellSources(
        { class: { name: 'Wizard' }, race: { name: 'STRUCT Race' } },
        '5e',
      );
      expect(sources.race.cantrips).toStrictEqual(['Guidance']);
      // loud drops for 'another' and 'two', in capture order
      expect(consoleError).toHaveBeenCalledTimes(2);
      expect(consoleError).toHaveBeenNthCalledWith(1, expect.stringContaining('"another"'));
      expect(consoleError).toHaveBeenNthCalledWith(2, expect.stringContaining('"two"'));
    });
  });

  describe('validateSpells', () => {
    it.each([
      ['empty array', []],
      ['null', null],
      ['absent', undefined],
    ])('short-circuits %s with zero loader round-trips', async (_label, selection) => {
      const result = await validateSpells({ class: { name: 'Wizard' } }, selection, spells5e, '5e');

      expect(result).toStrictEqual({ warnings: [], valid: true });
      expect(dataLoader.loadClassData).not.toHaveBeenCalled();
      expect(dataLoader.loadRaceData).not.toHaveBeenCalled();
    });

    it('warns per unknown spell, byte-exact, preserving selection order', async () => {
      const single = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Not A Spell'],
        spells5e,
        '5e',
      );
      expect(single.valid).toBe(false);
      expect(single.warnings).toStrictEqual([{ message: notFound('Not A Spell'), type: 'warning' }]);

      const mixed = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Not A Spell', 'Cure Wounds'],
        spells5e,
        '5e',
      );
      expect(mixed.valid).toBe(false);
      // not-found fires per-spell during iteration; off-list consolidates after (count order)
      expect(mixed.warnings).toStrictEqual([
        { message: notFound('Not A Spell'), type: 'warning' },
        { message: OUTSIDE_ONE, type: 'warning' },
      ]);
    });

    it.each([
      [['guidance'], OUTSIDE_ONE], // found via s.index arm; if index arm dies this flips to not-found bytes
      [['Cure Wounds', 'Guidance'], OUTSIDE_TWO], // consolidated single warning, plural form
    ])('%j off the Wizard disk list -> one consolidated warning', async (selection, expected) => {
      const result = await validateSpells(
        { class: { name: 'Wizard' } },
        selection,
        spells5e,
        '5e',
      );

      expect(result.valid).toBe(false);
      expect(result.warnings).toStrictEqual([{ message: expected, type: 'warning' }]);
    });

    it('accepts Wizard-list spells and leaves the selection array pure', async () => {
      const selection = ['Fireball', 'Detect Thoughts', 'Prestidigitation'];
      const snapshot = [...selection];

      const result = await validateSpells({ class: { name: 'Wizard' } }, selection, spells5e, '5e');

      expect(result).toStrictEqual({ warnings: [], valid: true });
      expect(selection).toEqual(snapshot);
    });

    it.each([
      ['Fighter', ['Fireball'], []], // half-caster proxy: Wizard-list spells allowed
      ['Rogue', ['Fireball'], []],
      ['Fighter', ['Guidance'], [OUTSIDE_ONE]], // Guidance is Cleric/Druid — proxy must not widen
      ['Monk', ['Darkness'], []], // hardcoded monk name list (Darkness is off every monk disk list)
      ['Monk', ['Guidance'], [OUTSIDE_ONE]],
    ])('%s selects %j', async (className, selection, expected) => {
      const result = await validateSpells({ class: { name: className } }, selection, spells5e, '5e');

      expect(result.warnings.map((w) => w.message)).toEqual(expected);
      expect(result.valid).toBe(expected.length === 0);
    });

    it.each([
      ['bare Cleric', {}, ['Darkness'], [OUTSIDE_ONE]], // disk: Darkness = Sorcerer/Warlock/Wizard
      ['Tiefling race grant', { race: { name: 'Tiefling' } }, ['Darkness'], []], // race.spells arm
      ['Gnome race cantrip grant', { race: { name: 'Gnome' } }, ['Minor Illusion'], []], // race.cantrips arm
    ])('2024 Cleric %s', async (_label, extra, selection, expected) => {
      const result = await validateSpells(
        { class: { name: 'Cleric' }, ...extra },
        selection,
        spells2024,
        '2024',
      );

      expect(result.warnings.map((w) => w.message)).toEqual(expected);
    });

    it('#1530: the thaumaturgy case trail is FIXED — titled allowed, lowercase refused', async () => {
      const formData = { class: { name: 'Fighter' }, race: { name: 'Tiefling' } };

      // disk prose "You know the thaumaturgy cantrip" is canonicalized to 'Thaumaturgy'
      // via the catalog, so the TITLED spell selection is now allowed by the race grant:
      const titled = await validateSpells(formData, ['Thaumaturgy'], spells5e, '5e');
      expect(titled).toStrictEqual({ warnings: [], valid: true });

      // the lowercase pseudo-name is no longer admitted into the allowed set; it still
      // resolves as a spell via s.index but is off the Fighter list -> consolidated warn:
      const lowered = await validateSpells(formData, ['thaumaturgy'], spells5e, '5e');
      expect(lowered).toStrictEqual({ warnings: [{ message: OUTSIDE_ONE, type: 'warning' }], valid: false });
    });

    it('feat grants widen the allowed set off the Cleric list (2024 Fey Touched)', async () => {
      const result = await validateSpells(
        { class: { name: 'Cleric' }, feats: ['Fey Touched'] },
        ['Misty Step'], // disk 2024: Sorcerer/Warlock/Wizard — allowed only via feat grant
        spells2024,
        '2024',
      );

      expect(result).toStrictEqual({ warnings: [], valid: true });
    });

    it('grantedSpells argument and magicInitiate/fey/shadow formData fields widen for a Ranger', async () => {
      const wizard = await validateSpells(
        { class: { name: 'Wizard' } },
        ['Command'], // disk 5e: Cleric/Paladin — off Wizard without the argument
        spells5e,
        '5e',
        ['Command'],
      );
      expect(wizard).toStrictEqual({ warnings: [], valid: true });

      const rangerFormData = {
        class: { name: 'Ranger' },
        level: 1,
        magicInitiateInstances: [
          { cantrips: ['Guidance', 'Produce Flame'], level1Spell: 'Burning Hands' },
          { cantrips: ['Light'] }, // sparse instance: cantrips[1]/level1Spell absent (?-arms)
        ],
        feyTouchedSpell: 'Command',
        shadowTouchedSpell: 'False Life',
      };
      const ranger = await validateSpells(
        rangerFormData,
        ['Guidance', 'Produce Flame', 'Burning Hands', 'Light', 'Command', 'False Life'],
        spells5e,
        '5e',
      );
      expect(ranger).toStrictEqual({ warnings: [], valid: true });
    });
  });

  describe('2024 Bard Magical Secrets (CLA-221 cannot-regress, fix 2963ab01a)', () => {
    it('pins the four-list const and the pure level-number gate', () => {
      // CLA-221 manifest expectedBehavior: "Bard, Cleric, Druid, and Wizard spell lists"
      expect(MAGICAL_SECRETS_CLASS_LISTS).toStrictEqual(['Bard', 'Cleric', 'Druid', 'Wizard']);
      expect(hasMagicalSecretsAccess('Bard', '2024', 10)).toBe(true); // disk lv10 magical_secrets:2
      expect(hasMagicalSecretsAccess('Bard', '2024', '20')).toBe(true); // string level
      expect(hasMagicalSecretsAccess('Bard', '2024', '10abc')).toBe(true); // parseInt coercion quirk
      expect(hasMagicalSecretsAccess('Bard', '2024', 9)).toBe(false);
      expect(hasMagicalSecretsAccess('Bard', '2024', undefined)).toBe(false);
      expect(hasMagicalSecretsAccess('Bard', '2024', null)).toBe(false);
      expect(hasMagicalSecretsAccess('Bard', '5e', 20)).toBe(false);
      expect(hasMagicalSecretsAccess('Cleric', '2024', 20)).toBe(false);
    });

    it.each([
      [10, ['Cure Wounds', 'Fireball', 'Guidance'], []], // lv>=10 opens every level, key row irrelevant
      [20, ['Cure Wounds', 'Fireball', 'Guidance'], []],
      [9, ['Guidance'], [OUTSIDE_ONE]], // Guidance disk: Cleric/Druid (off Bard)
    ])('2024 Bard lv%u admits four-list picks per gate', async (level, selection, expected) => {
      const result = await validateSpells({ class: { name: 'Bard' }, level }, selection, spells2024, '2024');

      expect(result.warnings.map((w) => w.message)).toEqual(expected);
      expect(result.valid).toBe(expected.length === 0);
    });

    it('does not widen 5e bards (same off-Bard Guidance token)', async () => {
      const result = await validateSpells(
        { class: { name: 'Bard' }, level: 20 },
        ['Guidance'], // disk 5e Guidance: Cleric/Druid only
        spells5e,
        '5e',
      );

      expect(result.warnings).toStrictEqual([{ message: OUTSIDE_ONE, type: 'warning' }]);
      expect(result.valid).toBe(false);
    });
  });

  describe('getSpellValidationInfo (WizardStepSpells.jsx:6 consumer)', () => {
    it('returns the exact key set, embedded validation, and loads sources exactly once (Q8 fixed)', async () => {
      const formData = { class: { name: 'Wizard' } };

      const result = await getSpellValidationInfo(formData, ['Fireball', 'Not A Spell'], spells5e, '5e');

      expect(Object.keys(result).sort()).toEqual([
        'classSpellList',
        'isSpellcaster',
        'sources',
        'spellCount',
        'valid',
        'warnings',
      ]);
      expect(result.spellCount).toBe(2);
      expect(result.classSpellList).toEqual(['Wizard']);
      expect(result.isSpellcaster).toBe(true); // Q1: unconditional true for any named class
      expect(result.valid).toBe(false);
      expect(result.warnings).toStrictEqual([{ message: notFound('Not A Spell'), type: 'warning' }]);
      expect(result.sources).toStrictEqual({
        class: { name: 'Wizard', spellList: ['Wizard'], isSpellcaster: true },
        race: { name: '', spells: [], cantrips: [] },
        background: { name: '', spells: [], cantrips: [] },
        feats: { grantedSpells: [], grantedCantrips: [], spellListAccess: [] },
      });
      // Q8 fixed quantification: one shared getSpellSources load feeds validation + info
      expect(dataLoader.loadClassData).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      const nullSelection = await getSpellValidationInfo(formData, null, [], '5e');
      expect(nullSelection.spellCount).toBe(0);
      expect(nullSelection.valid).toBe(true);
      expect(dataLoader.loadClassData).toHaveBeenCalledTimes(1); // wrapper loads; core loop runs empty
    });
  });
});
