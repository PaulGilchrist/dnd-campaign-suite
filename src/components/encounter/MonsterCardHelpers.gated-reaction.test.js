// MA-0006 regression: Aarakocra Aeromancer Feather Fall (1/Day) reaction gate.
// Gate: campaign lastAttack trigger:'falling' (CLA-315 seam) + this monster as
// relevant actor; round latch; 1/Day spend with ability_use log; refusals log
// feather_fall_refused and spend nothing. Negation is advisory (CLA-325).
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  monsterReactionGate,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
  isSpellOriginLastAttack,
  resolveCounterspellCheck,
  counterspellGate,
  parryGate,
  parryIdentityRefusal,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const FEATHER_FALL_ACTION = {
  name: 'Feather Fall (1/Day)',
  description: 'The aarakocra casts <strong>Feather Fall</strong> in response to that spell\'s trigger, using the same spellcasting ability as Spellcasting.',
  usage: '1/Day',
  uses: 1,
  maxUses: 1,
  automation: { type: 'reaction', trigger: 'falling', effect: 'feather_fall' },
};

const MONSTER = 'Aarakocra Aeromancer 1';
const CAMPAIGN = 'test-campaign';

function fallingAttack(overrides = {}) {
  return { trigger: 'falling', attackerName: MONSTER, targetName: MONSTER, ...overrides };
}

function makeDeps({ lastAttack = null, round = 1, store = {} } = {}) {
  const state = { ...store };
  const logs = [];
  return {
    state,
    logs,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => ({ round })),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => { state[`${key}.${prop}`] = value; }),
      addEntry: vi.fn(async (campaign, entry) => { logs.push(entry); }),
    },
  };
}

describe('MA-0006 gated monster reaction registry', () => {
  it('recognises the feather_fall automation row and ignores plain rows', () => {
    expect(getGatedMonsterReaction(FEATHER_FALL_ACTION)?.effect).toBe('feather_fall');
    expect(getGatedMonsterReaction({ name: 'Mace', description: 'Hit: 1d6+2 bludgeoning.' })).toBeNull();
  });

  it('monsters.json carries the uses field + automation on reactions[0]', () => {
    const monster = monsters.find(m => m.index === 'aarakocra-aeromancer');
    const reaction = monster.reactions[0];
    expect(reaction.automation).toMatchObject({ type: 'reaction', trigger: 'falling', effect: 'feather_fall' });
    expect(reaction.maxUses).toBe(1);
    expect(reaction.usage).toBe('1/Day');
  });

  it('computes remaining uses', () => {
    expect(monsterReactionUsesRemaining(FEATHER_FALL_ACTION, {})).toBe(1);
    expect(monsterReactionUsesRemaining(FEATHER_FALL_ACTION, { feather_fall: 1 })).toBe(0);
    expect(monsterReactionUsesRemaining({ name: 'Plain' }, {})).toBeNull();
  });
});

