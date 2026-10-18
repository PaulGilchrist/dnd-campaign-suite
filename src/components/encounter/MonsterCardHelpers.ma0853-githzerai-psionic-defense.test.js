// @maintained-by-ai: 2026-10-18 — MA-0853 OWNER: githzerai-monk Psionic Defense 2/Day disk lock + limit-2 economy
// MA-0853 regression: Githzerai Monk "Psionic Defense" (2/Day) — disk row was
// prose-only (name/description/spellcasting_ability/uses-string) = gate-null inert,
// zero affordance. Fix authors the MA-0006 feather_fall byte-shape onto the existing
// live seam: automation {type,trigger:'falling',effect:'feather_fall'} + numeric
// uses/maxUses 2 + usage "2/Day". Shield half stays GM-adjudicated advisory
// (record-only resolver has no per-row instruction popup — advisory lives in
// automation.description). Siblings since fixed in their own tickets:
// githzerai-psion (MA-0857), githzerai-zerth (MA-0861).
// #508 trim: plain-row→null (owner gated-reaction.test.js:66, file-wide canon),
// trigger/actor/round refusal branches and fresh-1/Day uses arithmetic are owner
// computation legs — cite-skipped here. This file pins ONLY this row's distinct
// arm: the maxUses:2 data-lock and its honest limit-2 sequential spend economy
// (second press succeeding at used=1 proves reactionMaxUses reads 2, never 1).
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  monsterReactionGate,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const ROW = monsters.find(m => m.index === 'githzerai-monk').reactions[0];
const MONK = 'Githzerai Monk 1';
const CAMPAIGN = 'test-campaign';

function fallingAttack(overrides = {}) {
  return { trigger: 'falling', attackerName: MONK, targetName: MONK, ...overrides };
}

function makeDeps({ lastAttack = null, round = 1 } = {}) {
  const state = {};
  const logs = [];
  const ctx = { round };
  return {
    state,
    logs,
    ctx,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => ctx),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => { state[`${key}.${prop}`] = value; }),
      addEntry: vi.fn(async (campaign, entry) => { logs.push(entry); }),
    },
  };
}

describe('MA-0853 Psionic Defense row shape + gate arming', () => {
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

  it('arms feather_fall chip; 2/Day uses arithmetic spends 2→1→0, gate limit honest at 2', () => {
    expect(getGatedMonsterReaction(ROW)?.effect).toBe('feather_fall');
    expect(monsterReactionUsesRemaining(ROW, {})).toBe(2);
    expect(monsterReactionUsesRemaining(ROW, { feather_fall: 1 })).toBe(1);
    expect(monsterReactionUsesRemaining(ROW, { feather_fall: 2 })).toBe(0);
    const gate = monsterReactionGate({ def: getGatedMonsterReaction(ROW), action: ROW, monsterName: MONK, lastAttack: fallingAttack(), currentRound: 1, storedUses: {}, usedRound: 0 });
    expect(gate.ok).toBe(true);
    expect(gate.limit).toBe(2);
  });
  // Stale-null sibling pins dropped: githzerai-zerth (MA-0861) and githzerai-psion
  // (MA-0857) rows now arm feather_fall chips — each pinned in its own test file.
});

describe('MA-0853 resolveMonsterGatedReaction — sequential 2/Day spend then refusal', () => {
  it('press spends 1 (1 left today); next round press spends 2 (0 left today); third press refuses uses, zero spend', async () => {
    const { state, logs, ctx, deps } = makeDeps({ lastAttack: fallingAttack(), round: 2 });

    const first = await resolveMonsterGatedReaction({ action: ROW, monsterName: MONK, campaignName: CAMPAIGN, deps });
    expect(first.ok).toBe(true);
    expect(state[`${MONK}._feather_fall_usedRound`]).toBe(2);
    expect(state[`${MONK}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 1 });
    const spend1 = logs.find(l => l.type === 'ability_use');
    expect(spend1.abilityName).toBe('Feather Fall');
    expect(spend1.description).toMatch(/2\/Day · 1 left today/);

    ctx.round = 5;
    const second = await resolveMonsterGatedReaction({ action: ROW, monsterName: MONK, campaignName: CAMPAIGN, deps });
    expect(second.ok).toBe(true);
    expect(state[`${MONK}._feather_fall_usedRound`]).toBe(5);
    expect(state[`${MONK}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 2 });
    const spend2 = logs.filter(l => l.type === 'ability_use')[1];
    expect(spend2.description).toMatch(/2\/Day · 0 left today/);

    const writesBeforeExhaustion = deps.setRuntimeValue.mock.calls.length;
    ctx.round = 8;
    const third = await resolveMonsterGatedReaction({ action: ROW, monsterName: MONK, campaignName: CAMPAIGN, deps });
    expect(third.ok).toBe(false);
    const refusal = logs[logs.length - 1];
    expect(refusal.automationType).toBe('feather_fall_refused');
    expect(refusal.description).toMatch(/\(uses\)/);
    expect(refusal.description).toMatch(/uses already spent today/);
    // Shared monsterReactionGate refusal prose hardcodes "1/Day" (MA-0006 twin
    // text; binding scope = DATA-only, no resolver edits) — gate math is still
    // limit-2 honest via reactionMaxUses(maxUses): refusal lands ONLY after the
    // two real spends above, never at one.
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(writesBeforeExhaustion);
    expect(state[`${MONK}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 2 });
  });
  // No-falling-event and same-round round-latch refusals: owner leg
  // gated-reaction.test.js:104-120 — cite-skipped per #508.
});
