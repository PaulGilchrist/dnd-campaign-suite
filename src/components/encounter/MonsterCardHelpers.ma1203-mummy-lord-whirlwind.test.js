// @maintained-by-ai
// MA-1203 Mummy Lord "Whirlwind of Sand" (+ MA-1681 Counterattack / MA-1686
// Warrior Veteran Parry twins): disk rows were prose-only = getGatedMonsterReaction
// null, zero affordance (MA-0869 twin). Fix authors the MA-0341 parry byte-shape
// onto the live channel + honest RAW-unlimited sentinel usage 'At Will'+uses:999
// (§60, MA-0006/0300/0305). This file owns ONLY what the MA-0341 owner suite does
// not re-cover (#496/#508 trim):
//  - disk locks BY-name (#387), incl. the authored acBonus (buildParryBuff
//    silently defaults 2) and the automation.description advisory legs;
//  - MA-1203 byte-inert discriminator: advisory + non-'Parry' row name threaded
//    into buildParrySpendLog (twins' logs stay byte-identical, $-anchored tail);
//  - the ranged→'melee' honest refusal, ONCE, on the Warrior Commander row whose
//    RAW prose says "an attack roll" (ANY) while the gate is melee-only.
// Deleted per #508 (owners cited): parryIdentityRefusal accept→null rows and all
// ranged unit re-pins (owner MA-0341 truth table, gated-reaction.test.js :311);
// resolve refusal wiring + round latch (owner :344 refusals, :330 gate latch);
// monsterReactionUsesRemaining arithmetic (owner usage tables, MA-0006 lane);
// generic accept legs — MA-1686 acBonus 2 e2e is the owner it.each MA-1048/
// MA-1238 rows verbatim; the surviving accept rows below fold that template and
// add only the MA-1203 advisory-thread assertions.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

// #387: disk locks BY-name — reactions[0] index is incidental.
const reactionRow = (index, name) => monsters.find(m => m.index === index).reactions.find(r => r.name === name);

const MUMMY_ROW = reactionRow('mummy-lord', 'Whirlwind of Sand');
const MUMMY = 'Mummy Lord 1';
const WC_ROW = reactionRow('warrior-commander', 'Counterattack');
const WC = 'Warrior Commander 1';
const WV_ROW = reactionRow('warrior-veteran', 'Parry');
const CAPTAIN_ROW = reactionRow('bandit-captain', 'Parry');
const CAPTAIN = 'Bandit Captain 1';
const BANDIT = 'Bandit 1';
const CAMPAIGN = 'test-campaign';

function meleeHitOn(targetName, targetAc, overrides = {}) {
  return { attackerName: BANDIT, targetName, attackName: 'Scimitar', rollType: 'attack', weaponType: 'melee', hit: true, d20: 14, bonus: 3, total: 17, targetAc, effectiveAc: targetAc, damageApplied: undefined, ...overrides };
}

function makeParryDeps({ lastAttack = meleeHitOn(MUMMY, 17), round = 1, store = {} } = {}) {
  const state = { ...store };
  const logs = [];
  const campaignWrites = [];
  return {
    state,
    logs,
    campaignWrites,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => ({ round, creatures: [{ name: BANDIT, type: 'npc' }, { name: MUMMY, type: 'npc' }] })),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
    },
  };
}

describe('MA-1203/1681/1686 parry disk locks — BY-name rows, byte-shape, advisory, chip armed', () => {
  it.each([
    // MA-1203: prose RAW trigger is ANY "attack roll" — gate is melee-only, refuses honestly.
    { ma: 'MA-1203', row: MUMMY_ROW, acBonus: 2, triggerRe: /hit by an attack roll$/, advisoryRe: /GM-enforced advisory legs[\s\S]*teleports up to 60 feet[\s\S]*Blinded/ },
    // MA-1681: acBonus 4 MUST be authored (silent default is 2); counter leg is GM-adjudicated.
    { ma: 'MA-1681', row: WC_ROW, acBonus: 4, triggerRe: /hit by an attack roll\.$/, advisoryRe: /Greatsword or Longbow[\s\S]*GM-adjudicated[\s\S]*no counterattack subsystem/ },
    // MA-1686: plain Parry twin — no advisory, byte-inert automation (accept/refusal legs
    // owned by the MA-0341 tables; acBonus 2 e2e = owner it.each MA-1048/MA-1238 rows).
    { ma: 'MA-1686', row: WV_ROW, acBonus: 2, triggerRe: /melee attack roll while holding a weapon/, advisoryRe: null },
  ])('$ma $row.name: parry byte-shape + At Will sentinel + arms chip (label channel-generic)', ({ ma, row, acBonus, triggerRe, advisoryRe }) => {
    expect(row.automation, ma).toMatchObject({ type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus });
    expect(row.usage, ma).toBe('At Will');
    expect(row.uses, ma).toBe(999);
    expect(row.maxUses, ma).toBe(999);
    expect(row.trigger, ma).toMatch(triggerRe);
    if (advisoryRe) expect(row.automation.description, ma).toMatch(advisoryRe);
    else expect(row.automation.description, ma).toBeUndefined();
    expect(Object.keys(row).pop(), ma).toBe('automation');
    expect(getGatedMonsterReaction(row), ma).toMatchObject({ effect: 'parry', label: 'Parry' });
  });
});

