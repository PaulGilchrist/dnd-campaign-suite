// @maintained-by-ai
// MA-0329 regression: Azer Pyromancer Hellish Rebuke (2/Day) gated reaction —
// HELLISH_REBUKE LANE ONLY. Gate identity (damaged-target + damage-dealt probe
// incl. spell-leg primary+secondary fallback, reacted stamp, attacker identity);
// hellishRebukeSpec authored-row guards (DC/formula — nothing rolled, nothing
// spent); lane-only live-state legs (dead attacker, 60 ft isWithinRange);
// damage-redirect arithmetic (rebuke is its OWN 2d10 roll vs the attacker's DEX
// save DC 15, half floored — NOT the trigger's damage); reaction spend incl.
// storedUses merge. Round latch, uses-refusal, plain-row null-negative and
// fresh/spend uses arithmetic are #508 reaction-family template legs owned ONCE
// at MonsterCardHelpers.gated-reaction.test.js:89-90/:107-108/:66-68 — not
// re-pinned here. Registry arm for azer also consumed at monsterJinx.test.js:141
// (cite-skip). Fixtures by name per #387.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  hellishRebukeGate,
  hellishRebukeSpec,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const AZER = monsters.find(m => m.index === 'azer-pyromancer');
const HR_ACTION = AZER.reactions[0];
const CULTIST_ACTION = monsters.find(m => m.index === 'fiend-cultist').reactions[0];
const MONSTER = 'Azer Pyromancer 1';
const PC = 'ElderPaladin';
const CAMPAIGN = 'test-campaign';

// Hellish Rebuke RAW automation byte-shape — absolute lock, never row-vs-row (#504).
const HR_AUTOMATION = { type: 'reaction', trigger: 'takes_damage', effect: 'hellish_rebuke', saveType: 'DEX', saveDc: 15, dcSuccess: 'half', damageExpression: '2d10', damageType: 'Fire' };

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

function makeDeps({ lastAttack = damageAgainstMonster(), round = 1, store = {}, save = { success: false, roll: 3, total: 3, saveBonus: 0 }, damage = { total: 14, rolls: [5, 9] }, inRange = true, attackerHp = 30 } = {}) {
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
      getCombatContext: vi.fn(async () => csWithPC(round, attackerHp)),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? (key === 'campaign' && prop === 'lastAttack' ? lastAttack : null)),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
      rollExpression: vi.fn(() => damage),
      isWithinRange: vi.fn(async () => inRange),
      createSaveListener: vi.fn(() => ({ promptId: 'p-1', promise: Promise.resolve(save) })),
      applyDamageToTarget: vi.fn(async (cs, targetName, dmg, types) => {
        applied.push({ targetName, dmg, types });
        return { newHp: 30 - dmg };
      }),
    },
  };
}

