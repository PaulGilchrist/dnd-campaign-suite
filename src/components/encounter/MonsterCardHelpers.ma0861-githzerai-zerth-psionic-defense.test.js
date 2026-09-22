// MA-0861 regression: Githzerai Zerth "Psionic Defense" (2/Day) — disk row was the
// MA-0853 byte-twin (name/description/spellcasting_ability/uses-string) = gate-null
// inert, zero affordance. Fix authors the same MA-0006 feather_fall byte-shape onto
// the existing live seam: automation {type,trigger:'falling',effect:'feather_fall'} +
// numeric uses/maxUses 2 + usage "2/Day" — byte-identical to the fixed githzerai-monk
// row. Shield half stays GM-adjudicated advisory in automation.description.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  monsterReactionGate,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const ROW = monsters.find(m => m.index === 'githzerai-zerth').reactions[0];
const ZERTH = 'Githzerai Zerth 1';
const CAMPAIGN = 'test-campaign';

function fallingAttack(overrides = {}) {
  return { trigger: 'falling', attackerName: ZERTH, targetName: ZERTH, ...overrides };
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

describe('MA-0861 Zerth Psionic Defense row shape + gate arming', () => {
  it('disk reactions[0] carries the MA-0006 feather_fall byte-shape with 2/Day', () => {
    expect(ROW.name).toBe('Psionic Defense');
    expect(ROW.description).toContain('<strong>Feather Fall</strong> or <strong>Shield</strong>');
    expect(ROW.spellcasting_ability).toBe('Wisdom');
    expect(ROW.automation).toMatchObject({ type: 'reaction', trigger: 'falling', effect: 'feather_fall' });
    expect(ROW.automation.description).toMatch(/GM adjudicates.*Shield.*no mechanical consumer/);
    expect(ROW.usage).toBe('2/Day');
    expect(ROW.uses).toBe(2);
    expect(ROW.maxUses).toBe(2);
  });

  it('row is byte-twin of fixed MA-0853 githzerai-monk reactions[0]', () => {
    const monk = monsters.find(m => m.index === 'githzerai-monk').reactions[0];
    expect(JSON.stringify(ROW, Object.keys(ROW).sort())).toBe(JSON.stringify(monk, Object.keys(monk).sort()));
  });

  it('getGatedMonsterReaction arms the chip on effect feather_fall', () => {
    expect(getGatedMonsterReaction(ROW)?.effect).toBe('feather_fall');
    expect(getGatedMonsterReaction({ name: 'Plain', description: 'No automation.' })).toBeNull();
  });

  it('numeric uses gate: chip counter reads 2 fresh, spends down to 0', () => {
    expect(monsterReactionUsesRemaining(ROW, {})).toBe(2);
    expect(monsterReactionUsesRemaining(ROW, { feather_fall: 1 })).toBe(1);
    expect(monsterReactionUsesRemaining(ROW, { feather_fall: 2 })).toBe(0);
    const gate = monsterReactionGate({ def: getGatedMonsterReaction(ROW), action: ROW, monsterName: ZERTH, lastAttack: fallingAttack(), currentRound: 1, storedUses: {}, usedRound: 0 });
    expect(gate.ok).toBe(true);
    expect(gate.limit).toBe(2);
  });
});

describe('MA-0861 resolveMonsterGatedReaction — 2/Day spend then refusal', () => {
  it('first fall: spend 1, ability_use log shows 1 left today', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: fallingAttack(), round: 2 });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: ZERTH, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(state[`${ZERTH}._feather_fall_usedRound`]).toBe(2);
    expect(state[`${ZERTH}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 1 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Feather Fall');
    expect(spend.description).toMatch(/2\/Day · 1 left today/);
  });

  it('second fall (new round): spend 2, log shows 0 left today', async () => {
    const { state, logs, deps } = makeDeps({
      lastAttack: fallingAttack(),
      round: 5,
      store: { [`${ZERTH}._feather_fall_usedRound`]: 2, [`${ZERTH}.${MONSTER_REACTION_USES_KEY}`]: { feather_fall: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: ZERTH, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(state[`${ZERTH}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 2 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toMatch(/2\/Day · 0 left today/);
  });

  it('third fall at 2/Day exhaustion: feather_fall_refused, zero spend', async () => {
    const { state, logs, deps } = makeDeps({
      lastAttack: fallingAttack(),
      round: 8,
      store: { [`${ZERTH}._feather_fall_usedRound`]: 5, [`${ZERTH}.${MONSTER_REACTION_USES_KEY}`]: { feather_fall: 2 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: ZERTH, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('feather_fall_refused');
    expect(logs[0].description).toMatch(/uses already spent today/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${ZERTH}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 2 });
  });

  it('no falling event: feather_fall_refused (trigger), zero spend', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: ZERTH, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('feather_fall_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${ZERTH}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });
});
