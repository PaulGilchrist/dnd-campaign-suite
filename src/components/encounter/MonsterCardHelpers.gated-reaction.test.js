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
