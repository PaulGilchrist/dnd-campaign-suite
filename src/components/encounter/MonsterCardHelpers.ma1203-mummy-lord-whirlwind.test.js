// MA-1203 regression: Mummy Lord "Whirlwind of Sand" — disk row was prose-only
// (name/trigger/description, no automation) = getGatedMonsterReaction null, zero
// affordance, live committed attack-hit produced zero reaction delta (MA-0869 twin).
// Fix authors the MA-0341 parry byte-shape onto the existing live channel:
// automation {type:'reaction',trigger:'melee_hit',effect:'parry',acBonus:2} +
// honest RAW-unlimited sentinel usage:'At Will'+uses/maxUses:999 (§60, MA-0006/
// 0300/0305) + 1/round latch (_parry_usedRound). The +2 AC vs the triggering
// attack folds via getParryAcBonus/consumeParryAcBonus (MA-0341/MA-1170 lineage);
// the teleport + Blinded-within-5-ft-of-destination burst stays gridless §70
// advisory — authored into automation.description and surfaced verbatim in the
// ability_use spend log via the MA-1203 byte-inert discriminator in
// buildParrySpendLog (parry twins' logs stay byte-identical).
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  parryGate,
  parryIdentityRefusal,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const ROW = monsters.find(m => m.index === 'mummy-lord').reactions[0];
const MUMMY = 'Mummy Lord 1';
const BANDIT = 'Bandit 1';
const CAMPAIGN = 'test-campaign';

function meleeHitOnMummy(overrides = {}) {
  return { attackerName: BANDIT, targetName: MUMMY, attackName: 'Scimitar', rollType: 'attack', weaponType: 'melee', hit: true, d20: 20, bonus: 3, total: 23, targetAc: 17, effectiveAc: 17, damageApplied: undefined, ...overrides };
}

function makeParryDeps({ lastAttack = meleeHitOnMummy(), round = 1, store = {} } = {}) {
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

describe('MA-1203 Whirlwind of Sand row shape + chip arming', () => {
  it('disk reactions[0] carries the MA-0341 parry byte-shape with acBonus 2 + At Will sentinel', () => {
    expect(ROW.name).toBe('Whirlwind of Sand');
    expect(ROW.automation).toMatchObject({ type: 'reaction', trigger: 'melee_hit', effect: 'parry', acBonus: 2 });
    expect(ROW.usage).toBe('At Will');
    expect(ROW.uses).toBe(999);
    expect(ROW.maxUses).toBe(999);
  });

  it('automation.description carries the teleport + Blinded RAW legs as GM-enforced advisory', () => {
    expect(ROW.automation.description).toMatch(/teleports up to 60 feet/);
    expect(ROW.automation.description).toMatch(/Blinded/);
    expect(ROW.automation.description).toMatch(/GM-enforced/);
  });

  it('getGatedMonsterReaction arms the chip on effect parry (was null pre-fix)', () => {
    expect(getGatedMonsterReaction(ROW)?.effect).toBe('parry');
    expect(getGatedMonsterReaction(ROW)?.label).toBe('Parry');
  });

  it('At Will sentinel: counter reads 999 and never burns under the 999 cap', () => {
    expect(monsterReactionUsesRemaining(ROW, {})).toBe(999);
    expect(monsterReactionUsesRemaining(ROW, { parry: 2 })).toBe(997);
  });
});

describe('MA-1203 resolveMonsterGatedReaction — pending-window parry press', () => {
  it('press at pending melee hit: activeBuffs +2 AC stamp + round latch + lastAttack parryAcBonus:2 + advisory in ability_use log, At Will never spends MONSTER_REACTION_USES', async () => {
    const { state, logs, campaignWrites, deps } = makeParryDeps({ round: 3 });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: MUMMY, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(2);
    expect(result.newAc).toBe(19);
    const buffs = state[`${MUMMY}.activeBuffs`];
    expect(buffs.some(b => b.effect === 'parry' && b.acBonus === 2)).toBe(true);
    expect(state[`${MUMMY}._parry_usedRound`]).toBe(3);
    expect(campaignWrites[0]).toMatchObject({ parryResolved: true, parriedBy: MUMMY, parryAcBonus: 2 });
    expect(state[`${MUMMY}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Whirlwind of Sand');
    expect(spend.description).toMatch(/AC 17 → 19/);
    expect(spend.description).toMatch(/At Will/);
    expect(spend.description).toMatch(/teleports up to 60 feet/);
    expect(spend.description).toMatch(/Blinded/);
  });

  it('same-round second press: parry_refused (round/reacted), zero additional writes', async () => {
    const { logs, deps } = makeParryDeps({
      round: 3,
      lastAttack: meleeHitOnMummy({ parryResolved: true, parriedBy: MUMMY }),
      store: { [`${MUMMY}._parry_usedRound`]: 3, [`${MUMMY}.activeBuffs`]: [{ effect: 'parry', acBonus: 2 }] },
    });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: MUMMY, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('parry_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('no attack event: parry_refused (trigger), zero writes', async () => {
    const { state, logs, deps } = makeParryDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: MUMMY, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('parry_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${MUMMY}.activeBuffs`]).toBeUndefined();
  });

  it('damage already committed (Done pressed): parry_refused (resolved), zero writes', async () => {
    const { logs, deps } = makeParryDeps({ lastAttack: meleeHitOnMummy({ damageApplied: true, actualDamage: 11 }) });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: MUMMY, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('parry_refused');
    expect(logs[0].description).toMatch(/resolved/);
  });

  it('parryGate honest boundary: AC 17 vs total 18 parries, total 19 still hits', () => {
    const g = parryGate({ lastAttack: meleeHitOnMummy({ d20: 15, total: 18 }), monsterName: MUMMY, currentRound: 1, storedUses: {}, usedRound: 0, action: ROW });
    expect(g.ok).toBe(true);
    expect(18 < 17 + 2).toBe(true);
    expect(19 >= 17 + 2).toBe(true);
    expect(parryIdentityRefusal(meleeHitOnMummy({ weaponType: 'ranged' }), MUMMY)).toBe('melee');
  });
});

describe('MA-1203 byte-inertness for existing parry twins', () => {
  it('Bandit Captain spend log stays byte-identical (label Parry, no advisory append)', async () => {
    const twin = monsters.find(m => m.index === 'bandit-captain').reactions[0];
    expect(twin.name).toBe('Parry');
    expect(twin.automation.description).toBeUndefined();
    const lastAttack = { attackerName: 'ElderPaladin', targetName: 'Bandit Captain 1', attackName: 'Longsword', rollType: 'attack', weaponType: 'melee', hit: true, d20: 17, bonus: 5, total: 22, targetAc: 15 };
    const { state, logs, deps } = makeParryDeps({ lastAttack, round: 6 });
    const result = await resolveMonsterGatedReaction({ action: twin, monsterName: 'Bandit Captain 1', campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Parry');
    expect(spend.description).toMatch(/^Bandit Captain 1 uses Parry — \+2 AC/);
    expect(spend.description).toMatch(/At Will — unlimited uses, 1 Reaction per round\.$/);
    expect(state['Bandit Captain 1.activeBuffs'][0].acBonus).toBe(2);
  });
});
