// MA-0399 regression: Black Pudding Split gated reaction. Row carries
// automation {type:'reaction', trigger:'bloodied_or_lightning_slashing',
// effect:'split'}; the gate reads live combatSummary HP (bloodied) and the
// campaign lastAttack damageTypes (lightning/slashing, "subjected to" —
// immunity-zeroed damage still counts). Response is a GM-executed duplication
// advisory (no monster-duplication subsystem, CLA-325/MA-0006 record-only
// precedent): popup + ability_use log carry one-size-smaller + floor(hp/2)
// instruction. Refusals log split_refused with zero writes; At Will sentinel
// never spends MONSTER_REACTION_USES; 1/round latch + lastAttack.splitResolved
// event stamp gate re-fires.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  oneSizeSmaller,
  splitTriggerEvidence,
  splitGate,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const PUDDING = {
  name: 'Split',
  description: 'Trigger: While the pudding is Large or Medium and has 10+ Hit Points, it becomes <strong>Bloodied</strong> or is subjected to Lightning or Slashing damage. Response: The pudding splits into two new <strong>Black Puddings</strong>.',
  usage: 'At Will',
  uses: 999,
  maxUses: 999,
  automation: { type: 'reaction', trigger: 'bloodied_or_lightning_slashing', effect: 'split', minHp: 10, damageTypes: ['Lightning', 'Slashing'] },
};

const MONSTER = 'Black Pudding 1';
const CAMPAIGN = 'test-campaign';

function combatant(overrides = {}) {
  return { name: MONSTER, type: 'npc', size: 'Large', maxHp: 68, currentHp: 68, ...overrides };
}

function slashingAttack(overrides = {}) {
  return { attackerName: 'ElderPaladin', targetName: MONSTER, attackName: 'Longsword', damageTypes: ['Slashing'], primaryDamageType: 'Slashing', actualDamage: 28, damageApplied: true, ...overrides };
}

function makeDeps({ lastAttack = null, round = 1, creatures = [], store = {} } = {}) {
  const state = { ...store };
  const logs = [];
  return {
    state,
    logs,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => ({ round, creatures })),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => { state[`${key}.${prop}`] = value; }),
      addEntry: vi.fn(async (campaign, entry) => { logs.push(entry); }),
    },
  };
}

describe('MA-0399 Split registry + authored data', () => {
  it('registry resolves split; unregistered reaction rows stay byte-inert (null)', () => {
    expect(getGatedMonsterReaction(PUDDING)?.effect).toBe('split');
    expect(getGatedMonsterReaction({ name: 'Mace', description: 'Hit: 1d6+2 bludgeoning.' })).toBeNull();
  });

  it('monsters.json Black Pudding reactions[0] carries the automation metadata, prose intact', () => {
    const monster = monsters.find(m => m.index === 'black-pudding');
    const row = monster.reactions[0];
    expect(row.name).toBe('Split');
    expect(row.automation).toMatchObject({ type: 'reaction', trigger: 'bloodied_or_lightning_slashing', effect: 'split', minHp: 10, damageTypes: ['Lightning', 'Slashing'] });
    expect(row.usage).toBe('At Will');
    expect(row.maxUses).toBe(999);
    expect(row.description).toMatch(/^Trigger: While the pudding is Large or Medium/);
  });

  it('oneSizeSmaller walks the ladder, unknown/Tiny return null', () => {
    expect(oneSizeSmaller('Large')).toBe('Medium');
    expect(oneSizeSmaller('Medium')).toBe('Small');
    expect(oneSizeSmaller('Huge')).toBe('Large');
    expect(oneSizeSmaller('Tiny')).toBeNull();
    expect(oneSizeSmaller(null)).toBeNull();
  });
});

