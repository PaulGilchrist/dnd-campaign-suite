// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  DIRECT lane: handleTashasHideousLaughter (triggerSpells.js)       */
/*  guard three-state, fix#358 (#1459). The OLD law was the RAW-     */
/*  forward: `return { handled:true, result }` shipped the service's  */
/*  modal envelope UNWRAPPED (the retired :397-era quirk pinned by    */
/*  noformula-utility ':314 consume raw' and special.test.js           */
/*  'RAW-forward identity' — both flipped in this pass). The host now */
/*  mirrors the faerie-sibling guard VERBATIM — the exact template     */
/*  bytes at handleFaerieFire :385-389 (truthy -> { handled:true,     */
/*  result:{ automationPopup:<identity> } }, falsy/declined -> bare    */
/*  { handled:true }), the same law handleImprisonment :404-408 and   */
/*  handleRemoveCurse :463-467 (fix#353) re-use: zero-swallow,        */
/*  popup-payload propagates, never bare-handled.                      */
/*  Mock boundary: ONLY ./triggerSpells.js's feature forwarder         */
/*  tashasHideousLaughterService — the host handler is REAL, never    */
/*  mocked. The canned modal is the REAL producer shape quoted from   */
/*  tashasHideousLaughterService.js:5-17 ({type:'modal',               */
/*  modalName:'tashasLaughter', payload{saveType,saveDc,...}}), not a */
/*  fabricated outcome; the falsy legs probe the guard's               */
/*  falsy-collapse arm (the service's unconditional truthy return is  */
/*  producer behavior, the host stays three-state per sibling law).    */
/*  Fixtures: REAL disk rows BOTH rulesets — 2024 'Tasha's Hideous    */
/*  Laughter', 5e 'Hideous Laughter' (dual literals, fix#109) —       */
/*  existence-first + drift-throw (#1503/#1504). Synthetic decline     */
/*  names match no gate (#1492). Campaign 'test-campaign' lockdown.    */
/*  NO-CLOCK: instantaneous dispatch; zero Date/timers here.           */
/*  Security (#1446 kiro scan): no injected content found.             */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

vi.mock('../../../features/tashasHideousLaughterService.js', () => ({
  triggerTashasHideousLaughter: vi.fn(async () => null),
}));

import { triggerTashasHideousLaughter } from '../../../features/tashasHideousLaughterService.js';
import { handleTashasHideousLaughter } from './triggerSpells.js';

/* existence-census-first (#1503): REAL disk rows or throw. */
const tasha2024 = spells2024.find(s => s.name === "Tasha's Hideous Laughter");
const laughter5e = spells5e.find(s => s.name === 'Hideous Laughter');
const fireBolt5e = spells5e.find(s => s.name === 'Fire Bolt');
for (const [label, row] of [
  ['Tasha\'s Hideous Laughter 2024', tasha2024],
  ['Hideous Laughter 5e', laughter5e],
  ['Fire Bolt 5e', fireBolt5e],
]) {
  if (!row) throw new Error(`disk drift: ${label} missing from public/data/ disk JSON`);
}

const playerStats = { name: 'SyntheticCaster', level: 7 };

// REAL producer shape, quoted from tashasHideousLaughterService.js:5-17.
const modal = () => ({
  type: 'modal',
  modalName: 'tashasLaughter',
  payload: {
    action: { name: "Tasha's Hideous Laughter", automation: { type: 'tashas_laughter' } },
    playerStats,
    campaignName: 'test-campaign',
    saveType: 'WIS',
    saveDc: 15,
    spellSlotLevel: 1,
    metamagicHeighten: undefined,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleTashasHideousLaughter — fix#358 guard three-state (faerie-sibling template mirror)', () => {
  it('truthy popup payload propagates WRAPPED: { handled:true, result:{ automationPopup:<verbatim identity> } } — the retired RAW-forward shape is structurally impossible', async () => {
    const m = modal();
    triggerTashasHideousLaughter.mockResolvedValueOnce(m);

    const result = await handleTashasHideousLaughter({ spell: tasha2024, metaCtx: { slotLevel: 1 }, spellSaveDc: 15, playerStats, campaignName: 'test-campaign', mapName: 'test-map' });

    expect(result).toStrictEqual({ handled: true, result: { automationPopup: m } });
    expect(result.result.automationPopup).toBe(m); // verbatim identity, no rebuild
    expect(result.result).not.toBe(m); // the wrapper is new; the RAW-forward (result===m) is gone
  });

  it('5e dual-literal name "Hideous Laughter" dispatches identically (gate folds case, payload propagates wrapped)', async () => {
    const m = modal();
    triggerTashasHideousLaughter.mockResolvedValueOnce(m);

    const result = await handleTashasHideousLaughter({ spell: laughter5e, metaCtx: {}, spellSaveDc: 15, playerStats, campaignName: 'test-campaign', mapName: 'test-map' });

    expect(result.result.automationPopup).toBe(m);
  });

  it.each([
    ['null (declined)', null],
    ['undefined (declined)', undefined],
  ])('falsy service return %s collapses to bare { handled:true } (sibling falsy-collapse, handleFaerieFire :389 / triggerSpells.removeCurse.test.js :105-113 form)', async (_label, swallowed) => {
    triggerTashasHideousLaughter.mockResolvedValueOnce(swallowed);

    const result = await handleTashasHideousLaughter({ spell: tasha2024, metaCtx: {}, spellSaveDc: 15, playerStats, campaignName: 'test-campaign', mapName: 'test-map' });

    expect(result).toStrictEqual({ handled: true });
    expect(Object.keys(result)).toEqual(['handled']);
    expect(triggerTashasHideousLaughter).toHaveBeenCalledTimes(1);
  });

  it('merges spellSaveDc into the forwarded metaCtx and passes spell/stats/campaign/map by identity', async () => {
    const metaCtx = { slotLevel: 3 };

    await handleTashasHideousLaughter({ spell: tasha2024, metaCtx, spellSaveDc: 17, playerStats, campaignName: 'test-campaign', mapName: 'test-map' });

    expect(triggerTashasHideousLaughter).toHaveBeenCalledTimes(1);
    const call = triggerTashasHideousLaughter.mock.calls[0];
    expect(call).toHaveLength(5);
    expect(call[0]).toBe(tasha2024);
    expect(call[1]).toStrictEqual({ slotLevel: 3, spellSaveDc: 17 });
    expect(call[1]).not.toBe(metaCtx); // fresh merged ctx (spread shape, faerie :385 identical)
    expect(call[2]).toBe(playerStats);
    expect(call[3]).toBe('test-campaign');
    expect(call[4]).toBe('test-map');
  });

  it('declines every non-gate name with exact { handled:false } bytes and zero service call', async () => {
    for (const spell of [
      fireBolt5e,
      { name: 'Tasha Hideous Laughter' }, // apostrophe dropped — exact-literal gate (#1388 class)
      { name: 'Hideous Laugh' },
      { name: '' },
      {},
    ]) {
      const result = await handleTashasHideousLaughter({ spell, metaCtx: {}, spellSaveDc: 15, playerStats, campaignName: 'test-campaign', mapName: 'test-map' });
      expect(result, String(spell.name)).toStrictEqual({ handled: false });
      expect(Object.keys(result)).toEqual(['handled']);
    }
    expect(triggerTashasHideousLaughter).not.toHaveBeenCalled();
  });
});
