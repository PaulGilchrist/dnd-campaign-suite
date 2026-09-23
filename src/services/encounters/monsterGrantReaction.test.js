// MA-0882: Gnoll Pack Lord "Incite Rampage" — formerly a zero-affordance inert
// row (description + cosmetic <em> (5-6)</em> only, recharge economy never
// engaged). The monsterGrantReaction seam arms a chip whose click runs the live
// MA-0031 monsterRechargeGate FIRST (spent → refusal popup +
// `incite_rampage_refused` log, zero grant), resolves the GM-armed target
// (getTargetFromAttacker — ANOTHER creature, no-target/self-target refuse
// zero-spend), refuses an already-incited target zero-spend, then
// spendsMonsterRecharge FIRST (ability_use log), registers te `incite_rampage`
// ON THE TARGET with ONE rounds:1 addExpiration clock, and logs the grant
// ("can take a Reaction to make one melee attack" + §70 Rampage-prerequisite
// advisory). Mirrors the MA-0648/0655 sanctioned twins.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterGrantReactionRow,
  grantReactionRangeFt,
  resolveMonsterGrantReactionRow,
  buildGrantReactionGrantLog,
  buildGrantTargetRefusalLog,
  buildAlreadyIncitedRefusalLog,
} from './monsterGrantReaction.js';
import { TARGET_EFFECT_DEFINITIONS, getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
  KEY: 'pendingExpirations',
}));

const packLord = monstersData.find(m => m.index === 'gnoll-pack-lord');
const INCITE_ROW = packLord.actions[3];
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

describe('MA-0882 disk data shape', () => {
  it('gnoll-pack-lord actions[3] Incite Rampage authors monster_grant_reaction automation + recharge 5-6 kept', () => {
    expect(INCITE_ROW.name).toBe('Incite Rampage');
    expect(INCITE_ROW.automation).toEqual({ type: 'monster_grant_reaction', effect: 'incite_rampage', range_ft: 60 });
    expect(INCITE_ROW.recharge).toBe('5-6');
    expect(INCITE_ROW.range).toBe('60 feet');
    expect(isMonsterGrantReactionRow(INCITE_ROW)).toBe(true);
    expect(grantReactionRangeFt(INCITE_ROW)).toBe(60);
    expect(isMonsterGrantReactionRow(BONE_WHIP)).toBe(false);
    expect(isMonsterGrantReactionRow({ name: 'Multiattack', automation: { type: 'monster_grant_reaction' } })).toBe(false);
  });

  it('te `incite_rampage` is registered exactly once in targetEffectDefinitions', () => {
    const def = getEffectDefinition('incite_rampage');
    expect(def).toBeDefined();
    expect(def.label).toBe('Incited Rampage');
    expect(def.icon).toMatch(/^fa-/);
    expect(def.cls).toBe('effect-buff');
    expect(def.group).toBe('Spells');
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'incite_rampage')).toHaveLength(1);
    expect(def.description).toMatch(/Reaction to make one melee attack/i);
    expect(def.description).toMatch(/GM-enforced/i);
    expect(def.description).toMatch(/Rampage/i);
  });
});

