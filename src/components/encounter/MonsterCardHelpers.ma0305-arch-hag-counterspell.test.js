// MA-0305: Arch-hag "Tongue Twister" reaction was prose-only inert (no
// automation metadata → getGatedMonsterReaction null → zero affordance).
// DATA fix byte-mirrors the live MA-0300 Arcanaloth template. RAW note:
// the arch-hag statblock prose carries NO per-day limit (unlimited
// reaction), but the gated seam's reactionMaxUses defaults to 1 when uses
// are absent — a usage-less row would fabricate a "1/Day uses already spent"
// refusal after a single counter. Honest sentinel: usage "At Will" (display
// truth, formatActionUsage string passthrough) + 999 maxUses (seam requires
// a finite number; effectively unlimited in play; reset is GM-enforced
// advisory per CLA-325, same as all monster uses).
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
const HAG = 'Arch-hag 1';
const PC = 'DivinationWizard';
// Arch-hag CHA 25 → +7 spellcasting mod (prose: "same spellcasting
// ability as Spellcasting" = Charisma). Test overrides deps.spellAbilityMod
// (live monsterSpellcastingMod hardcodes WIS — pre-existing MA-0300 seam
// quirk, not MA-0305 scope).
const CHA_MOD = 7;

const HAG_ACTION = monsters.find(m => m.index === 'arch-hag').reactions[0];

function pcSpellAttack(overrides = {}) {
  return { attackerName: PC, targetName: HAG, attackName: 'Fire Bolt', rollType: 'attack', damageSchool: 'Evocation', isCantrip: true, ...overrides };
}

function csWithPC(round = 1) {
  return { round, creatures: [{ name: PC, type: 'player' }, { name: HAG, type: 'npc' }] };
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
      spellAbilityMod: CHA_MOD,
      resolveSpellLevel: vi.fn(async la => (la?.isCantrip ? 0 : 3)),
    },
  };
}

describe('MA-0305 arch-hag Tongue Twister data-lock', () => {
  it('monsters.json arch-hag reactions[0] carries the MA-0013/MA-0300 automation shape', () => {
    expect(HAG_ACTION.name).toBe('Tongue Twister');
    expect(HAG_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(HAG_ACTION.maxUses).toBe(999);
    expect(HAG_ACTION.uses).toBe(999);
    expect(getGatedMonsterReaction(HAG_ACTION)?.effect).toBe('counterspell');
  });

  it('usage renders as honest "At Will" (RAW unlimited) — never [object Object]', () => {
    expect(HAG_ACTION.usage).toBe('At Will');
    expect(formatActionUsage(HAG_ACTION.usage)).toBe('At Will');
  });

  it('usage-less row would fabricate a 1/Day cap (why the 999 sentinel is required)', () => {
    // reactionMaxUses defaults to 1 with no uses/maxUses authored — this
    // documents the seam constraint that forces the finite sentinel.
    const usageless = { name: 'Tongue Twister', automation: { type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' } };
    const g = counterspellGate({ lastAttack: pcSpellAttack(), attackerIsPC: true, monsterName: HAG, currentRound: 1, storedUses: { counterspell: 1 }, usedRound: 0, action: usageless });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe('uses');
    expect(g.message).toMatch(/1\/Day uses already spent/);
    // The authored sentinel row stays open at 1 spent (RAW-unlimited behavior):
    const sentinel = counterspellGate({ lastAttack: pcSpellAttack(), attackerIsPC: true, monsterName: HAG, currentRound: 1, storedUses: { counterspell: 1 }, usedRound: 0, action: HAG_ACTION });
    expect(sentinel.ok).toBe(true);
    expect(sentinel.limit).toBe(999);
  });

  it('monsterReactionUsesRemaining counts down from the sentinel', () => {
    expect(monsterReactionUsesRemaining(HAG_ACTION, {})).toBe(999);
    expect(monsterReactionUsesRemaining(HAG_ACTION, { counterspell: 2 })).toBe(997);
  });
});

describe('MA-0305 resolveMonsterGatedReaction — arch-hag Tongue Twister', () => {
  it('cantrip (<3) auto-countered via CHA check seam, 1 spent, cast stamped resolved', async () => {
    const { state, logs, campaignWrites, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 0 }) });
    const result = await resolveMonsterGatedReaction({ action: HAG_ACTION, monsterName: HAG, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(true);
    expect(state[`${HAG}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Counterspell');
    expect(spend.description).toMatch(/Fire Bolt/);
    expect(spend.description).toMatch(/auto-countered/);
    expect(campaignWrites[0]).toMatchObject({ counterspellResolved: true, counteredBy: HAG, counteredSpell: 'Fire Bolt' });
    expect(deps.rollD20).not.toHaveBeenCalled();
  });

  it('level >=3 uses d20+CHA(+7) vs DC 10+level (CLA-322 shape)', async () => {
    const { logs, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 3, isCantrip: false }), d20: 5 });
    const result = await resolveMonsterGatedReaction({ action: HAG_ACTION, monsterName: HAG, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(false);
    expect(logs.find(l => l.abilityName === 'Counterspell').description).toMatch(/d20 \(5\) \+ 7 = 12 vs DC 13 — failed — spell resolves/);
  });

  it('no PC spell lastAttack: counterspell_refused (trigger), zero spend', async () => {
    const { state, logs, deps } = makeCounterDeps({ lastAttack: { attackerName: PC, attackName: 'Mace', weaponType: 'melee' } });
    const result = await resolveMonsterGatedReaction({ action: HAG_ACTION, monsterName: HAG, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(logs[0].description).toMatch(/trigger/);
    expect(state[`${HAG}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('RAW-unlimited: a fresh-round second counter is NOT refused (sentinel holds)', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 4,
      store: { [`${HAG}._counterspell_usedRound`]: 2, [`${HAG}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: HAG_ACTION, monsterName: HAG, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(logs.some(l => l.automationType === 'counterspell_refused')).toBe(false);
    expect(state[`${HAG}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 2 });
  });

  it('same-round second click refuses via round latch with zero additional spend', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 3,
      store: { [`${HAG}._counterspell_usedRound`]: 3, [`${HAG}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: HAG_ACTION, monsterName: HAG, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(state[`${HAG}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
  });
});
