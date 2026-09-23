// MA-0891: Goblin Boss "Redirect Attack" (reactions[0]) — formerly a
// zero-affordance prose row (name+trigger+description only). The
// monsterRedirectAttack seam arms a gated chip (GATED_MONSTER_REACTIONS
// `redirect_attack`, automation{type:"monster_redirect_attack",
// effect:"redirect_attack", ally_size, range_ft} authored on disk) whose press
// runs: round-latch/uses gate FIRST (MA-0881 MONSTER_REACTION_USES shape —
// same-round re-press refuses zero-spend), pending-attack identity gate
// (parryIdentityRefusal MA-0341 lineage — press over the attacker's pending
// HIT popup; no pending → `redirect_attack_refused` no_pending_attack),
// armed-ally gate on the GM-armed cs.targetName seam (MA-0882
// getTargetFromAttacker — no_target/self_target/size refuse zero-spend), then
// latch+spend, campaign.pendingRedirect + lastAttack retarget stamps, te
// `redirect_attack` ON THE ALLY rounds:1 + ONE addExpiration clock, spend +
// grant logs (§42/§70 gridless advisory). The grant carries NO popupHtml so
// the pending Done popup survives the press (§217/§235 parry lineage); the
// RESOLVE consumer (consumePendingRedirectOnResolve, handlePlainDamage)
// rewrites the victim to the ALLY on Done.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterRedirectAttackRow,
  redirectAllySizeAllowed,
  redirectAllySizes,
  redirectRangeFt,
  redirectIdentityRefusal,
  redirectGate,
  redirectAllyGate,
  resolveMonsterRedirectAttackRow,
  consumePendingRedirectOnResolve,
  buildRedirectGrantedLog,
  buildRedirectRefusalLog,
} from './monsterRedirectAttack.js';
import { TARGET_EFFECT_DEFINITIONS, getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
import { getGatedMonsterReaction } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
  KEY: 'pendingExpirations',
}));

const goblinBoss = monstersData.find(m => m.index === 'goblin-boss');
const REDIRECT_ROW = goblinBoss.reactions[0];
const banditCaptain = monstersData.find(m => m.index === 'bandit-captain');
const packLord = monstersData.find(m => m.index === 'gnoll-pack-lord');

function pendingHit({ attackerName = 'Bandit 1', targetName = 'Goblin Boss 1', ...rest } = {}) {
  return {
    rollType: 'attack',
    attackerName,
    targetName,
    attackName: 'Scimitar',
    d20: 14,
    bonus: 3,
    total: 17,
    hit: true,
    weaponType: 'melee',
    ...rest,
  };
}

function makeCs({ allyName = 'Bandit 2', allySize = 'Medium or Small', bossArmed = true } = {}) {
  return {
    round: 1,
    creatures: [
      { name: 'Goblin Boss 1', size: 'Small', targetName: bossArmed ? allyName : null },
      { name: 'Bandit 1', size: 'Medium or Small' },
      { name: allyName, size: allySize },
    ],
  };
}

function makeDeps({ activeTe = null } = {}) {
  const store = { reactionUses: {}, latches: {}, campaign: {}, te: null, logs: [], expirations: [] };
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te = { campaign, target, effect, source, extra };
    }),
    getActiveTargetEffect: vi.fn(() => activeTe),
    addExpiration: vi.fn((opts) => { store.expirations.push(opts); }),
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
      if (propertyName === 'monsterReactionUses') return store.reactionUses;
      if (propertyName === 'lastAttack') return store.campaign.lastAttack;
      if (propertyName === 'pendingRedirect') return store.campaign.pendingRedirect;
      return undefined;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
      if (propertyName === 'monsterReactionUses') store.reactionUses = value;
      if (propertyName === '_redirect_attack_usedRound') store.latches.redirect = value;
      if (characterKey === 'campaign') store.campaign[propertyName] = value;
      return Promise.resolve();
    }),
    addEntry: vi.fn((campaignName, entry) => { store.logs.push(entry); return Promise.resolve(); }),
  };
}