describe('MA-0399 splitTriggerEvidence', () => {
  const auto = PUDDING.automation;

  it('bloodied combatant (30/68, Large, 10+ HP) satisfies via bloodied — no attack needed', () => {
    const t = splitTriggerEvidence({ lastAttack: null, monster: combatant({ currentHp: 30 }), auto });
    expect(t).toMatchObject({ satisfied: true, via: 'bloodied', hp: 30, maxHp: 68 });
  });

  it('bloodied boundary: exactly floor(maxHp/2) counts, one above does not', () => {
    expect(splitTriggerEvidence({ lastAttack: null, monster: combatant({ currentHp: 34 }), auto }).satisfied).toBe(true);
    expect(splitTriggerEvidence({ lastAttack: null, monster: combatant({ currentHp: 35 }), auto }).satisfied).toBe(false);
  });

  it('bloodied below the 10+ HP floor does NOT satisfy (RAW)', () => {
    const t = splitTriggerEvidence({ lastAttack: null, monster: combatant({ maxHp: 16, currentHp: 8 }), auto });
    expect(t.satisfied).toBe(false);
    expect(t.reason).toBe('trigger');
  });

  it('lightning lastAttack against the pudding satisfies even while NOT bloodied', () => {
    const t = splitTriggerEvidence({ lastAttack: slashingAttack({ damageTypes: ['Lightning'], primaryDamageType: 'Lightning' }), monster: combatant({ currentHp: 60 }), auto });
    expect(t).toMatchObject({ satisfied: true, via: 'damage_type', damageType: 'Lightning' });
  });

  it('immune lightning/slashing hit (actualDamage 0) still counts as "subjected to"', () => {
    const t = splitTriggerEvidence({ lastAttack: slashingAttack({ actualDamage: 0 }), monster: combatant(), auto });
    expect(t).toMatchObject({ satisfied: true, via: 'damage_type', damageType: 'Slashing' });
  });

  it('piercing damage against a non-bloodied pudding refuses (trigger)', () => {
    const t = splitTriggerEvidence({ lastAttack: slashingAttack({ damageTypes: ['Piercing'], primaryDamageType: 'Piercing' }), monster: combatant({ currentHp: 60 }), auto });
    expect(t.satisfied).toBe(false);
    expect(t.reason).toBe('trigger');
  });

  it('elemental damage aimed at ANOTHER creature does not satisfy', () => {
    const t = splitTriggerEvidence({ lastAttack: slashingAttack({ targetName: 'AasimarTest' }), monster: combatant({ currentHp: 60 }), auto });
    expect(t.satisfied).toBe(false);
  });

  it('Small combatant refuses (size)', () => {
    const t = splitTriggerEvidence({ lastAttack: null, monster: combatant({ size: 'Small', maxHp: 20, currentHp: 10 }), auto });
    expect(t.satisfied).toBe(false);
    expect(t.reason).toBe('size');
  });

  it('missing combatant refuses (combatant)', () => {
    expect(splitTriggerEvidence({ lastAttack: null, monster: null, auto }).reason).toBe('combatant');
  });
});

describe('MA-0399 splitGate latch + event stamps', () => {
  const auto = PUDDING.automation;

  it('same-round second use refuses (round latch)', () => {
    const gate = splitGate({ lastAttack: slashingAttack(), monster: combatant({ currentHp: 30 }), monsterName: MONSTER, currentRound: 4, usedRound: 4, auto });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('round');
  });

  it('same-damage-event second click refuses (splitResolved stamp)', () => {
    const gate = splitGate({ lastAttack: slashingAttack({ splitResolved: true, splitBy: MONSTER }), monster: combatant({ currentHp: 30 }), monsterName: MONSTER, currentRound: 4, usedRound: 0, auto });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('reacted');
  });

  it('fresh trigger allows with floor(hp/2) eachHp — odd HP floors down', () => {
    const gate = splitGate({ lastAttack: null, monster: combatant({ currentHp: 31 }), monsterName: MONSTER, currentRound: 5, usedRound: 4, auto });
    expect(gate.ok).toBe(true);
    expect(gate.eachHp).toBe(15);
  });
});

describe('MA-0399 resolveMonsterSplit via resolveMonsterGatedReaction', () => {
  it('refusal (no trigger): split_refused logged, zero writes, refusal popup', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: slashingAttack({ damageTypes: ['Piercing'], targetName: 'AasimarTest' }), creatures: [combatant({ currentHp: 60 })] });
    const result = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('split_refused');
    expect(result.popupHtml).toMatch(/Split Refused/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('not-in-encounter refuses with zero writes', async () => {
    const { logs, deps } = makeDeps({ lastAttack: null, creatures: [] });
    const result = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('split_refused');
    expect(logs[0].description).toMatch(/combatant/);
  });

  it('bloodied accept: round latch stamped, At Will spends NO uses, ability_use carries Medium + 15/15 duplication instruction + popup', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: null, round: 3, creatures: [combatant({ currentHp: 30 })] });
    const result = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(state[`${MONSTER}._split_usedRound`]).toBe(3);
    expect(state[`${MONSTER}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Split');
    expect(spend.description).toMatch(/Bloodied at 30\/68/);
    expect(spend.description).toMatch(/two Medium Black Puddings at 15\/15 HP each/);
    expect(result.eachHp).toBe(15);
    expect(result.newSize).toBe('Medium');
    expect(result.popupHtml).toMatch(/GM-Executed Duplication/);
    expect(result.popupHtml).toMatch(/15\/15 HP each/);
  });

  it('slashing-impact accept (immune, 0 dealt): stamps lastAttack splitResolved + splitIntoHp', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: slashingAttack({ actualDamage: 0 }), round: 2, creatures: [combatant({ currentHp: 68 })] });
    const result = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.eachHp).toBe(34);
    const stamped = state['campaign.lastAttack'];
    expect(stamped.splitResolved).toBe(true);
    expect(stamped.splitBy).toBe(MONSTER);
    expect(stamped.splitIntoHp).toBe(34);
    expect(logs.find(l => l.type === 'ability_use').description).toMatch(/subjected to Slashing damage/);
  });

  it('same-round second click refuses with zero additional writes', async () => {
    const { logs, deps } = makeDeps({
      lastAttack: null,
      round: 6,
      creatures: [combatant({ currentHp: 30 })],
      store: { [`${MONSTER}._split_usedRound`]: 6 },
    });
    const result = await resolveMonsterGatedReaction({ action: PUDDING, monsterName: MONSTER, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('split_refused');
    expect(logs[0].description).toMatch(/round/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });
});
