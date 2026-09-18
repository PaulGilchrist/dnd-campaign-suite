// MA-0329 regression: Azer Pyromancer Hellish Rebuke (2/Day) gated reaction.
// Gate: campaign lastAttack with the monster as damaged target + damage dealt
// (PC reactionDamage identity shape, no trigger-string stamp); round latch;
// 2/Day spend via MONSTER_REACTION_USES; DEX save vs authored DC 15 (MA-0328
// lineage); 2d10 Fire half on save via computeDamageAfterSave; refusals log
// hellish_rebuke_refused and spend nothing; the triggering hit is stamped
// hellishRebukeResolved so the same hit cannot refire.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  hellishRebukeGate,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const AZER = monsters.find(m => m.index === 'azer-pyromancer');
const HR_ACTION = AZER.reactions[0];
const MONSTER = 'Azer Pyromancer 1';
const PC = 'ElderPaladin';
const CAMPAIGN = 'test-campaign';

function damageAgainstMonster(overrides = {}) {
  return {
    attackerName: PC,
    targetName: MONSTER,
    attackName: 'Longsword',
    hit: true,
    actualDamage: 8,
    primaryDamage: 8,
    damageTypes: ['Slashing'],
    ...overrides,
  };
}

function csWithPC(round = 1, attackerHp = 30) {
  return { round, creatures: [{ name: PC, type: 'player', currentHp: attackerHp }, { name: MONSTER, type: 'npc', currentHp: 90 }] };
}

function makeDeps({ lastAttack = damageAgainstMonster(), round = 1, store = {}, save = { success: false, roll: 3, total: 3, saveBonus: 0 }, damage = { total: 14, rolls: [5, 9] }, inRange = true, applyOk = {} } = {}) {
  const state = { ...store };
  const logs = [];
  const campaignWrites = [];
  const saveConfigs = [];
  const applied = [];
  return {
    state,
    logs,
    campaignWrites,
    applied,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => csWithPC(round)),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? (key === 'campaign' && prop === 'lastAttack' ? lastAttack : null)),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
      rollExpression: vi.fn(() => damage),
      isWithinRange: vi.fn(async () => inRange),
      createSaveListener: vi.fn((campaign, config) => {
        saveConfigs.push(config);
        return { promptId: 'p-1', promise: Promise.resolve(save) };
      }),
      applyDamageToTarget: vi.fn(async (cs, targetName, dmg, types) => {
        applied.push({ targetName, dmg, types });
        return applyOk === false ? null : { newHp: 30 - dmg };
      }),
    },
  };
}

describe('MA-0329 Hellish Rebuke data + registry', () => {
  it('monsters.json azer-pyromancer reactions[0] carries the automation + 2/Day + DC/damage metadata', () => {
    expect(HR_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'takes_damage', effect: 'hellish_rebuke', saveType: 'DEX', saveDc: 15, dcSuccess: 'half', damageExpression: '2d10', damageType: 'Fire' });
    expect(HR_ACTION.uses).toBe(2);
    expect(HR_ACTION.maxUses).toBe(2);
    expect(HR_ACTION.usage).toBe('2/Day');
  });

  it('registry resolves hellish_rebuke; unregistered reaction rows stay byte-inert (null)', () => {
    expect(getGatedMonsterReaction(HR_ACTION)?.effect).toBe('hellish_rebuke');
    const cultistRow = monsters.find(m => m.index === 'fiend-cultist').reactions[0];
    expect(getGatedMonsterReaction(cultistRow)).toBeNull();
    expect(getGatedMonsterReaction({ name: 'Mace', description: 'Hit: 1d6+2 bludgeoning.' })).toBeNull();
  });

  it('remaining uses: 2 fresh, 0 at spent', () => {
    expect(monsterReactionUsesRemaining(HR_ACTION, {})).toBe(2);
    expect(monsterReactionUsesRemaining(HR_ACTION, { hellish_rebuke: 2 })).toBe(0);
  });
});

describe('MA-0329 hellishRebukeGate', () => {
  it('refuses no lastAttack / monster-not-target / zero-damage', () => {
    const g0 = hellishRebukeGate({ lastAttack: null, monsterName: MONSTER, currentRound: 1, storedUses: {}, usedRound: 0, action: HR_ACTION });
    expect(g0).toMatchObject({ ok: false, reason: 'trigger' });
    const g1 = hellishRebukeGate({ lastAttack: damageAgainstMonster({ targetName: 'Other 1' }), monsterName: MONSTER, currentRound: 1, storedUses: {}, usedRound: 0, action: HR_ACTION });
    expect(g1.reason).toBe('trigger');
    const g2 = hellishRebukeGate({ lastAttack: damageAgainstMonster({ actualDamage: 0 }), monsterName: MONSTER, currentRound: 1, storedUses: {}, usedRound: 0, action: HR_ACTION });
    expect(g2.reason).toBe('damage');
  });

  it('refuses same-round refire, spent-cast refire, and 2/Day exhaustion', () => {
    const gR = hellishRebukeGate({ lastAttack: damageAgainstMonster(), monsterName: MONSTER, currentRound: 4, storedUses: {}, usedRound: 4, action: HR_ACTION });
    expect(gR.reason).toBe('round');
    const gA = hellishRebukeGate({ lastAttack: damageAgainstMonster({ hellishRebukeResolved: true }), monsterName: MONSTER, currentRound: 5, storedUses: {}, usedRound: 4, action: HR_ACTION });
    expect(gA.reason).toBe('reacted');
    const gU = hellishRebukeGate({ lastAttack: damageAgainstMonster(), monsterName: MONSTER, currentRound: 6, storedUses: { hellish_rebuke: 2 }, usedRound: 5, action: HR_ACTION });
    expect(gU.reason).toBe('uses');
    expect(gU.message).toMatch(/2\/Day/);
  });

  it('allows a fresh damaged-target event and reports attacker + damage dealt', () => {
    const g = hellishRebukeGate({ lastAttack: damageAgainstMonster(), monsterName: MONSTER, currentRound: 2, storedUses: {}, usedRound: 1, action: HR_ACTION });
    expect(g).toMatchObject({ ok: true, used: 0, limit: 2, attackerName: PC });
  });
});