function press({ lastAttack = pendingHit(), cs = makeCs(), storedUses = {}, usedRound = 0, deps = makeDeps({ cs }) } = {}) {
  return resolveMonsterRedirectAttackRow({
    action: REDIRECT_ROW,
    monsterName: 'Goblin Boss 1',
    campaignName: 'test-campaign',
    lastAttack,
    cs,
    currentRound: 1,
    storedUses,
    usedRound,
    latchKey: '_redirect_attack_usedRound',
    deps,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0891 disk data shape', () => {
  it('goblin-boss reactions[0] authors monster_redirect_attack automation, name/trigger/description byte-kept', () => {
    expect(REDIRECT_ROW.name).toBe('Redirect Attack');
    expect(REDIRECT_ROW.trigger).toBe('A creature the goblin can see makes an attack roll against it.');
    expect(REDIRECT_ROW.description).toBe('The goblin chooses a Small or Medium ally within 5 feet of itself. The goblin and that ally swap places, and the ally becomes the target of the attack instead.');
    expect(REDIRECT_ROW.automation).toEqual({
      type: 'monster_redirect_attack',
      trigger: 'attacked_by_seen',
      effect: 'redirect_attack',
      ally_size: ['Small', 'Medium'],
      range_ft: 5,
    });
    expect(isMonsterRedirectAttackRow(REDIRECT_ROW)).toBe(true);
    expect(redirectRangeFt(REDIRECT_ROW)).toBe(5);
    expect(redirectAllySizes(REDIRECT_ROW)).toEqual(['small', 'medium']);
  });

  it('only the redirect row discriminates — parry/grant/attack rows never', () => {
    expect(isMonsterRedirectAttackRow(banditCaptain.reactions.find(r => r.name === 'Parry'))).toBe(false);
    expect(isMonsterRedirectAttackRow(packLord.actions.find(a => a.name === 'Incite Rampage'))).toBe(false);
    expect(isMonsterRedirectAttackRow(goblinBoss.actions.find(a => a.name === 'Scimitar'))).toBe(false);
    expect(isMonsterRedirectAttackRow({ automation: { type: 'monster_redirect_attack' } })).toBe(false);
  });

  it('chip arms off automation.effect via getGatedMonsterReaction (existing gated-chip classes only)', () => {
    const def = getGatedMonsterReaction(REDIRECT_ROW);
    expect(def).toEqual({ effect: 'redirect_attack', trigger: 'attacked_by_seen', label: 'Redirect Attack', icon: 'fa-right-left' });
  });

  it('te `redirect_attack` registered exactly once, grouped like MA-0882 incite_rampage', () => {
    const def = getEffectDefinition('redirect_attack');
    expect(def).toBeDefined();
    expect(def.label).toBe('Redirected Attack');
    expect(def.icon).toMatch(/^fa-/);
    expect(def.cls).toBe('effect-buff');
    expect(def.group).toBe('Spells');
    expect(TARGET_EFFECT_DEFINITIONS.filter(d => d.effect === 'redirect_attack')).toHaveLength(1);
    expect(def.description).toMatch(/becomes the target of the triggering attack/i);
    expect(def.description).toMatch(/GM-enforced/i);
    expect(def.description).toMatch(/§42/);
  });

  it('legacy rows byte-unchanged — bandit-captain Parry + gnoll incite automation kept', () => {
    const parry = banditCaptain.reactions.find(r => r.name === 'Parry');
    expect(parry.automation).toEqual({ type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus: 2 });
    const incite = packLord.actions.find(a => a.name === 'Incite Rampage');
    expect(incite.automation).toEqual({ type: 'monster_grant_reaction', effect: 'incite_rampage', range_ft: 60 });
  });
});

describe('MA-0891 size gate', () => {
  it('Medium or Small stat-block tokens fold; Tiny/Large refuse; unknown lenient', () => {
    const allowed = ['small', 'medium'];
    expect(redirectAllySizeAllowed('Medium or Small', allowed)).toBe(true);
    expect(redirectAllySizeAllowed('Small', allowed)).toBe(true);
    expect(redirectAllySizeAllowed('Tiny', allowed)).toBe(false);
    expect(redirectAllySizeAllowed('Large', allowed)).toBe(false);
    expect(redirectAllySizeAllowed('', allowed)).toBe(true);
    expect(redirectAllySizeAllowed('Huge or Gargantuan', allowed)).toBe(false);
  });
});

describe('MA-0891 identity + gates', () => {
  it('no pending attack refuses with no_pending_attack token', () => {
    expect(redirectIdentityRefusal(null, 'Goblin Boss 1')).toBe('no_pending_attack');
    expect(redirectIdentityRefusal(pendingHit({ targetName: 'Bandit 1' }), 'Goblin Boss 1')).toBe('no_pending_attack');
    expect(redirectIdentityRefusal(pendingHit({ rollType: 'save' }), 'Goblin Boss 1')).toBe('no_pending_attack');
  });

  it('miss/resolved/reacted/self-attacker refuse; pending hit passes', () => {
    expect(redirectIdentityRefusal(pendingHit({ hit: false }), 'Goblin Boss 1')).toBe('miss');
    expect(redirectIdentityRefusal(pendingHit({ damageApplied: true }), 'Goblin Boss 1')).toBe('resolved');
    expect(redirectIdentityRefusal(pendingHit({ redirected: true }), 'Goblin Boss 1')).toBe('reacted');
    expect(redirectIdentityRefusal(pendingHit({ attackerName: 'Goblin Boss 1' }), 'Goblin Boss 1')).toBe('attacker');
    expect(redirectIdentityRefusal(pendingHit(), 'Goblin Boss 1')).toBeNull();
  });

  it('round latch refuses FIRST, then uses, then identity (MA-0881 order)', () => {
    expect(redirectGate({ lastAttack: null, monsterName: 'Goblin Boss 1', currentRound: 3, storedUses: {}, usedRound: 3, action: REDIRECT_ROW }).reason).toBe('round');
    expect(redirectGate({ lastAttack: pendingHit(), monsterName: 'Goblin Boss 1', currentRound: 1, storedUses: { redirect_attack: 999 }, usedRound: 0, action: REDIRECT_ROW }).reason).toBe('uses');
    expect(redirectGate({ lastAttack: null, monsterName: 'Goblin Boss 1', currentRound: 1, storedUses: {}, usedRound: 0, action: REDIRECT_ROW }).reason).toBe('no_pending_attack');
    expect(redirectGate({ lastAttack: pendingHit(), monsterName: 'Goblin Boss 1', currentRound: 1, storedUses: {}, usedRound: 0, action: REDIRECT_ROW }).ok).toBe(true);
  });

  it('armed-ally gate: no_target/self_target/size/already-active refuse, Medium-or-Small ally passes', () => {
    const deps = { getActiveTargetEffect: vi.fn(() => null) };
    expect(redirectAllyGate({ cs: makeCs({ bossArmed: false }), monsterName: 'Goblin Boss 1', action: REDIRECT_ROW, campaignName: 'test-campaign', deps }).reason).toBe('no_target');
    expect(redirectAllyGate({ cs: { round: 1, creatures: [{ name: 'Goblin Boss 1', size: 'Small', targetName: 'Goblin Boss 1' }] }, monsterName: 'Goblin Boss 1', action: REDIRECT_ROW, campaignName: 'test-campaign', deps }).reason).toBe('self_target');
    expect(redirectAllyGate({ cs: makeCs({ allySize: 'Tiny' }), monsterName: 'Goblin Boss 1', action: REDIRECT_ROW, campaignName: 'test-campaign', deps }).reason).toBe('size');
    expect(redirectAllyGate({ cs: makeCs(), monsterName: 'Goblin Boss 1', action: REDIRECT_ROW, campaignName: 'test-campaign', deps: { getActiveTargetEffect: vi.fn(() => ({ target: 'Bandit 2', effect: 'redirect_attack' })) } }).reason).toBe('already-active');
    expect(redirectAllyGate({ cs: makeCs(), monsterName: 'Goblin Boss 1', action: REDIRECT_ROW, campaignName: 'test-campaign', deps }).ally.name).toBe('Bandit 2');
  });
});

describe('MA-0891 press flow (armed redirect)', () => {
  it('press over pending hit: latch+spend FIRST, pendingRedirect + lastAttack retarget stamps, te on ALLY with ONE rounds:1 clock, spend + granted logs, NO popup (pending Done survives)', async () => {
    const deps = makeDeps();
    const result = await press({ deps });
    expect(result).toEqual({ resolved: true, effectKey: 'redirect_attack', allyName: 'Bandit 2', attackerName: 'Bandit 1' });
    expect(result.popupHtml).toBeUndefined();
    expect(deps.store.latches.redirect).toBe(1);
    expect(deps.store.reactionUses).toEqual({ redirect_attack: 1 });
    expect(deps.store.campaign.pendingRedirect).toMatchObject({
      attackerName: 'Bandit 1',
      originalTarget: 'Goblin Boss 1',
      newTarget: 'Bandit 2',
      by: 'Goblin Boss 1',
      round: 1,
    });
    expect(deps.store.campaign.pendingRedirect.lastAttackNonce).toContain('Scimitar');
    expect(deps.store.campaign.lastAttack).toMatchObject({
      redirected: true,
      redirectedBy: 'Goblin Boss 1',
      retarget_original: 'Goblin Boss 1',
      retarget_to: 'Bandit 2',
    });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Bandit 2', 'redirect_attack', 'Goblin Boss 1', expect.objectContaining({ rounds: 1, duration: 'rounds', actionName: 'Redirect Attack' }));
    expect(deps.addExpiration).toHaveBeenCalledTimes(1);
    expect(deps.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Goblin Boss 1',
      targetName: 'Bandit 2',
      campaignName: 'test-campaign',
      rounds: 1,
      effects: [{ type: 'remove_target_effect', effectKey: 'redirect_attack', source: 'Goblin Boss 1', target: 'Bandit 2' }],
    });
    const spend = deps.store.logs.find(e => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Redirect Attack');
    const granted = deps.store.logs.find(e => e.automationType === 'redirect_attack_granted');
    expect(granted.description).toContain('Bandit 2 becomes the target');
    expect(granted.description).toContain('Position swap GM-enforced');
    expect(granted.description).toContain('§42');
    expect(granted.description).toContain('5-ft');
  });

  it('non-redirect rows never resolve', async () => {
    const deps = makeDeps();
    const result = await resolveMonsterRedirectAttackRow({
      action: banditCaptain.reactions.find(r => r.name === 'Parry'),
      monsterName: 'Bandit Captain 1',
      campaignName: 'test-campaign',
      lastAttack: pendingHit({ targetName: 'Bandit Captain 1' }),
      cs: makeCs(),
      currentRound: 1,
      storedUses: {},
      usedRound: 0,
      latchKey: '_parry_usedRound',
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'not-redirect-attack' });
    expect(deps.store.logs).toHaveLength(0);
  });
});

describe('MA-0891 refusals (zero spend, zero te, zero stamps)', () => {
  async function expectZeroWrite(deps) {
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.addExpiration).not.toHaveBeenCalled();
  }

  it('no pending attack: redirect_attack_refused no_pending_attack, refusal popup, zero spend', async () => {
    const deps = makeDeps();
    const result = await press({ lastAttack: null, deps });
    expect(result.resolved).toBe(false);
    expect(result.reason).toBe('no_pending_attack');
    expect(deps.store.logs).toHaveLength(1);
    expect(deps.store.logs[0].automationType).toBe('redirect_attack_refused');
    expect(deps.store.logs[0].automationDetail).toBe('no_pending_attack');
    expect(result.popupHtml).toMatch('Redirect Attack Refused');
    await expectZeroWrite(deps);
  });

  it('same-round re-press: round refusal FIRST, zero spend', async () => {
    const deps = makeDeps();
    const result = await press({ usedRound: 1, storedUses: { redirect_attack: 1 }, deps });
    expect(result.reason).toBe('round');
    expect(deps.store.logs[0].automationDetail).toBe('round');
    await expectZeroWrite(deps);
  });

  it('damage already applied: resolved refusal, zero spend', async () => {
    const deps = makeDeps();
    const result = await press({ lastAttack: pendingHit({ damageApplied: true }), deps });
    expect(result.reason).toBe('resolved');
    await expectZeroWrite(deps);
  });

  it('self-armed target: self_target refusal, zero spend', async () => {
    const deps = makeDeps();
    const cs = { round: 1, creatures: [{ name: 'Goblin Boss 1', size: 'Small', targetName: 'Goblin Boss 1' }, { name: 'Bandit 1', size: 'Medium or Small' }] };
    const result = await press({ cs, deps });
    expect(result.reason).toBe('self_target');
    await expectZeroWrite(deps);
  });

  it('Tiny armed ally: size refusal, zero spend', async () => {
    const deps = makeDeps();
    const result = await press({ cs: makeCs({ allySize: 'Tiny' }), deps });
    expect(result.reason).toBe('size');
    expect(deps.store.logs[0].description).toMatch(/only Small or Medium allies/i);
    await expectZeroWrite(deps);
  });
});

