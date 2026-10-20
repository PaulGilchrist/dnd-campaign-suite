// @maintained-by-ai
// MA-0882 service lane: monsterGrantReaction resolver — Gnoll Pack Lord "Incite
// Rampage" chip click (automation {type:"monster_grant_reaction", effect:
// "incite_rampage", range_ft:60}; formerly an inert row with cosmetic (5-6) text
// only). One click = recharge gate FIRST (live MA-0031 monsterRechargeGate — spent
// row refuses even with a target armed), then the GM-armed-target seam
// (getTargetFromAttacker — RAW ANOTHER creature ≤60 ft; unarmed/self-armed refuse),
// then the already-incited gate (re-grant on a live target refuses rather than
// stacks or double-spends — refuses-not-replaces pinned honest #949); all refusals
// zero-spend/zero-te/zero-clock (#1026 zero-applied-must-not-burn). Met →
// spendMonsterRecharge FIRST (ability_use log before grant log), stamp te
// `incite_rampage` on the TARGET with exactly ONE rounds:1 addExpiration clock
// (reaction window clears at the next-round seam — never wall-clock, #app MANDATORY),
// grant log + popup, campaign-keyed writes (#1019).
//
// Cite-owner table:
//   te key existence + definition bytes ..... targetEffectDefinitions.test.js #820 golden census ('incite_rampage' row) — #1012 retired this lane's registration test
//   recharge gate math + ability_use shape .. monsterRecharge.test.js (MA-0031; live-consumed here, shape not restated)
//   reaction-bucket economy ................. CANON turnState #1070; trigger predicate #1018; generic gate machinery gated-reaction.test.js #1091
//   chip render / press routing ............. MonsterAction.grant-reaction.test.jsx
//
// Old -> new: disk-shape test -> disk shape (row found by NAME, magic actions[3]
// index gone); te-registration test -> REMOVED (owner: golden census #1012);
// 4 refusal its -> one it.each refusal economy (#903); 2 log-builder unit its ->
// folded into the press + refusal route-throughs (#1080 producer bytes via real
// production route); press -> kept, strengthened (exact register/addExpiration
// positional bytes, 2-log census with spend-before-grant order, single
// campaign-keyed store write = zero-RNG proof #1072 — the d6 5-6 recovery rolls
// ride rollMonsterRecharges, never here).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterGrantReactionRow,
  grantReactionRangeFt,
  resolveMonsterGrantReactionRow,
} from './monsterGrantReaction.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
  KEY: 'pendingExpirations',
}));

const packLord = monstersData.find(m => m.index === 'gnoll-pack-lord');
const INCITE_ROW = packLord.actions.find(a => a.name === 'Incite Rampage');
const BONE_WHIP = packLord.actions.find(a => a.name === 'Bone Whip');

function makeDeps({ rechargeMap = {}, cs = null, activeTe = null } = {}) {
  const store = { recharge: { ...rechargeMap }, te: null, logs: [], expirations: [] };
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te = { campaign, target, effect, source, extra };
    }),
    getActiveTargetEffect: vi.fn(() => activeTe),
    addExpiration: vi.fn((opts) => { store.expirations.push(opts); }),
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
      if (propertyName === 'monsterRecharge') return store.recharge;
      return undefined;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
      if (propertyName === 'monsterRecharge') store.recharge = value;
      return Promise.resolve();
    }),
    addEntry: vi.fn((campaignName, entry) => { store.logs.push(entry); return Promise.resolve(); }),
    getCombatContext: vi.fn(async () => cs ?? {
      creatures: [
        { name: 'Gnoll Pack Lord 1', targetName: 'Bandit 1' },
        { name: 'Bandit 1' },
      ],
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0882 disk shape + row predicate', () => {
  it('Incite Rampage authors monster_grant_reaction with recharge 5-6 kept; predicate reads it, other rows never arm the affordance', () => {
    expect(INCITE_ROW.automation).toEqual({ type: 'monster_grant_reaction', effect: 'incite_rampage', range_ft: 60 });
    expect(INCITE_ROW.recharge).toBe('5-6');
    expect(INCITE_ROW.range).toBe('60 feet');
    expect(isMonsterGrantReactionRow(INCITE_ROW)).toBe(true);
    expect(grantReactionRangeFt(INCITE_ROW)).toBe(60);
    // no row, no automation, and type-without-effect rows are never grant affordances
    expect(isMonsterGrantReactionRow(BONE_WHIP)).toBe(false);
    expect(isMonsterGrantReactionRow({ name: 'Multiattack', automation: { type: 'monster_grant_reaction' } })).toBe(false);
    expect(isMonsterGrantReactionRow(undefined)).toBe(false);
  });
});

