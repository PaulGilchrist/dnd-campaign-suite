// @maintained-by-ai
// Gated monster reaction COMPUTATION owner (MA-0006 feather_fall archetype, MA-0013
// counterspell, MA-0341 parry gate + MA-0681 elemental_absorption): trigger identity,
// actor, round latch (initiative seam, never a wall-clock timer), uses arithmetic,
// spend/refusal logs. Chip press + card rendering are component lane #417 — computation
// only here. Standing rec #417/#500: the file keeps ONE getGatedMonsterReaction(plainRow)
// →null leg (feather_fall registry test below; the MA-0341 :360 and MA-0681 :640 twins
// are deleted). Parry DATA twins (MA-0565/0573/0643/0702/0869/0997/1048/1140/1236/1238)
// fold into one it.each locking each monster's authored acBonus end-to-end.
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
  elementalAbsorptionGate,
  elementalAbsorptionIdentityRefusal,
  elementalAbsorptionMatchedType,
  resolveMonsterElementalAbsorption,
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
  it('feather_fall row arms, plain rows inert; uses arithmetic fresh/spent/plain', () => {
    expect(getGatedMonsterReaction(FEATHER_FALL_ACTION)?.effect).toBe('feather_fall');
    // #417: the ONLY getGatedMonsterReaction(plainRow)→null leg file-wide
    // (old MA-0341 :360 Scimitar and MA-0681 :640 Scimitar duplicates deleted per #500).
    expect(getGatedMonsterReaction({ name: 'Mace', description: 'Hit: 1d6+2 bludgeoning.' })).toBeNull();
    expect(monsterReactionUsesRemaining(FEATHER_FALL_ACTION, {})).toBe(1);
    expect(monsterReactionUsesRemaining(FEATHER_FALL_ACTION, { feather_fall: 1 })).toBe(0);
    expect(monsterReactionUsesRemaining({ name: 'Plain' }, {})).toBeNull();
  });

  it('monsters.json carries the uses field + automation on reactions[0]', () => {
    const monster = monsters.find(m => m.index === 'aarakocra-aeromancer');
    const reaction = monster.reactions[0];
    expect(reaction.automation).toMatchObject({ type: 'reaction', trigger: 'falling', effect: 'feather_fall' });
    expect(reaction.maxUses).toBe(1);
    expect(reaction.usage).toBe('1/Day');
  });
});

describe('MA-0006 monsterReactionGate truth table', () => {
  const def = getGatedMonsterReaction(FEATHER_FALL_ACTION);

  it('refuses trigger/trigger/actor/round/uses; allows fresh falling trigger', () => {
    const rows = [
      ['trigger: no lastAttack', null, 1, {}, 0, 'trigger'],
      ['trigger: non-falling lastAttack (CLA-315)', { trigger: 'hit', attackerName: 'Thug 1', targetName: MONSTER }, 1, {}, 0, 'trigger'],
      ['actor: another monster is falling', fallingAttack({ attackerName: 'Other 1', targetName: 'Other 1' }), 1, {}, 0, 'actor'],
      ['round: second use same round (latch)', fallingAttack(), 3, {}, 3, 'round'],
      ['uses: 1/Day exhausted fresh round', fallingAttack(), 2, { feather_fall: 1 }, 1, 'uses'],
    ];
    for (const [label, lastAttack, round, uses, usedRound, reason] of rows) {
      const gate = monsterReactionGate({ def, action: FEATHER_FALL_ACTION, monsterName: MONSTER, lastAttack, currentRound: round, storedUses: uses, usedRound });
      expect(gate.ok, label).toBe(false);
      expect(gate.reason, label).toBe(reason);
    }
    const ok = monsterReactionGate({ def, action: FEATHER_FALL_ACTION, monsterName: MONSTER, lastAttack: fallingAttack(), currentRound: 1, storedUses: {}, usedRound: 0 });
    expect(ok.ok).toBe(true);
    expect(ok.limit).toBe(1);
  });
});

