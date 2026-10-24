// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  SUT + collaborator mocks (census vs savePath.js REAL import graph) */
/*  savePath.js imports: diceRoller (NEVER rolled on the AoE lane —   */
/*  mocked as bare vi.fn so an accidental cast-time roll is caught by  */
/*  not.toHaveBeenCalled, not absorbed by a stubbed total),             */
/*  postCastRiderService.triggerSoulstitchSpells + ./damageCalculation */
/*  (REAL leaf — its computeEmpoweredEvocation pulls                    */
/*  getEmpoweredEvocationFeatures/IntModifier from postCastRiderService */
/*  and setRuntimeValue from useRuntimeState, so those mock exports are */
/*  graph-required, not decoration),                                     */
/*  ../../../combat/rangeValidation (UNMOCKED this pass: pure leaf —    */
/*  its only import rangeCheck was already loaded transitively via     */
/*  spellOverlayService → mapsService; the old mock re-implemented     */
/*  rangeToFeet's regex — duplicate-logic over-mock removed),          */
/*  damageUtils.getCombatContext (stubbed), ../../maps/spellOverlayService */
/*  (REAL leaf — overlay/fetch lanes OWNED HERE per #1489 deferral;    */
/*  savePath-aoe-condition.test.js:12 delegates overlay targeting to    */
/*  this file). fetch is stubbed global per test — the service's exact  */
/*  URL bytes and catch/!ok containment are asserted, never mocked out. */
/*  DEAD mocks removed (#1484/#1485 dead-module-mock instances #4/#5): */
/*  logService, viciousMockeryService — verified line-by-line neither   */
/*  is in this span's import graph.                                     */
/*  Owners cited (not re-grown): innate-sorcery +1 & dc_success map &   */
/*  metamagicHeighten & '0'/'' hasDamage routing → savePath-aoe-meta;   */
/*  overchannel suffix/flags → savePath-aoe-overchannel; CLA-120 INT   */
/*  fold → savePath-aoe-empowered-evocation; condition-only popup →     */
/*  savePath-aoe-condition; roll lane/soulstitch throw-catch →           */
/*  savePath-single-target; radiantSoulChaMod positive gate →            */
/*  aoeSpells/spellCastService.execute + damageCalculation.test.js:273; */
/*  zone repeats/adjacency → zone quad (zoneRepeatTurnEndService etc);  */
/*  magic missile → helpers-magicMissile (#1488, not here).             */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../postCastRiderService.js', () => ({
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve()),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}));

const { handleSavePath } = await import('./savePath.js');
const { rollExpression, rollExpressionMaximized } = await import('../../../../dice/diceRoller.js');
const { getCombatContext } = await import('../../../combat/damageUtils.js');
const { triggerSoulstitchSpells } = await import('../../postCastRiderService.js');

/* ------------------------------------------------------------------ */
/*  DISK ROWS — verbatim keys the span reads, copied from             */
/*  public/data/spells.json (5e) and public/data/2024/spells.json     */
/*  (2024). Provenance census (this pass, node -e over both files):   */
/*  - dc_type is UPPERCASE on disk BOTH rulesets: 'DEX'.               */
/*  - Fireball ladders are identical bytes: 3:'8d6' … 9:'14d6'.        */
/*  - KEY-SHAPE asymmetry: 5e carries area_of_effect {type:'sphere',   */
/*    size:20 NUMERIC}; 2024 carries {shape:'sphere',                   */
/*    size:'20-foot-radius' STRING}. savePath aoeShape (savePath.js:30 */
/*    shape||type) normalizes both to 'sphere'; the size byte never     */
/*    rides the payload (exact key-set asserted).                       */
/*  - AUTOMATION SERIALIZATION (#1489 asymmetry check): census of      */
/*    public/data/spells.json → 331 rows / 0 string automations /      */
/*    52 object / 279 absent; 2024 → 393 / 0 / 87 / 306. No JSON-      */
/*    STRING automation exists in either ruleset's disk spells.json.   */
/*    Fireball has NO automation key in either file, so the damage     */
/*    lane routes on the truthy-damage gate (savePath.js:167/187) and  */
/*    is immune to automation serialization — the #1489 string-vs-     */
/*    object lane-collapse hazard cannot bite here; it only threatens    */
/*    the condition lane, which needs automation.effects.fail.          */
/*  - damage_at_character_level on disk: 5e only, and only on           */
/*    SINGLE-target rows (Acid Splash … Vicious Mockery, all with       */
/*    area_of_effect absent) — the AoE character-level rung at          */
/*    savePath.js:165 is a code-supported, disk-virgin ladder rung,    */
/*    pinned below as such (not a fabricated disk shape).               */
/*  - Name-gate census: this suite calls handleSavePath DIRECTLY —     */
/*    index.js/modalSpells.js upstream gates (fireball is not gated     */
/*    there anyway) never intercept this span.                          */
/* ------------------------------------------------------------------ */