describe('MA-0882 recharge gate + target gate refusals (zero grant, zero spend)', () => {
  it('not recharged: refusal popup + incite_rampage_refused log, zero te, zero clock, zero spend', async () => {
    const deps = makeDeps({ rechargeMap: { 'Incite Rampage': { recharged: false, threshold: 5 } } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterGrantReactionRow({
      action: INCITE_ROW,
      monsterName: 'Gnoll Pack Lord 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'not-recharged' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.store.logs).toHaveLength(1);
    expect(deps.store.logs[0].automationType).toBe('incite_rampage_refused');
    expect(deps.store.logs[0].description).toContain('not recharged');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Not Recharged'));
  });

  it('no armed target: no_target refusal, zero spend, zero te', async () => {
    const deps = makeDeps({ cs: { creatures: [{ name: 'Gnoll Pack Lord 1', targetName: null }, { name: 'Bandit 1' }] } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterGrantReactionRow({
      action: INCITE_ROW,
      monsterName: 'Gnoll Pack Lord 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'no-target' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const refusal = deps.store.logs.find(e => e.automationType === 'incite_rampage_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.automationDetail).toBe('no_target');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('No Target Armed'));
  });

  it('self-armed target: self_target refusal (RAW targets ANOTHER creature), zero spend', async () => {
    const deps = makeDeps({ cs: { creatures: [{ name: 'Gnoll Pack Lord 1', targetName: 'Gnoll Pack Lord 1' }] } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterGrantReactionRow({
      action: INCITE_ROW,
      monsterName: 'Gnoll Pack Lord 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'self-target' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.store.logs.some(e => e.automationType === 'incite_rampage_refused' && e.automationDetail === 'self_target')).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Cannot Incite Yourself'));
  });

  it('already-incited target: already-active refusal, zero recharge spent, zero te', async () => {
    const deps = makeDeps({ activeTe: { target: 'Bandit 1', effect: 'incite_rampage', source: 'Gnoll Pack Lord 1' } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterGrantReactionRow({
      action: INCITE_ROW,
      monsterName: 'Gnoll Pack Lord 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'already-active' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    const refusal = deps.store.logs.find(e => e.automationType === 'incite_rampage_refused');
    expect(refusal.automationDetail).toBe('already_incite_rampage');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Already Incited'));
  });

  it('non-grant-reaction rows never resolve', async () => {
    const deps = makeDeps();
    const result = await resolveMonsterGrantReactionRow({
      action: BONE_WHIP,
      monsterName: 'Gnoll Pack Lord 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'not-grant-reaction' });
    expect(deps.store.logs).toHaveLength(0);
  });
});

describe('MA-0882 grant flow (press)', () => {
  it('press: spends recharge FIRST (ability_use log), registers te incite_rampage on the armed target with ONE rounds:1 clock, grant log + popup', async () => {
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
    expect(deps.store.te).toEqual({
      campaign: 'test-campaign',
      target: 'Bandit 1',
      effect: 'incite_rampage',
      source: 'Gnoll Pack Lord 1',
      extra: expect.objectContaining({ rounds: 1, duration: 'rounds', actionName: 'Incite Rampage' }),
    });
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Gnoll Pack Lord 1',
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      rounds: 1,
      effects: [{ type: 'remove_target_effect', effectKey: 'incite_rampage', source: 'Gnoll Pack Lord 1', target: 'Bandit 1' }],
    });
    const spend = deps.store.logs.find(e => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Incite Rampage');
    const grant = deps.store.logs.find(e => e.automationType === 'incite_rampage_granted');
    expect(grant.description).toContain('can take a Reaction to make one melee attack (GM-enforced)');
    expect(grant.description).toContain('Rampage');
    expect(grant.description).toContain('§70');
    expect(deps.store.recharge).toEqual({ 'Incite Rampage': { recharged: false, threshold: 5 } });
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Bandit 1'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Recharge 5-6 spent'));
  });
});

describe('MA-0882 log builders', () => {
  it('grant log honest: reaction copy + §70 Rampage advisory', () => {
    const log = buildGrantReactionGrantLog({ monsterName: 'Gnoll Pack Lord', action: INCITE_ROW, targetName: 'Gnoll 2', rangeFt: 60 });
    expect(log.abilityName).toBe('Incite Rampage');
    expect(log.description).toContain('`incite_rampage`');
    expect(log.description).toContain('GM-enforced');
    expect(log.description).toContain('§42');
  });

  it('target refusal log carries <slug>_refused + reason token', () => {
    expect(buildGrantTargetRefusalLog({ monsterName: 'Gnoll Pack Lord', action: INCITE_ROW, reason: 'no_target' }).automationType).toBe('incite_rampage_refused');
    expect(buildAlreadyIncitedRefusalLog({ monsterName: 'Gnoll Pack Lord', action: INCITE_ROW, targetName: 'Bandit 1' }).automationDetail).toBe('already_incite_rampage');
  });
});