describe('MA-0006 monsterReactionGate refusals', () => {
  const def = getGatedMonsterReaction(FEATHER_FALL_ACTION);

  it('refuses when no falling lastAttack exists', () => {
    const gate = monsterReactionGate({ def, action: FEATHER_FALL_ACTION, monsterName: MONSTER, lastAttack: null, currentRound: 1, storedUses: {}, usedRound: 0 });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('trigger');
  });

  it('refuses a non-falling lastAttack (CLA-315: weapon attacks must not satisfy falling)', () => {
    const gate = monsterReactionGate({ def, action: FEATHER_FALL_ACTION, monsterName: MONSTER, lastAttack: { trigger: 'hit', attackerName: 'Thug 1', targetName: MONSTER }, currentRound: 1, storedUses: {}, usedRound: 0 });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('trigger');
  });

  it('refuses when this monster is not the falling actor', () => {
    const gate = monsterReactionGate({ def, action: FEATHER_FALL_ACTION, monsterName: MONSTER, lastAttack: fallingAttack({ attackerName: 'Other 1', targetName: 'Other 1' }), currentRound: 1, storedUses: {}, usedRound: 0 });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('actor');
  });

  it('refuses a second use in the same round (round latch)', () => {
    const gate = monsterReactionGate({ def, action: FEATHER_FALL_ACTION, monsterName: MONSTER, lastAttack: fallingAttack(), currentRound: 3, storedUses: {}, usedRound: 3 });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('round');
  });

  it('refuses at 1/Day exhaustion even in a fresh round', () => {
    const gate = monsterReactionGate({ def, action: FEATHER_FALL_ACTION, monsterName: MONSTER, lastAttack: fallingAttack(), currentRound: 2, storedUses: { feather_fall: 1 }, usedRound: 1 });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('uses');
  });

  it('allows a fresh falling trigger for the relevant actor', () => {
    const gate = monsterReactionGate({ def, action: FEATHER_FALL_ACTION, monsterName: MONSTER, lastAttack: fallingAttack(), currentRound: 1, storedUses: {}, usedRound: 0 });
    expect(gate.ok).toBe(true);
    expect(gate.limit).toBe(1);
  });
});

describe('MA-0006 resolveMonsterGatedReaction spend + refusal logging', () => {
  it('refusal (no falling event): feather_fall_refused logged, zero spend', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: FEATHER_FALL_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('feather_fall_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('refusal (wrong actor): feather_fall_refused logged, zero spend', async () => {
    const { logs, deps } = makeDeps({ lastAttack: fallingAttack({ attackerName: 'Goblin 1', targetName: 'Goblin 1' }) });
    const result = await resolveMonsterGatedReaction({ action: FEATHER_FALL_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('feather_fall_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('success: round latch + 1/Day spend written, ability_use log names Feather Fall', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: fallingAttack(), round: 4 });
    const result = await resolveMonsterGatedReaction({ action: FEATHER_FALL_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(state[`${MONSTER}._feather_fall_usedRound`]).toBe(4);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 1 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend).toBeTruthy();
    expect(spend.abilityName).toBe('Feather Fall');
    expect(spend.description).toMatch(/GM-enforced for monsters/);
    expect(spend.description).toMatch(/0 left today/);
  });

  it('same-round second click refuses with zero additional spend', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: fallingAttack(), round: 4, store: { [`${MONSTER}._feather_fall_usedRound`]: 4, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { feather_fall: 1 } } });
    const result = await resolveMonsterGatedReaction({ action: FEATHER_FALL_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('feather_fall_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 1 });
  });

  it('next-day/next-round click at spent uses refuses 1/Day (no phantom spend)', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: fallingAttack(), round: 7, store: { [`${MONSTER}._feather_fall_usedRound`]: 4, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { feather_fall: 1 } } });
    const result = await resolveMonsterGatedReaction({ action: FEATHER_FALL_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('feather_fall_refused');
    expect(logs[0].description).toMatch(/1\/Day/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 1 });
  });
});

// MA-0013: Aberrant Cultist Counterspell (2/Day). Reactive gate on a
// spell-origin campaign lastAttack by a PC attacker; RAW level <3 auto,
// ≥3 d20+WIS(+4) vs DC 10+level (CLA-322 shape); 2/Day spend; refusals
// log counterspell_refused zero-spend; the triggering cast is stamped
// counterspellResolved so the same cast can't be double-countered.
const COUNTERSPELL_ACTION = monsters.find(m => m.index === 'aberrant-cultist').reactions[0];
const CULTIST = 'Aberrant Cultist 1';
const PC = 'DivinationWizard';

function pcSpellAttack(overrides = {}) {
  return { attackerName: PC, targetName: CULTIST, attackName: 'Fire Bolt', rollType: 'attack', damageSchool: 'Evocation', isCantrip: true, ...overrides };
}

function csWithPC(round = 1) {
  return { round, creatures: [{ name: PC, type: 'player' }, { name: CULTIST, type: 'npc' }] };
}

function makeCounterDeps({ lastAttack = pcSpellAttack(), round = 1, store = {}, d20 = 1, resolveSpellLevel } = {}) {
  const state = { ...store };
  const logs = [];
  const campaignWrites = [];
  return {
    state,
    logs,
    campaignWrites,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => csWithPC(round)),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
      rollD20: vi.fn(() => d20),
      spellAbilityMod: 4,
      resolveSpellLevel: resolveSpellLevel || vi.fn(async la => (la?.isCantrip ? 0 : 3)),
    },
  };
}

