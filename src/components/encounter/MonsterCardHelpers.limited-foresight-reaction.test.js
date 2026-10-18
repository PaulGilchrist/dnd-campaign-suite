// @maintained-by-ai: 2026-10-18
// MA-0548 regression: Cyclops Sentry Limited Foresight — pre-roll cloud
// reaction (recharge "6"). GATED_MONSTER_REACTIONS `limited_foresight` arms
// the chip; the resolver gates on campaign lastAttack identity (parry
// MA-0341 lineage WITHOUT the hit requirement — damageApplied:true is the
// too-late boundary), recharges via the MA-0031 economy, and on fire grants
// BOTH sides: te `disadvantage_attack_rolls` on the attacker (MA-0542
// registered te) + self te `next_attack_advantage` with vexTarget = the
// attacker (CLA-341 verified channel), ONE merged addExpiration anchored on
// the cyclops (§38 anchor leg — expiry at its next turn-start, RAW
// end-of-turn advisory). Re-arm only via rollMonsterRecharges d6 6+ at the
// monster's own turn-start (MA-0544 lifecycle template).
// Cite-skips (owned ONCE elsewhere, #508/#513 reaction-family template):
// plain-row getGatedMonsterReaction→null at MonsterCardHelpers.gated-reaction.test.js:66 (#417);
// rollMonsterRecharges d6 miss/threshold arithmetic at services/encounters/monsterRecharge.test.js:84/:96 (MA-0031) —
// here only the d6 6+ re-arm seam (press-spend key ↔ gate read key) is this
// lane's own wiring. Fixtures by name per #387. No timers.
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

function gateCall(extra = {}) {
  return limitedForesightGate({ action: ACTION, lastAttack: lastAttack(), monsterName: SENTRY, rechargeMap: null, armed: { name: KNIGHT }, currentRound: 2, usedRound: 0, ...extra });
}

beforeEach(() => {
  vi.mocked(registerTargetEffect).mockClear();
  vi.mocked(addExpiration).mockClear();
});

describe('MA-0548 disk row + registry', () => {
  it('monsters.json cyclops-sentry reactions[0] locks RAW row and arms the chip', () => {
    expect(ACTION.name).toBe('Limited Foresight');
    expect(ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'attacked_by_seen', effect: 'limited_foresight' });
    expect(ACTION.recharge).toBe('6');
    expect(getGatedMonsterReaction(ACTION)?.effect).toBe('limited_foresight');
  });
});

describe('MA-0548 gate truth tables', () => {
  it('limitedForesightIdentityRefusal truth table: armed null + six refusal tokens', () => {
    expect(limitedForesightIdentityRefusal(lastAttack(), SENTRY)).toBeNull();
    expect(limitedForesightIdentityRefusal(null, SENTRY)).toBe('trigger');
    expect(limitedForesightIdentityRefusal(lastAttack({ targetName: 'ElderPaladin' }), SENTRY)).toBe('trigger');
    expect(limitedForesightIdentityRefusal(lastAttack({ rollType: 'saving-throw' }), SENTRY)).toBe('roll');
    expect(limitedForesightIdentityRefusal(lastAttack({ damageApplied: true }), SENTRY)).toBe('resolved');
    expect(limitedForesightIdentityRefusal(lastAttack({ limitedForesightResolved: true }), SENTRY)).toBe('reacted');
    expect(limitedForesightIdentityRefusal(lastAttack({ attackerName: SENTRY }), SENTRY)).toBe('attacker');
  });

  it('limitedForesightGate truth table: fresh accept; recharge/target/target/round refusals', () => {
    expect(gateCall()).toMatchObject({ ok: true, attackerName: KNIGHT, threshold: 6 });
    expect(gateCall({ rechargeMap: spentRecharge() })).toMatchObject({ ok: false, reason: 'recharge' });
    expect(gateCall({ rechargeMap: spentRecharge() }).message).toMatch(/d6 6\+/);
    const noTarget = gateCall({ armed: null });
    expect(noTarget.reason).toBe('target');
    expect(noTarget.message).toMatch(/arm Knight 1 on the card/);
    expect(gateCall({ armed: { name: 'ElderPaladin' } }).reason).toBe('target');
    expect(gateCall({ currentRound: 2, usedRound: 2 }).reason).toBe('round');
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

  it('same-event second press: limited_foresight_refused (reacted) — zero re-grant, zero spend, recharge kept', async () => {
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

  it('spent recharge press: recharge refusal log + popup, zero grant zero spend; turn-start d6 6 re-arms the gate', async () => {
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
    // d6-miss arithmetic is MA-0031-owned (monsterRecharge.test.js:96) —
    // this leg only proves the press-spend key re-arms THIS gate.
    const hit = await rollMonsterRecharges({
      monsterName: SENTRY,
      campaignName: CAMPAIGN,
      deps: { getRuntimeValue: deps.getRuntimeValue, setRuntimeValue: deps.setRuntimeValue, addEntry: deps.addEntry, rollExpression: vi.fn(() => ({ total: 6, rolls: [6] })) },
    });
    expect(hit.outcomes[0]).toEqual({ key: 'Limited Foresight', rolled: 6, recharged: true });
    expect(gateCall({ rechargeMap: state[`${SENTRY}.${MONSTER_RECHARGE_KEY}`], currentRound: 3 }).ok).toBe(true);
  });
});
