// @improved-by-ai
// MA-0548 regression: Cyclops Sentry Limited Foresight — pre-roll cloud
// reaction (recharge "6"). GATED_MONSTER_REACTIONS `limited_foresight` arms
// the chip; the resolver gates on campaign lastAttack identity (parry
// MA-0341 lineage without the hit requirement — damageApplied is the
// too-late boundary), recharges via the MA-0031 economy, and on fire grants
// BOTH sides: te `disadvantage_attack_rolls` on the attacker (MA-0542
// registered te) + self te `next_attack_advantage` with vexTarget = the
// attacker (CLA-341 verified channel), ONE merged addExpiration anchored on
// the cyclops (§38 anchor leg — expiry at its next turn-start, RAW
// end-of-turn advisory). Re-arm only via rollMonsterRecharges d6 6+ at the
// monster's own turn-start (MA-0544 lifecycle template).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  limitedForesightGate,
  limitedForesightIdentityRefusal,
} from './MonsterCardHelpers.js';
import { MONSTER_RECHARGE_KEY, rollMonsterRecharges } from '../../services/encounters/monsterRecharge.js';
import { registerTargetEffect } from '../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../services/rules/effects/expirationQueue.js';
import monsters from '../../../public/data/monsters.json';

vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', () => ({
  registerTargetEffect: vi.fn(),
  getEffectDefinition: vi.fn(() => ({ label: 'Attack Disadvantage' })),
}));
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

const ACTION = monsters.find(m => m.index === 'cyclops-sentry').reactions[0];
const SENTRY = 'Cyclops Sentry 1';
const KNIGHT = 'Knight 1';
const CAMPAIGN = 'test-campaign';

function cs(round = 1) {
  return { round, creatures: [{ name: SENTRY, type: 'npc', currentHp: 138, maxHp: 138 }, { name: KNIGHT, type: 'player', currentHp: 52, maxHp: 52 }] };
}

function lastAttack(extra = {}) {
  return {
    attackerName: KNIGHT,
    targetName: SENTRY,
    rollType: 'attack',
    weaponType: 'melee',
    attackName: 'Longsword',
    d20: 12,
    bonus: 3,
    total: 15,
    targetAc: 14,
    hit: true,
    damageApplied: false,
    ...extra,
  };
}

function makeDeps({ round = 1, store = {}, armed = { name: KNIGHT }, la = lastAttack() } = {}) {
  const state = { ...store };
  const logs = [];
  const deps = {
    findLastAttack: vi.fn(async () => la),
    getCombatContext: vi.fn(async () => cs(round)),
    getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
    setRuntimeValue: vi.fn(async (key, prop, value) => { state[`${key}.${prop}`] = value; }),
    addEntry: vi.fn(async (campaign, entry) => { logs.push(entry); }),
    getTarget: vi.fn(() => armed),
  };
  return { state, logs, deps };
}

function spentRecharge(map = {}) {
  return { ...map, 'Limited Foresight': { recharged: false, threshold: 6 } };
}

beforeEach(() => {
  vi.mocked(registerTargetEffect).mockClear();
  vi.mocked(addExpiration).mockClear();
});

describe('MA-0548 disk row + registry shape', () => {
  it('monsters.json cyclops-sentry reactions[0] carries automation {type,trigger,effect} + recharge "6"', () => {
    expect(ACTION.name).toBe('Limited Foresight');
    expect(ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'attacked_by_seen', effect: 'limited_foresight' });
    expect(ACTION.recharge).toBe('6');
  });

  it('registry arms the Limited Foresight chip and ignores plain rows', () => {
    expect(getGatedMonsterReaction(ACTION)?.effect).toBe('limited_foresight');
    expect(getGatedMonsterReaction({ name: 'Stone Club', attack_bonus: 9 })).toBeNull();
  });
});