describe('MA-0013 Counterspell registry + pure check', () => {
  it('monsters.json aberrant-cultist reactions[0] carries the automation + 2/Day shape', () => {
    expect(COUNTERSPELL_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(COUNTERSPELL_ACTION.uses).toBe(2);
    expect(COUNTERSPELL_ACTION.maxUses).toBe(2);
    expect(getGatedMonsterReaction(COUNTERSPELL_ACTION)?.effect).toBe('counterspell');
  });

  it('isSpellOriginLastAttack accepts spell-save, spell-attack, isSpellDamage and stamped spell school', () => {
    expect(isSpellOriginLastAttack(null)).toBe(false);
    expect(isSpellOriginLastAttack({ rollType: 'save', isSpellDamage: true })).toBe(true);
    expect(isSpellOriginLastAttack({ attackType: 'spell', spellLevel: 3 })).toBe(true);
    expect(isSpellOriginLastAttack(pcSpellAttack())).toBe(true);
    expect(isSpellOriginLastAttack({ attackerName: PC, attackName: 'Mace', weaponType: 'melee' })).toBe(false);
  });

  it('resolveCounterspellCheck: level <3 auto-counters (no roll)', () => {
    const r = resolveCounterspellCheck({ spellLevel: 0, abilityMod: 4, rollD20: () => 1 });
    expect(r).toMatchObject({ auto: true, countered: true, spellLevel: 0 });
    const r2 = resolveCounterspellCheck({ spellLevel: 2, abilityMod: 0, rollD20: () => 1 });
    expect(r2.auto).toBe(true);
    expect(r2.countered).toBe(true);
  });

  it('resolveCounterspellCheck: level >=3 uses d20+WIS vs DC 10+level (CLA-322)', () => {
    const hit = resolveCounterspellCheck({ spellLevel: 3, abilityMod: 4, rollD20: () => 9 });
    expect(hit).toMatchObject({ auto: false, total: 13, targetDC: 13, countered: true });
    const miss = resolveCounterspellCheck({ spellLevel: 3, abilityMod: 4, rollD20: () => 8 });
    expect(miss).toMatchObject({ total: 12, targetDC: 13, countered: false });
  });

  it('counterspellGate refuses a non-spell or monster-origin lastAttack', () => {
    const g1 = counterspellGate({ lastAttack: { attackerName: PC, attackName: 'Mace' }, attackerIsPC: true, monsterName: CULTIST, currentRound: 1, storedUses: {}, usedRound: 0, action: COUNTERSPELL_ACTION });
    expect(g1.reason).toBe('trigger');
    const g2 = counterspellGate({ lastAttack: pcSpellAttack({ attackerName: 'Thug 1' }), attackerIsPC: false, monsterName: CULTIST, currentRound: 1, storedUses: {}, usedRound: 0, action: COUNTERSPELL_ACTION });
    expect(g2.reason).toBe('trigger');
  });
});

describe('MA-0013 resolveMonsterGatedReaction — Counterspell', () => {
  it('cantrip (<3) auto-countered, 2→1 spend, counterspell log names the trigger spell, cast marked resolved', async () => {
    const { state, logs, campaignWrites, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 0 }) });
    const result = await resolveMonsterGatedReaction({ action: COUNTERSPELL_ACTION, monsterName: CULTIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(true);
    expect(state[`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Counterspell');
    expect(spend.description).toMatch(/Fire Bolt/);
    expect(spend.description).toMatch(/auto-countered/);
    expect(spend.description).toMatch(/1 left today/);
    expect(campaignWrites[0]).toMatchObject({ counterspellResolved: true, counteredBy: CULTIST, counteredSpell: 'Fire Bolt' });
    expect(deps.rollD20).not.toHaveBeenCalled();
  });

  it('level >=3 failed check: reaction is spent, spell NOT countered, check logged vs DC', async () => {
    const { state, logs, campaignWrites, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 3, isCantrip: false }), d20: 1 });
    const result = await resolveMonsterGatedReaction({ action: COUNTERSPELL_ACTION, monsterName: CULTIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(false);
    expect(state[`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
    const spend = logs.find(l => l.abilityName === 'Counterspell');
    expect(spend.description).toMatch(/d20 \(1\) \+ 4 = 5 vs DC 13/);
    expect(spend.description).toMatch(/failed — spell resolves/);
    expect(campaignWrites[0]).toMatchObject({ counterspellResolved: true, counterspellCheckFailed: true });
  });

  it('second click on the SAME resolved cast: counterspell_refused (countered), zero additional spend', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0, counterspellResolved: true }),
      store: { [`${CULTIST}._counterspell_usedRound`]: 1, [`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: COUNTERSPELL_ACTION, monsterName: CULTIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(logs[0].description).toMatch(/countered|resolved/);
    expect(state[`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
  });

  it('no spell lastAttack: counterspell_refused (trigger), zero spend', async () => {
    const { state, logs, deps } = makeCounterDeps({ lastAttack: { attackerName: PC, attackName: 'Mace', weaponType: 'melee' } });
    const result = await resolveMonsterGatedReaction({ action: COUNTERSPELL_ACTION, monsterName: CULTIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(logs[0].description).toMatch(/trigger/);
    expect(state[`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('at 2/Day exhaustion a fresh PC spell still refuses with zero spend', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 5,
      store: { [`${CULTIST}._counterspell_usedRound`]: 2, [`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 2 } },
    });
    const result = await resolveMonsterGatedReaction({ action: COUNTERSPELL_ACTION, monsterName: CULTIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(logs[0].description).toMatch(/2\/Day/);
    expect(state[`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 2 });
  });
});

// MA-0341: Bandit Captain Parry — gated melee-defense reaction. RAW trigger:
// hit by a melee attack roll while wielding a weapon (equip GM-enforced);
// response +2 AC vs THAT attack. Gate keys off campaign lastAttack identity
// (melee weaponType, this monster as target, hit:true, damage NOT applied,
// not already parried) + 1/round latch. At Will sentinel (uses:999) — press
// stamps an activeBuffs +2 AC entry (never spends MONSTER_REACTION_USES) and
// marks the lastAttack parryResolved; refusals log parry_refused zero-write.
const PARRY_ACTION = monsters.find(m => m.index === 'bandit-captain').reactions[0];
const CAPTAIN = 'Bandit Captain 1';
const SLASHER = 'ElderPaladin';

function meleeHitOnCaptain(overrides = {}) {
  return { attackerName: SLASHER, targetName: CAPTAIN, attackName: 'Longsword', rollType: 'attack', weaponType: 'melee', hit: true, d20: 17, bonus: 5, total: 22, targetAc: 15, effectiveAc: 15, damageApplied: undefined, ...overrides };
}

function csWithCaptain(round = 1) {
  return { round, creatures: [{ name: SLASHER, type: 'player' }, { name: CAPTAIN, type: 'npc' }] };
}

function makeParryDeps({ lastAttack = meleeHitOnCaptain(), round = 1, store = {} } = {}) {
  const state = { ...store };
  const logs = [];
  const campaignWrites = [];
  return {
    state,
    logs,
    campaignWrites,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => csWithCaptain(round)),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
    },
  };
}

describe('MA-0341 Parry registry + row shape', () => {
  it('monsters.json bandit-captain reactions[0] carries the automation + At Will sentinel', () => {
    expect(PARRY_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus: 2 });
    expect(PARRY_ACTION.usage).toBe('At Will');
    expect(PARRY_ACTION.uses).toBe(999);
    expect(PARRY_ACTION.maxUses).toBe(999);
    expect(getGatedMonsterReaction(PARRY_ACTION)?.effect).toBe('parry');
    expect(getGatedMonsterReaction({ name: 'Scimitar', description: 'Hit: 1d6+5 slashing.' })).toBeNull();
  });
});

describe('MA-0341 parryGate RAW identity refusals', () => {
  it('refuses no lastAttack (trigger) and non-melee attacks (melee)', () => {
    expect(parryIdentityRefusal(null, CAPTAIN)).toBe('trigger');
    expect(parryIdentityRefusal({ ...meleeHitOnCaptain(), rollType: 'save' }, CAPTAIN)).toBe('trigger');
    expect(parryIdentityRefusal({ ...meleeHitOnCaptain(), weaponType: 'ranged' }, CAPTAIN)).toBe('melee');
    const g = parryGate({ lastAttack: meleeHitOnCaptain({ weaponType: 'ranged' }), monsterName: CAPTAIN, currentRound: 1, storedUses: {}, usedRound: 0, action: PARRY_ACTION });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe('melee');
  });

  it('refuses spell-origin attacks even when weaponType falls back to melee (MA-0245 stamp guard)', () => {
    expect(parryIdentityRefusal({ ...meleeHitOnCaptain(), damageSchool: 'Evocation', isCantrip: true }, CAPTAIN)).toBe('spell');
    expect(parryIdentityRefusal({ ...meleeHitOnCaptain(), attackType: 'spell' }, CAPTAIN)).toBe('spell');
    const g = parryGate({ lastAttack: { ...meleeHitOnCaptain(), damageSchool: 'Evocation' }, monsterName: CAPTAIN, currentRound: 1, storedUses: {}, usedRound: 0, action: PARRY_ACTION });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe('spell');
  });

  it('refuses wrong target, a miss, committed damage, and an already-parried attack', () => {
    expect(parryIdentityRefusal(meleeHitOnCaptain({ targetName: 'Thug 1' }), CAPTAIN)).toBe('trigger');
    expect(parryIdentityRefusal(meleeHitOnCaptain({ hit: false }), CAPTAIN)).toBe('miss');
    expect(parryIdentityRefusal(meleeHitOnCaptain({ damageApplied: true, actualDamage: 8 }), CAPTAIN)).toBe('resolved');
    expect(parryIdentityRefusal(meleeHitOnCaptain({ parryResolved: true }), CAPTAIN)).toBe('reacted');
    expect(parryIdentityRefusal(meleeHitOnCaptain({ attackerName: CAPTAIN }), CAPTAIN)).toBe('attacker');
  });

  it('accepts the unresolved melee hit and reports the attacker', () => {
    const g = parryGate({ lastAttack: meleeHitOnCaptain(), monsterName: CAPTAIN, currentRound: 4, storedUses: {}, usedRound: 0, action: PARRY_ACTION });
    expect(g.ok).toBe(true);
    expect(g.attackerName).toBe(SLASHER);
    expect(g.limit).toBe(999);
  });

  it('1/round latch: refuses a second press in the same round, re-arms next round', () => {
    const same = parryGate({ lastAttack: meleeHitOnCaptain(), monsterName: CAPTAIN, currentRound: 4, storedUses: {}, usedRound: 4, action: PARRY_ACTION });
    expect(same.ok).toBe(false);
    expect(same.reason).toBe('round');
    const next = parryGate({ lastAttack: meleeHitOnCaptain(), monsterName: CAPTAIN, currentRound: 5, storedUses: {}, usedRound: 4, action: PARRY_ACTION });
    expect(next.ok).toBe(true);
  });
});

describe('MA-0341 resolveMonsterGatedReaction — Parry', () => {
  it('refusal (no melee hit): parry_refused logged, zero writes', async () => {
    const { state, logs, deps } = makeParryDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: PARRY_ACTION, monsterName: CAPTAIN, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('parry_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${CAPTAIN}.activeBuffs`]).toBeUndefined();
    expect(state[`${CAPTAIN}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('refusal (damage already applied): parry_refused (resolved), zero writes', async () => {
    const { logs, deps } = makeParryDeps({ lastAttack: meleeHitOnCaptain({ damageApplied: true, actualDamage: 8 }) });
    const result = await resolveMonsterGatedReaction({ action: PARRY_ACTION, monsterName: CAPTAIN, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('parry_refused');
    expect(logs[0].description).toMatch(/resolved/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('success: activeBuffs +2 AC stamp + round latch + lastAttack parryResolved + ability_use log, At Will never spends MONSTER_REACTION_USES', async () => {
    const { state, logs, campaignWrites, deps } = makeParryDeps({ round: 6 });
    const result = await resolveMonsterGatedReaction({ action: PARRY_ACTION, monsterName: CAPTAIN, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(2);
    expect(result.newAc).toBe(17);
    const buffs = state[`${CAPTAIN}.activeBuffs`];
    expect(Array.isArray(buffs)).toBe(true);
    expect(buffs.some(b => b.effect === 'parry' && b.acBonus === 2)).toBe(true);
    expect(state[`${CAPTAIN}._parry_usedRound`]).toBe(6);
    expect(campaignWrites[0]).toMatchObject({ parryResolved: true, parriedBy: CAPTAIN, parryAcBonus: 2 });
    expect(state[`${CAPTAIN}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Parry');
    expect(spend.description).toMatch(/AC 15 → 17/);
    expect(spend.description).toMatch(/At Will/);
    expect(spend.description).toMatch(/GM-enforced/);
  });

  it('same-round second press on the same attack: parry_refused (round/reacted), zero additional writes', async () => {
    const { logs, deps } = makeParryDeps({
      round: 6,
      lastAttack: meleeHitOnCaptain({ parryResolved: true, parriedBy: CAPTAIN }),
      store: { [`${CAPTAIN}._parry_usedRound`]: 6, [`${CAPTAIN}.activeBuffs`]: [{ effect: 'parry', acBonus: 2 }] },
    });
    const result = await resolveMonsterGatedReaction({ action: PARRY_ACTION, monsterName: CAPTAIN, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('parry_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });
});

// MA-0565: Death Knight Parry — MA-0341 routine DATA twin. Disk reactions[0]
// prose-only (name/trigger/description) = gate-null inert; fix authors the
// MA-0341 byte-shape with acBonus 6 (RAW: +6 AC vs the triggering melee hit).
const DEATH_KNIGHT_ACTION = monsters.find(m => m.index === 'death-knight').reactions[0];
const KNIGHT = 'Death Knight 1';

describe('MA-0565 Death Knight Parry — data-lock + acBonus 6', () => {
  it('monsters.json death-knight reactions[0] carries the automation + At Will sentinel (MA-0341 byte-shape, acBonus 6)', () => {
    expect(DEATH_KNIGHT_ACTION.name).toBe('Parry');
    expect(DEATH_KNIGHT_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus: 6 });
    expect(DEATH_KNIGHT_ACTION.usage).toBe('At Will');
    expect(DEATH_KNIGHT_ACTION.uses).toBe(999);
    expect(DEATH_KNIGHT_ACTION.maxUses).toBe(999);
    expect(getGatedMonsterReaction(DEATH_KNIGHT_ACTION)?.effect).toBe('parry');
  });

  it('gate accepts unresolved melee hit on the knight and refuses a 2nd same-round press', () => {
    const hit = { attackerName: 'Bandit 1', targetName: KNIGHT, attackName: 'Scimitar', rollType: 'attack', weaponType: 'melee', hit: true, d20: 12, bonus: 9, total: 21, targetAc: 20, effectiveAc: 20 };
    const g = parryGate({ lastAttack: hit, monsterName: KNIGHT, currentRound: 3, storedUses: {}, usedRound: 0, action: DEATH_KNIGHT_ACTION });
    expect(g.ok).toBe(true);
    expect(g.limit).toBe(999);
    const again = parryGate({ lastAttack: hit, monsterName: KNIGHT, currentRound: 3, storedUses: {}, usedRound: 3, action: DEATH_KNIGHT_ACTION });
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('round');
  });

  it('resolve: +6 AC stamp, AC 20 → 26 flips the nat-flush hit to miss, At Will never spends uses', async () => {
    const hit = { attackerName: 'Bandit 1', targetName: KNIGHT, attackName: 'Scimitar', rollType: 'attack', weaponType: 'melee', hit: true, d20: 12, bonus: 9, total: 21, targetAc: 20, effectiveAc: 20 };
    const { state, logs, campaignWrites, deps } = makeParryDeps({ lastAttack: hit, round: 3 });
    const result = await resolveMonsterGatedReaction({ action: DEATH_KNIGHT_ACTION, monsterName: KNIGHT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(6);
    expect(result.newAc).toBe(26);
    expect(result.newAc).toBeGreaterThan(hit.total);
    expect(state[`${KNIGHT}.activeBuffs`].some(b => b.effect === 'parry' && b.acBonus === 6)).toBe(true);
    expect(state[`${KNIGHT}._parry_usedRound`]).toBe(3);
    expect(campaignWrites[0]).toMatchObject({ parryResolved: true, parriedBy: KNIGHT, parryAcBonus: 6 });
    expect(state[`${KNIGHT}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    expect(logs.find(l => l.type === 'ability_use').description).toMatch(/AC 20 → 26/);
  });
});

// MA-0573: Death Knight Aspirant Parry — MA-0565 routine DATA twin. Disk
// reactions[0] was prose-only = gate-null inert; fix authors the MA-0341
// byte-shape with acBonus 4 (RAW: +4 AC vs the triggering melee hit).
const ASPIRANT_ACTION = monsters.find(m => m.index === 'death-knight-aspirant').reactions[0];
const ASPIRANT = 'Death Knight Aspirant 1';

describe('MA-0573 Death Knight Aspirant Parry — data-lock + acBonus 4', () => {
  it('monsters.json death-knight-aspirant reactions[0] carries the automation + At Will sentinel (MA-0341 byte-shape, acBonus 4)', () => {
    expect(ASPIRANT_ACTION.name).toBe('Parry');
    expect(ASPIRANT_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus: 4 });
    expect(ASPIRANT_ACTION.usage).toBe('At Will');
    expect(ASPIRANT_ACTION.uses).toBe(999);
    expect(ASPIRANT_ACTION.maxUses).toBe(999);
    expect(getGatedMonsterReaction(ASPIRANT_ACTION)?.effect).toBe('parry');
  });

  it('gate accepts unresolved melee hit on the aspirant and refuses a 2nd same-round press', () => {
    const hit = { attackerName: 'Bandit 1', targetName: ASPIRANT, attackName: 'Scimitar', rollType: 'attack', weaponType: 'melee', hit: true, d20: 12, bonus: 9, total: 21, targetAc: 20, effectiveAc: 20 };
    const g = parryGate({ lastAttack: hit, monsterName: ASPIRANT, currentRound: 3, storedUses: {}, usedRound: 0, action: ASPIRANT_ACTION });
    expect(g.ok).toBe(true);
    expect(g.limit).toBe(999);
    const again = parryGate({ lastAttack: hit, monsterName: ASPIRANT, currentRound: 3, storedUses: {}, usedRound: 3, action: ASPIRANT_ACTION });
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('round');
  });

  it('resolve: +4 AC stamp, AC 20 → 24 flips the nat-flush hit to miss, At Will never spends uses', async () => {
    const hit = { attackerName: 'Bandit 1', targetName: ASPIRANT, attackName: 'Scimitar', rollType: 'attack', weaponType: 'melee', hit: true, d20: 12, bonus: 9, total: 21, targetAc: 20, effectiveAc: 20 };
    const { state, logs, campaignWrites, deps } = makeParryDeps({ lastAttack: hit, round: 3 });
    const result = await resolveMonsterGatedReaction({ action: ASPIRANT_ACTION, monsterName: ASPIRANT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(4);
    expect(result.newAc).toBe(24);
    expect(result.newAc).toBeGreaterThan(hit.total);
    expect(state[`${ASPIRANT}.activeBuffs`].some(b => b.effect === 'parry' && b.acBonus === 4)).toBe(true);
    expect(state[`${ASPIRANT}._parry_usedRound`]).toBe(3);
    expect(campaignWrites[0]).toMatchObject({ parryResolved: true, parriedBy: ASPIRANT, parryAcBonus: 4 });
    expect(state[`${ASPIRANT}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    expect(logs.find(l => l.type === 'ability_use').description).toMatch(/AC 20 → 24/);
  });
});

// MA-0643: Drow Elite Warrior Parry — MA-0341 routine DATA twin. Disk
// reactions[0] was prose-only = gate-null inert; fix authors the MA-0341
// byte-shape with acBonus 3 (RAW: +3 AC vs the triggering melee hit).
const DROW_ACTION = monsters.find(m => m.index === 'drow-elite-warrior').reactions[0];
const DROW = 'Drow Elite Warrior 1';

describe('MA-0643 Drow Elite Warrior Parry — data-lock + acBonus 3', () => {
  it('monsters.json drow-elite-warrior reactions[0] carries the automation + At Will sentinel (MA-0341 byte-shape, acBonus 3)', () => {
    expect(DROW_ACTION.name).toBe('Parry');
    expect(DROW_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus: 3 });
    expect(DROW_ACTION.usage).toBe('At Will');
    expect(DROW_ACTION.uses).toBe(999);
    expect(DROW_ACTION.maxUses).toBe(999);
    expect(getGatedMonsterReaction(DROW_ACTION)?.effect).toBe('parry');
  });

  it('gate accepts unresolved melee hit on the drow and refuses a 2nd same-round press', () => {
    const hit = { attackerName: 'Gladiator 1', targetName: DROW, attackName: 'Spear', rollType: 'attack', weaponType: 'melee', hit: true, d20: 12, bonus: 7, total: 19, targetAc: 18, effectiveAc: 18 };
    const g = parryGate({ lastAttack: hit, monsterName: DROW, currentRound: 3, storedUses: {}, usedRound: 0, action: DROW_ACTION });
    expect(g.ok).toBe(true);
    expect(g.limit).toBe(999);
    const again = parryGate({ lastAttack: hit, monsterName: DROW, currentRound: 3, storedUses: {}, usedRound: 3, action: DROW_ACTION });
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('round');
  });

  it('resolve: +3 AC stamp, AC 18 → 21 flips the 18-20 window hit to miss, At Will never spends uses', async () => {
    const hit = { attackerName: 'Gladiator 1', targetName: DROW, attackName: 'Spear', rollType: 'attack', weaponType: 'melee', hit: true, d20: 12, bonus: 7, total: 19, targetAc: 18, effectiveAc: 18 };
    const { state, logs, campaignWrites, deps } = makeParryDeps({ lastAttack: hit, round: 3 });
    const result = await resolveMonsterGatedReaction({ action: DROW_ACTION, monsterName: DROW, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(3);
    expect(result.newAc).toBe(21);
    expect(result.newAc).toBeGreaterThan(hit.total);
    expect(state[`${DROW}.activeBuffs`].some(b => b.effect === 'parry' && b.acBonus === 3)).toBe(true);
    expect(state[`${DROW}._parry_usedRound`]).toBe(3);
    expect(campaignWrites[0]).toMatchObject({ parryResolved: true, parriedBy: DROW, parryAcBonus: 3 });
    expect(state[`${DROW}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    expect(logs.find(l => l.type === 'ability_use').description).toMatch(/AC 18 → 21/);
  });
});
