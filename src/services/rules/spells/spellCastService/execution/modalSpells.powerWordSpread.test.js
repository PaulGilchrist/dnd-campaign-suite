// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  CLA-392 SPREAD-GATE LANE (#1481) — modalSpells.js:9-:39 REAL     */
/*                                                                     */
/*  Boundary (VERBATIM cites, honored): #1486 table — 'powerWordSpread */
/*  bytes -> modalSpells.powerWordSpread.test.js (#1481/#CLA-392)'.  */
/*  #1481: 'modalSpells.powerWordSpread owns the spread gate with     */
/*  injected fake; spellCastService.powerWordHeal.test.js owns hub    */
/*  edge cases incl. multiTarget-equals-first dedup' and #1454 owns   */
/*  hub traversal incl CLA-392 shared snapshot (:259 short-circuit =   */
/*  its getCombatContext-times-1 pin). THIS face = the spread gate    */
/*  itself with INJECTED fake helpers; helpers-powerWordKill.test.js  */
/*  :17 re-confirms: 'modalSpells.powerWordSpread owns the spread gate */
/*  (:28-:34) with an INJECTED fake helper'. earlyReturns-modal #1471 */
/*  MOCKS both producers (:202/:203) and consumes the '{ handled:      */
/*  true } with NO result key' envelope (its :406-408 note: 'bytes    */
/*  pinned REAL by powerWordSpread.test.js') — the exact-key-set      */
/*  toEqual rows below are those bytes; do not re-grow them there.   */
/*                                                                     */
/*  DEDUPE CITATION CONFLICT (resolved, reported): #1481 says the hub */
/*  owns multiTarget-equals-first dedup, but useSpellMetamagicGates.  */
/*  powerWordKillSlots.test.js:8-9 delegates it HERE ('spread is      */
/*  covered where it lives... including the multiTarget===first-target */
/*  dedupe') and the hub only exercises same-name casts whose second  */
/*  apply is MASKED by the heal helper's delta-0 silent-skip — the    */
/*  :17/:33 `!==` branch is not observably pinned through the hub.    */
/*  Row E keeps a direct times(1) pin on this gate.                   */
/*                                                                     */
/*  SPREAD SEMANTICS (disk, #1365): both disks name Power Word Kill  */
/*  (5e spells.json :7586 / 2024 :10208) and Power Word Heal exists   */
/*  only on the 2024 disk (:10162, absent from 5e, #1450); Power Word */
/*  Stun (both) and 2024 Power Word Fortify are the NON-spread        */
/*  siblings — this gate serves Heal/Kill names ONLY (exact lowercase */
/*  full-string compares :10/:26, name bytes pulled from REAL disk    */
/*  rows below). There is NO radius/spread gathering in this span:    */
/*  targets come from the injected getTargetInfo (first) plus the      */
/*  chooser's metaCtx.multiTarget (second) — the source comment        */
/*  adjudicates the 10-ft gate gridless-lenient, no position seam.    */
/*  HP THRESHOLDS (5e '100 hit points or fewer... dies' :7585; 2024  */
/*  Heal 'regains all its Hit Points'; PWK 2024 12d12 fallback) are  */
/*  NEVER READ by this gate — spread is name-based-only pass-through; */
/*  tiers live on helpers-powerWordKill #1478 / helpers-powerWordHeal */
/*  / hub lanes. No fabricated tier table here.                       */
/*                                                                     */
/*  CLA-392 SNAPSHOT: ONE getCombatContext(campaignName) per cast at  */
/*  :13/:29 shared across every per-target apply (:15/:18, :31/:34).  */
/*  Pinned times(1) PLUS toBe identity (mock returns a STABLE         */
/*  hoisted object; a per-target-refetch mutant hands apply two fresh */
/*  clones and both pins fail). Guard `(firstTargetName || metaCtx?   */
/*  .multiTarget)` at :13/:29 => zero-target casts fetch NOTHING      */
/*  (row D times(0)); snapshot precedes every apply (invocationCall-   */
/*  Order census, #1480 canon).                                        */
/*                                                                     */
/*  DEAD-TARGET DETERMINATION (pinned honestly): the gate does NOT     */
/*  skip corpses — row A's second target 'Thug 2' carries currentHp 0 */
/*  in the shared summary and STILL receives apply (no HP filter       */
/*  exists at :15/:18/:31/:34). Corpse/HP semantics are downstream     */
/*  (helpers lane #1478 tiers, heal delta-0 silent-skip).              */
/*                                                                     */
/*  QUIRK SCAN: golden unguarded-deref (#1360/#1486 :42 fresh form): */
/*  heal :10 dereferences spell.name WITHOUT the `spell.name &&`      */
/*  guard the kill gate carries at :26 — missing name rejects          */
/*  TypeError on heal, resolves {handled:false} on kill; the          */
/*  asymmetry is pinned verbatim (mending :10 loudly trips row Q).    */
/*  silent-undefined (?:1480 family): target?.name ( :12/:28) — an    */
/*  undefined getTargetInfo() RESULT must survive and still spread to  */
/*  multiTarget (row C; falsy triple collapses — undefined/null/      */
/*  {name:''} are observably identical past the `|| null` fold, #1352).*/
/*  :0-swallow census: NO `|| 0` arms exist in this span (READ).      */
/*  'null + N': no string concat in span. case trails (#1457): gate   */
/*  lowercases (:10/:26) — row F uppercases the disk name. No          */
/*  action.name literal exists on this face (no caller-casing fork).  */
/*  Dead twins/hijack (#1485): beforeEach clearAllMocks PRESERVES the */
/*  hoisted stable-summary impl (neutral, deterministic every arm);    */
/*  shapechangeStub times(0) census in every row (M11). NO-CLOCK:     */
/*  spread is instantaneous; no timers, no persistence flags.          */
/*                                                                     */
/*  MOCK ROSTER vs REAL import list (#1440): modalSpells.js imports   */
/*  exactly {handle} from shapechangeHandler (:1) and {getCombatContext*/
/*  } from damageUtils (:2) — both mocked direct-path (#1475/76, no   */
/*  barrel); nothing else mocked; the unit under test stays REAL.      */
/*                                                                     */
/*  KILL MATRIX: M1 CLA-392 OR-collapse (first skipped when           */
/*  multiTarget set) -> row A times(2)+Nth tuples · M2 dedupe `!==`  */
/*  removed -> row E times(1) · M3 per-target refetch -> times(1)    */
/*  rows A/B/C/E · M4 snapshot cloned per call -> toBe(SHARED_SUMMARY)*/
/*  identity · M5 gate literal flip/case-sensitivity -> miss rows +   */
/*  row F · M6 kill guard :26 dropped OR heal guard :10 added -> row  */
/*  Q asymmetry · M7 fetch-guard :13/:29 always-fetch -> row D        */
/*  times(0) · M8 multiTarget-only branch dropped -> row C ·           */
/*  M9 apply order swapped -> A Nth(1)/Nth(2) names · M10 campaign/   */
/*  playerStats arg drift -> exact tuples + toBe(playerStats) ·       */
/*  M11 reroute via shapechangeHandler -> stub times(0) census ·      */
/*  M12 envelope drift (extra result key) -> toEqual exact key-set · */
/*  M13 double getTargetInfo -> times(1)+toHaveBeenCalledWith().        */
/*  Campaign locked 'test-campaign'. Fixtures: Thug hit_points 32 =   */
/*  monsters.json REAL bytes; 'Thug 1' instance name = test-campaign  */
/*  maps/test-map.json; currentHp:0 second = DOCUMENTED SYNTHETIC     */
/*  corpse matrix row (opaque payload to this gate, identity matters); */
/*  caster name HeroesFeastBard = REAL test-campaign character.       */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