describe('MA-0548 limitedForesightIdentityRefusal + gate', () => {
  it('attack roll against the cyclops, damage not committed = armed', () => {
    expect(limitedForesightIdentityRefusal(lastAttack(), SENTRY)).toBeNull();
  });

  it('identity refusals: trigger, roll, resolved, reacted, attacker', () => {
    expect(limitedForesightIdentityRefusal(null, SENTRY)).toBe('trigger');
    expect(limitedForesightIdentityRefusal(lastAttack({ targetName: 'ElderPaladin' }), SENTRY)).toBe('trigger');
    expect(limitedForesightIdentityRefusal(lastAttack({ rollType: 'saving-throw' }), SENTRY)).toBe('roll');
    expect(limitedForesightIdentityRefusal(lastAttack({ damageApplied: true }), SENTRY)).toBe('resolved');
    expect(limitedForesightIdentityRefusal(lastAttack({ limitedForesightResolved: true }), SENTRY)).toBe('reacted');
    expect(limitedForesightIdentityRefusal(lastAttack({ attackerName: SENTRY }), SENTRY)).toBe('attacker');
  });

  it('fresh recharge = available threshold 6; spent recharge refuses "recharge"', () => {
    const fresh = limitedForesightGate({ action: ACTION, lastAttack: lastAttack(), monsterName: SENTRY, rechargeMap: null, armed: { name: KNIGHT }, currentRound: 2, usedRound: 0 });
    expect(fresh).toMatchObject({ ok: true, attackerName: KNIGHT, threshold: 6 });
    const spent = limitedForesightGate({ action: ACTION, lastAttack: lastAttack(), monsterName: SENTRY, rechargeMap: spentRecharge(), armed: { name: KNIGHT }, currentRound: 2, usedRound: 0 });
    expect(spent.ok).toBe(false);
    expect(spent.reason).toBe('recharge');
    expect(spent.message).toMatch(/d6 6\+/);
  });

  it('no armed target or bystander arm refuses "target"; same-round latch refuses "round"', () => {
    const noTarget = limitedForesightGate({ action: ACTION, lastAttack: lastAttack(), monsterName: SENTRY, rechargeMap: null, armed: null, currentRound: 2, usedRound: 0 });
    expect(noTarget.reason).toBe('target');
    expect(noTarget.message).toMatch(/arm Knight 1 on the card/);
    const bystander = limitedForesightGate({ action: ACTION, lastAttack: lastAttack(), monsterName: SENTRY, rechargeMap: null, armed: { name: 'ElderPaladin' }, currentRound: 2, usedRound: 0 });
    expect(bystander.reason).toBe('target');
    const latched = limitedForesightGate({ action: ACTION, lastAttack: lastAttack(), monsterName: SENTRY, rechargeMap: null, armed: { name: KNIGHT }, currentRound: 2, usedRound: 2 });
    expect(latched.reason).toBe('round');
  });
});

