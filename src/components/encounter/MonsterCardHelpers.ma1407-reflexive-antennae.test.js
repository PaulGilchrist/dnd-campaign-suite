// MA-1407 regression: Rust Monster Reflexive Antennae (At Will) gated reaction.
// Gate: RAW campaign lastAttack with the monster as target and hit:true
// (parry MA-0341 hit lineage — PC committed attack rolls stamp top-level
// hit:true); round latch (_reflexive_antennae_usedRound); MONSTER_REACTION_USES
// spend with At Will sentinel (usage:'At Will'+uses:999, MA-0341 shape); the
// ATTACKER makes a DC 11 Dexterity save via the hellish_rebuke MA-0329
// createSaveListener seam minus the damage leg — the Antennae disk row carries
// NO damage dice (object corrosion −1 AC/attack is GM-enforced advisory,
// CLA-325; never fabricate HP damage); refusals log reflexive_antennae_refused
// and spend nothing; the triggering hit is stamped reflexiveAntennaeResolved so
// it cannot refire.
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
    total: 21,
    targetAc: 14,
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

describe('MA-1407 Reflexive Antennae data + registry', () => {
  it('monsters.json rust-monster reactions[0] carries the automation + At Will sentinel', () => {
    expect(RA_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'attacked_by_hit', effect: 'reflexive_antennae', saveType: 'DEX', saveDc: 11, dcSuccess: 'none' });
    expect(RA_ACTION.usage).toBe('At Will');
    expect(RA_ACTION.uses).toBe(999);
    expect(RA_ACTION.maxUses).toBe(999);
    expect(RA_ACTION.name).toBe('Reflexive Antennae');
    expect(RA_ACTION.trigger).toMatch(/attack roll hits the rust monster/);
  });

  it('spec numerics match the Antennae action row on disk (DC 11 Dexterity, NO damage dice)', () => {
    const antennae = RUST.actions.find(a => a.name === 'Antennae');
    expect(antennae.save_dc).toBe(11);
    expect(antennae.save_type).toBe('Dexterity');
    expect(antennae.damage_dice_primary).toBeUndefined();
    const spec = reflexiveAntennaeSpec(RA_ACTION).spec;
    expect(spec.saveDc).toBe(antennae.save_dc);
    expect(spec.saveType).toBe('DEX');
    expect(spec.dcSuccess).toBe('none');
    expect(spec.damageExpression).toBeUndefined();
  });

  it('registry resolves reflexive_antennae; unregistered rows stay byte-inert (null)', () => {
    expect(getGatedMonsterReaction(RA_ACTION)?.effect).toBe('reflexive_antennae');
    expect(getGatedMonsterReaction({ name: 'Bite', description: 'Melee Attack Roll: +3.' })).toBeNull();
    expect(monsterReactionUsesRemaining(RA_ACTION, {})).toBe(999);
    expect(monsterReactionUsesRemaining(RA_ACTION, { reflexive_antennae: 1 })).toBe(998);
  });
});