/* Mock roster == complete REAL import list of modalSpells.js (#1440):
   :2 damageUtils.getCombatContext feeds EVERY per-target write through
   ONE shared fetch (CLA-392); :1 shapechangeHandler.handle belongs to
   another arm and is hijack-censused at times(0). */
const { SHARED_SUMMARY } = vi.hoisted(() => ({
  SHARED_SUMMARY: {
    creatures: [
      { name: 'Thug 1', currentHp: 32 }, /* Thug hit_points 32 = monsters.json REAL; instance name = test-campaign maps/test-map.json */
      { name: 'Thug 2', currentHp: 0 },  /* documented synthetic corpse row: gate must STILL apply (no HP filter at :15/:18/:31/:34) */
    ],
  },
}));

vi.mock('../../../../automation/handlers/spells/shapechangeHandler.js', () => ({
  handle: vi.fn(),
}));
vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => SHARED_SUMMARY),
}));

import { handlePowerWordHeal, handlePowerWordKill } from './modalSpells.js';
import { handle as shapechangeStub } from '../../../../automation/handlers/spells/shapechangeHandler.js';
import { getCombatContext } from '../../../combat/damageUtils.js';

const CAMPAIGN = 'test-campaign';

/* Gate name bytes from REAL disk rows (preflight catch): Kill 5e+2024,
   Heal 2024-only (#1450), Stun both, Fortify 2024 — non-spread siblings. */
