// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* ------------------------------------------------------------------ */
/*  Lane: spellResolution.js CONTROL-FLOW face (base sibling).         */
/*                                                                      */
/*  Split canon (#1500, VERBATIM): "base owns control flow: buff/     */
/*  silence blocking, ambush, globe target, psychic component          */
/*  reduction, Friends/Invisibility end, CLA-212 cantrip recompute,   */
/*  needsLookup, default values. Complex owns numeric/damage-type     */
/*  resolution" — numerics are NOT re-grown here; they live in         */
/*  spellResolution.complex.test.js (T1 full-17-key pin :128-160,     */
/*  damage fallback :164, psychic override :176, resolveSaveDc         */
/*  :197/:207, toHit/castingMod reachability :220-278).                */
/*                                                                      */
/*  ORPHAN-LIVE-BY-TESTS (re-verified 2026-10-21): resolveSpell-      */
/*  Resolution (:129) has ZERO production importers (grep excl test -> */
/*  only export line :216). Kept as guard-bits vs resurrection of the */
/*  retained export + CLA-391 byte-shape mirror mandate (module        */
/*  :11-14). getActiveBuffs re-export LIVE via blockChecks.js:27      */
/*  dynamic import — live-block behavior owned by blockChecks pair    */
/*  (#1466 gates); isInnateSorceryActive re-export DEAD — REPORTED    */
/*  (complex header :18). Silence/SilenceZone/psychic/friends/invis   */
/*  mocks are external boundaries; ALL control flow inside             */
/*  spellResolution.js (checkBlockedByBuff, resolveAmbushFlags,       */
/*  checkSilenceBlocked, applyPsychicComponents, resolveSpellStats,    */
/*  placeholder gate :174, needsLookup :179) runs REAL — never-mock-  */
/*  unit-under-test. normalizeCastingTime (:9 castingTimeUtils) REAL. */
/*                                                                      */
/*  Mock census vs spellResolution.js imports :1-9, line-by-line:     */
/*  :1 useRuntimeState(getRuntimeValue)✓mock(+setRuntimeValue spare   */
/*  factory key, unused) :2 logService.addEntry✓ :3 buffService both✓ */
/*  :4 silenceService pair✓ :5 psychicSpellsHandler✓ :6 friends✓      */
/*  :7 invisibility✓ :8 resolveSpellDamageWithTypes✓(pinned null —    */
/*  numerics ride complex) :9 castingTimeUtils REAL — zero dead mocks.*/
/*                                                                      */
/*  Bake-roll third-source VERDICT: NONE. Module's only level input   */
/*  is spell.level||1 (:108) fed to resolveSpellDamageWithTypes       */
/*  (:109); playerStats.level is NEVER read (grep:0). #1454/:53       */
/*  ladder vs #1488/:13 baked pair stays in the damage lanes; this    */
/*  lane joins the table as pass-through, falsy-zero cantrip row      */
/*  pinned (T2). NOTE quantified twin: :108 falsy level||1 vs log      */
/*  lane :202 spell.level||0 — different falsy defaults, same source  */
/*  byte; log lane owned by spellResolution-log.test.js.               */
/*                                                                      */
/*  Quirk censuses (disk, 2026-10-21): needsLookup lattice over REAL  */
/*  disks = 5e 249 true / 3 false / 79 undefined-of-331; 2024 = 289 / */
/*  5 / 99-of-393 — the implicit-undefined carry (:179 AoE+no-         */
/*  automation.type) is quantified in T3. lowercase 'v' components:   */
/*  0-of-331 and 0-of-393, so the byte-critical includes('V') gate   */
/*  (:53) is disk-safe; quirk pinned synthetically T7. Twin logic:    */
/*  checkBlockedByBuff ≡ blockChecks.checkBlockedBySpellcastingBuff   */
/*  (CLA-391 mirror, module note :11-14) — REPORTED, no inline-dup in */
/*  this lane beyond it. NO-CLOCK: Date.now() only as log stamp        */
/*  (:28/:61); needsLookup holds no round math (contrast #1497).      */
/*  te-keys: lane writes no targetEffects (registry n/a).              */
/*                                                                      */
/*  Kill-matrix declared: block-return-after-side-effects → T4/T6     */
/*  downstream-absence+census; drop ||1 → T2; cantrip-0 swallowed →   */
/*  T2; needsLookup branch reorder/short-circuit → T3 rows; IIFE      */
/*  ?.name||null → T11 falsy rows; rejection honesty → T11 rejects;   */
/*  gate toLowerCase/byte-case removal → T7 lowercase + T14 'FRIENDS' */
/*  ; arg swaps → exact tuples everywhere; order swap → invocation-    */
/*  CallOrder pins T4/T6/T14; refusalType replace bytes → T5 B/C;     */
/*  console.error deletion → T9 bytes + T16 swallow bytes; golden     */
/*  derefs stay raw+silent → T15. No mutants survived (declared).     */
/*                                                                      */
/*  Fixtures: REAL disk rows both rulesets via static JSON imports    */
/*  (drift alarms inline; fabrication-ban honored); caster 'TestWizard */
/*  ' synthetic non-impersonating provenance (#1492); campaign        */
/*  lockdown 'test-campaign'.                                           */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/class-warlock/psychicSpellsHandler.js', () => ({
  getPsychicSpellsConfig: vi.fn(() => null),
}));

vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => null),
}));

import { resolveSpellResolution } from './spellResolution.js';
import { getActiveBuffs, isInnateSorceryActive } from '../../../../combat/buffs/buffService.js';
import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { getPsychicSpellsConfig } from '../../../../automation/handlers/class-warlock/psychicSpellsHandler.js';
import { getSilenceSource, isCreatureInSilenceZone } from '../../../features/silenceService.js';
import { endFriendsOnHostileAction } from '../../../features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../../features/invisibilityService.js';
import { addEntry } from '../../../../ui/logService.js';
import { normalizeCastingTime } from '../../../../shared/castingTimeUtils.js';

/* ---------------- disk rows (drift-throw finder, #1499/1500 form) ---- */

const disk = (arr, name) => {
  const s = arr.find((x) => x.name === name);
  if (!s) throw new Error(`disk row missing: ${name}`);
  return s;
};
const fb5 = disk(spells5e, 'Fireball');
const fb24 = disk(spells2024, 'Fireball');
const mm5 = disk(spells5e, 'Magic Missile');
const mm24 = disk(spells2024, 'Magic Missile');
const fear5 = disk(spells5e, 'Fear');
const fear24 = disk(spells2024, 'Fear');
const globe5 = disk(spells5e, 'Globe of Invulnerability');
const shield5 = disk(spells5e, 'Shield');
const shield24 = disk(spells2024, 'Shield');
const friends5 = disk(spells5e, 'Friends');
const friends24 = disk(spells2024, 'Friends');
const light5 = disk(spells5e, 'Light');
const silence24 = disk(spells2024, 'Silence');

/* ---------------- synthetic non-impersonating caster ------------------- */

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '150 feet',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    dc: { dc_type: 'dex', dc_success: 'half' },
    ...overrides,
  };
}

const resolve = (spell, playerStats, getTargetInfo = null) =>
  resolveSpellResolution(spell, {}, playerStats ?? makePlayerStats(), 'test-campaign', getTargetInfo);

