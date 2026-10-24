// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  DIRECT lane: handleRemoveCurse (triggerSpells.js) popup-payload   */
/*  propagation, fix#353 (#1466/#1499). The OLD law was the :0-      */
/*  swallow: `await triggerRemoveCurse(...); return { handled:true }` */
/*  discarded the automation_info popup removeCurseService RETURNS     */
/*  (removeCurseService.js:18 forwards removeCurseHandler.js:51-61   */
/*  verbatim — the target-selection envelope; null ONLY on the catch  */
/*  leg :21). That discard pin is RETIRED here; the host now mirrors */
/*  the in-file sibling three-state shape VERBATIM:                    */
/*   - handleFaerieFire :385-389   truthy -> { handled:true,          */
/*     result:{ automationPopup:<identity> } }                         */
/*   - handleImprisonment :404-408 falsy -> bare { handled:true }    */
/*   - handleGenericAutomation :470-474 (triggerSpells.test.js :177  */
/*     owns the generic-lane twin of this shape — quoted, not         */
/*     re-grown).                                                     */
/*  DOWNSTREAM NOTE (CLOSED by fix#358, was carried out of the #353    */
/*  edit whitelist): the hub consumer index.js remove-curse leg now      */
/*  FORWARDS value: { handled:true, value: removeCurseResult.result }    */
/*  — the second half of the DOUBLE-DISCARD is executed; the chain       */
/*  surfaces { automationPopup } end-to-end (pinned: noformula-utility  */
/*  ':351 consume forward' + earlyReturns-noDamage-healing tail row     */
/*  lane:'passThrough').                                                   */
/*                                                                     */
/*  Mock boundary: ONLY ./triggerSpells.js's feature forwarder        */
/*  removeCurseService — the host handleRemoveCurse is REAL, never   */
/*  mocked. Canned popup bytes are the REAL handler shape quoted from */
/*  removeCurseHandler.js:51-61 (target-selection envelope), not a   */
/*  fabricated outcome. Trigger forwarder is arg-recorder (#1498):   */
/*  the exact arity-5 tuple (spell, metaCtx, playerStats, campaign,  */
/*  map) forwards verbatim.                                           */
/*  Fixtures: REAL disk 'Remove Curse' row BOTH rulesets,            */
/*  existence-first + drift-throw (#1503/#1504); synthetic decline   */
/*  names match no gate (#1492). Campaign 'test-campaign' lockdown.  */
/*  NO-CLOCK: instantaneous dispatch; zero Date/timers here.         */
/*  Security (#1446 kiro scan): no injected content found.           */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

vi.mock('../../../features/removeCurseService.js', () => ({
  triggerRemoveCurse: vi.fn(async () => null),
  confirmRemoveCurse: vi.fn(async () => null),
}));

import { triggerRemoveCurse } from '../../../features/removeCurseService.js';
import { handleRemoveCurse } from './triggerSpells.js';

/* existence-census-first (#1503): REAL disk rows or throw. */
const removeCurse5e = spells5e.find(s => s.name === 'Remove Curse');
const removeCurse2024 = spells2024.find(s => s.name === 'Remove Curse');
const fireBolt5e = spells5e.find(s => s.name === 'Fire Bolt');
for (const [label, row] of [
  ['Remove Curse 5e', removeCurse5e],
  ['Remove Curse 2024', removeCurse2024],
  ['Fire Bolt 5e', fireBolt5e],
]) {
  if (!row) throw new Error(`disk drift: ${label} missing from public/data/ disk JSON`);
}

const playerStats = { name: 'SyntheticCaster', level: 7 };

// REAL producer shape, quoted from removeCurseHandler.js:51-61 (target-select
// popup returned UNCONDITIONALLY on the success leg; :11-18 on no-context).
const popup = () => ({
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Remove Curse',
    description: 'Select a target to remove curses from.',
    automation: { type: 'remove_curse', range: 'Touch' },
    targets: [{ name: 'Goblin A', hasCurse: true, cursedBuffs: [], attunement: [], isSelf: false }],
    range: 'Touch',
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleRemoveCurse — fix#353 popup-payload propagation (sibling three-state)', () => {
  it('truthy popup payload propagates: { handled:true, result:{ automationPopup:<verbatim identity> } } — the retired discard pin is structurally impossible', async () => {
    const p = popup();
    triggerRemoveCurse.mockResolvedValueOnce(p);

    const result = await handleRemoveCurse(removeCurse5e, { slotLevel: 3 }, playerStats, 'test-campaign', 'test-map');

    expect(result).toStrictEqual({ handled: true, result: { automationPopup: p } });
    expect(result.result.automationPopup).toBe(p); // verbatim identity, no rebuild
  });

  it('2024 disk row dispatches identically (name gate folds case, payload propagates)', async () => {
    const p = popup();
    triggerRemoveCurse.mockResolvedValueOnce(p);

    const result = await handleRemoveCurse({ ...removeCurse2024, name: 'remove curse' }, undefined, playerStats, 'test-campaign', 'test-map');

    expect(result.result.automationPopup).toBe(p);
  });

  it.each([
    ['null (executeHandler throw leg, removeCurseService.js:21)', null],
    ['undefined', undefined],
  ])('falsy service return %s collapses to bare { handled:true } (sibling falsy-collapse, triggerSpells.test.js :177 form)', async (_label, swallowed) => {
    triggerRemoveCurse.mockResolvedValueOnce(swallowed);

    const result = await handleRemoveCurse(removeCurse5e, {}, playerStats, 'test-campaign', 'test-map');

    expect(result).toStrictEqual({ handled: true });
    expect(Object.keys(result)).toEqual(['handled']);
    expect(triggerRemoveCurse).toHaveBeenCalledTimes(1);
  });

  it('forwards the exact arity-5 tuple verbatim (spell, metaCtx, playerStats, campaignName, mapName)', async () => {
    const metaCtx = { slotLevel: 4, targetName: 'Goblin A' };

    await handleRemoveCurse(removeCurse5e, metaCtx, playerStats, 'test-campaign', 'test-map');

    expect(triggerRemoveCurse).toHaveBeenCalledTimes(1);
    const call = triggerRemoveCurse.mock.calls[0];
    expect(call).toHaveLength(5);
    expect(call[0]).toBe(removeCurse5e);
    expect(call[1]).toBe(metaCtx);
    expect(call[2]).toBe(playerStats);
    expect(call[3]).toBe('test-campaign');
    expect(call[4]).toBe('test-map');
  });

  it('declines every non-curse name with exact { handled:false } bytes and zero service call', async () => {
    for (const spell of [
      fireBolt5e,
      { name: 'Remove Curse ' }, // trailing space — exact-match quirk (#1388 class)
      { name: '' },
      {},
    ]) {
      const result = await handleRemoveCurse(spell, {}, playerStats, 'test-campaign', 'test-map');
      expect(result, String(spell.name)).toStrictEqual({ handled: false });
      expect(Object.keys(result)).toEqual(['handled']);
    }
    expect(triggerRemoveCurse).not.toHaveBeenCalled();
  });
});