describe('MA-0548 resolveMonsterGatedReaction — both-side te + recharge lifecycle', () => {
  it('first press vs armed attacker: grants BOTH te + one anchored clock, stamps lastAttack, logs grants, spends recharge 6', async () => {
    const { state, logs, deps } = makeDeps({ round: 2 });
    const result = await resolveMonsterGatedReaction({ action: ACTION, monsterName: SENTRY, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.attackerName).toBe(KNIGHT);
    expect(registerTargetEffect).toHaveBeenCalledWith(CAMPAIGN, KNIGHT, 'disadvantage_attack_rolls', SENTRY, { duration: 'until_start_of_next_turn' });
    expect(registerTargetEffect).toHaveBeenCalledWith(CAMPAIGN, SENTRY, 'next_attack_advantage', SENTRY, { vexTarget: KNIGHT, duration: 'until_start_of_next_turn' });
    expect(addExpiration).toHaveBeenCalledTimes(1);
    expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
      attackerName: SENTRY,
      targetName: KNIGHT,
      expireOnCreatureName: SENTRY,
      rounds: undefined,
      effects: [
        { type: 'remove_target_effect', effectKey: 'disadvantage_attack_rolls', source: SENTRY, target: KNIGHT },
        { type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: SENTRY, target: SENTRY },
      ],
    }));
    const stamped = state['campaign.lastAttack'];
    expect(stamped.limitedForesightResolved).toBe(true);
    expect(stamped.foresightBy).toBe(SENTRY);
    expect(stamped.foresightTarget).toBe(KNIGHT);
    expect(state[`${SENTRY}._limited_foresight_usedRound`]).toBe(2);
    expect(state[`${SENTRY}.${MONSTER_RECHARGE_KEY}`]).toEqual({ 'Limited Foresight': { recharged: false, threshold: 6 } });
    expect(logs.some(l => l.type === 'condition' && l.action === 'applied' && l.characterName === KNIGHT && l.condition === 'Attack Disadvantage')).toBe(true);
    expect(logs.some(l => l.type === 'condition' && l.action === 'applied' && l.characterName === SENTRY && l.condition === 'Next Attack Advantage' && /vexTarget/.test(l.reason))).toBe(true);
    expect(logs.some(l => l.type === 'ability_use' && l.abilityName === 'Limited Foresight' && /Recharge 6/.test(l.description))).toBe(true);
    expect(result.popupHtml).toMatch(/Recharge 6 spent/);
    expect(result.popupHtml).toMatch(/WITHOUT Done/);
  });

  it('same-event second press: limited_foresight_refused (reacted) — zero re-grant, zero spend', async () => {
    const { state, logs, deps } = makeDeps({
      la: lastAttack({ limitedForesightResolved: true, foresightBy: SENTRY }),
    });
    const result = await resolveMonsterGatedReaction({ action: ACTION, monsterName: SENTRY, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already responded/);
    expect(registerTargetEffect).not.toHaveBeenCalled();
    expect(addExpiration).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('limited_foresight_refused');
    expect(logs[0].description).toMatch(/\(reacted\)/);
    expect(state[`${SENTRY}.${MONSTER_RECHARGE_KEY}`]).toBeUndefined();
  });

  it('spent recharge press: recharge refusal popup + limited_foresight_refused not-recharged log, zero grant zero spend', async () => {
    const { state, logs, deps } = makeDeps({ store: { [`${SENTRY}.${MONSTER_RECHARGE_KEY}`]: spentRecharge() } });
    const result = await resolveMonsterGatedReaction({ action: ACTION, monsterName: SENTRY, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(registerTargetEffect).not.toHaveBeenCalled();
    expect(addExpiration).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('limited_foresight_refused');
    expect(logs[0].description).toMatch(/not recharged/);
    expect(result.popupHtml).toMatch(/Not Recharged/);
    expect(state[`${SENTRY}.${MONSTER_RECHARGE_KEY}`]).toEqual(spentRecharge());
  });

  it('no armed target: limited_foresight_refused (no-target message, target) — Recharge kept', async () => {
    const { state, logs, deps } = makeDeps({ armed: null });
    const result = await resolveMonsterGatedReaction({ action: ACTION, monsterName: SENTRY, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('limited_foresight_refused');
    expect(logs[0].description).toMatch(/\(target\)/);
    expect(registerTargetEffect).not.toHaveBeenCalled();
    expect(state[`${SENTRY}.${MONSTER_RECHARGE_KEY}`]).toBeUndefined();
  });

  it('turn-start regain d6 6 re-arms the gate; d6 5 keeps it spent (honest threshold)', async () => {
    const { state, logs, deps } = makeDeps();
    await resolveMonsterGatedReaction({ action: ACTION, monsterName: SENTRY, campaignName: CAMPAIGN, deps });
    expect(state[`${SENTRY}.${MONSTER_RECHARGE_KEY}`]['Limited Foresight'].recharged).toBe(false);
    const miss = await rollMonsterRecharges({
      monsterName: SENTRY,
      campaignName: CAMPAIGN,
      deps: { getRuntimeValue: deps.getRuntimeValue, setRuntimeValue: deps.setRuntimeValue, addEntry: deps.addEntry, rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })) },
    });
    expect(miss.outcomes[0]).toEqual({ key: 'Limited Foresight', rolled: 5, recharged: false });
    const gateAfterMiss = limitedForesightGate({ action: ACTION, lastAttack: lastAttack(), monsterName: SENTRY, rechargeMap: state[`${SENTRY}.${MONSTER_RECHARGE_KEY}`], armed: { name: KNIGHT }, currentRound: 3, usedRound: 0 });
    expect(gateAfterMiss.reason).toBe('recharge');
    const hit = await rollMonsterRecharges({
      monsterName: SENTRY,
      campaignName: CAMPAIGN,
      deps: { getRuntimeValue: deps.getRuntimeValue, setRuntimeValue: deps.setRuntimeValue, addEntry: deps.addEntry, rollExpression: vi.fn(() => ({ total: 6, rolls: [6] })) },
    });
    expect(hit.outcomes[0].recharged).toBe(true);
    expect(logs.some(l => l.automationType === 'recharge' && /Limited Foresight recharged \(d6: 6\)/.test(l.description))).toBe(true);
    const gateAfterHit = limitedForesightGate({ action: ACTION, lastAttack: lastAttack(), monsterName: SENTRY, rechargeMap: state[`${SENTRY}.${MONSTER_RECHARGE_KEY}`], armed: { name: KNIGHT }, currentRound: 3, usedRound: 0 });
    expect(gateAfterHit.ok).toBe(true);
  });
});