describe('MA-0891 resolve consumer (Done → victim swap)', () => {
  it('armed redirect rewrites the victim to the ALLY, stamps lastAttack retarget fields, clears the stamp, logs', async () => {
    const deps = makeDeps();
    deps.store.campaign.pendingRedirect = { attackerName: 'Bandit 1', originalTarget: 'Goblin Boss 1', newTarget: 'Bandit 2', by: 'Goblin Boss 1', attackName: 'Scimitar', round: 1, lastAttackNonce: 'Scimitar:14:17' };
    deps.store.campaign.lastAttack = pendingHit({ redirected: true, retarget_to: 'Bandit 2' });
    const context = { damageType: 'Slashing', attackerName: 'Bandit 1', targetName: 'Goblin Boss 1' };
    const swap = await consumePendingRedirectOnResolve('test-campaign', context, makeCs(), deps);
    expect(swap).toEqual({ newTarget: 'Bandit 2', originalTarget: 'Goblin Boss 1' });
    expect(context.targetName).toBe('Bandit 2');
    expect(deps.store.campaign.pendingRedirect).toBeNull();
    expect(deps.store.campaign.lastAttack).toMatchObject({
      redirected: true,
      retarget_original: 'Goblin Boss 1',
      retarget_to: 'Bandit 2',
      redirectConsumed: true,
    });
    const applied = deps.store.logs.find(e => e.automationType === 'redirect_attack_applied');
    expect(applied.description).toContain('Bandit 2');
    expect(applied.description).toContain('Goblin Boss 1 unharmed');
  });

  it('no armed redirect: byte-inert — no writes, no log, no rewrite', async () => {
    const deps = makeDeps();
    const context = { damageType: 'Slashing', attackerName: 'Bandit 1', targetName: 'Goblin Boss 1' };
    const swap = await consumePendingRedirectOnResolve('test-campaign', context, makeCs(), deps);
    expect(swap).toBeNull();
    expect(context.targetName).toBe('Goblin Boss 1');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.addEntry).not.toHaveBeenCalled();
  });

  it('attacker mismatch + consumed stamp stay inert', async () => {
    const deps = makeDeps();
    deps.store.campaign.pendingRedirect = { attackerName: 'Bandit 9', originalTarget: 'Goblin Boss 1', newTarget: 'Bandit 2', by: 'Goblin Boss 1' };
    const context = { attackerName: 'Bandit 1', targetName: 'Goblin Boss 1' };
    expect(await consumePendingRedirectOnResolve('test-campaign', context, makeCs(), deps)).toBeNull();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    deps.store.campaign.pendingRedirect = { attackerName: 'Bandit 1', consumed: true, newTarget: 'Bandit 2' };
    expect(await consumePendingRedirectOnResolve('test-campaign', context, makeCs(), deps)).toBeNull();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('same-attacker swing re-armed on a different victim stays inert (E2E control)', async () => {
    const deps = makeDeps();
    deps.store.campaign.pendingRedirect = { attackerName: 'Bandit 1', originalTarget: 'Goblin Boss 1', newTarget: 'Bandit 2', by: 'Goblin Boss 1' };
    const context = { attackerName: 'Bandit 1', targetName: 'Bandit 2' };
    expect(await consumePendingRedirectOnResolve('test-campaign', context, makeCs(), deps)).toBeNull();
    expect(context.targetName).toBe('Bandit 2');
    expect(deps.store.campaign.pendingRedirect).not.toBeNull();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.addEntry).not.toHaveBeenCalled();
  });

  it('ally gone from the board: redirect_attack_lapsed, stamp cleared, no rewrite', async () => {
    const deps = makeDeps();
    deps.store.campaign.pendingRedirect = { attackerName: 'Bandit 1', originalTarget: 'Goblin Boss 1', newTarget: 'Bandit 2', by: 'Goblin Boss 1' };
    const context = { attackerName: 'Bandit 1', targetName: 'Goblin Boss 1' };
    const cs = { round: 1, creatures: [{ name: 'Goblin Boss 1', size: 'Small' }, { name: 'Bandit 1', size: 'Medium or Small' }] };
    const swap = await consumePendingRedirectOnResolve('test-campaign', context, cs, deps);
    expect(swap).toBeNull();
    expect(context.targetName).toBe('Goblin Boss 1');
    expect(deps.store.campaign.pendingRedirect).toBeNull();
    expect(deps.store.logs.find(e => e.automationType === 'redirect_attack_lapsed')).toBeTruthy();
  });

  it('refusal log builder carries <feature>_refused + reason token; grant log honest', () => {
    expect(buildRedirectRefusalLog({ monsterName: 'Goblin Boss', action: REDIRECT_ROW, reason: 'no_pending_attack', message: 'x' }).automationType).toBe('redirect_attack_refused');
    const granted = buildRedirectGrantedLog({ monsterName: 'Goblin Boss', action: REDIRECT_ROW, lastAttack: pendingHit(), allyName: 'Bandit 2', rangeFt: 5 });
    expect(granted.automationType).toBe('redirect_attack_granted');
    expect(granted.description).toContain('Bandit 2 becomes the target');
    expect(granted.description).toContain('gridless advisory');
  });
});
