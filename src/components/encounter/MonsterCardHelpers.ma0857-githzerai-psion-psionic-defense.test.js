// @maintained-by-ai: 2026-10-18 — MA-0857 OWNER: githzerai-psion Psionic Defense At-Will 999 disk lock + spend economy
// MA-0857 regression: Githzerai Psion "Psionic Defense" (RAW unlimited) — disk row was
// prose-only (name/description/spellcasting_ability) = gate-null inert, zero affordance.
// Fix authors the MA-0006 feather_fall byte-shape onto the existing live seam: automation
// {type,trigger:'falling',effect:'feather_fall'} + At-Will sentinel usage:"At Will" +
// numeric uses/maxUses 999 (MA-0006/0300/0305 At-Will lineage). Shield half stays
// GM-adjudicated advisory in automation.description. Distinct limit vs siblings —
// githzerai-monk 2/Day owned MA-0853, githzerai-zerth 2/Day owned MA-0861.
// #520 trim: plain-row→null deleted (owner gated-reaction.test.js:66 file-wide canon);
// no-falling byte-copy deleted (owner scenario :106). #508 cite-skip: generic gate
// refusal/round-latch tables and uses arithmetic are owner computation legs.
// formatActionUsage('At Will') verbatim-string lane owned usage.test.js:8-12.
// Kept ONLY this row's distinct arms: BY-name disk lock (#387) + At-Will 999 sequential
// spend economy — honest 998→997 down-count the owner 1/Day and #520 limit-2 legs
// (#520 is the sequential-shape owner) never pin.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionGate,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const ROW = monsters.find(m => m.index === 'githzerai-psion').reactions[0];
const PSION = 'Githzerai Psion 1';
const CAMPAIGN = 'test-campaign';

function fallingAttack(overrides = {}) {
  return { trigger: 'falling', attackerName: PSION, targetName: PSION, ...overrides };
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

describe('MA-0857 Psionic Defense row shape + gate arming', () => {
  it('disk reactions[0] BY-name lock: feather_fall byte-shape, Intelligence, At Will 999 sentinel; gate honest at limit 999', () => {
    expect(ROW.name).toBe('Psionic Defense');
    expect(ROW.description).toContain('<strong>Feather Fall</strong> or <strong>Shield</strong>');
    expect(ROW.spellcasting_ability).toBe('Intelligence');
    expect(ROW.automation).toMatchObject({ type: 'reaction', trigger: 'falling', effect: 'feather_fall' });
    expect(ROW.automation.description).toMatch(/GM adjudicates.*Shield.*no mechanical consumer/);
    expect(ROW.usage).toBe('At Will');
    expect(ROW.uses).toBe(999);
    expect(ROW.maxUses).toBe(999);
    expect(getGatedMonsterReaction(ROW)?.effect).toBe('feather_fall');
    const gate = monsterReactionGate({ def: getGatedMonsterReaction(ROW), action: ROW, monsterName: PSION, lastAttack: fallingAttack(), currentRound: 1, storedUses: {}, usedRound: 0 });
    expect(gate.ok).toBe(true);
    expect(gate.limit).toBe(999);
  });
  // Plain-row→null: owner gated-reaction.test.js:66 file-wide canon (#520). Sibling rows
  // cross-pinned here deleted — zerth owns MA-0861, monk owns MA-0853.
});

describe('MA-0857 resolveMonsterGatedReaction — At-Will 999 sequential spend economy', () => {
  it('falls on successive rounds spend 1 then 2 (998→997 left today), sentinel never exhausts', async () => {
    const { state, logs, ctx, deps } = makeDeps({ lastAttack: fallingAttack(), round: 2 });

    const first = await resolveMonsterGatedReaction({ action: ROW, monsterName: PSION, campaignName: CAMPAIGN, deps });
    expect(first.ok).toBe(true);
    expect(state[`${PSION}._feather_fall_usedRound`]).toBe(2);
    expect(state[`${PSION}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 1 });
    const spend1 = logs.find(l => l.type === 'ability_use');
    expect(spend1.abilityName).toBe('Feather Fall');
    expect(spend1.description).toMatch(/998 left today/);

    ctx.round = 4;
    const second = await resolveMonsterGatedReaction({ action: ROW, monsterName: PSION, campaignName: CAMPAIGN, deps });
    expect(second.ok).toBe(true);
    expect(state[`${PSION}._feather_fall_usedRound`]).toBe(4);
    expect(state[`${PSION}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ feather_fall: 2 });
    const spend2 = logs.filter(l => l.type === 'ability_use')[1];
    expect(spend2.description).toMatch(/997 left today/);
  });
  // No-event and same-round round-latch refusals: owner legs gated-reaction.test.js:104-120
  // — cite-skipped per #508/#520 (byte-copy of owner scenario :106 deleted here).
});