describe('MA-0882 refusal economy — zero spend, zero te, zero clock (#1026)', () => {
  it.each([
    { name: 'spent recharge', rechargeMap: { 'Incite Rampage': { recharged: false, threshold: 5 } }, reason: 'not-recharged', detail: undefined, token: 'not recharged', popup: 'Not Recharged' },
    { name: 'unarmed target', cs: { creatures: [{ name: 'Gnoll Pack Lord 1', targetName: null }, { name: 'Bandit 1' }] }, reason: 'no-target', detail: 'no_target', token: 'no_target', popup: 'No Target Armed' },
    { name: 'self-armed target (RAW another creature)', cs: { creatures: [{ name: 'Gnoll Pack Lord 1', targetName: 'Gnoll Pack Lord 1' }] }, reason: 'self-target', detail: 'self_target', token: 'self_target', popup: 'Cannot Incite Yourself' },
    { name: 'already-incited target (refuses, not stacks #949)', activeTe: { target: 'Bandit 1', effect: 'incite_rampage', source: 'Gnoll Pack Lord 1' }, reason: 'already-active', detail: 'already_incite_rampage', token: 'already_incite_rampage', popup: 'Already Incited' },
  ])('$name: refuses $reason with one refused-log and zero spend/te/clock', async ({ rechargeMap, cs, activeTe, reason, detail, token, popup }) => {
    const deps = makeDeps({ rechargeMap, cs, activeTe });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterGrantReactionRow({
      action: INCITE_ROW,
      monsterName: 'Gnoll Pack Lord 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      deps,
    });
    expect(result).toEqual({ resolved: false, reason });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled(); // never burn recharge on a refusal
    expect(deps.store.te).toBeNull();
    const refusals = deps.store.logs.filter(e => e.automationType === 'incite_rampage_refused');
    expect(refusals).toHaveLength(1);
    expect(refusals[0].automationDetail).toBe(detail);
    expect(refusals[0].description).toContain(token);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining(popup));
  });

  it('out-of-lane row resolves nothing, logs nothing, pops nothing', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterGrantReactionRow({
      action: BONE_WHIP,
      monsterName: 'Gnoll Pack Lord 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'not-grant-reaction' });
    expect(deps.store.logs).toHaveLength(0);
    expect(setPopupHtml).not.toHaveBeenCalled();
  });
});

describe('MA-0882 grant press', () => {
  it('press: spends FIRST, stamps te incite_rampage on the target with ONE rounds:1 clock, exact 2-log census + popup, campaign-keyed, zero dice', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterGrantReactionRow({
      action: INCITE_ROW,
      monsterName: 'Gnoll Pack Lord 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      deps,
    });
    expect(result).toEqual({ resolved: true, effectKey: 'incite_rampage', targetName: 'Bandit 1', rangeFt: 60 });
    // exact producer te bytes on the TARGET (#993/#1080)
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(1);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Bandit 1', 'incite_rampage', 'Gnoll Pack Lord 1', {
      duration: 'rounds',
      rounds: 1,
      actionName: 'Incite Rampage',
    });
    // ONE rounds:1 expiration clock — window clears at the next-round seam, never wall-clock
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Gnoll Pack Lord 1',
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      rounds: 1,
      effects: [{ type: 'remove_target_effect', effectKey: 'incite_rampage', source: 'Gnoll Pack Lord 1', target: 'Bandit 1' }],
    });
    // log census is exactly TWO: ability_use spend (shape owned by monsterRecharge.test.js)
    // BEFORE the grant log — spend-first double-spend guard, and no silent extra entries.
    expect(deps.store.logs).toHaveLength(2);
    expect(deps.store.logs[0].type).toBe('ability_use');
    expect(deps.store.logs[0].abilityName).toBe('Incite Rampage');
    const grant = deps.store.logs[1];
    expect(grant.automationType).toBe('incite_rampage_granted');
    expect(grant.description).toContain('`incite_rampage`');
    expect(grant.description).toContain('can take a Reaction to make one melee attack (GM-enforced)');
    expect(grant.description).toContain('Rampage Bonus Action prerequisite');
    expect(grant.description).toContain('§70');
    expect(grant.description).toContain('§42');
    expect(grant.description).toContain('Recharge 5-6 spent');
    // the ONLY store write is the spent stamp — zero dice rolled here (d6 5-6 recovery
    // rides rollMonsterRecharges, owned by the monsterRecharge lane #1072) — and it is
    // campaign-keyed (#1019).
    expect(deps.store.recharge).toEqual({ 'Incite Rampage': { recharged: false, threshold: 5 } });
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(deps.setRuntimeValue).toHaveBeenCalledWith('Gnoll Pack Lord 1', 'monsterRecharge', { 'Incite Rampage': { recharged: false, threshold: 5 } }, 'test-campaign');
    expect(deps.addEntry.mock.calls.every(([campaign]) => campaign === 'test-campaign')).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Bandit 1'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Recharge 5-6 spent'));
  });
});
