// MA-0857 regression: Githzerai Psion "Psionic Defense" (RAW unlimited) — disk row was
// prose-only (name/description/spellcasting_ability) = gate-null inert, zero affordance.
// Fix authors the MA-0006 feather_fall byte-shape onto the existing live seam: automation
// {type,trigger:'falling',effect:'feather_fall'} + At-Will sentinel usage:"At Will" +
// numeric uses/maxUses 999 (MA-0006/0300/0305 At-Will lineage — MA-0853 twin authored
// 2/2 here; this row is RAW-unlimited). Shield half stays GM-adjudicated advisory in
// automation.description. githzerai-zerth since fixed in MA-0861 — pinned in its own test.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  monsterReactionGate,
  resolveMonsterGatedReaction,
  formatActionUsage,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const ROW = monsters.find(m => m.index === 'githzerai-psion').reactions[0];
const PSION = 'Githzerai Psion 1';
const CAMPAIGN = 'test-campaign';

function fallingAttack(overrides = {}) {
  return { trigger: 'falling', attackerName: PSION, targetName: PSION, ...overrides };
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

describe('MA-0857 Psionic Defense row shape + gate arming', () => {
  it('disk reactions[0] carries the MA-0006 feather_fall byte-shape with At-Will 999 sentinel', () => {
    expect(ROW.name).toBe('Psionic Defense');
    expect(ROW.description).toContain('<strong>Feather Fall</strong> or <strong>Shield</strong>');
    expect(ROW.spellcasting_ability).toBe('Intelligence');
    expect(ROW.automation).toMatchObject({ type: 'reaction', trigger: 'falling', effect: 'feather_fall' });
    expect(ROW.automation.description).toMatch(/GM adjudicates.*Shield.*no mechanical consumer/);
    expect(ROW.usage).toBe('At Will');
    expect(ROW.uses).toBe(999);
    expect(ROW.maxUses).toBe(999);
    expect(formatActionUsage(ROW.usage)).toBe('At Will');
  });

  it('getGatedMonsterReaction arms the chip on effect feather_fall', () => {
    expect(getGatedMonsterReaction(ROW)?.effect).toBe('feather_fall');
    expect(getGatedMonsterReaction({ name: 'Plain', description: 'No automation.' })).toBeNull();
  });

  it('At-Will numeric gate: chip counter reads 999 fresh, spends down honestly', () => {
    expect(monsterReactionUsesRemaining(ROW, {})).toBe(999);
    expect(monsterReactionUsesRemaining(ROW, { feather_fall: 1 })).toBe(998);
    const gate = monsterReactionGate({ def: getGatedMonsterReaction(ROW), action: ROW, monsterName: PSION, lastAttack: fallingAttack(), currentRound: 1, storedUses: {}, usedRound: 0 });
    expect(gate.ok).toBe(true);
    expect(gate.limit).toBe(999);
  });

  // zerth null-pin dropped: gated in MA-0861 (byte-twin of MA-0853); monk pin kept.
  it('ma0853 monk row intact beside fixed zerth', () => {
    const zerth = monsters.find(m => m.index === 'githzerai-zerth').reactions[0];
    expect(getGatedMonsterReaction(zerth)?.effect).toBe('feather_fall');
    expect(zerth.usage).toBe('2/Day');
    const monk = monsters.find(m => m.index === 'githzerai-monk').reactions[0];
    expect(getGatedMonsterReaction(monk)?.effect).toBe('feather_fall');
    expect(monk.usage).toBe('2/Day');
    expect(monk.maxUses).toBe(2);
  });
});

describe('MA-0857 resolveMonsterGatedReaction — At-Will spend, round latch, refusals', () => {
  it('first fall: spend 1, arm round latch, ability_use log shows 998 left today', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: fallingAttack(), round: 2 });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: PSION, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(state[`${PSION}._feather_fall_usedRound`]).toBe(2);
    expect(state[`${PSION}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 1 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Feather Fall');
    expect(spend.description).toMatch(/998 left today/);
  });

  it('second fall same round: feather_fall_refused (round), zero spend', async () => {
    const { state, logs, deps } = makeDeps({
      lastAttack: fallingAttack(),
      round: 3,
      store: { [`${PSION}._feather_fall_usedRound`]: 3, [`${PSION}.${MONSTER_REACTION_USES_KEY}`]: { feather_fall: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: PSION, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('feather_fall_refused');
    expect(logs[0].description).toMatch(/round/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${PSION}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 1 });
  });

  it('fall on a later round: At-Will refills, spend 2, log shows 997 left today', async () => {
    const { state, logs, deps } = makeDeps({
      lastAttack: fallingAttack(),
      round: 4,
      store: { [`${PSION}._feather_fall_usedRound`]: 3, [`${PSION}.${MONSTER_REACTION_USES_KEY}`]: { feather_fall: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: PSION, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(state[`${PSION}._feather_fall_usedRound`]).toBe(4);
    expect(state[`${PSION}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 2 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toMatch(/997 left today/);
  });

  it('no falling event: feather_fall_refused (trigger), zero spend', async () => {
    const { state, logs, deps } = makeDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: ROW, monsterName: PSION, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('feather_fall_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${PSION}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });
});