describe('MA-1407 reflexiveAntennaeGate', () => {
  const g = (lastAttack, overrides = {}) => reflexiveAntennaeGate({ lastAttack, monsterName: MONSTER, currentRound: overrides.round ?? 1, storedUses: overrides.storedUses ?? {}, usedRound: overrides.usedRound ?? 0, action: RA_ACTION });

  it('accepts monster-as-target hit:true (the MA-1407 live byte-shape)', () => {
    expect(g(attackHit())).toMatchObject({ ok: true, used: 0, limit: 999, attackerName: PC });
  });

  it('refuses no lastAttack / monster-not-target', () => {
    expect(g(null).reason).toBe('trigger');
    expect(g(attackHit({ targetName: 'Thug 1' })).reason).toBe('trigger');
  });

  it('refuses a miss (hit not true)', () => {
    expect(g(attackHit({ hit: false })).reason).toBe('miss');
    expect(g({ attackerName: PC, targetName: MONSTER, rollType: 'attack' }).reason).toBe('miss');
  });

  it('refuses same-event refire (reflexiveAntennaeResolved stamp)', () => {
    expect(g(attackHit({ reflexiveAntennaeResolved: true })).reason).toBe('reacted');
  });

  it('refuses absent / self attacker', () => {
    expect(g(attackHit({ attackerName: null })).reason).toBe('attacker');
    expect(g(attackHit({ attackerName: MONSTER })).reason).toBe('attacker');
  });

  it('refuses same-round refire and sentinel exhaustion', () => {
    expect(g(attackHit(), { round: 4, usedRound: 4 }).reason).toBe('round');
    expect(g(attackHit(), { round: 6, usedRound: 5, storedUses: { reflexive_antennae: 999 } }).reason).toBe('uses');
  });

  it('round latch refuses BEFORE uses (same-round spent reads round)', () => {
    expect(g(attackHit(), { round: 3, usedRound: 3, storedUses: { reflexive_antennae: 999 } }).reason).toBe('round');
  });
});

describe('MA-1407 reflexiveAntennaeSpec', () => {
  it('row without authored DC refuses honestly (no baked default)', () => {
    expect(reflexiveAntennaeSpec({ name: 'Reflexive Antennae' }).reason).toBe('dc');
  });
});

describe('MA-1407 resolveMonsterGatedReaction — Reflexive Antennae', () => {
  it('refusal (no qualifying trigger): reflexive_antennae_refused logged, zero spend', async () => {
    const { state, logs, saveCalls, deps } = makeDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('reflexive_antennae_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(saveCalls).toHaveLength(0);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('refusal (miss): refused zero-spend, no save', async () => {
    const { logs, saveCalls, deps } = makeDeps({ lastAttack: attackHit({ hit: false }) });
    const result = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('reflexive_antennae_refused');
    expect(logs[0].description).toMatch(/miss/i);
    expect(saveCalls).toHaveLength(0);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('save FAIL: DC 11 Dex save vs attacker via save seam, corrosion advisory (no damage), spend + latch + stamp + logs', async () => {
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

  it('1-per-trigger honest latch: second click on the same hit refuses, zero extra spend', async () => {
    const first = makeDeps({});
    const r1 = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: first.deps });
    expect(r1.ok).toBe(true);
    const stamped = first.campaignWrites[0];

    const second = makeDeps({ lastAttack: stamped, round: 3, store: { [`${MONSTER}._reflexive_antennae_usedRound`]: 3, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { reflexive_antennae: 1 } } });
    const r2 = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: second.deps });
    expect(r2.ok).toBe(false);
    expect(second.logs[0].automationType).toBe('reflexive_antennae_refused');
    expect(second.logs[0].description).toMatch(/reacted/i);
    expect(second.saveCalls).toHaveLength(0);
    expect(second.state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ reflexive_antennae: 1 });
  });

  it('round-wrap refire on a fresh hit spends again (999→…998→997)', async () => {
    const { state, deps } = makeDeps({
      lastAttack: attackHit({ attackName: 'Fire Bolt' }),
      round: 5,
      store: { [`${MONSTER}._reflexive_antennae_usedRound`]: 4, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { reflexive_antennae: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ reflexive_antennae: 2 });
    expect(state[`${MONSTER}._reflexive_antennae_usedRound`]).toBe(5);
  });

  it('attacker gone (0 HP): refused zero-spend', async () => {
    const { logs, saveCalls, deps } = makeDeps({});
    deps.getCombatContext = vi.fn(async () => ({ round: 1, creatures: [{ name: PC, type: 'player', currentHp: 0 }, { name: MONSTER, type: 'npc', currentHp: 33 }] }));
    const result = await resolveMonsterGatedReaction({ action: RA_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs.some(l => l.automationType === 'reflexive_antennae_refused' && /not an active combatant/.test(l.description))).toBe(true);
    expect(saveCalls).toHaveLength(0);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });
});