describe('MA-0329 Hellish Rebuke authored data + spec', () => {
  it('monsters.json azer-pyromancer reactions[0] locks the RAW byte-shape, 2/Day, and arms the gate', () => {
    expect(HR_ACTION.name).toBe('Hellish Rebuke (2/Day)');
    expect(HR_ACTION.automation).toEqual(HR_AUTOMATION);
    expect(HR_ACTION.uses).toBe(2);
    expect(HR_ACTION.maxUses).toBe(2);
    expect(HR_ACTION.usage).toBe('2/Day');
    expect(HR_ACTION.range).toBe('60 ft.');
    expect(getGatedMonsterReaction(HR_ACTION)?.effect).toBe('hellish_rebuke');
    // Plain-row null-negative is owned ONCE at gated-reaction.test.js:66 (#508) — not re-pinned.
  });

  it('MA-0725 data-lock: fiend-cultist reactions[0] authors the identical automation with At Will sentinel, arms gate, never exhausts', () => {
    expect(CULTIST_ACTION.name).toBe('Hellish Rebuke');
    expect(CULTIST_ACTION.automation).toEqual(HR_AUTOMATION);
    expect(CULTIST_ACTION).toMatchObject({ range: '60 ft.', usage: 'At Will', uses: 999, maxUses: 999 });
    expect(getGatedMonsterReaction(CULTIST_ACTION)?.effect).toBe('hellish_rebuke');
    expect(monsterReactionUsesRemaining(CULTIST_ACTION, {})).toBe(999);
    // fresh/spent uses arithmetic owned at gated-reaction.test.js:67-68 (#508).
  });

  it('hellishRebukeSpec: reads authored DC/formula/range from the row; missing DC or formula refuses with nothing rolled, nothing spent', () => {
    expect(hellishRebukeSpec(HR_ACTION).spec).toMatchObject({ saveDc: 15, formula: '2d10', saveType: 'DEX', damageType: 'Fire', dcSuccess: 'half', rangeFt: 60 });
    expect(hellishRebukeSpec({ ...HR_ACTION, automation: { ...HR_ACTION.automation, saveDc: undefined } })).toMatchObject({ reason: 'dc' });
    expect(hellishRebukeSpec({ ...HR_ACTION, automation: { ...HR_ACTION.automation, damageExpression: undefined } })).toMatchObject({ reason: 'formula' });
  });
});

describe('MA-0329 hellishRebukeGate — identity legs (round latch + uses owned by #508 template)', () => {
  it('refuses wrong-target / zero-damage (weapon AND spell fallback) / reacted / self-or-missing attacker; accepts a fresh spell-leg hit', () => {
    const rows = [
      ['trigger: another creature was the damaged target', damageAgainstMonster({ targetName: 'Other 1' }), 'trigger'],
      ['damage: weapon hit dealt 0', damageAgainstMonster({ actualDamage: 0 }), 'damage'],
      ['damage: spell-leg fallback primary+secondary both 0', damageAgainstMonster({ actualDamage: undefined, primaryDamage: 0, secondaryDamage: 0 }), 'damage'],
      ['reacted: same hit already stamped hellishRebukeResolved', damageAgainstMonster({ hellishRebukeResolved: true }), 'reacted'],
      ['attacker: self-inflicted', damageAgainstMonster({ attackerName: MONSTER }), 'attacker'],
      ['attacker: no attacker name', damageAgainstMonster({ attackerName: null }), 'attacker'],
    ];
    for (const [label, lastAttack, reason] of rows) {
      const g = hellishRebukeGate({ lastAttack, monsterName: MONSTER, currentRound: 2, storedUses: {}, usedRound: 1, action: HR_ACTION });
      expect(g.ok, label).toBe(false);
      expect(g.reason, label).toBe(reason);
    }
    const accept = hellishRebukeGate({ lastAttack: damageAgainstMonster({ actualDamage: undefined, primaryDamage: 8, secondaryDamage: 6 }), monsterName: MONSTER, currentRound: 2, storedUses: {}, usedRound: 1, action: HR_ACTION });
    expect(accept).toMatchObject({ ok: true, used: 0, limit: 2, attackerName: PC });
    // round-latch + uses legs are the #508 template, owned at gated-reaction.test.js:89-90.
  });
});