const DISK_FIREBALL_5E = {
  name: 'Fireball',
  level: 3,
  school: 'Evocation',
  range: '150 feet',
  duration: 'Instantaneous',
  concentration: false,
  damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6', 4: '9d6', 5: '10d6', 6: '11d6', 7: '12d6', 8: '13d6', 9: '14d6' } },
  dc: { dc_type: 'DEX', dc_success: 'half' },
  area_of_effect: { type: 'sphere', size: 20 },
};

const DISK_FIREBALL_2024 = {
  name: 'Fireball',
  level: 3,
  school: 'Evocation',
  range: '150 feet',
  duration: 'Instantaneous',
  concentration: false,
  damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6', 4: '9d6', 5: '10d6', 6: '11d6', 7: '12d6', 8: '13d6', 9: '14d6' } },
  dc: { dc_type: 'DEX', dc_success: 'half' },
  area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
};

const DISK_BURNING_HANDS_2024 = {
  name: 'Burning Hands',
  level: 1,
  school: 'Evocation',
  range: 'Self',
  duration: 'Instantaneous',
  concentration: false,
  damage: { damage_type: 'Fire', damage_at_slot_level: { 1: '3d6', 2: '4d6', 3: '5d6', 4: '6d6', 5: '7d6', 6: '8d6', 7: '9d6', 8: '10d6', 9: '11d6' } },
  dc: { dc_type: 'DEX', dc_success: 'half' },
  area_of_effect: { shape: 'cone', size: '15-foot Cone' },
};

/* The exact saveAttackAoe payload key-set (savePath.js:126-147).
   Note: NO duration key on the damage popup — duration TEXT rides only
   the condition-only popup (savePath.js:105). NO clock anywhere. */
const SAVE_ATTACK_AOE_KEYS = [
  'action', 'activeOverlay', 'campaignName', 'damage', 'damageType', 'dcSuccess',
  'empoweredEvocationIntMod', 'metamagicCareful', 'metamagicHeighten',
  'overchannelActive', 'overchannelSpellLevel', 'overchannelUseCount', 'playerStats',
  'radiantSoulChaMod', 'range', 'saveDc', 'saveType', 'shape',
];

function makePlayerStats() {
  // Span reads only playerStats.name (attacker lookup :179, radiant-soul
  // deref :70) and automation.passives (:68). Nothing else, so nothing else.
  return { name: 'TestWizard', automation: { passives: [] } };
}

function makeSavePathArgs(overrides = {}) {
  return {
    spell: DISK_FIREBALL_5E,
    fullSpell: DISK_FIREBALL_5E,
    metaCtx: {},
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    mapName: null,
    getRuntimeValue: vi.fn(() => undefined),
    innateSorceryActive: false,
    effectiveDamageType: 'Fire',
    spellSaveDc: 17,
    overchannelActive: false,
    overchannelUseCount: 0,
    hasInvisible: false,
    ...overrides,
  };
}

/* fetch sentinel: ok:false default so an UNEXPECTED fetch (from a
   non-overlay test) returns [] harmlessly — every non-overlay test then
   asserts fetchSpy was not called at all, so the sentinel can never
   mask a regression. Direct-path-mock-before-first-action (#1475/76). */
