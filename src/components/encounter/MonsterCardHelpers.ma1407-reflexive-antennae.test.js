// @maintained-by-ai — MA-1407 reflexive antennae owner: trimmed 16→7 tests
// (disk+registry+spec lock once, gate truth-table once, refusals collapsed,
// resolve-e2e once per save outcome, honest latch chain incl. round-wrap).
// MA-1407 regression: Rust Monster Reflexive Antennae (At Will) gated reaction —
// distinct effect/economy owner (not a byte-twin of #508/#532/#540/#512/#513;
// those files never mention reflexive_antennae). Disk row locked BY NAME once:
// reactions[0] automation DEX DC 11 dcSuccess:'none', NO damage dice (object
// corrosion −1 AC/attack is GM-enforced advisory, CLA-325 — never fabricate HP
// damage); spec read mirrors the Antennae action row (MA-0329/MA-1354 lineage).
// Gate truth-table collapsed to ONE refusal-table test (MA-0341 hit lineage:
// committed attack rolls stamp top-level hit:true; round latch
// _reflexive_antennae_usedRound; MONSTER_REACTION_USES At Will sentinel 999;
// round latch refuses BEFORE uses). Resolve refusals collapsed to one zero-spend
// test (no trigger / miss / attacker down); resolve-e2e runs ONCE per save
// outcome; honest latch chain: spend → same-hit refire refused → round-wrap
// spends again.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  reflexiveAntennaeGate,
  reflexiveAntennaeSpec,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const RUST = monsters.find(m => m.index === 'rust-monster');
const RA_ACTION = RUST.reactions[0];
const MONSTER = 'Rust Monster 1';
const PC = 'AasimarTest';
const CAMPAIGN = 'test-campaign';

function attackHit(overrides = {}) {
  return {
    attackerName: PC,
    targetName: MONSTER,
    attackName: 'Longsword',
    rollType: 'attack',
    hit: true,
    ...overrides,
  };
}

function csWithPC(round = 1, attackerHp = 30) {
  return { round, creatures: [{ name: PC, type: 'player', currentHp: attackerHp }, { name: MONSTER, type: 'npc', currentHp: 33 }] };
}

function makeDeps({ lastAttack = attackHit(), round = 1, store = {}, saveSuccess = false } = {}) {
  const state = { ...store };
  const logs = [];
  const campaignWrites = [];
  const saveCalls = [];
  return {
    state,
    logs,
    campaignWrites,
    saveCalls,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => csWithPC(round)),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? (key === 'campaign' && prop === 'lastAttack' ? lastAttack : null)),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
      createSaveListener: vi.fn((campaignName, config) => {
        saveCalls.push(config);
        return { promise: Promise.resolve({ success: saveSuccess }) };
      }),
    },
  };
}

describe('MA-1407 Reflexive Antennae disk lock + registry (by name, once)', () => {
  it('rust-monster reactions[0] + Antennae row locked: DC 11 DEX, NO damage dice, At Will sentinel, registry + economy', () => {
    expect(RA_ACTION.name).toBe('Reflexive Antennae');
    expect(RA_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'attacked_by_hit', effect: 'reflexive_antennae', saveType: 'DEX', saveDc: 11, dcSuccess: 'none' });
    expect(RA_ACTION.trigger).toMatch(/attack roll hits the rust monster/);
    expect(RA_ACTION.usage).toBe('At Will');
    expect(RA_ACTION.uses).toBe(999);
    expect(RA_ACTION.maxUses).toBe(999);

    const antennae = RUST.actions.find(a => a.name === 'Antennae');
    expect(antennae.save_dc).toBe(11);
    expect(antennae.save_type).toBe('Dexterity');
    expect(antennae.damage_dice_primary).toBeUndefined();
    const spec = reflexiveAntennaeSpec(RA_ACTION).spec;
    expect(spec.saveDc).toBe(antennae.save_dc);
    expect(spec.saveType).toBe('DEX');
    expect(spec.dcSuccess).toBe('none');
    expect(spec.damageExpression).toBeUndefined();
    // row without authored DC refuses honestly (no baked default)
    expect(reflexiveAntennaeSpec({ name: 'Reflexive Antennae' }).reason).toBe('dc');

    expect(getGatedMonsterReaction(RA_ACTION)?.effect).toBe('reflexive_antennae');
    expect(getGatedMonsterReaction({ name: 'Bite', description: 'Melee Attack Roll: +3.' })).toBeNull();
    expect(monsterReactionUsesRemaining(RA_ACTION, {})).toBeNull(); // At Will sentinel → no counter
    expect(monsterReactionUsesRemaining(RA_ACTION, { reflexive_antennae: 1 })).toBeNull();
  });
});