describe('MA-0329 resolveMonsterGatedReaction — Hellish Rebuke', () => {
  it('refusal (no damage event): hellish_rebuke_refused logged, zero spend', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('hellish_rebuke_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.createSaveListener).not.toHaveBeenCalled();
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('failed save: DEX vs DC 15, 2d10 full damage applied, 2→1 spend, cast stamped resolved, logs', async () => {
    const { state, logs, campaignWrites, applied, deps } = makeDeps({ round: 3 });
    const result = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.saveSuccess).toBe(false);
    expect(result.finalDamage).toBe(14);
    expect(deps.createSaveListener).toHaveBeenCalledTimes(1);
    expect(deps.createSaveListener.mock.calls[0][1]).toMatchObject({ targetName: PC, saveType: 'DEX', saveDc: 15, dcSuccess: 'half', damageFormula: '2d10', damageType: 'Fire' });
    expect(applied[0]).toMatchObject({ targetName: PC, dmg: 14, types: ['Fire'] });
    expect(state[`${MONSTER}._hellish_rebuke_usedRound`]).toBe(3);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ hellish_rebuke: 1 });
    expect(campaignWrites[0]).toMatchObject({ hellishRebukeResolved: true, rebukedBy: MONSTER, rebukeTarget: PC });
    const damageLog = logs.find(l => l.type === 'roll' && l.rollType === 'damage');
    expect(damageLog.total).toBe(14);
    expect(damageLog.finalDamage).toBe(14);
    expect(damageLog.description).toMatch(/DC 15/);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Hellish Rebuke');
    expect(spend.description).toMatch(/failed their DEX save/i);
    expect(spend.description).toMatch(/14 Fire damage/);
    expect(spend.description).toMatch(/2\/Day · 1 left today/);
  });

  it('successful save: half damage floored (2d10=15 → 7)', async () => {
    const { applied, logs, deps } = makeDeps({ save: { success: true, roll: 18, total: 20, saveBonus: 2 }, damage: { total: 15, rolls: [6, 9] } });
    const result = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.saveSuccess).toBe(true);
    expect(result.finalDamage).toBe(7);
    expect(applied[0].dmg).toBe(7);
    expect(logs.find(l => l.type === 'ability_use').description).toMatch(/7 Fire damage/);
  });

  it('second use spends 2→0; third click refuses uses with zero additional spend', async () => {
    const first = makeDeps({ lastAttack: damageAgainstMonster({ attackName: 'Second Hit' }), round: 2, store: { [`${MONSTER}._hellish_rebuke_usedRound`]: 1, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { hellish_rebuke: 1 } } });
    const r1 = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: first.deps });
    expect(r1.ok).toBe(true);
    expect(first.state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ hellish_rebuke: 2 });

    const second = makeDeps({ lastAttack: damageAgainstMonster(), round: 4, store: { [`${MONSTER}._hellish_rebuke_usedRound`]: 3, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { hellish_rebuke: 2 } } });
    const r2 = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: second.deps });
    expect(r2.ok).toBe(false);
    expect(second.logs[0].automationType).toBe('hellish_rebuke_refused');
    expect(second.logs[0].description).toMatch(/uses/);
    expect(second.deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(second.state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ hellish_rebuke: 2 });
  });

  it('attacker unknown / out of range: refused zero-spend', async () => {
    const noAtt = makeDeps({ lastAttack: damageAgainstMonster({ attackerName: null }) });
    const r1 = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: noAtt.deps });
    expect(r1.ok).toBe(false);
    expect(noAtt.logs[0].automationType).toBe('hellish_rebuke_refused');
    expect(noAtt.deps.setRuntimeValue).not.toHaveBeenCalled();

    const far = makeDeps({ inRange: false });
    const r2 = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: far.deps });
    expect(r2.ok).toBe(false);
    expect(far.logs.some(l => l.automationType === 'hellish_rebuke_refused' && /range/.test(l.description))).toBe(true);
    expect(far.deps.setRuntimeValue).not.toHaveBeenCalled();
  });
});
