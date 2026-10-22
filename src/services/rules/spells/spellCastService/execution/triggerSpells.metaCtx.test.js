// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  DIRECT lane: what REAL handleGenericAutomation (triggerSpells.js  */
/*  :453-:469) DOES with the metaCtx that #1505 proved ARRIVES at     */
/*  :710. Owns the :460 fold semantics — the ONLY metaCtx touch here; */
/*  zero per-key derefs, wholesale shallow fold.                       */
/*                                                                     */
/*  metaCtx consumption census (triggerSpells.js, this dispatch span): */
/*   :453  envelope destructure metaCtx — undefined-legal              */
/*   :460  metaCtx: { ...metaCtx } — fresh outer object; inner values  */
/*         (selectedTargets array, targetName, slotLevel,              */
/*         metamagicHeighten) shared BY REFERENCE; missing → {}        */
/*         (:0-swallow — spread of undefined, golden, no TypeError)    */
/*   never  triggerSpells reads no metaCtx key individually here;    */
/*         slotLevel consumed hub-side (index.js:440/:444, SP-075),   */
/*         metamagicHeighten stamped hub-side (:680 CLA-219) —         */
/*         passThrough, not consumed. spellSaveDc is NOT folded onto   */
/*         metaCtx on this lane (that spread form lives in the         */
/*         name-dispatch handlers :78-:451; DC arithmetic is            */
/*         computeSpellStats home, cited #1506).                       */
/*                                                                     */
/*  SPLIT (cited, never re-grown): envelope identity + :680 fold at   */
/*  the hub = index.generic-metaCtx.test.js (#1505, triggerSpells     */
/*  mocked there). Gate census 44/78 + :462 arity-5 tuple + caller-   */
/*  side purity + automation/name identity = earlyReturns-generic      */
/*  :274/:317/:320/:385-:389/:439-:440 (#1470/#1461). Gate declines   */
/*  (effects.fail, SERVICE_HANDLED 'Hex' lowercase trail #1457,        */
/*  no-automation.type Compulsion) + result shaping (automationPopup   */
/*  wrap / handled-null) = triggerSpells.test.js (base, 7 tests).     */
/*  SERVICE_HANDLED dead-twin reachability: earlyReturns :275 census. */
/*                                                                     */
/*  Unique here (call triggerSpells DIRECTLY): inner selectedTargets   */
/*  BY REFERENCE through :460 (hub lanes pin values via toEqual only);*/
/*  metaCtx OMITTED at :460 — unreachable via hub, since :680 folds    */
/*  undefined into {} before :710 — and explicit-{} fresh-fold;        */
/*  action.spell identity (:308 census pins automation+name, not       */
/*  spell); unguarded :462 executeHandler deref crash-twin (#1360/    */
/*  #1491 console-untuple form).                                       */
/*  Purity verdict: triggerSpells never mutates metaCtx mid-flight —  */
/*  grep-proven zero `metaCtx.` derefs in the file; :460 is fresh     */
/*  rebuild per dispatch (#1479/#1505 threaded-not-rebuilt verdict    */
/*  extended: caller args go to :462 verbatim, cited earlyReturns      */
/*  :385-:389 toBe pins — not re-grown here).                         */
/*  NO-CLOCK: dispatch is instantaneous; triggerSpells.js stamps no    */
/*  expiry rounds on this span; expiry delegates (checkCompelledDuel-  */
/*  AttackExpiry :292/:305/:318) are name-dispatch handlers owned      */
/*  elsewhere — rounds:600 standing 🔴 cited to seam owners (#1497).  */
/*  invocationCallOrder unnecessary: exactly-one dispatch per test.     */
/*                                                                     */
/*  Fixtures: REAL disk rows BOTH rulesets, existence-first +          */
/*  drift-throw (#1503/#1504). Note the retired fabrication: the old   */
/*  fixture claimed 5e Prismatic Spray automation damage '10d6' — disk  */
/*  5e row has NO automation at all; the REAL prismatic_spray row is   */
/*  2024 with damage '12d6'. executeHandler is the injected envelope   */
/*  param (caller seam, #1505), not a module mock — canned returns     */
/*  are boundary bytes, not hollowed REAL modules; prismaticSpray-     */
/*  Handler.js and barkskinHandler consume downstream, own tests.      */
/*  Synthetic non-impersonating caster (#1492); campaign lockdown       */
/*  'test-campaign'. Security (#1446 kiro scan): none found.           */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