const fetchSpy = vi.fn();

/* ------------------------------------------------------------------ */
/*  KILL MATRIX (M-table)                                              */
/*  M1  shape normalize shape||type (savePath.js:30)      → T1,T2,T5  */
/*  M2  slot-level exact hit (:52)                        → T4-r1      */
/*  M3  highestBelow fallback (:55)                       → T4-r2      */
/*  M4  firstKey fallback (:60)                           → T4-r3      */
/*  M5  spell.damage source rung (:165)                 → T4-r4        */
/*  M6  damage_at_character_level rung (:165)             → T4-r5      */
/*  M7  '0' truthy-string ladder survivor + hasDamage (:167) → T4-r6  */
/*  M8  payloadDamage '0' default (:169)                   → T4-r6      */
/*  M9  slotLevel = metaCtx?.slotLevel || spell.level (:183) → T1     */
/*  M10 saveType chain fullSpell→spell→'DEX' (:80/:138)    → T1,T6    */
/*  M11 dcSuccess ?? chain — null+undefined both fall the rung (:83-86) */
/*  M12 unguarded spell.dc deref console-untouched (:80)   → T7        */
/*  M13 rangeToFeet chain fullSpell.range||spell.range (:182) → T1,T5  */
/*  M14 attacker name→targetName lookup (:179)              → T3b-r4    */
/*  M15 overlayTargetId prefix gate (:42-43)               → T3b-r2/3   */
/*  M16 overlays.find(o=>o.id) + miss→null (:45)           → T3a,T3b-r1 */
/*  M17 fetch URL bytes incl. /spell-overlay?campaign= (spellOverlay    */
/*      Service.js:20)                                     → T3a            */
/*  M18 fetch reject containment: catch→[]+console.error   → T3c        */
/*  M19 !response.ok early-return [] (console untouched)   → T3c        */
/*  M20 metamagicCareful || false + reference pass (:142)  → T1,T8     */
/*  M21 soulstitch selection consumed single-target only (:18-37,214)   */
/*      → T9 (selection must NOT leak into AoE payload)    → T9        */
/*  M22 dice NOT rolled at cast time — modal rolls per target           */
/*      → T1 (rollExpression/Maximized never called)       → T1        */
/*  M23 hardcoded action.automation:{} on damage popup (:127)            */
/*      → T1 (disk row carries duration/automation keys)   → T1        */
/* ------------------------------------------------------------------ */