const disk = (rows, name, where) => {
  const row = rows.find(s => s.name === name);
  if (!row) throw new Error(`${name} disk row missing (${where}) — fixtures must be REAL rows`);
  return row.name;
};
const pwkName = disk(spells5e, 'Power Word Kill', '5e spells.json');
const pwhName = disk(spells2024, 'Power Word Heal', '2024 spells.json');
const stunName = disk(spells5e, 'Power Word Stun', '5e spells.json');
const fortifyName = disk(spells2024, 'Power Word Fortify', '2024 spells.json');
disk(spells2024, 'Power Word Kill', '2024 spells.json');

function makePlayerStats() {
  return { name: 'HeroesFeastBard', level: 20, class: { name: 'Bard' } };
}

const HANDLERS = [
  { label: 'handlePowerWordKill', fn: handlePowerWordKill, applyKey: 'applyPowerWordKillToTarget', spellName: pwkName, span: ':25-:39' },
  { label: 'handlePowerWordHeal', fn: handlePowerWordHeal, applyKey: 'applyPowerWordHealToTarget', spellName: pwhName, span: ':9-:23' },
];

describe.each(HANDLERS)('$label spread gate (modalSpells$span, injected fake)', ({ label, fn, applyKey, spellName }) => {
  beforeEach(() => {
    /* clearAllMocks PRESERVES the hoisted stable-summary impl — every
       shared arm re-runs on the same neutral default (#1485 order-hijack
       guard): no arm below depends on residue from a previous arm. */
    vi.clearAllMocks();
  });

  it.each([
    { label: 'A CLA-392 spread — FIRST target plus distinct multiTarget, first first', target: { name: 'Thug 1' }, metaCtx: { multiTarget: 'Thug 2' }, expected: ['Thug 1', 'Thug 2'], fetches: 1 },
    { label: 'B skip path — empty metaCtx still applies the resolved first target', target: { name: 'Thug 1' }, metaCtx: {}, expected: ['Thug 1'], fetches: 1 },
    { label: 'C multiTarget-only — undefined getTargetInfo result survives ?. and spreads to second', target: undefined, metaCtx: { multiTarget: 'Thug 2' }, expected: ['Thug 2'], fetches: 1 },
    { label: 'D no targets (undefined result, metaCtx undefined) — snapshot never fetched, applies nothing, still handled', target: undefined, metaCtx: undefined, expected: [], fetches: 0 },
    { label: 'E dedupe — multiTarget equal to first target applies exactly once', target: { name: 'Thug 1' }, metaCtx: { multiTarget: 'Thug 1' }, expected: ['Thug 1'], fetches: 1 },
    { label: 'F case trail — gate lowercases, uppercase disk name still handled', target: { name: 'Thug 1' }, metaCtx: {}, expected: ['Thug 1'], fetches: 1, upper: true },
  ])('$label', async ({ target, metaCtx, expected, fetches, upper }) => {
    const playerStats = makePlayerStats();
    const getTargetInfo = vi.fn(async () => target);
    const apply = vi.fn(() => Promise.resolve());

    const result = await fn({
      spell: { name: upper ? spellName.toUpperCase() : spellName },
      metaCtx,
      getTargetInfo,
      playerStats,
      campaignName: CAMPAIGN,
      [applyKey]: apply,
    });

    /* Exact key-set envelope: { handled: true } with NO result key —
       earlyReturns-modal #1471 :406-408 consumes these bytes. */
    expect(result).toEqual({ handled: true });
    expect(getTargetInfo).toHaveBeenCalledTimes(1);
    expect(getTargetInfo).toHaveBeenCalledWith();
    expect(getCombatContext).toHaveBeenCalledTimes(fetches);
    if (fetches > 0) expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    expect(apply).toHaveBeenCalledTimes(expected.length);
    expected.forEach((name, i) => {
      expect(apply).toHaveBeenNthCalledWith(i + 1, name, playerStats, CAMPAIGN, SHARED_SUMMARY);
      /* CLA-392 identity pins: ONE shared snapshot object (not clones)
         and the caller's playerStats forwarded by reference. */
      expect(apply.mock.calls[i][3]).toBe(SHARED_SUMMARY);
      expect(apply.mock.calls[i][1]).toBe(playerStats);
      expect(getCombatContext.mock.invocationCallOrder[0]).toBeLessThan(apply.mock.invocationCallOrder[i]);
    });
    expect(shapechangeStub).toHaveBeenCalledTimes(0);
  });

  it(`${label} declines every other Power Word name with zero side effects (gate serves ${spellName} only)`, async () => {
    const getTargetInfo = vi.fn(async () => ({ name: 'Thug 1' }));
    const apply = vi.fn(() => Promise.resolve());
    const missNames = [pwkName, pwhName, stunName, fortifyName].filter(n => n !== spellName);
    for (const name of missNames) {
      const result = await fn({
        spell: { name },
        metaCtx: { multiTarget: 'Thug 2' },
        getTargetInfo,
        playerStats: makePlayerStats(),
        campaignName: CAMPAIGN,
        [applyKey]: apply,
      });
      expect(result).toEqual({ handled: false });
    }
    expect(getTargetInfo).toHaveBeenCalledTimes(0);
    expect(getCombatContext).toHaveBeenCalledTimes(0);
    expect(apply).toHaveBeenCalledTimes(0);
    expect(shapechangeStub).toHaveBeenCalledTimes(0);
  });
});