describe('MA-0006 resolveMonsterGatedReaction spend + refusal logging', () => {
  it('refusals log feather_fall_refused with zero spend (no event / round latch / 1/Day)', async () => {
    const scenarios = [
      ['no falling event', {}, undefined, undefined],
      ['same-round second click (round latch)', { lastAttack: fallingAttack(), round: 4, store: { [`${MONSTER}._feather_fall_usedRound`]: 4, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { feather_fall: 1 } } }, { feather_fall: 1 }, undefined],
      ['fresh round at spent uses refuses 1/Day (no phantom spend)', { lastAttack: fallingAttack(), round: 7, store: { [`${MONSTER}._feather_fall_usedRound`]: 4, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { feather_fall: 1 } } }, { feather_fall: 1 }, /1\/Day/],
    ];
    for (const [label, opts, expectedUses, descRe] of scenarios) {
      const { state, logs, deps } = makeDeps(opts);
      const result = await resolveMonsterGatedReaction({ action: FEATHER_FALL_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
      expect(result.ok, label).toBe(false);
      expect(logs, label).toHaveLength(1);
      expect(logs[0].automationType, label).toBe('feather_fall_refused');
      if (descRe) expect(logs[0].description, label).toMatch(descRe);
      expect(deps.setRuntimeValue, label).not.toHaveBeenCalled();
      expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`], label).toEqual(expectedUses);
    }
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
  it('monsters.json aberrant-cultist reactions[0] data-lock arms the gate', () => {
    expect(COUNTERSPELL_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(COUNTERSPELL_ACTION.uses).toBe(2);
    expect(COUNTERSPELL_ACTION.maxUses).toBe(2);
    expect(getGatedMonsterReaction(COUNTERSPELL_ACTION)?.effect).toBe('counterspell');
  });

  it('isSpellOriginLastAttack truth table: spell origins true, null/weapon false', () => {
    const rows = [
      [null, false],
      [{ rollType: 'save', isSpellDamage: true }, true],
      [{ attackType: 'spell', spellLevel: 3 }, true],
      [pcSpellAttack(), true],
      [{ attackerName: PC, attackName: 'Mace', weaponType: 'melee' }, false],
    ];
    for (const [la, expected] of rows) {
      expect(isSpellOriginLastAttack(la), JSON.stringify(la)).toBe(expected);
    }
  });

  it('resolveCounterspellCheck: <3 auto-counters no roll; >=3 d20+WIS vs DC 10+level (CLA-322)', () => {
    const auto = resolveCounterspellCheck({ spellLevel: 0, abilityMod: 4, rollD20: () => 1 });
    expect(auto).toMatchObject({ auto: true, countered: true, spellLevel: 0 });
    const auto2 = resolveCounterspellCheck({ spellLevel: 2, abilityMod: 0, rollD20: () => 1 });
    expect(auto2.auto).toBe(true);
    expect(auto2.countered).toBe(true);
    const hit = resolveCounterspellCheck({ spellLevel: 3, abilityMod: 4, rollD20: () => 9 });
    expect(hit).toMatchObject({ auto: false, total: 13, targetDC: 13, countered: true });
    const miss = resolveCounterspellCheck({ spellLevel: 3, abilityMod: 4, rollD20: () => 8 });
    expect(miss).toMatchObject({ total: 12, targetDC: 13, countered: false });
  });

  it('counterspellGate refuses a monster-origin spell cast (attackerIsPC=false)', () => {
    // Non-spell origin (Mace) is the same refusal reason already pinned via
    // isSpellOriginLastAttack above and the resolve-level no-spell row below.
    const g = counterspellGate({ lastAttack: pcSpellAttack({ attackerName: 'Thug 1' }), attackerIsPC: false, monsterName: CULTIST, currentRound: 1, storedUses: {}, usedRound: 0, action: COUNTERSPELL_ACTION });
    expect(g.reason).toBe('trigger');
  });
});

describe('MA-0013 resolveMonsterGatedReaction — Counterspell', () => {
  it('auto (<3) and check (>=3) outcomes: countered/not-countered, spent, stamped, logged', async () => {
    const auto = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 0 }) });
    const autoResult = await resolveMonsterGatedReaction({ action: COUNTERSPELL_ACTION, monsterName: CULTIST, campaignName: CAMPAIGN, deps: auto.deps });
    expect(autoResult.ok).toBe(true);
    expect(autoResult.countered).toBe(true);
    expect(auto.state[`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
    const autoSpend = auto.logs.find(l => l.type === 'ability_use');
    expect(autoSpend.abilityName).toBe('Counterspell');
    expect(autoSpend.description).toMatch(/Fire Bolt/);
    expect(autoSpend.description).toMatch(/auto-countered/);
    expect(autoSpend.description).toMatch(/1 left today/);
    expect(auto.campaignWrites[0]).toMatchObject({ counterspellResolved: true, counteredBy: CULTIST, counteredSpell: 'Fire Bolt' });
    expect(auto.deps.rollD20).not.toHaveBeenCalled();

    const failed = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 3, isCantrip: false }), d20: 1 });
    const failedResult = await resolveMonsterGatedReaction({ action: COUNTERSPELL_ACTION, monsterName: CULTIST, campaignName: CAMPAIGN, deps: failed.deps });
    expect(failedResult.ok).toBe(true);
    expect(failedResult.countered).toBe(false);
    expect(failed.state[`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
    const failedSpend = failed.logs.find(l => l.abilityName === 'Counterspell');
    expect(failedSpend.description).toMatch(/d20 \(1\) \+ 4 = 5 vs DC 13/);
    expect(failedSpend.description).toMatch(/failed — spell resolves/);
    expect(failed.campaignWrites[0]).toMatchObject({ counterspellResolved: true, counterspellCheckFailed: true });
  });

  it('refusals log counterspell_refused zero-spend (resolved cast / no spell / 2/Day)', async () => {
    const scenarios = [
      ['second click on the SAME resolved cast', { lastAttack: pcSpellAttack({ spellLevel: 0, counterspellResolved: true }), store: { [`${CULTIST}._counterspell_usedRound`]: 1, [`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 1 } } }, { counterspell: 1 }, /countered|resolved/],
      ['no spell lastAttack (trigger)', { lastAttack: { attackerName: PC, attackName: 'Mace', weaponType: 'melee' } }, undefined, /trigger/],
      ['2/Day exhaustion on a fresh PC spell', { lastAttack: pcSpellAttack({ spellLevel: 0 }), round: 5, store: { [`${CULTIST}._counterspell_usedRound`]: 2, [`${CULTIST}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 2 } } }, { counterspell: 2 }, /2\/Day/],
    ];
    for (const [label, opts, expectedUses, descRe] of scenarios) {
      const { state, logs, deps } = makeCounterDeps(opts);
      const result = await resolveMonsterGatedReaction({ action: COUNTERSPELL_ACTION, monsterName: CULTIST, campaignName: CAMPAIGN, deps });
      expect(result.ok, label).toBe(false);
      expect(logs[0].automationType, label).toBe('counterspell_refused');
      expect(logs[0].description, label).toMatch(descRe);
      expect(state[`${CULTIST}.${MONSTER_REACTION_USES_KEY}`], label).toEqual(expectedUses);
      expect(deps.setRuntimeValue, label).not.toHaveBeenCalled();
    }
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

describe('MA-0341 Parry owner — registry + gate truth tables', () => {
  it('monsters.json bandit-captain reactions[0] byte-shape + At Will sentinel', () => {
    expect(PARRY_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus: 2 });
    expect(PARRY_ACTION.usage).toBe('At Will');
    expect(PARRY_ACTION.uses).toBe(999);
    expect(PARRY_ACTION.maxUses).toBe(999);
    expect(getGatedMonsterReaction(PARRY_ACTION)?.effect).toBe('parry');
  });

  it('parryIdentityRefusal RAW truth table (all distinct branches)', () => {
    const rows = [
      ['no lastAttack', null, 'trigger'],
      ['save roll, not an attack', { ...meleeHitOnCaptain(), rollType: 'save' }, 'trigger'],
      ['ranged weapon attack', { ...meleeHitOnCaptain(), weaponType: 'ranged' }, 'melee'],
      ['spell-origin with melee fallback (MA-0245 stamp guard)', { ...meleeHitOnCaptain(), damageSchool: 'Evocation', isCantrip: true }, 'spell'],
      ['attackType spell stamp', { ...meleeHitOnCaptain(), attackType: 'spell' }, 'spell'],
      ['wrong target', meleeHitOnCaptain({ targetName: 'Thug 1' }), 'trigger'],
      ['miss', meleeHitOnCaptain({ hit: false }), 'miss'],
      ['damage already committed', meleeHitOnCaptain({ damageApplied: true, actualDamage: 8 }), 'resolved'],
      ['already parried', meleeHitOnCaptain({ parryResolved: true }), 'reacted'],
      ['self-inflicted attack', meleeHitOnCaptain({ attackerName: CAPTAIN }), 'attacker'],
      ['unresolved melee hit accepted', meleeHitOnCaptain(), null],
    ];
    for (const [label, lastAttack, expected] of rows) {
      expect(parryIdentityRefusal(lastAttack, CAPTAIN) ?? null, label).toBe(expected);
    }
  });

  it('parryGate: accepts unresolved melee hit (attacker, limit 999), 1/round latch re-arms next round', () => {
    const g = parryGate({ lastAttack: meleeHitOnCaptain(), monsterName: CAPTAIN, currentRound: 4, storedUses: {}, usedRound: 0, action: PARRY_ACTION });
    expect(g.ok).toBe(true);
    expect(g.attackerName).toBe(SLASHER);
    expect(g.limit).toBe(999);
    const same = parryGate({ lastAttack: meleeHitOnCaptain(), monsterName: CAPTAIN, currentRound: 4, storedUses: {}, usedRound: 4, action: PARRY_ACTION });
    expect(same.ok).toBe(false);
    expect(same.reason).toBe('round');
    const next = parryGate({ lastAttack: meleeHitOnCaptain(), monsterName: CAPTAIN, currentRound: 5, storedUses: {}, usedRound: 4, action: PARRY_ACTION });
    expect(next.ok).toBe(true);
  });
});

describe('MA-0341 resolveMonsterGatedReaction — Parry', () => {
  it('refusals log parry_refused zero-write (no melee hit / damage committed)', async () => {
    const scenarios = [
      ['no melee hit', { lastAttack: null }, undefined],
      ['damage already applied (resolved)', { lastAttack: meleeHitOnCaptain({ damageApplied: true, actualDamage: 8 }) }, /resolved/],
    ];
    for (const [label, opts, descRe] of scenarios) {
      const { state, logs, deps } = makeParryDeps(opts);
      const result = await resolveMonsterGatedReaction({ action: PARRY_ACTION, monsterName: CAPTAIN, campaignName: CAMPAIGN, deps });
      expect(result.ok, label).toBe(false);
      expect(logs, label).toHaveLength(1);
      expect(logs[0].automationType, label).toBe('parry_refused');
      if (descRe) expect(logs[0].description, label).toMatch(descRe);
      expect(deps.setRuntimeValue, label).not.toHaveBeenCalled();
      expect(state[`${CAPTAIN}.activeBuffs`], label).toBeUndefined();
      expect(state[`${CAPTAIN}.${MONSTER_REACTION_USES_KEY}`], label).toBeUndefined();
    }
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
});

// Parry DATA twins — routine re-authors of the MA-0341 byte-shape on disk
// (each reactions[0] was prose-only = gate-null inert; the fix authors the
// byte-shape with THAT monster's RAW acBonus — MUST be authored because
// buildParryBuff silently defaults 2). One folded it.each (standing rec): per
// monster locks automation byte-shape, prose acBonus, At Will sentinel, arms
// the gate, and runs resolve end-to-end so the stamped bonus and AC-flip log
// carry the authored value (never the silent default). Gate refusal/latch and
// identity branches are owned by the MA-0341 tables above — not re-pinned here.
const DEATH_KNIGHT_ACTION = monsters.find(m => m.index === 'death-knight').reactions[0];
const KNIGHT = 'Death Knight 1';
const ASPIRANT_ACTION = monsters.find(m => m.index === 'death-knight-aspirant').reactions[0];
const ASPIRANT = 'Death Knight Aspirant 1';
const DROW_ACTION = monsters.find(m => m.index === 'drow-elite-warrior').reactions[0];
const DROW = 'Drow Elite Warrior 1';
const ERINYES_ACTION = monsters.find(m => m.index === 'erinyes').reactions[0];
const ERINYES = 'Erinyes 1';
const GLADIATOR_ACTION = monsters.find(m => m.index === 'gladiator').reactions[0];
const GLADIATOR = 'Gladiator 1';
const WARLORD_ACTION = monsters.find(m => m.index === 'hobgoblin-warlord').reactions[0];
const WARLORD = 'Hobgoblin Warlord 1';
const KNIGHT_ACTION = monsters.find(m => m.index === 'knight').reactions[0];
const KNIGHT_1 = 'Knight 1';
const MARILITH_ACTION = monsters.find(m => m.index === 'marilith').reactions[0];
const MARILITH = 'Marilith 1';
const NIMBLEWRIGHT_ACTION = monsters.find(m => m.index === 'nimblewright').reactions[0];
const NIMBLEWRIGHT = 'Nimblewright 1';
const NOBLE_ACTION = monsters.find(m => m.index === 'noble').reactions[0];
const NOBLE = 'Noble 1';

it.each([
  // MA-0565: +6 vs the triggering melee hit — AC 20 → 26 flips the total-21 hit to miss.
  { ma: 'MA-0565', action: DEATH_KNIGHT_ACTION, monster: KNIGHT, acBonus: 6, newAc: 26, attacker: 'Bandit 1', weapon: 'Scimitar', d20: 12, bonus: 9, total: 21, targetAc: 20 },
  // MA-0573: AC 20 → 24 flips the total-21 hit to miss.
  { ma: 'MA-0573', action: ASPIRANT_ACTION, monster: ASPIRANT, acBonus: 4, newAc: 24, attacker: 'Bandit 1', weapon: 'Scimitar', d20: 12, bonus: 9, total: 21, targetAc: 20 },
  // MA-0643: AC 18 → 21 flips the 18-20 window hit to miss.
  { ma: 'MA-0643', action: DROW_ACTION, monster: DROW, acBonus: 3, newAc: 21, attacker: 'Gladiator 1', weapon: 'Spear', d20: 12, bonus: 7, total: 19, targetAc: 18 },
  // MA-0702: AC 18 → 22 flips the 18-21 window hit to miss.
  { ma: 'MA-0702', action: ERINYES_ACTION, monster: ERINYES, acBonus: 4, newAc: 22, attacker: 'Bandit 1', weapon: 'Scimitar', d20: 17, bonus: 3, total: 20, targetAc: 18 },
  // MA-0869: AC 16 → 19 flips the 16-18 window hit to miss.
  { ma: 'MA-0869', action: GLADIATOR_ACTION, monster: GLADIATOR, acBonus: 3, newAc: 19, attacker: 'Bandit 1', weapon: 'Scimitar', d20: 14, bonus: 3, total: 17, targetAc: 16 },
  // MA-0997: AC 20 → 23 flips the 20-22 window hit to miss (row prose "adds 3").
  { ma: 'MA-0997', action: WARLORD_ACTION, monster: WARLORD, acBonus: 3, newAc: 23, attacker: 'Bandit 1', weapon: 'Scimitar', d20: 17, bonus: 3, total: 20, targetAc: 20 },
  // MA-1048: AC 18 → 20 flips the 18-19 window hit to miss (do NOT copy the warlord's 3).
  { ma: 'MA-1048', action: KNIGHT_ACTION, monster: KNIGHT_1, acBonus: 2, newAc: 20, attacker: 'Bandit 1', weapon: 'Scimitar', d20: 15, bonus: 3, total: 18, targetAc: 18 },
  // MA-1140: AC 16 → 21 flips the 16-20 window hit to miss (row prose "adds 5").
  { ma: 'MA-1140', action: MARILITH_ACTION, monster: MARILITH, acBonus: 5, newAc: 21, attacker: 'Bandit 1', weapon: 'Scimitar', d20: 13, bonus: 3, total: 16, targetAc: 16 },
  // MA-1236: AC 18 → 20 flips the 18-19 window hit to miss.
  { ma: 'MA-1236', action: NIMBLEWRIGHT_ACTION, monster: NIMBLEWRIGHT, acBonus: 2, newAc: 20, attacker: 'Bandit Captain 1', weapon: 'Scimitar', d20: 15, bonus: 3, total: 18, targetAc: 18 },
  // MA-1238: AC 15 → 17 flips the 15-16 window hit to miss. Wielded-weapon clause stays GM-enforced advisory (§235).
  { ma: 'MA-1238', action: NOBLE_ACTION, monster: NOBLE, acBonus: 2, newAc: 17, attacker: 'Bandit 1', weapon: 'Scimitar', d20: 12, bonus: 3, total: 15, targetAc: 15 },
])('$ma $monster Parry acBonus $acBonus: data-lock, arms gate, resolve AC $targetAc → $newAc never spends', async ({ action, monster, acBonus, newAc, attacker, weapon, d20, bonus, total, targetAc }) => {
  expect(action.name).toBe('Parry');
  expect(action.description).toMatch(new RegExp(`adds ${acBonus} to its AC`));
  expect(action.automation).toEqual({ type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus });
  expect(action.usage).toBe('At Will');
  expect(action.uses).toBe(999);
  expect(action.maxUses).toBe(999);
  expect(getGatedMonsterReaction(action)?.effect).toBe('parry');
  const hit = { attackerName: attacker, targetName: monster, attackName: weapon, rollType: 'attack', weaponType: 'melee', hit: true, d20, bonus, total, targetAc, effectiveAc: targetAc };
  const { state, logs, campaignWrites, deps } = makeParryDeps({ lastAttack: hit, round: 3 });
  const result = await resolveMonsterGatedReaction({ action, monsterName: monster, campaignName: CAMPAIGN, deps });
  expect(result.ok).toBe(true);
  expect(result.acBonus).toBe(acBonus);
  expect(result.newAc).toBe(newAc);
  expect(state[`${monster}.activeBuffs`].some(b => b.effect === 'parry' && b.acBonus === acBonus)).toBe(true);
  expect(state[`${monster}._parry_usedRound`]).toBe(3);
  expect(campaignWrites[0]).toMatchObject({ parryResolved: true, parriedBy: monster, parryAcBonus: acBonus });
  expect(state[`${monster}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  expect(logs.find(l => l.type === 'ability_use').description).toMatch(new RegExp(`AC ${targetAc} → ${newAc}`));
});

// MA-0681: Elemental Cultist Elemental Absorption (1/Day) — damage-taken
// press-at-pending-hit reaction (parry MA-0341 lineage). RAW trigger: takes
// Acid/Cold/Fire/Lightning/Thunder damage → Resistance to THAT instance + 10
// THP. Gate keys off the pending campaign lastAttack identity (this monster as
// target, hit, elemental type match, damage NOT yet committed via Done, not
// already absorbed) + 1/round latch + 1/Day uses. Press stamps a one-shot
// elemental_absorption resistance activeBuffs entry, grants 10 THP via the
// tempHpService replace-if-larger channel (injectable), spends the 1/Day use,
// and marks the lastAttack absorbed. Non-elemental / spent / committed refusals
// log elemental_absorption_refused and spend nothing.
const ABSORPTION_ACTION = monsters.find(m => m.index === 'elemental-cultist').reactions[0];
const CULTIST_681 = 'Elemental Cultist 1';
const AZER = 'Azer Pyromancer 1';

function pendingFireHitOnCultist(overrides = {}) {
  return { attackerName: AZER, targetName: CULTIST_681, attackName: 'Flame Burst', rollType: 'attack', weaponType: 'ranged', hit: true, d20: 13, bonus: 7, total: 20, targetAc: 16, effectiveAc: 16, primaryDamage: 22, primaryDamageType: 'Fire', damageTypes: ['Fire'], damageApplied: undefined, elementalAbsorptionResolved: undefined, ...overrides };
}

function makeAbsorbDeps({ lastAttack = pendingFireHitOnCultist(), round = 1, store = {}, tempHp = 0 } = {}) {
  const state = { ...store };
  const logs = [];
  const campaignWrites = [];
  const thpGrants = [];
  return {
    state,
    logs,
    campaignWrites,
    thpGrants,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => ({ round })),
      getRuntimeValue: vi.fn((key, prop) => (prop === 'tempHp' ? tempHp : (state[`${key}.${prop}`] ?? null))),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
      // tempHpService replace-if-larger stand-in: never adds, keeps the larger.
      setTempHp: vi.fn((name, amount) => { thpGrants.push({ name, amount }); return Math.max(Number(tempHp) || 0, amount); }),
    },
  };
}

describe('MA-0681 Elemental Absorption data-lock + gate truth tables', () => {
  it('monsters.json elemental-cultist reactions[0] locks RAW, arms the gate', () => {
    expect(ABSORPTION_ACTION.name).toBe('Elemental Absorption');
    expect(ABSORPTION_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'damage_taken_elemental', effect: 'elemental_absorption', tempHp: 10 });
    expect(ABSORPTION_ACTION.automation.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
    expect(ABSORPTION_ACTION.uses).toBe(1);
    expect(ABSORPTION_ACTION.maxUses).toBe(1);
    expect(ABSORPTION_ACTION.usage).toBe('1/Day');
    // Uses-remaining arithmetic is the MA-0006 table's lane — not re-pinned here.
    expect(getGatedMonsterReaction(ABSORPTION_ACTION)?.effect).toBe('elemental_absorption');
  });

  it('identity refusals + round latch + 1/Day uses truth table', () => {
    const auto = ABSORPTION_ACTION.automation;
    const refusalRows = [
      ['no lastAttack', null, 'trigger'],
      ['wrong target', pendingFireHitOnCultist({ targetName: 'Other 1' }), 'trigger'],
      ['miss', pendingFireHitOnCultist({ hit: false }), 'miss'],
      ['damage committed', pendingFireHitOnCultist({ damageApplied: true, actualDamage: 22 }), 'resolved'],
      ['already absorbed', pendingFireHitOnCultist({ elementalAbsorptionResolved: true }), 'reacted'],
      ['non-elemental Poison', pendingFireHitOnCultist({ primaryDamageType: 'Poison', damageTypes: ['Poison'] }), 'type'],
      ['non-elemental Bludgeoning', pendingFireHitOnCultist({ primaryDamageType: 'Bludgeoning', damageTypes: ['Bludgeoning'] }), 'type'],
    ];
    for (const [label, lastAttack, reason] of refusalRows) {
      expect(elementalAbsorptionIdentityRefusal(lastAttack, CULTIST_681, auto), label).toBe(reason);
    }
    const latchRows = [
      ['round latch', pendingFireHitOnCultist(), 3, {}, 3, 'round'],
      ['1/Day exhausted', pendingFireHitOnCultist(), 8, { elemental_absorption: 1 }, 2, 'uses'],
    ];
    for (const [label, lastAttack, round, uses, usedRound, reason] of latchRows) {
      const g = elementalAbsorptionGate({ lastAttack, monsterName: CULTIST_681, currentRound: round, storedUses: uses, usedRound, action: ABSORPTION_ACTION });
      expect(g.ok, label).toBe(false);
      expect(g.reason, label).toBe(reason);
    }
  });

  it('accepts every RAW elemental type on a pending hit (matchedType echo, gate arms)', () => {
    for (const t of ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']) {
      const lastAttack = pendingFireHitOnCultist({ primaryDamageType: t, damageTypes: [t] });
      expect(elementalAbsorptionMatchedType(lastAttack, ABSORPTION_ACTION.automation), t).toBe(t);
      const g = elementalAbsorptionGate({ lastAttack, monsterName: CULTIST_681, currentRound: 1, storedUses: {}, usedRound: 0, action: ABSORPTION_ACTION });
      expect(g.ok, t).toBe(true);
      expect(g.matchedType, t).toBe(t);
    }
  });
});

describe('MA-0681 resolveMonsterElementalAbsorption press → arm + spend + THP', () => {
  it('press on a pending Fire hit: spends 1/Day, grants 10 THP replace-if-larger, arms resistance, stamps lastAttack absorbed, ability_use log', async () => {
    const { state, logs, campaignWrites, thpGrants, deps } = makeAbsorbDeps({ round: 5 });
    const result = await resolveMonsterGatedReaction({ action: ABSORPTION_ACTION, monsterName: CULTIST_681, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.tempHp).toBe(10);
    expect(result.halved).toBe(11);
    expect(thpGrants).toEqual([{ name: CULTIST_681, amount: 10 }]);
    expect(state[`${CULTIST_681}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ elemental_absorption: 1 });
    expect(state[`${CULTIST_681}._elemental_absorption_usedRound`]).toBe(5);
    const buffs = state[`${CULTIST_681}.activeBuffs`];
    expect(buffs.some(b => b.effect === 'elemental_absorption' && b.resistanceTypes.includes('Fire'))).toBe(true);
    expect(campaignWrites[0]).toMatchObject({ elementalAbsorptionResolved: true, absorbedBy: CULTIST_681, elementalAbsorbedType: 'Fire' });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Elemental Absorption');
    expect(spend.description).toMatch(/Resistance to this instance/i);
    expect(spend.description).toMatch(/22 Fire halved to 11/);
    expect(spend.description).toMatch(/1\/Day · 0 left today/);
  });

  it('THP replace-if-larger respects a larger standing buffer', async () => {
    const { deps, thpGrants } = makeAbsorbDeps({ tempHp: 25 });
    const result = await resolveMonsterElementalAbsorption({ action: ABSORPTION_ACTION, monsterName: CULTIST_681, campaignName: CAMPAIGN, lastAttack: pendingFireHitOnCultist(), currentRound: 1, storedUses: {}, usedRound: 0, latchKey: '_elemental_absorption_usedRound', deps });
    expect(result.ok).toBe(true);
    expect(thpGrants).toEqual([{ name: CULTIST_681, amount: 10 }]);
    expect(result.tempHp).toBe(25);
  });

  it('refusals log elemental_absorption_refused zero-THP zero-spend (reacted / uses / type)', async () => {
    const scenarios = [
      ['second press on the same resolved hit (reacted)', { lastAttack: pendingFireHitOnCultist({ elementalAbsorptionResolved: true }), round: 5, store: { [`${CULTIST_681}._elemental_absorption_usedRound`]: 5, [`${CULTIST_681}.${MONSTER_REACTION_USES_KEY}`]: { elemental_absorption: 1 } } }, { elemental_absorption: 1 }, /reacted/],
      ['spent 1/Day on a fresh elemental hit (uses)', { round: 9, store: { [`${CULTIST_681}.${MONSTER_REACTION_USES_KEY}`]: { elemental_absorption: 1 } } }, { elemental_absorption: 1 }, /uses/i],
      ['non-elemental damage never fires (type)', { lastAttack: pendingFireHitOnCultist({ primaryDamageType: 'Poison', damageTypes: ['Poison'] }) }, undefined, /type/],
    ];
    for (const [label, opts, expectedUses, descRe] of scenarios) {
      const { state, logs, thpGrants, deps } = makeAbsorbDeps(opts);
      const result = await resolveMonsterGatedReaction({ action: ABSORPTION_ACTION, monsterName: CULTIST_681, campaignName: CAMPAIGN, deps });
      expect(result.ok, label).toBe(false);
      expect(logs[0].automationType, label).toBe('elemental_absorption_refused');
      expect(logs[0].description, label).toMatch(descRe);
      expect(thpGrants, label).toHaveLength(0);
      expect(state[`${CULTIST_681}.${MONSTER_REACTION_USES_KEY}`], label).toEqual(expectedUses);
    }
  });
});

// MA-0013 usage-less-row default seam — RELOCATED here from the ma0305
// arch-hag helper lane per pass #517 rec / #518 carry (fabrication legs
// live at the owner where the default is implemented: reactionMaxUses
// MonsterCardHelpers.js:2226-2229 returns 1 when uses/maxUses are absent,
// and counterspellGate :1553-1556 renders that default into the
// '1/Day uses already spent' refusal). Appended at end-of-file so every
// existing cross-file line citation into this lane stays byte-exact.
// Authored-row ADMITS (limit 999, used < 999) are owned once by the
// shared-gate limit-999 arm :330-334 (same reactionMaxUses limit) plus the
// live counterspell press via resolveMonsterCounterspell :2672 →
// counterspellGate in ma0300 helper :77-101 — never re-simulated per
// monster (arch-hag/arcanaloth rows are gate-input twins: byte-identical
// maxUses:999/effect:counterspell fields; the gate reads neither name).
describe('MA-0013 usage-less-row seam — fabricated 1/Day cap (relocated from ma0305)', () => {
  it('usage-less counterspell row defaults limit 1 and refuses after one spend; owners At-Will rows carry honest 999 instead', () => {
    const usageless = { name: 'Generic Counterspell', automation: { type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' } };
    const g = counterspellGate({ lastAttack: pcSpellAttack(), attackerIsPC: true, monsterName: CULTIST, currentRound: 1, storedUses: { counterspell: 1 }, usedRound: 0, action: usageless });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe('uses');
    expect(g.message).toMatch(/1\/Day uses already spent/);
  });
});