import { handleGenericAutomation } from './triggerSpells.js';

const diskRow2024 = spells2024.find(s => s.name === 'Prismatic Spray' && s.automation?.type);
const diskRow5e = spells5e.find(s => s.name === 'Barkskin' && s.automation?.type);
if (!diskRow2024) throw new Error('disk drift: 2024 Prismatic Spray automation row missing from public/data/2024/spells.json');
if (!diskRow5e) throw new Error('disk drift: 5e Barkskin automation row missing from public/data/spells.json');

function makePlayerStats() {
  return { name: 'SyntheticCaster', level: 7, proficiency: 6 };
}

describe('handleGenericAutomation — :460 metaCtx fold internals (direct lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('folds stamped metaCtx fresh at :460 — exact real-key set verbatim, inner selectedTargets BY REFERENCE, caller untouched, envelope arity-1 (#1505 consumer side)', async () => {
    expect(handleGenericAutomation.length).toBe(1);

    const executeHandler = vi.fn(async () => null);
    const spell = diskRow2024; // REAL row: automation { type: 'prismatic_spray', saveType: 'DEX', damage: '12d6', saveDc: 'spell_save_dc' }
    const metaCtx = { selectedTargets: ['Zombie 1', 'Zombie 2'], slotLevel: 7, metamagicHeighten: true, targetName: 'Zombie 1' };

    await handleGenericAutomation({ spell, executeHandler, playerStats: makePlayerStats(), campaignName: 'test-campaign', mapName: 'test-map', characters: [], metaCtx });

    expect(executeHandler).toHaveBeenCalledTimes(1);
    const action = executeHandler.mock.calls[0][0];
    // Wholesale shallow fold — exact key set, no fabricated keys (no spellSaveDc stamped here).
    expect(action.metaCtx).toEqual({ selectedTargets: ['Zombie 1', 'Zombie 2'], slotLevel: 7, metamagicHeighten: true, targetName: 'Zombie 1' });
    expect(action.metaCtx).not.toBe(metaCtx);
    // Inner survives the fold by reference — the pin no hub lane makes (they use toEqual).
    expect(action.metaCtx.selectedTargets).toBe(metaCtx.selectedTargets);
    // Envelope carries spell BY REFERENCE (:458); automation identity cited earlyReturns :308.
    expect(action.spell).toBe(spell);
    // Caller purity: triggerSpells never mutates metaCtx mid-flight.
    expect(metaCtx).toEqual({ selectedTargets: ['Zombie 1', 'Zombie 2'], slotLevel: 7, metamagicHeighten: true, targetName: 'Zombie 1' });
  });

  it('collapses a missing or empty metaCtx to a fresh {} at :460 — the :0-swallow, hub-unreachable directly (:680 folds before :710), no TypeError, no fabricated keys', async () => {
    const executeHandler = vi.fn(async () => null);

    // A) metaCtx OMITTED entirely — { ...undefined } → {} (golden spread, must not throw).
    await handleGenericAutomation({ spell: diskRow2024, executeHandler, playerStats: makePlayerStats(), campaignName: 'test-campaign', mapName: 'test-map', characters: [] });
    const actionA = executeHandler.mock.calls[0][0];
    expect(actionA.metaCtx).toEqual({});
    expect(actionA.metaCtx).toBeDefined();

    // B) explicit empty object — still folded FRESH, not passed through (:460 rebuild).
    const emptyCtx = {};
    await handleGenericAutomation({ spell: diskRow5e, executeHandler, playerStats: makePlayerStats(), campaignName: 'test-campaign', mapName: 'test-map', characters: [], metaCtx: emptyCtx });
    const actionB = executeHandler.mock.calls[1][0];
    expect(actionB.metaCtx).toEqual({});
    expect(actionB.metaCtx).not.toBe(emptyCtx);

    expect(executeHandler).toHaveBeenCalledTimes(2);
  });

  it('rejects with TypeError when executeHandler is absent — unguarded :462 deref, console untouched (crash-twin #1360/#1491, no try/catch swallow)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(handleGenericAutomation({ spell: diskRow2024, playerStats: makePlayerStats(), campaignName: 'test-campaign', mapName: 'test-map', characters: [], metaCtx: {} }))
      .rejects.toThrow(/executeHandler is not a function/);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