it('Q guard asymmetry quirk golden (#1360): missing spell.name rejects TypeError on the UNGUARDED heal gate (:10) and resolves { handled: false } on the guarded kill gate (:26), console untouched, nothing applied', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const getTargetInfo = vi.fn(async () => ({ name: 'Thug 1' }));
  const applyHeal = vi.fn(() => Promise.resolve());
  const applyKill = vi.fn(() => Promise.resolve());
  const shared = { metaCtx: {}, getTargetInfo, playerStats: makePlayerStats(), campaignName: CAMPAIGN };

  await expect(handlePowerWordHeal({ ...shared, spell: {}, applyPowerWordHealToTarget: applyHeal })).rejects.toThrow(TypeError);
  await expect(handlePowerWordKill({ ...shared, spell: {}, applyPowerWordKillToTarget: applyKill })).resolves.toEqual({ handled: false });

  expect(getTargetInfo).toHaveBeenCalledTimes(0);
  expect(getCombatContext).toHaveBeenCalledTimes(0);
  expect(applyHeal).toHaveBeenCalledTimes(0);
  expect(applyKill).toHaveBeenCalledTimes(0);
  expect(errorSpy).toHaveBeenCalledTimes(0);
  expect(warnSpy).toHaveBeenCalledTimes(0);
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});
