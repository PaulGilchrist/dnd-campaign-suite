// MA-1354 regression: Psychic Gray Ooze Mind Corrosion (At Will) gated reaction.
// Gate: RAW campaign lastAttack with the monster as save-fail target on a
// spell-origin effect (isSpellOriginLastAttack MA-0013 seam) + identifiable
// triggering creature (hellish_rebuke MA-0329 identity lineage); round latch
// (_mind_corrosion_usedRound); MONSTER_REACTION_USES spend with At Will
// sentinel (usage:'At Will'+uses:999, MA-0006/0300/0305); flat 1d6 Psychic on
// the TRIGGERING creature, no save (damage-to-triggerer channel MA-0725/
// MA-1242); refusals log mind_corrosion_refused and spend nothing; the
// triggering save failure is stamped mindCorrosionResolved so it cannot refire.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  mindCorrosionGate,
  mindCorrosionSpec,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const OOZE = monsters.find(m => m.index === 'psychic-gray-ooze');
const MC_ACTION = OOZE.reactions[0];
const MONSTER = 'Psychic Gray Ooze 1';
const PC = 'AberrantSorcerer';
const CAMPAIGN = 'test-campaign';

function spellSaveFailure(overrides = {}) {
  return {
    attackerName: PC,
    targetName: MONSTER,
    attackName: 'Burning Hands',
    rollType: 'attack',
    saveType: 'DEX',
    saveDc: 12,
    saveResult: 'failure',
    damageType: 'Fire',
    primaryDamage: 14,
    actualDamage: 14,
    damageApplied: true,
    ...overrides,
  };
}

function csWithPC(round = 1, triggererHp = 30) {
  return { round, creatures: [{ name: PC, type: 'player', currentHp: triggererHp }, { name: MONSTER, type: 'npc', currentHp: 37 }] };
}

function makeDeps({ lastAttack = spellSaveFailure(), round = 1, store = {}, damage = { total: 4, rolls: [4] }, applyOk = {} } = {}) {
  const state = { ...store };
  const logs = [];
  const campaignWrites = [];
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
      applyDamageToTarget: vi.fn(async (cs, targetName, dmg, types) => {
        applied.push({ targetName, dmg, types });
        return applyOk === false ? null : { newHp: 30 - dmg };
      }),
    },
  };
}

describe('MA-1354 Mind Corrosion data + registry', () => {
  it('monsters.json psychic-gray-ooze reactions[0] carries the automation + At Will sentinel', () => {
    expect(MC_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'fails_save_vs_spell', effect: 'mind_corrosion', damageExpression: '1d6', damageType: 'Psychic' });
    expect(MC_ACTION.usage).toBe('At Will');
    expect(MC_ACTION.uses).toBe(999);
    expect(MC_ACTION.maxUses).toBe(999);
    expect(MC_ACTION.name).toBe('Mind Corrosion');
    expect(MC_ACTION.trigger).toMatch(/fails a saving throw against a spell/);
  });

  it('registry resolves mind_corrosion; unregistered rows stay byte-inert (null)', () => {
    expect(getGatedMonsterReaction(MC_ACTION)?.effect).toBe('mind_corrosion');
    expect(getGatedMonsterReaction({ name: 'Mace', description: 'Hit: 1d6+2 bludgeoning.' })).toBeNull();
    expect(monsterReactionUsesRemaining(MC_ACTION, {})).toBe(999);
    expect(monsterReactionUsesRemaining(MC_ACTION, { mind_corrosion: 1 })).toBe(998);
  });
});

describe('MA-1354 mindCorrosionGate', () => {
  const g = (lastAttack, overrides = {}) => mindCorrosionGate({ lastAttack, monsterName: MONSTER, currentRound: overrides.round ?? 1, storedUses: overrides.storedUses ?? {}, usedRound: overrides.usedRound ?? 0, action: MC_ACTION });

  it('refuses no lastAttack / monster-not-target', () => {
    expect(g(null).reason).toBe('trigger');
    expect(g(spellSaveFailure({ targetName: 'Thug 1' })).reason).toBe('trigger');
  });

  it('refuses non-spell-origin events (weapon hit has no save fields)', () => {
    const weapon = { attackerName: PC, targetName: MONSTER, rollType: 'attack', hit: true, actualDamage: 7 };
    expect(g(weapon).reason).toBe('spell');
  });

  it('refuses a succeeded save', () => {
    expect(g(spellSaveFailure({ saveResult: 'success' })).reason).toBe('save');
  });

  it('refuses same-event refire (mindCorrosionResolved stamp)', () => {
    expect(g(spellSaveFailure({ mindCorrosionResolved: true })).reason).toBe('reacted');
  });

  it('refuses absent / self attacker', () => {
    expect(g(spellSaveFailure({ attackerName: null })).reason).toBe('attacker');
    expect(g(spellSaveFailure({ attackerName: MONSTER })).reason).toBe('attacker');
  });

  it('refuses same-round refire and sentinel exhaustion', () => {
    expect(g(spellSaveFailure({ attackName: 'Toll the Dead' }), { round: 4, usedRound: 4 }).reason).toBe('round');
    const spent = g(spellSaveFailure({ attackName: 'Toll the Dead' }), { round: 6, usedRound: 5, storedUses: { mind_corrosion: 999 } });
    expect(spent.reason).toBe('uses');
  });

  it('allows a fresh spell-origin save failure and reports the triggerer', () => {
    const gate = g(spellSaveFailure(), { round: 2, usedRound: 1 });
    expect(gate).toMatchObject({ ok: true, used: 0, limit: 999, triggererName: PC });
  });

  it('spell-origin fold accepts the spell-save prompt byte-shape (rollType save)', () => {
    const gate = g({ attackerName: PC, targetName: MONSTER, rollType: 'save', saveType: 'DEX', saveDc: 12, saveResult: 'failure' });
    expect(gate.ok).toBe(true);
  });

  it('AoE spell-save byte-shape: saveResult lives ONLY in targetResults (live lastAttack stamp)', () => {
    const aoe = { attackerName: PC, targetName: MONSTER, rollType: 'spell-save', saveType: 'DEX', saveDc: 12, attackScope: 'aoe', targetResults: [{ targetName: MONSTER, saveResult: 'failure', roll: 3, total: -12, appliedDamage: 7 }] };
    expect(g(aoe).ok).toBe(true);
    const passed = { ...aoe, targetResults: [{ targetName: MONSTER, saveResult: 'success', roll: 15, total: 0, appliedDamage: 3 }] };
    expect(g(passed).reason).toBe('save');
  });
});