describe('MA-1407 reflexiveAntennaeGate', () => {
  const g = (lastAttack, overrides = {}) => reflexiveAntennaeGate({ lastAttack, monsterName: MONSTER, currentRound: overrides.round ?? 1, storedUses: overrides.storedUses ?? {}, usedRound: overrides.usedRound ?? 0, action: RA_ACTION });

  it('accepts monster-as-target hit:true (the MA-1407 live byte-shape)', () => {
    expect(g(attackHit())).toMatchObject({ ok: true, used: 0, limit: 999, attackerName: PC });
  });

  it('refusal truth-table (one test): trigger/miss/reacted/attacker/round/uses + round-before-uses precedence', () => {
    expect(g(null).reason).toBe('trigger');
    expect(g(attackHit({ targetName: 'Thug 1' })).reason).toBe('trigger');
    expect(g(attackHit({ hit: false })).reason).toBe('miss');
    expect(g({ attackerName: PC, targetName: MONSTER, rollType: 'attack' }).reason).toBe('miss');
    expect(g(attackHit({ reflexiveAntennaeResolved: true })).reason).toBe('reacted');
    expect(g(attackHit({ attackerName: null })).reason).toBe('attacker');
    expect(g(attackHit({ attackerName: MONSTER })).reason).toBe('attacker');
    expect(g(attackHit(), { round: 4, usedRound: 4 }).reason).toBe('round');
    expect(g(attackHit(), { round: 6, usedRound: 5, storedUses: { reflexive_antennae: 999 } }).reason).toBe('uses');
    // same-round spent reads round BEFORE uses
    expect(g(attackHit(), { round: 3, usedRound: 3, storedUses: { reflexive_antennae: 999 } }).reason).toBe('round');
  });
});

describe('MA-1407 resolveMonsterGatedReaction — Reflexive Antennae', () => {
  it('refusal legs (no trigger / miss / attacker down): reflexive_antennae_refused logged, zero spend, no save', async () => {
    const noTrigger = makeDeps({ lastAttack: null });
    const r1 = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: noTrigger.deps });
    expect(r1.ok).toBe(false);
    expect(noTrigger.logs[0].automationType).toBe('reflexive_antennae_refused');
    expect(noTrigger.deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(noTrigger.saveCalls).toHaveLength(0);
    expect(noTrigger.state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();

    const miss = makeDeps({ lastAttack: attackHit({ hit: false }) });
    const r2 = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: miss.deps });
    expect(r2.ok).toBe(false);
    expect(miss.logs[0].automationType).toBe('reflexive_antennae_refused');
    expect(miss.logs[0].description).toMatch(/miss/i);
    expect(miss.saveCalls).toHaveLength(0);
    expect(miss.deps.setRuntimeValue).not.toHaveBeenCalled();

    const down = makeDeps({});
    down.deps.getCombatContext = vi.fn(async () => csWithPC(1, 0));
    const r3 = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: down.deps });
    expect(r3.ok).toBe(false);
    expect(down.logs[0].automationType).toBe('reflexive_antennae_refused');
    expect(down.logs[0].description).toMatch(/not an active combatant/);
    expect(down.saveCalls).toHaveLength(0);
    expect(down.deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('save FAIL resolve-e2e (once): DC 11 Dex vs attacker via seam, corrosion advisory (no damage), spend + latch + stamp + logs', async () => {
    const { state, logs, campaignWrites, saveCalls, deps } = makeDeps({ round: 3, saveSuccess: false });
    const result = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(saveCalls[0]).toMatchObject({ targetName: PC, attackerName: MONSTER, saveType: 'DEX', saveDc: 11, dcSuccess: 'none', damageFormula: null, sourceName: 'Reflexive Antennae' });
    expect(state[`${MONSTER}._reflexive_antennae_usedRound`]).toBe(3);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ reflexive_antennae: 1 });
    expect(campaignWrites[0]).toMatchObject({ reflexiveAntennaeResolved: true, antennaeTriggeredBy: MONSTER, antennaeTarget: PC, antennaeSaveSuccess: false });
    const corrosion = logs.find(l => l.automationType === 'reflexive_antennae_corrosion');
    expect(corrosion.description).toMatch(/FAILED the DC 11 DEX save/);
    expect(corrosion.description).toMatch(/−1 penalty/);
    expect(corrosion.description).toMatch(/GM-enforced/);
    expect(corrosion.description).not.toMatch(/HP damage of|took \d+ damage/);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Reflexive Antennae');
    expect(spend.description).toMatch(/DC 11 DEX save/);
    expect(spend.description).toMatch(/At Will/);
  });

  it('save SUCCESS: no corrosion, still spends, stamp records success', async () => {
    const { state, logs, campaignWrites, deps } = makeDeps({ saveSuccess: true });
    const result = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.saveSuccess).toBe(true);
    expect(campaignWrites[0].antennaeSaveSuccess).toBe(true);
    const corrosion = logs.find(l => l.automationType === 'reflexive_antennae_corrosion');
    expect(corrosion.description).toMatch(/SUCCEEDED/);
    expect(corrosion.description).toMatch(/no object corroded/);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ reflexive_antennae: 1 });
  });

  it('honest latch chain: fresh hit spends 1 → stamped refire refused zero-spend → round-wrap fresh hit spends 2', async () => {
    const first = makeDeps({});
    const r1 = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: first.deps });
    expect(r1.ok).toBe(true);
    const stamped = first.campaignWrites[0];

    const second = makeDeps({ lastAttack: stamped, round: 2, store: { ...first.state } });
    const r2 = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: second.deps });
    expect(r2.ok).toBe(false);
    expect(second.logs[0].automationType).toBe('reflexive_antennae_refused');
    expect(second.logs[0].description).toMatch(/reacted/i);
    expect(second.saveCalls).toHaveLength(0);
    expect(second.state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ reflexive_antennae: 1 });

    const fresh = attackHit({ attackName: 'Fire Bolt' });
    const third = makeDeps({ lastAttack: fresh, round: 3, store: { ...first.state, 'campaign.lastAttack': fresh } });
    const r3 = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: third.deps });
    expect(r3.ok).toBe(true);
    expect(third.state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ reflexive_antennae: 2 });
    expect(third.state[`${MONSTER}._reflexive_antennae_usedRound`]).toBe(3);
  });
});
