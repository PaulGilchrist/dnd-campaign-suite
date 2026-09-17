// MA-0300: Arcanaloth Counterspell reaction was prose-only inert (no
// automation metadata → getGatedMonsterReaction null → zero affordance).
// DATA fix mirrors the live MA-0013 Aberrant Cultist template. RAW note:
// the arcanaloth statblock prose carries NO per-day limit (unlimited
// reaction), but the gated seam's reactionMaxUses defaults to 1 when uses
// are absent — a usage-less row would fabricate a "1/Day uses already spent"
// refusal after a single counter. Grep found NO usage-less/unlimited gated
// precedent (all feather_fall/counterspell rows carry uses). So the row
// honestly documents RAW-unlimited via usage "At Will" (display truth,
// formatActionUsage string passthrough) + a 999 sentinel maxUses (seam
// requires a finite number; effectively unlimited in play; reset is
// GM-enforced advisory per CLA-325, same as all monster uses).
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  monsterReactionUsesRemaining,
  resolveMonsterGatedReaction,
  counterspellGate,
  MONSTER_REACTION_USES_KEY,
  formatActionUsage,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const CAMPAIGN = 'test-campaign';
const ARCANA = 'Arcanaloth 1';
const PC = 'DivinationWizard';
// Arcanaloth INT 20 → +5 spellcasting mod (prose: "same spellcasting
// ability as Spellcasting" = Intelligence).
const INT_MOD = 5;

const ARCANA_ACTION = monsters.find(m => m.index === 'arcanaloth').reactions[0];

function pcSpellAttack(overrides = {}) {
  return { attackerName: PC, targetName: ARCANA, attackName: 'Fire Bolt', rollType: 'attack', damageSchool: 'Evocation', isCantrip: true, ...overrides };
}

function csWithPC(round = 1) {
  return { round, creatures: [{ name: PC, type: 'player' }, { name: ARCANA, type: 'npc' }] };
}

function makeCounterDeps({ lastAttack = pcSpellAttack(), round = 1, store = {}, d20 = 20 } = {}) {
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
      spellAbilityMod: INT_MOD,
      resolveSpellLevel: vi.fn(async la => (la?.isCantrip ? 0 : 3)),
    },
  };
}

describe('MA-0300 arcanaloth Counterspell data-lock', () => {
  it('monsters.json arcanaloth reactions[0] carries the MA-0013 automation shape', () => {
    expect(ARCANA_ACTION.name).toBe('Counterspell');
    expect(ARCANA_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(ARCANA_ACTION.maxUses).toBe(999);
    expect(ARCANA_ACTION.uses).toBe(999);
    expect(getGatedMonsterReaction(ARCANA_ACTION)?.effect).toBe('counterspell');
  });

  it('usage renders as honest "At Will" (RAW unlimited) — never [object Object]', () => {
    expect(ARCANA_ACTION.usage).toBe('At Will');
    expect(formatActionUsage(ARCANA_ACTION.usage)).toBe('At Will');
  });

  it('usage-less row would fabricate a 1/Day cap (why the 999 sentinel is required)', () => {
    // reactionMaxUses defaults to 1 with no uses/maxUses authored — this
    // documents the seam constraint that forces the finite sentinel.
    const usageless = { name: 'Counterspell', automation: { type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' } };
    const g = counterspellGate({ lastAttack: pcSpellAttack(), attackerIsPC: true, monsterName: ARCANA, currentRound: 1, storedUses: { counterspell: 1 }, usedRound: 0, action: usageless });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe('uses');
    expect(g.message).toMatch(/1\/Day uses already spent/);
    // The authored sentinel row stays open at 1 spent (RAW-unlimited behavior):
    const sentinel = counterspellGate({ lastAttack: pcSpellAttack(), attackerIsPC: true, monsterName: ARCANA, currentRound: 1, storedUses: { counterspell: 1 }, usedRound: 0, action: ARCANA_ACTION });
    expect(sentinel.ok).toBe(true);
    expect(sentinel.limit).toBe(999);
  });

  it('monsterReactionUsesRemaining counts down from the sentinel', () => {
    expect(monsterReactionUsesRemaining(ARCANA_ACTION, {})).toBe(999);
    expect(monsterReactionUsesRemaining(ARCANA_ACTION, { counterspell: 2 })).toBe(997);
  });
});

describe('MA-0300 resolveMonsterGatedReaction — arcanaloth Counterspell', () => {
  it('cantrip (<3) auto-countered via INT check seam, 1 spent, cast stamped resolved', async () => {
    const { state, logs, campaignWrites, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 0 }) });
    const result = await resolveMonsterGatedReaction({ action: ARCANA_ACTION, monsterName: ARCANA, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(true);
    expect(state[`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Counterspell');
    expect(spend.description).toMatch(/Fire Bolt/);
    expect(spend.description).toMatch(/auto-countered/);
    expect(campaignWrites[0]).toMatchObject({ counterspellResolved: true, counteredBy: ARCANA, counteredSpell: 'Fire Bolt' });
    expect(deps.rollD20).not.toHaveBeenCalled();
  });

  it('level >=3 uses d20+INT(+5) vs DC 10+level (CLA-322 shape)', async () => {
    const { logs, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 3, isCantrip: false }), d20: 7 });
    const result = await resolveMonsterGatedReaction({ action: ARCANA_ACTION, monsterName: ARCANA, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(false);
    expect(logs.find(l => l.abilityName === 'Counterspell').description).toMatch(/d20 \(7\) \+ 5 = 12 vs DC 13 — failed — spell resolves/);
  });

  it('no PC spell lastAttack: counterspell_refused (trigger), zero spend', async () => {
    const { state, logs, deps } = makeCounterDeps({ lastAttack: { attackerName: PC, attackName: 'Mace', weaponType: 'melee' } });
    const result = await resolveMonsterGatedReaction({ action: ARCANA_ACTION, monsterName: ARCANA, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(logs[0].description).toMatch(/trigger/);
    expect(state[`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('RAW-unlimited: a fresh-round second counter is NOT refused (sentinel holds)', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 4,
      store: { [`${ARCANA}._counterspell_usedRound`]: 2, [`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ARCANA_ACTION, monsterName: ARCANA, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(logs.some(l => l.automationType === 'counterspell_refused')).toBe(false);
    expect(state[`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 2 });
  });

  it('same-round second click refuses via round latch with zero additional spend', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 3,
      store: { [`${ARCANA}._counterspell_usedRound`]: 3, [`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ARCANA_ACTION, monsterName: ARCANA, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(state[`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
  });
});