describe('MA-1354 resolveMonsterGatedReaction — Mind Corrosion', () => {
  it('refusal (no qualifying trigger): mind_corrosion_refused logged, zero spend', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: MC_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('mind_corrosion_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.applyDamageToTarget).not.toHaveBeenCalled();
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('refusal (succeeded save): refused zero-spend, no roll', async () => {
    const { logs, deps } = makeDeps({ lastAttack: spellSaveFailure({ saveResult: 'success' }) });
    const result = await resolveMonsterGatedReaction({ action: MC_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('mind_corrosion_refused');
    expect(logs[0].description).toMatch(/save/);
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('failed spell save: flat 1d6 Psychic at the triggerer (no save), spend + latch + stamp + logs', async () => {
    const { state, logs, campaignWrites, applied, deps } = makeDeps({ round: 3 });
    const result = await resolveMonsterGatedReaction({ action: MC_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.finalDamage).toBe(4);
    expect(deps.rollExpression).toHaveBeenCalledWith('1d6');
    expect(applied[0]).toMatchObject({ targetName: PC, dmg: 4, types: ['Psychic'] });
    expect(state[`${MONSTER}._mind_corrosion_usedRound`]).toBe(3);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ mind_corrosion: 1 });
    expect(campaignWrites[0]).toMatchObject({ mindCorrosionResolved: true, corrodedBy: MONSTER, corrosionTarget: PC, corrosionDamage: 4 });
    const damageLog = logs.find(l => l.type === 'roll' && l.rollType === 'damage');
    expect(damageLog.targetName).toBe(PC);
    expect(damageLog.total).toBe(4);
    expect(damageLog.damageType).toBe('Psychic');
    expect(damageLog.description).toMatch(/no save/);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Mind Corrosion');
    expect(spend.description).toMatch(/4 Psychic damage/);
    expect(spend.description).toMatch(/At Will/);
  });

  it('1-per-trigger honest latch: second click on the same save failure refuses, zero spend', async () => {
    const first = makeDeps({});
    const r1 = await resolveMonsterGatedReaction({ action: MC_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: first.deps });
    expect(r1.ok).toBe(true);
    const stamped = first.campaignWrites[0];

    const second = makeDeps({ lastAttack: stamped, round: 3, store: { [`${MONSTER}._mind_corrosion_usedRound`]: 3, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { mind_corrosion: 1 } } });
    const r2 = await resolveMonsterGatedReaction({ action: MC_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: second.deps });
    expect(r2.ok).toBe(false);
    expect(second.logs[0].automationType).toBe('mind_corrosion_refused');
    expect(second.logs[0].description).toMatch(/reacted/i);
    expect(second.deps.rollExpression).not.toHaveBeenCalled();
    expect(second.state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ mind_corrosion: 1 });
  });

  it('round-wrap refire on a fresh save failure spends again (999→…998→997)', async () => {
    const { state, deps } = makeDeps({
      lastAttack: spellSaveFailure({ attackName: 'Ray of Frost' }),
      round: 5,
      store: { [`${MONSTER}._mind_corrosion_usedRound`]: 4, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { mind_corrosion: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: MC_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ mind_corrosion: 2 });
    expect(state[`${MONSTER}._mind_corrosion_usedRound`]).toBe(5);
  });

  it('triggerer gone (0 HP): refused zero-spend', async () => {
    const { logs, deps } = makeDeps({});
    deps.getCombatContext = vi.fn(async () => ({ round: 1, creatures: [{ name: PC, type: 'player', currentHp: 0 }, { name: MONSTER, type: 'npc', currentHp: 37 }] }));
    const result = await resolveMonsterGatedReaction({ action: MC_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs.some(l => l.automationType === 'mind_corrosion_refused' && /not an active combatant/.test(l.description))).toBe(true);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('row without authored dice refuses honestly (spec read, no baked default)', () => {
    expect(mindCorrosionSpec({ name: 'Mind Corrosion' }).reason).toBe('formula');
    expect(mindCorrosionSpec(MC_ACTION).spec).toEqual({ formula: '1d6', damageType: 'Psychic' });
  });
});