describe('MA-0329 resolveMonsterGatedReaction — Hellish Rebuke', () => {
  it('refusals log hellish_rebuke_refused zero-spend (no event / dead attacker / out of 60 ft range)', async () => {
    const scenarios = [
      ['no damage event (gate trigger)', { lastAttack: null }, /trigger/],
      ['attacker at 0 HP is not an active combatant', { attackerHp: 0 }, /attacker/],
      ['attacker beyond the authored 60 ft range', { inRange: false }, /range/],
    ];
    for (const [label, opts, descRe] of scenarios) {
      const { state, logs, deps } = makeDeps(opts);
      const result = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
      expect(result.ok, label).toBe(false);
      expect(logs, label).toHaveLength(1);
      expect(logs[0].automationType, label).toBe('hellish_rebuke_refused');
      expect(logs[0].description, label).toMatch(descRe);
      expect(deps.setRuntimeValue, label).not.toHaveBeenCalled();
      expect(deps.createSaveListener, label).not.toHaveBeenCalled();
      expect(deps.applyDamageToTarget, label).not.toHaveBeenCalled();
      expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`], label).toBeUndefined();
    }
  });

  it('accept→stamp end-to-end: own 2d10 dice (not the trigger\'s 8) vs attacker DEX DC 15 — failed save full 14, saved half floored 15→7; latch, spend, lastAttack stamp, logs', async () => {
    const failed = makeDeps({ round: 3 });
    const r1 = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: failed.deps });
    expect(r1.ok).toBe(true);
    expect(r1.saveSuccess).toBe(false);
    expect(r1.finalDamage).toBe(14);
    expect(failed.deps.createSaveListener).toHaveBeenCalledTimes(1);
    expect(failed.deps.createSaveListener.mock.calls[0][1]).toMatchObject({ targetName: PC, attackerName: MONSTER, saveType: 'DEX', saveDc: 15, dcSuccess: 'half', damageFormula: '2d10', damageType: 'Fire', sourceName: 'Hellish Rebuke' });
    // Damage redirect: the roll mock produces 14 while the triggering hit dealt 8 — rebuke rolls its OWN dice at the attacker.
    expect(failed.applied).toEqual([{ targetName: PC, dmg: 14, types: ['Fire'] }]);
    expect(failed.state[`${MONSTER}._hellish_rebuke_usedRound`]).toBe(3);
    expect(failed.state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ hellish_rebuke: 1 });
    expect(failed.campaignWrites[0]).toMatchObject({ hellishRebukeResolved: true, rebukedBy: MONSTER, rebukeTarget: PC, rebukeDamage: 14 });
    const dmgLog = failed.logs.find(l => l.type === 'roll' && l.rollType === 'damage');
    expect(dmgLog).toMatchObject({ total: 14, finalDamage: 14, damageType: 'Fire', targetName: PC });
    expect(dmgLog.description).toMatch(/DC 15/);
    const spend = failed.logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Hellish Rebuke');
    expect(spend.description).toMatch(/failed their DEX save/i);
    expect(spend.description).toMatch(/14 Fire damage/);
    expect(spend.description).toMatch(/2\/Day · 1 left today/);

    const saved = makeDeps({ save: { success: true, roll: 18, total: 20, saveBonus: 2 }, damage: { total: 15, rolls: [6, 9] } });
    const r2 = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps: saved.deps });
    expect(r2.saveSuccess).toBe(true);
    expect(r2.finalDamage).toBe(7);
    expect(saved.applied[0].dmg).toBe(7);
    expect(saved.logs.find(l => l.type === 'roll').description).toMatch(/SUCCEEDED — half/);
    expect(saved.logs.find(l => l.type === 'ability_use').description).toMatch(/succeeded their DEX save/i);
    expect(saved.logs.find(l => l.type === 'ability_use').description).toMatch(/7 Fire damage/);
  });

  it('second use on a fresh hit merges storedUses 1→2 (other-effect counts preserved), stamps the new hit', async () => {
    const { state, campaignWrites, deps } = makeDeps({
      lastAttack: damageAgainstMonster({ attackName: 'Second Hit' }),
      round: 2,
      store: { [`${MONSTER}._hellish_rebuke_usedRound`]: 1, [`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]: { hellish_rebuke: 1, other_effect: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: HR_ACTION, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(0);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ hellish_rebuke: 2, other_effect: 1 });
    expect(state[`${MONSTER}._hellish_rebuke_usedRound`]).toBe(2);
    expect(campaignWrites[0].hellishRebukeResolved).toBe(true);
    // Third-click uses exhaustion zero-spend is the #508 template refusal, owned at gated-reaction.test.js:107-108.
  });
});