describe('spellResolution — control-flow lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveBuffs.mockReturnValue([]);
    isInnateSorceryActive.mockReturnValue(false);
    getSilenceSource.mockReturnValue(null);
    isCreatureInSilenceZone.mockReturnValue(false);
    getPsychicSpellsConfig.mockReturnValue(null);
    getRuntimeValue.mockReturnValue([]);
    addEntry.mockImplementation(() => Promise.resolve());
  });

  /* ---- T1 defaults skeleton (numeric face -> complex :128-160) ---- */

  it('unblocked cast builds the 17-key control-flow skeleton in canonical order, fullSpell by identity, fresh object per call', () => {
    const result = resolve(mm5, makePlayerStats()); // REAL disk row, needsLookup true

    expect(Object.keys(result)).toStrictEqual([
      'globeTargetName', 'magicalAmbush', 'casterConditions', 'hasInvisible',
      'psychicSpellsConfig', 'spellLevel', 'innateSorceryActive', 'damageInfo',
      'formula', 'damageType', 'effectiveDamageType', 'cantripSpellAbility',
      'spellToHit', 'spellSaveDc', 'spellCastingMod', 'fullSpell', 'needsLookup',
    ]);
    expect({
      globeTargetName: result.globeTargetName, // getTargetInfo null -> null, not Promise
      magicalAmbush: result.magicalAmbush,
      casterConditions: result.casterConditions,
      hasInvisible: result.hasInvisible,
      psychicSpellsConfig: result.psychicSpellsConfig,
      innateSorceryActive: result.innateSorceryActive,
      damageInfo: result.damageInfo,
      formula: result.formula,
      needsLookup: result.needsLookup,
    }).toStrictEqual({
      globeTargetName: null,
      magicalAmbush: false,
      casterConditions: [],
      hasInvisible: false,
      psychicSpellsConfig: null,
      innateSorceryActive: false,
      damageInfo: null,
      formula: null,
      needsLookup: true,
    });
    expect(result.fullSpell).toBe(mm5);
    // purity: fresh result container per call; casterConditions is an ALIAS
    // of the collaborator's array (module never clones — honest quirk pin)
    const again = resolve(mm5, makePlayerStats());
    expect(again).not.toBe(result);
    expect(again.fullSpell).toBe(result.fullSpell);
    expect(again.casterConditions).toBe(result.casterConditions);
    // every collaborator queried with the lockdown tuple
    expect(getActiveBuffs).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    expect(isInnateSorceryActive).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    expect(getRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWizard', 'activeConditions', 'test-campaign');
    expect(addEntry).not.toHaveBeenCalled();
  });

  /* ---- T2 spellLevel single source (bake-roll verdict) ---- */

  it('spellLevel: single-source spell.level passthrough; falsy undefined AND falsy-zero cantrip both swallow to 1 (:108)', () => {
    expect(resolve(makeSpell({ level: 5 }), makePlayerStats()).spellLevel).toBe(5);
    expect(resolve(makeSpell({ level: undefined }), makePlayerStats()).spellLevel).toBe(1);
    // cantrip level 0 hits the SAME ||1 swallow — bake-roll VERDICT: this
    // module offers NO third level source (playerStats.level never read);
    // :108 is the only input handed to resolveSpellDamageWithTypes (:109).
    const cantrip = resolve({ ...light5 }, makePlayerStats());
    expect(light5.level).toBe(0); // disk drift alarm
    expect(cantrip.spellLevel).toBe(1);
  });

  /* ---- T3 needsLookup lattice, real disks, quantified census ---- */

  it('needsLookup lattice over REAL disk rows both rulesets: no-AoE true, null-AoE true, type-no-effects true, AoE-no-automation implicit-undefined (79/331 + 99/393 carry)', () => {
    // branch 1: !area_of_effect
    expect(resolve(mm5, makePlayerStats()).needsLookup).toBe(true);            // 5e: key absent
    expect(resolve(mm24, makePlayerStats()).needsLookup).toBe(true);           // 2024: value null
    // branch 2: automation.type set, effects absent
    expect(resolve(fear5, makePlayerStats()).needsLookup).toBe(true);
    expect(resolve(fear24, makePlayerStats()).needsLookup).toBe(true);
    expect(fear5.automation.type).toBe('fear');       // disk drift alarms
    expect(fear24.automation.effects).toBeUndefined();
    // implicit-undefined quirk (#1499 key-carry): AoE truthy + automation?.type falsy
    expect(fb5.area_of_effect).toStrictEqual({ type: 'sphere', size: 20 });
    expect(fb5.automation).toBeUndefined();
    expect(fb24.automation).toBeUndefined();
    expect(fb24.area_of_effect).toStrictEqual({ shape: 'sphere', size: '20-foot-radius' });
    expect(resolve({ ...fb5 }, makePlayerStats()).needsLookup).toBeUndefined();
    expect(resolve({ ...fb24 }, makePlayerStats()).needsLookup).toBeUndefined();
    // quantified disk census vs the module expression (drift alarm on disk edits)
    const lattice = (arr) => arr.reduce((acc, s) => {
      const v = !s.area_of_effect || (s.automation?.type && !s.automation?.effects);
      acc[v === true ? 't' : v === false ? 'f' : 'u'] += 1;
      return acc;
    }, { t: 0, f: 0, u: 0 });
    expect({ n: spells5e.length, ...lattice(spells5e) }).toStrictEqual({ n: 331, t: 249, f: 3, u: 79 });
    expect({ n: spells2024.length, ...lattice(spells2024) }).toStrictEqual({ n: 393, t: 289, f: 5, u: 99 });
  });

  /* ---- T4 buff block short-circuit ---- */

  it('blocksSpellcasting buff short-circuits to the exact 1-key tuple BEFORE every downstream collaborator', () => {
    getActiveBuffs.mockReturnValue([{ name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true }]);

    const result = resolve(fb5, makePlayerStats());

    expect(result).toStrictEqual({ blockedByBuffs: true });
    expect(getActiveBuffs).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    expect(addEntry).toHaveBeenCalledTimes(1); // refusal bytes pinned in T5
    expect(getActiveBuffs.mock.invocationCallOrder[0]).toBeLessThan(addEntry.mock.invocationCallOrder[0]);
    // nothing downstream of the gate (:150 before :154-186) may run:
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(getSilenceSource).not.toHaveBeenCalled();
    expect(isCreatureInSilenceZone).not.toHaveBeenCalled();
    expect(getPsychicSpellsConfig).not.toHaveBeenCalled();
    expect(endFriendsOnHostileAction).not.toHaveBeenCalled();
    expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    expect(isInnateSorceryActive).not.toHaveBeenCalled();
  });

  it('non-blocking buff lattice ([] and blocksSpellcasting:false) runs the full gauntlet', () => {
    for (const buffs of [[], [{ name: 'Shield of Faith', blocksSpellcasting: false }]]) {
      vi.clearAllMocks();
      getActiveBuffs.mockReturnValue(buffs);

      const result = resolve(fb5, makePlayerStats());

      expect(result.blockedByBuffs).toBeUndefined();
      expect(getActiveBuffs).toHaveBeenCalledWith('TestWizard', 'test-campaign');
      expect(addEntry).not.toHaveBeenCalled();
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledTimes(1);
    }
  });

  /* ---- T5 CLA-391 refusal log — exact entry, derivation triple ---- */

  it('CLA-391 refusal log pins the full entry bytes and the effect||name toLowerCase/underscore derivation across its three falsy shapes', () => {
    const rows = [
      {
        buff: { name: 'Wild Shape', effect: 'shape_shift' },
        entry: {
          type: 'automation', automationType: 'shape_shift_refused',
          creatureName: 'TestWizard', characterName: 'TestWizard',
          name: 'Wild Shape',
          description: 'Fireball blocked — TestWizard cannot cast spells while under Wild Shape.',
        },
      },
      { // no effect -> name feeds refusalType; \s+ -> _ byte visible
        buff: { name: 'Gaseous Form' },
        entry: {
          type: 'automation', automationType: 'gaseous_form_refused',
          creatureName: 'TestWizard', characterName: 'TestWizard',
          name: 'Gaseous Form',
          description: 'Fireball blocked — TestWizard cannot cast spells while under Gaseous Form.',
        },
      },
      { // no name either -> 'Shape-Shift' fallback; hyphen SURVIVES replace(\s+) quirk
        buff: {},
        entry: {
          type: 'automation', automationType: 'shape-shift_refused',
          creatureName: 'TestWizard', characterName: 'TestWizard',
          name: 'Shape-Shift',
          description: 'Fireball blocked — TestWizard cannot cast spells while under Shape-Shift.',
        },
      },
    ];

    for (const { buff, entry } of rows) {
      vi.clearAllMocks();
      getActiveBuffs.mockReturnValue([{ ...buff, blocksSpellcasting: true }]);

      resolve(fb5, makePlayerStats());

      expect(addEntry).toHaveBeenCalledTimes(1);
      const [campaign, logged] = addEntry.mock.calls[0];
      expect(campaign).toBe('test-campaign');
      const { timestamp, ...rest } = logged;
      expect(rest).toStrictEqual(entry);
      expect(typeof timestamp).toBe('number');
    }
  });

  /* ---- T6 silence block on disk rows both rulesets (#1365) ---- */

  it('Silence blocks V-component casts on REAL disk rows of both rulesets with the exact 5-key log entry and full downstream short-circuit', () => {
    for (const spell of [fb5, fb24]) {
      vi.clearAllMocks();
      // disk 'V' component drift alarms, both rulesets
      expect(spell.components).toContain('V');
      expect(spell.casting_time).toBe(spell === fb5 ? '1 action' : 'Action');

      getSilenceSource.mockReturnValue('SilenceCaster');
      isCreatureInSilenceZone.mockReturnValue(true);

      const result = resolve(spell, makePlayerStats());

      expect(result).toStrictEqual({ blockedBySilence: true });
      expect(getSilenceSource).toHaveBeenCalledWith('TestWizard', 'test-campaign');
      expect(isCreatureInSilenceZone).toHaveBeenCalledWith('TestWizard', 'SilenceCaster', 'test-campaign');
      expect(getSilenceSource.mock.invocationCallOrder[0]).toBeLessThan(
        isCreatureInSilenceZone.mock.invocationCallOrder[0],
      );
      // exact refusal log — census 1 call, exact key-set (NO automationType key)
      expect(addEntry).toHaveBeenCalledTimes(1);
      const [campaign, logged] = addEntry.mock.calls[0];
      expect(campaign).toBe('test-campaign');
      expect(Object.keys(logged)).toStrictEqual(['type', 'creatureName', 'name', 'description', 'timestamp']);
      const { timestamp, ...rest } = logged;
      expect(rest).toStrictEqual({
        type: 'automation',
        creatureName: 'TestWizard',
        name: 'Silence',
        description: `${spell.name} blocked — TestWizard is inside SilenceCaster's Silence zone; Verbal components are impossible there.`,
      });
      expect(typeof timestamp).toBe('number');
      // gate order: ambush (:159) ran once BEFORE silence (:161); nothing after it
      expect(getRuntimeValue).toHaveBeenCalledTimes(1);
      expect(getPsychicSpellsConfig).not.toHaveBeenCalled();
      expect(endFriendsOnHostileAction).not.toHaveBeenCalled();
      expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
      expect(isInnateSorceryActive).not.toHaveBeenCalled();
    }
  });

  /* ---- T7 silence gate lattice (negative rows) ---- */

  it('silence gates pass without deeper queries: no-V disk row never asks, lowercase v byte misses, null source / out-of-zone never pair-check', () => {
    // REAL disk Friends 2024: components ['S','M'] — gate :53 must NOT query silence
    getSilenceSource.mockReturnValue('SilenceCaster');
    isCreatureInSilenceZone.mockReturnValue(true);

    const fr = resolve(friends24, makePlayerStats());

    expect(fr.blockedBySilence).toBeUndefined();
    expect(friends24.components).toStrictEqual(['S', 'M']); // disk drift alarm
    expect(getSilenceSource).not.toHaveBeenCalled();
    expect(isCreatureInSilenceZone).not.toHaveBeenCalled();
    expect(endFriendsOnHostileAction).not.toHaveBeenCalled(); // 'Friends' name gate rides along
    expect(endInvisibilityOnHostileAction).toHaveBeenCalledTimes(1);

    // byte-critical uppercase gate: lowercase 'v' misses (disk census: 0 lowercase-'v'
    // rows in 331 + 393 — safe, quirk pinned synthetic)
    const lower = resolve(makeSpell({ components: ['v', 'S'] }), makePlayerStats());
    expect(lower.blockedBySilence).toBeUndefined();
    expect(getSilenceSource).not.toHaveBeenCalled();

    // silence source absent -> zone pairing never runs
    getSilenceSource.mockReturnValue(null);
    expect(resolve(fb5, makePlayerStats()).blockedBySilence).toBeUndefined();
    expect(getSilenceSource).toHaveBeenCalledTimes(1);
    expect(isCreatureInSilenceZone).not.toHaveBeenCalled();

    // in-zone false -> cast continues all the way to psychic lookup (4th unblocked cast)
    getSilenceSource.mockReturnValue('SilenceCaster');
    isCreatureInSilenceZone.mockReturnValue(false);
    expect(resolve(fb5, makePlayerStats()).blockedBySilence).toBeUndefined();
    expect(getPsychicSpellsConfig).toHaveBeenCalledTimes(4); // friends24 + lowercase + null-source + zone-false
    expect(addEntry).not.toHaveBeenCalled(); // every row passed the gate — zero log traffic
  });

  /* ---- T8 ambush AND-lattice ---- */

  it('magical ambush AND-lattice with case-insensitive invisible and casterConditions passed through by identity', () => {
    const ambush = [{ type: 'passive_rule', effect: 'magical_ambush' }];

    const conds = ['invisible'];
    const tCondEmpty = resolve(fb5, makePlayerStats({ automation: { passives: ambush } }));
    getRuntimeValue.mockReturnValue(conds);
    const tt = resolve(fb5, makePlayerStats({ automation: { passives: ambush } }));
    expect({ ambush: tCondEmpty.magicalAmbush, invis: tCondEmpty.hasInvisible }).toStrictEqual({ ambush: true, invis: false });
    expect(tt.magicalAmbush).toBe(true);
    expect(tt.hasInvisible).toBe(true);
    expect(tt.casterConditions).toBe(conds); // :42 identity passthrough

    // passive false + invisible true -> ambush AND keeps hasInvisible false
    getRuntimeValue.mockReturnValue(['invisible']);
    const ft = resolve(fb5, makePlayerStats({ automation: { passives: [] } }));
    expect({ ambush: ft.magicalAmbush, invis: ft.hasInvisible }).toStrictEqual({ ambush: false, invis: false });

    // passive true + not invisible
    getRuntimeValue.mockReturnValue(['burning']);
    const tf = resolve(fb5, makePlayerStats({ automation: { passives: ambush } }));
    expect({ ambush: tf.magicalAmbush, invis: tf.hasInvisible }).toStrictEqual({ ambush: true, invis: false });

    // case trail (:47 toLowerCase): 'Invisible' counts
    getRuntimeValue.mockReturnValue(['Invisible']);
    expect(resolve(fb5, makePlayerStats({ automation: { passives: ambush } })).hasInvisible).toBe(true);

    expect(getRuntimeValue).toHaveBeenNthCalledWith(1, 'TestWizard', 'activeConditions', 'test-campaign');
    // ambush CONSUMPTION/transport is owned by index.magicalAmbushTransport.test.js (#1485/#1495) — cited, not re-grown
  });

  /* ---- T9 guard throws with console bytes ---- */

  it('ambush guards throw the exact message AFTER logging the exact console byte (abort is never silent)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const guards = [
        {
          stats: makePlayerStats({ automation: { passives: null } }),
          msg: 'playerStats.automation.passives is required for magical ambush check',
          byte: '[spellCast] magicalAmbush check: playerStats.automation.passives is missing',
        },
        {
          stats: makePlayerStats({ automation: {} }),
          msg: 'playerStats.automation.passives is required for magical ambush check',
          byte: '[spellCast] magicalAmbush check: playerStats.automation.passives is missing',
        },
      ];
      for (const { stats, msg, byte } of guards) {
        spy.mockClear();
        expect(() => resolve(fb5, stats)).toThrow(msg);
        expect(spy.mock.calls).toStrictEqual([[byte]]);
      }

      spy.mockClear();
      getRuntimeValue.mockReturnValue('not-an-array');
      expect(() => resolve(fb5, makePlayerStats())).toThrow('activeConditions must be an array for caster');
      expect(spy.mock.calls).toStrictEqual([['[spellCast] casterConditions: activeConditions is not an array']]);
      expect(addEntry).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  /* ---- T10 SP-002 falsy activeConditions ---- */

  it('SP-002: null AND undefined activeConditions both resolve to a fresh empty casterConditions, never an abort (:41-42 twin)', () => {
    for (const falsy of [null, undefined]) {
      getRuntimeValue.mockReturnValue(falsy);

      const result = resolve(fb5, makePlayerStats());

      expect(result).not.toBeNull();
      expect(result.casterConditions).toStrictEqual([]);
      expect(result.hasInvisible).toBe(false);
    }
  });

  /* ---- T11 globe target IIFE (:154-157, #1466/#1474 target naming) ---- */

  it('globe target IIFE resolves name bytes, falsy shapes to null, and carries a rejected getTargetInfo as an honest rejection on globeTargetName', async () => {
    const targetInfo = vi.fn(() => Promise.resolve({ name: 'Goblin' }));
    const result = resolve(globe5, makePlayerStats(), targetInfo);

    expect(result.globeTargetName).toBeInstanceOf(Promise);
    expect(await result.globeTargetName).toBe('Goblin');
    expect(targetInfo).toHaveBeenCalledTimes(1);
    expect(targetInfo.mock.calls[0]).toStrictEqual([]); // zero-arg arity

    const rows = [
        [Promise.resolve(undefined), null],
        [Promise.resolve({}), null],
        [Promise.resolve({ name: '' }), null], // empty-name falsy -> null
    ];
    for (const [pr, expected] of rows) {
      expect(await resolve(globe5, makePlayerStats(), () => pr).globeTargetName).toBe(expected);
    }

    // unawaited-IIFE quirk (#1499 :154-157): rejection is NOT swallowed and NOT
    // logged — it rides on globeTargetName. Pinned honestly, consumed via rejects.
    const boom = () => Promise.reject(new Error('target gone'));
    const rejected = resolve(globe5, makePlayerStats(), boom);
    expect(Object.keys(rejected)).toHaveLength(17); // sync result completed anyway
    await expect(rejected.globeTargetName).rejects.toThrow('target gone');
  });

  /* ---- T12 psychic component reduction ---- */

  it('psychic config reduces V/S by-reference on matching school (case-insensitive) and the untouched lattice keeps every byte', () => {
    const config = { spellSchools: ['Enchantment', 'Illusion'], componentReduction: ['V', 'S'], damageType: 'Psychic' };
    getPsychicSpellsConfig.mockReturnValue(config);

    const hitSpell = makeSpell({ school: 'Enchantment', components: ['V', 'S', 'M'] });
    const ps = makePlayerStats();
    const hit = resolve(hitSpell, ps);
    expect(hit.psychicSpellsConfig).toBe(config); // identity passthrough
    expect(hitSpell.components).toStrictEqual(['M']); // mutated by reference
    expect(getPsychicSpellsConfig).toHaveBeenCalledTimes(1);
    expect(getPsychicSpellsConfig.mock.calls[0][0]).toBe(ps); // arg identity, no shapeless matcher

    // REAL disk Friends 5e (Enchantment, V,S) cloned -> emptied; disk row stays intact
    const clone = { ...friends5 };
    resolve(clone, makePlayerStats());
    expect(clone.components).toStrictEqual([]);
    expect(friends5.components).toStrictEqual(['V', 'S']);

    // lowercase school + lowercase component bytes still reduce (:69-73 double map)
    const lower = makeSpell({ school: 'enchantment', components: ['V', 's'] });
    resolve(lower, makePlayerStats());
    expect(lower.components).toStrictEqual([]);

    // untouched lattice: school miss / config null / components undefined
    const miss = makeSpell({ school: 'Evocation', components: ['V', 'S'] });
    resolve(miss, makePlayerStats());
    expect(miss.components).toStrictEqual(['V', 'S']);
    getPsychicSpellsConfig.mockReturnValue(null);
    const noCfg = makeSpell({ school: 'Enchantment', components: ['V', 'S'] });
    expect(resolve(noCfg, makePlayerStats()).psychicSpellsConfig).toBeNull();
    expect(noCfg.components).toStrictEqual(['V', 'S']);
    const noComp = makeSpell({ school: 'Enchantment', components: undefined });
    expect(resolve(noComp, makePlayerStats()).psychicSpellsConfig).toBeNull(); // :68 guard, no crash
  });

  /* ---- T13 casting_time placeholder gate (:174-176) ---- */

  it('the __placeholder__ getRuntimeValue side-channel opens ONLY on canonical 1-action casts, both rulesets, as an exact 2-arg tuple', () => {
    // gate arithmetic against the REAL util
    expect(normalizeCastingTime(mm5.casting_time)).toBe('1 action');
    expect(normalizeCastingTime(fear24.casting_time)).toBe('1 action'); // 'Action' normalizes in
    expect(normalizeCastingTime(shield5.casting_time)).toBe('1 reaction');
    expect(normalizeCastingTime(silence24.casting_time)).toBe('Action or Ritual'); // compound stays raw
    expect(normalizeCastingTime(fb24.casting_time)).toBe('1 action');

    for (const spell of [mm5, fear24]) {
      vi.clearAllMocks();
      resolve(spell, makePlayerStats());
      expect(getRuntimeValue).toHaveBeenCalledTimes(2); // ambush + placeholder
      expect(getRuntimeValue.mock.calls[1]).toStrictEqual(['__placeholder__', '__placeholder__']); // arity 2, no 3rd campaign arg carry
    }
    for (const spell of [shield5, shield24]) {
      vi.clearAllMocks();
      expect(resolve(spell, makePlayerStats()).needsLookup).toBe(true); // no-AoE reaction spells still look up
      expect(getRuntimeValue).toHaveBeenCalledTimes(1); // ambush only — gate closed
    }
    // 'Action or Ritual' stays non-canonical (util pass-through) -> gate closed;
    // AoE + no automation.type -> implicit-undefined carry (T3 lattice, not re-pinned)
    vi.clearAllMocks();
    resolve(silence24, makePlayerStats());
    expect(getRuntimeValue).toHaveBeenCalledTimes(1);
  });

  /* ---- T14 Friends/Invisibility end hooks (:169-172) ---- */

  it('Friends name-gate census: hostile-named casts end Friends, name-less and any-case Friends never do; Invisibility end is unconditional', () => {
    const rows = [
      { spell: fb5, friends: true },
      { spell: friends5, friends: false },           // REAL disk 'Friends'
      { spell: makeSpell({ name: 'FRIENDS' }), friends: false }, // toLowerCase byte
      { spell: makeSpell({ name: undefined }), friends: false }, // spell.name && guard
    ];

    for (const { spell, friends } of rows) {
      vi.clearAllMocks();
      resolve(spell, makePlayerStats());

      if (friends) {
        expect(endFriendsOnHostileAction).toHaveBeenCalledTimes(1);
        expect(endFriendsOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        expect(endFriendsOnHostileAction.mock.invocationCallOrder[0]).toBeLessThan(
          endInvisibilityOnHostileAction.mock.invocationCallOrder[0],
        );
      } else {
        expect(endFriendsOnHostileAction).not.toHaveBeenCalled();
      }
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledTimes(1);
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    }
  });

  /* ---- T15 golden unguarded derefs (console-untouched, #1360) ---- */

  it('golden unguarded derefs crash as raw TypeErrors with the exact V8 bytes and zero console/log traffic', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => resolveSpellResolution(fb5, {}, undefined, 'test-campaign', null))
        .toThrow(TypeError('Cannot read properties of undefined (reading \'name\')')); // :16
      expect(() => resolveSpellResolution(undefined, {}, makePlayerStats(), 'test-campaign', null))
        .toThrow(TypeError('Cannot read properties of undefined (reading \'components\')')); // :53
      getActiveBuffs.mockReturnValue(undefined);
      expect(() => resolve(fb5, makePlayerStats()))
        .toThrow(TypeError('Cannot read properties of undefined (reading \'find\')')); // :17

      expect(spy).not.toHaveBeenCalled(); // crashes stay raw — no silent, no logged
      expect(addEntry).not.toHaveBeenCalled();
      expect(endFriendsOnHostileAction).not.toHaveBeenCalled();
      expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  /* ---- T16 addEntry rejection swallow (:29/:62 catch bytes) ---- */

  it('addEntry rejections are swallowed with the exact lane console bytes and never break the block verdict', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      addEntry.mockRejectedValue(new Error('log down'));

      getActiveBuffs.mockReturnValue([{ name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true }]);
      expect(resolve(fb5, makePlayerStats())).toStrictEqual({ blockedByBuffs: true });
      for (let i = 0; i < 5 && spy.mock.calls.length === 0; i += 1) await Promise.resolve();
      expect(spy.mock.calls).toStrictEqual([['[spellResolution:blocked-by-buff-log-error]', new Error('log down')]]);

      spy.mockClear();
      getActiveBuffs.mockReturnValue([]);
      getSilenceSource.mockReturnValue('SilenceCaster');
      isCreatureInSilenceZone.mockReturnValue(true);
      expect(resolve(fb5, makePlayerStats())).toStrictEqual({ blockedBySilence: true });
      for (let i = 0; i < 5 && spy.mock.calls.length === 0; i += 1) await Promise.resolve();
      expect(spy.mock.calls).toStrictEqual([['[spellResolution:silence-log-error]', new Error('log down')]]);
    } finally {
      spy.mockRestore();
    }
  });

  /* ---- T17 CLA-212 cantrip recompute (base-owned per split) ---- */

  describe('CLA-212 per-spell spellCastingAbility recompute', () => {
    // War_Cleric shape: 2024 Aasimar Light Domain Cleric lv6, WIS 9/-1, CHA 16/+3, PB +3.
    const clericStats = makePlayerStats({
      name: 'War_Cleric',
      proficiency: 3,
      abilities: [
        { name: 'Wisdom', bonus: -1 },
        { name: 'Charisma', bonus: 3 },
      ],
      spellAbilities: { spellCastingAbility: 'Wisdom', toHit: 2, saveDc: 10, modifier: -1 },
    });

    it('a Light cantrip carrying spellCastingAbility Charisma recomputes to-hit/DC/mod on Charisma math', () => {
      const light = {
        ...light5, // REAL disk row: level 0, Evocation, ['V','M']
        spellCastingAbility: 'Charisma',
      };

      const result = resolve(light, clericStats);

      expect(light5.level).toBe(0);
      expect({ ability: result.cantripSpellAbility, toHit: result.spellToHit, dc: result.spellSaveDc, mod: result.spellCastingMod })
        .toStrictEqual({ ability: 'Charisma', toHit: 6, dc: 14, mod: 3 }); // CHA+3+PB+3 / 8+3+3 / CHA
    });

    it('no per-spell override falls back to the class ability, negative Wisdom and all', () => {
      const result = resolve({ ...light5 }, clericStats);

      expect({ ability: result.cantripSpellAbility, toHit: result.spellToHit, dc: result.spellSaveDc, mod: result.spellCastingMod })
        .toStrictEqual({ ability: 'Wisdom', toHit: 2, dc: 10, mod: -1 });
      // unmatched-ability + casting-mod branch reachability owned by complex :220-278 — cited
    });
  });
});