describe('MA-1203/1681 resolveMonsterGatedReaction — pending-window press + advisory threading', () => {
  it.each([
    // AC 17 → 19 flips the total-18 hit to miss.
    { ma: 'MA-1203', row: MUMMY_ROW, monster: MUMMY, acBonus: 2, targetAc: 17, d20: 15, total: 18, newAc: 19 },
    // AC 18 → 22 flips the total-21 hit to miss.
    { ma: 'MA-1681', row: WC_ROW, monster: WC, acBonus: 4, targetAc: 18, d20: 18, total: 21, newAc: 22 },
  ])('$ma press: acBonus $acBonus threads buff+campaign write, round latch, advisory logged, At Will never spends, counter leg never rolls', async ({ ma, row, monster, acBonus, targetAc, d20, total, newAc }) => {
    const { state, logs, campaignWrites, deps } = makeParryDeps({ lastAttack: meleeHitOn(monster, targetAc, { d20, total }), round: 3 });
    const result = await resolveMonsterGatedReaction({ action: row, monsterName: monster, campaignName: CAMPAIGN, deps });
    expect(result.ok, ma).toBe(true);
    expect(result.acBonus, ma).toBe(acBonus);
    expect(result.newAc, ma).toBe(newAc);
    expect(state[`${monster}.activeBuffs`].some(b => b.effect === 'parry' && b.acBonus === acBonus), ma).toBe(true);
    expect(state[`${monster}._parry_usedRound`], ma).toBe(3);
    expect(campaignWrites[0], ma).toMatchObject({ parryResolved: true, parriedBy: monster, parryAcBonus: acBonus });
    expect(state[`${monster}.${MONSTER_REACTION_USES_KEY}`], ma).toBeUndefined();
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName, ma).toBe(row.name);
    expect(spend.description, ma).toMatch(new RegExp(`AC ${targetAc} → ${newAc}`));
    expect(spend.description, ma).toMatch(/At Will/);
    // MA-1203 discriminator: the authored advisory lands verbatim at the log tail.
    expect(spend.description.endsWith(` ${row.automation.description}`), ma).toBe(true);
    expect(logs.some(l => l.type === 'roll attack' || l.type === 'roll'), ma).toBe(false);
  });

  it('MA-1681 ranged trigger refuses honestly (disk prose says "an attack roll" ANY, gate melee-only) — zero writes', async () => {
    const { logs, deps } = makeParryDeps({ lastAttack: meleeHitOn(WC, 18, { weaponType: 'ranged' }) });
    const result = await resolveMonsterGatedReaction({ action: WC_ROW, monsterName: WC, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'parry_refused' });
    expect(logs[0].description).toMatch(/not a melee attack/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('MA-1203 byte-inertness for existing parry twins', () => {
  it('Bandit Captain spend log stays byte-identical (label Parry, no advisory append)', async () => {
    expect(CAPTAIN_ROW.automation.description).toBeUndefined();
    const { state, logs, deps } = makeParryDeps({ lastAttack: meleeHitOn(CAPTAIN, 15, { attackerName: 'ElderPaladin', attackName: 'Longsword', d20: 17, bonus: 5, total: 22 }), round: 6 });
    const result = await resolveMonsterGatedReaction({ action: CAPTAIN_ROW, monsterName: CAPTAIN, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toMatch(/^Bandit Captain 1 uses Parry — \+2 AC/);
    expect(spend.description.endsWith('At Will — unlimited uses, 1 Reaction per round.')).toBe(true);
    expect(state[`${CAPTAIN}.activeBuffs`][0].acBonus).toBe(2);
  });
});