describe('savePath.js — damageful AoE save path → saveAttackAoe payload + overlay/fetch seam', () => {
  let consoleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getCombatContext.mockReturnValue(null);
    triggerSoulstitchSpells.mockImplementation(() => Promise.resolve());
    fetchSpy.mockImplementation(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ overlays: [] }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /*  T1 — keystone: REAL 5e disk Fireball → complete payload,       */
  /*  exact key-set, identity refs, zero dice rolled at cast time.  */
  /*  Kills M1,M9,M10,M13,M20,M22,M23 + envelope.                    */
  /* ---------------------------------------------------------------- */
  it('ships the full saveAttackAoe payload for the REAL disk 5e Fireball: uppercase DEX byte, half-on-save dcSuccess, raw dice (never rolled here), exact key-set, identity refs', async () => {
    expect(handleSavePath).toHaveLength(1); // arity pin (#1488 form)
    const args = makeSavePathArgs();
    const playerStats = args.playerStats;

    const result = await handleSavePath(args);

    expect(result.automationPopup.type).toBe('modal');
    expect(result.automationPopup.modalName).toBe('saveAttackAoe');
    const payload = result.automationPopup.payload;

    // Exact key-set — no fabricated keys, no duration clock text
    // (duration rides only the condition popup), no soulstitch leak.
    expect(Object.keys(payload).sort()).toEqual(SAVE_ATTACK_AOE_KEYS);

    expect(payload).toStrictEqual({
      action: { name: 'Fireball', automation: {}, spell: DISK_FIREBALL_5E },
      playerStats,
      campaignName: 'test-campaign',
      shape: 'sphere', // 5e disk byte is {type:'sphere'} — normalized by :30
      range: 150, // REAL rangeToFeet('150 feet'), unmocked leaf
      damage: '8d6', // slotLevel fallback to spell.level=3 (:183)
      damageType: 'Fire',
      radiantSoulChaMod: 0, // no radiant_soul passive on disk caster
      empoweredEvocationIntMod: 0, // gate empty via mocked rider service
      saveType: 'DEX', // disk UPPERCASE passthrough (case-trail #1457)
      saveDc: 17,
      dcSuccess: 'half', // the half-damage-on-save key — exists on THIS popup, none on the condition popup (#1489)
      activeOverlay: null, // combat context is null → no overlay, no fetch
      metamagicCareful: false, // || false default byte (:142)
      metamagicHeighten: false, // fix#358 (#1464) flip: strict boolean — !! folds false||undefined to false (was undefined pre-fix, :143)
      overchannelActive: false,
      overchannelUseCount: 0,
      overchannelSpellLevel: 3,
    });

    // Identity — the modal edits the real objects, not copies.
    expect(payload.action.spell).toBe(DISK_FIREBALL_5E);
    expect(payload.playerStats).toBe(playerStats);
    // M23: damage popup bakes automation:{} (savePath.js:127) — unlike
    // the condition popup which passes fullSpell.automation through (:97).

    // M22: dice canon — savePath ships the RAW expression; the modal
    // rolls per target. Nothing rolls at cast resolution here.
    expect(rollExpression).not.toHaveBeenCalled();
    expect(rollExpressionMaximized).not.toHaveBeenCalled();

    // Collaborator tuples: getCombatContext keyed by campaign; soulstitch
    // fires first with the exact 5-arg tuple (#1480 ordered-tap form).
    expect(getCombatContext.mock.calls).toEqual([['test-campaign']]);
    expect(triggerSoulstitchSpells.mock.calls).toEqual([[DISK_FIREBALL_5E, {}, playerStats, 'test-campaign', null]]);
    expect(triggerSoulstitchSpells.mock.calls[0][0]).toBe(DISK_FIREBALL_5E);
    expect(fetchSpy).not.toHaveBeenCalled(); // no overlay target → no network
  });

  /* ---------------------------------------------------------------- */
  /*  T2 — both-rulesets disk census: 2024 row's {shape,size-         */
  /*  string} keys normalize to the same payload bytes as 5e's        */
  /*  {type,size-number}; size never leaks into the payload.         */
  /* ---------------------------------------------------------------- */
  it('routes the REAL disk 2024 Fireball (shape-key + string-size asymmetry) to the identical payload key-set with normalized sphere bytes', async () => {
    const args = makeSavePathArgs({ fullSpell: DISK_FIREBALL_2024 });

    const result = await handleSavePath(args);
    const payload = result.automationPopup.payload;

    expect(result.automationPopup.modalName).toBe('saveAttackAoe');
    expect(Object.keys(payload).sort()).toEqual(SAVE_ATTACK_AOE_KEYS);
    expect(payload.shape).toBe('sphere');
    expect(payload.damage).toBe('8d6');
    expect(payload.saveType).toBe('DEX'); // uppercase on 2024 disk too
    expect(payload.dcSuccess).toBe('half');
    expect(payload.range).toBe(150);
    expect(payload.action.spell).toBe(DISK_FIREBALL_2024);
    // disk-virgin automation: absent on disk → truthy-damage gate routes
    // this lane regardless of automation serialization (#1489 asymmetry).
    expect('duration' in payload).toBe(false);
  });

  /* ---------------------------------------------------------------- */
  /*  T3 — overlay/fetch lanes (#1489 deferral: "overlay + fetch      */
  /*  faces = savePath-aoe-damage.test.js"; delegated by              */
  /*  savePath-aoe-condition.test.js:12). REAL spellOverlayService,  */
  /*  spellOverlayService; the fetch endpoint is stubbed at the seam.  */
  /* ---------------------------------------------------------------- */

  it('overlay-hit: fetches /spell-overlay?campaign=<name> once, in order after getCombatContext, and ships the matched overlay by reference', async () => {
    const args = makeSavePathArgs({
      fullSpell: { ...DISK_FIREBALL_5E, area_of_effect: { type: 'cone', size: 60 } },
    });
    const matched = { id: 'abc123', name: 'Test Overlay' };
    getCombatContext.mockReturnValue({
      creatures: [{ name: 'TestWizard', targetName: 'overlay-abc123' }],
    });
    fetchSpy.mockImplementation(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ overlays: [{ id: 'zzz999', name: 'Other' }, matched] }),
    }));

    const result = await handleSavePath(args);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/spell-overlay?campaign=test-campaign');
    expect(result.automationPopup.payload.activeOverlay).toBe(matched); // find-by-id, by reference
    // Combat-context stamp must resolve BEFORE the network tap (:178-180).
    expect(getCombatContext.mock.invocationCallOrder.at(-1)).toBeLessThan(fetchSpy.mock.invocationCallOrder.at(-1));
  });

  it('overlay-miss ladder: unmatched id, plain target, null context, and attacker-not-in-creatures all ship activeOverlay:null (fetch fired only past the prefix gate)', async () => {
    const rows = [
      { label: 'id-not-in-fetch', ctx: { creatures: [{ name: 'TestWizard', targetName: 'overlay-missing' }] }, expectFetch: 1, expected: null },
      { label: 'plain-target', ctx: { creatures: [{ name: 'TestWizard', targetName: 'Goblin' }] }, expectFetch: 0, expected: null },
      { label: 'null-combat-context', ctx: null, expectFetch: 0, expected: null },
      { label: 'attacker-not-in-creatures', ctx: { creatures: [{ name: 'SomeoneElse', targetName: 'overlay-abc123' }] }, expectFetch: 0, expected: null },
    ];

    for (const row of rows) {
      getCombatContext.mockReturnValue(row.ctx);
      fetchSpy.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ overlays: [{ id: 'abc123', name: 'Test Overlay' }] }),
      }));

      const result = await handleSavePath(makeSavePathArgs());

      expect(result.automationPopup.modalName, row.label).toBe('saveAttackAoe');
      expect(result.automationPopup.payload.activeOverlay, row.label).toEqual(row.expected);
      expect(fetchSpy.mock.calls.length, row.label).toBe(row.expectFetch);
      fetchSpy.mockClear();
    }
  });

  it('fetch-failure containment: rejection yields activeOverlay:null WITH the service console.error byte; ok:false yields null WITHOUT logging (distinct early-return)', async () => {
    getCombatContext.mockReturnValue({
      creatures: [{ name: 'TestWizard', targetName: 'overlay-abc123' }],
    });

    // Row 1: network rejection → spellOverlayService catch → [] + console.error once.
    fetchSpy.mockImplementation(() => Promise.reject(new Error('Network down')));
    const rejected = await handleSavePath(makeSavePathArgs());
    expect(rejected.automationPopup.payload.activeOverlay).toBeNull();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toBe('[spellOverlayService] Failed to fetch spell overlays:');
    expect(consoleSpy.mock.calls[0][1]).toBeInstanceOf(Error);

    // Row 2: !response.ok → early-return [] BEFORE any catch → silence.
    consoleSpy.mockClear();
    fetchSpy.mockImplementation(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ overlays: [] }) }));
    const notOk = await handleSavePath(makeSavePathArgs());
    expect(notOk.automationPopup.payload.activeOverlay).toBeNull();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /*  T4 — damage-expression ladder (resolveAoeDamageExpression +    */
  /*  source chain), payload.damage exact bytes only. dc_success     */
  /*  /hasDamage ROUTING is owned by savePath-aoe-meta (cited).      */
  /* ---------------------------------------------------------------- */

  it('resolves payload.damage through the full ladder — exact slot, highest-below, first-key, spell-source, disk-virgin character-level rung, and the "0" truthy survivor', async () => {
    const rows = [
      { label: 'exact slot 4 = disk upcast byte', fullSpell: DISK_FIREBALL_5E, metaCtx: { slotLevel: 4 }, expected: '9d6' },
      { label: 'highestBelow: gap at slot 4 picks 8d6', fullSpell: { ...DISK_FIREBALL_5E, damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6', 5: '12d6' } } }, metaCtx: { slotLevel: 4 }, expected: '8d6' },
      { label: 'firstKey when every level is above slot 3', fullSpell: { ...DISK_FIREBALL_5E, damage: { damage_type: 'Fire', damage_at_slot_level: { 5: '12d6' } } }, metaCtx: { slotLevel: 3 }, expected: '12d6' },
      { label: 'spell.damage source rung when fullSpell carries no ladder', fullSpell: { ...DISK_FIREBALL_5E, damage: { damage_type: 'Fire' } }, spell: { ...DISK_FIREBALL_5E, damage: { damage_at_slot_level: { 3: '6d6' } } }, expected: '6d6' },
      { label: 'character-level rung (code ladder, disk-virgin for AoE)', fullSpell: { ...DISK_FIREBALL_5E, damage: { damage_type: 'Fire', damage_at_character_level: { 1: '3d6', 5: '8d6' } } }, metaCtx: { slotLevel: 5 }, expected: '8d6' },
    ];

    for (const row of rows) {
      const result = await handleSavePath(makeSavePathArgs({
        fullSpell: row.fullSpell,
        spell: row.spell || DISK_FIREBALL_5E,
        metaCtx: row.metaCtx || {},
      }));
      expect(result.automationPopup.payload.damage, row.label).toBe(row.expected);
    }

    // M7/M8 — ':0-swallow census': the string '0' is TRUTHY at the
    // ladder (:52 returns it), hasDamage flips false (:167), and with
    // no fail-effects automation it still ships saveAttackAoe carrying
    // the literal '0' byte (modal renders zero). RAW half of 0 is 0 —
    // integer math, no float rounding introduced on this span.
    const zero = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_FIREBALL_5E, damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '0' } } },
    }));
    expect(zero.automationPopup.modalName).toBe('saveAttackAoe');
    expect(zero.automationPopup.payload.damage).toBe('0');
  });

  /* ---------------------------------------------------------------- */
  /*  T5 — REAL rangeToFeet integration (leaf unmocked this pass).   */
  /* ---------------------------------------------------------------- */

  it('resolves payload.range through the REAL rangeToFeet: fullSpell→spell fallback, null bytes, and the disk Burning Hands "Self" row collapsing to null', async () => {
    const fallback = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_FIREBALL_5E, range: null },
      spell: { ...DISK_FIREBALL_5E }, // range '150 feet' on the spell rung
    }));
    expect(fallback.automationPopup.payload.range).toBe(150);

    const bothNull = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_FIREBALL_5E, range: null },
      spell: { ...DISK_FIREBALL_5E, range: null },
    }));
    expect(bothNull.automationPopup.payload.range).toBe(null);

    // REAL disk row: 2024 Burning Hands is 'Self' — rangeToFeet returns
    // null (origin-cast); shape/cone bytes still ship, slot-1 dice '3d6'.
    const selfCast = await handleSavePath(makeSavePathArgs({
      fullSpell: DISK_BURNING_HANDS_2024,
      spell: DISK_BURNING_HANDS_2024, // level 1 — the slotLevel fallback (:183)
    }));
    expect(selfCast.automationPopup.modalName).toBe('saveAttackAoe');
    expect(selfCast.automationPopup.payload.shape).toBe('cone');
    expect(selfCast.automationPopup.payload.range).toBe(null);
    expect(selfCast.automationPopup.payload.damage).toBe('3d6');
  });

  /* ---------------------------------------------------------------- */
  /*  T6 — saveType / dcSuccess byte chains on THIS popup (the       */
  /*  meta lane owns dc_success VALUE mapping 0/0.5 — cited; these   */
  /*  are the fullSpell→spell→default RUNGS plus null semantics).    */
  /* ---------------------------------------------------------------- */

  it('threads saveType and dcSuccess through the fullSpell→spell→default chain: lowercase passthrough, uppercase DEX default byte, and ?? collapsing explicit-null with undefined onto the spell rung', async () => {
    const spellRung = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_FIREBALL_5E, dc: null },
      spell: { ...DISK_FIREBALL_5E, dc: { dc_type: 'con', dc_success: 'half' } },
    }));
    expect(spellRung.automationPopup.payload.saveType).toBe('con'); // no case normalization (:80) — case trail #1457
    expect(spellRung.automationPopup.payload.dcSuccess).toBe('half');

    const defaults = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_FIREBALL_5E, dc: null },
      spell: { ...DISK_FIREBALL_5E, dc: {} },
    }));
    expect(defaults.automationPopup.payload.saveType).toBe('DEX'); // hardcoded uppercase fallback byte (#1476 disk-case gold)
    expect(defaults.automationPopup.payload.dcSuccess).toBe(undefined); // implicit-undefined, key still present
    expect('dcSuccess' in defaults.automationPopup.payload).toBe(true);

    const explicitNull = await handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_FIREBALL_5E, dc: { dc_type: 'DEX', dc_success: null } },
      spell: { ...DISK_FIREBALL_5E, dc: { dc_type: 'DEX', dc_success: 'half' } },
    }));
    // QUIRK PIN: `??` (savePath.js:84) treats explicit null as MISSING —
    // a null dc_success on the cast row cannot veto the spell rung; it
    // collapses with implicit-undefined and falls through to 'half'.
    // #1488 implicit-vs-explicit family, disk-byte truth.
    expect(explicitNull.automationPopup.payload.dcSuccess).toBe('half');
  });

  /* ---------------------------------------------------------------- */
  /*  T7 — golden unguarded deref (#1360 family; savePath.js:80/:84  */
  /*  spell.dc twin — caller-gated-dead-twin form of #1489 :80).     */
  /* ---------------------------------------------------------------- */

  it('rejects with a raw TypeError when spell.dc is absent — console untouched, no fallback rescue', async () => {
    await expect(handleSavePath(makeSavePathArgs({
      fullSpell: { ...DISK_FIREBALL_5E, dc: null },
      spell: {},
    }))).rejects.toBeInstanceOf(TypeError);
    expect(consoleSpy).not.toHaveBeenCalled(); // crash is loud at the caller, silent in the span
  });

  /* ---------------------------------------------------------------- */
  /*  T8 — metamagicCareful reference passthrough (default false is   */
  /*  pinned in T1; heighten/innate bytes owned by meta lane, cited). */
  /* ---------------------------------------------------------------- */

  it('passes a metamagicCareful list through BY REFERENCE, untouched', async () => {
    const careful = ['Goblin', 'TestWizard'];
    const result = await handleSavePath(makeSavePathArgs({ metaCtx: { metamagicCareful: careful } }));
    expect(result.automationPopup.payload.metamagicCareful).toBe(careful);
  });

  /* ---------------------------------------------------------------- */
  /*  T9 — CLA-321 soulstitch selection is consumed by the             */
  /*  single-target lane ONLY (savePath-single-target owns the roll   */
  /*  context; the array is a dead twin on the AoE lane — pinned      */
  /*  here so a refactor that leaks it into the payload dies).        */
  /* ---------------------------------------------------------------- */

  it('discards a non-empty soulstitch selection on the AoE lane — no soulstitch bytes enter the saveAttackAoe payload', async () => {
    triggerSoulstitchSpells.mockResolvedValue(['Choice A', 'Choice B']);

    const result = await handleSavePath(makeSavePathArgs());

    expect(triggerSoulstitchSpells).toHaveBeenCalledTimes(1);
    expect(result.automationPopup.modalName).toBe('saveAttackAoe');
    expect(Object.keys(result.automationPopup.payload).sort()).toEqual(SAVE_ATTACK_AOE_KEYS);
  });
});
