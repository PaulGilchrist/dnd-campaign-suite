// MA-0314: Archmage "Protective Magic (3/Day)" reaction was prose-only inert
// (bare name+description row → getGatedMonsterReaction null → zero affordance).
// DATA fix mirrors the verified MA-0013 Aberrant Cultist / MA-0300 Arcanaloth
// templates: usage "3/Day" + numeric uses/maxUses + automation
// {type:'reaction', trigger:'enemy_spell_cast', effect:'counterspell'}.
// RAW residual: the row prose offers a Counterspell-OR-Shield choice; the
// gated seam resolves Counterspell only (accepted per MA-0300 pattern).
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
const ARCHMAGE = 'Archmage 1';
const PC = 'DivinationWizard';
// Archmage INT 20 → +5 spellcasting mod (prose: "same spellcasting
// ability as Spellcasting" = Intelligence).
const INT_MOD = 5;

const ARCHMAGE_ACTION = monsters.find(m => m.index === 'archmage').reactions[0];

function pcSpellAttack(overrides = {}) {
  return { attackerName: PC, targetName: ARCHMAGE, attackName: 'Fire Bolt', rollType: 'attack', damageSchool: 'Evocation', isCantrip: true, ...overrides };
}

function csWithPC(round = 1) {
  return { round, creatures: [{ name: PC, type: 'player' }, { name: ARCHMAGE, type: 'npc' }] };
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

describe('MA-0314 archmage Protective Magic data-lock', () => {
  it('monsters.json archmage reactions[0] carries the MA-0013 automation shape', () => {
    expect(ARCHMAGE_ACTION.name).toBe('Protective Magic (3/Day)');
    expect(ARCHMAGE_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(ARCHMAGE_ACTION.maxUses).toBe(3);
    expect(ARCHMAGE_ACTION.uses).toBe(3);
    expect(getGatedMonsterReaction(ARCHMAGE_ACTION)?.effect).toBe('counterspell');
  });

  it('usage renders as honest "3/Day" passthrough', () => {
    expect(ARCHMAGE_ACTION.usage).toBe('3/Day');
    expect(formatActionUsage(ARCHMAGE_ACTION.usage)).toBe('3/Day');
  });

  it('monsterReactionUsesRemaining counts down 3→0 from the stamped cap', () => {
    expect(monsterReactionUsesRemaining(ARCHMAGE_ACTION, {})).toBe(3);
    expect(monsterReactionUsesRemaining(ARCHMAGE_ACTION, { counterspell: 1 })).toBe(2);
    expect(monsterReactionUsesRemaining(ARCHMAGE_ACTION, { counterspell: 3 })).toBe(0);
  });
});

describe('MA-0314 resolveMonsterGatedReaction — archmage Protective Magic', () => {
  it('cantrip (<3) auto-countered via INT seam, 1 spent, cast stamped resolved', async () => {
    const { state, logs, campaignWrites, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 0 }) });
    const result = await resolveMonsterGatedReaction({ action: ARCHMAGE_ACTION, monsterName: ARCHMAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(true);
    expect(state[`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Counterspell');
    expect(spend.description).toMatch(/Fire Bolt/);
    expect(spend.description).toMatch(/auto-countered/);
    expect(spend.description).toMatch(/3\/Day · 2 left today/);
    expect(campaignWrites[0]).toMatchObject({ counterspellResolved: true, counteredBy: ARCHMAGE, counteredSpell: 'Fire Bolt' });
    expect(deps.rollD20).not.toHaveBeenCalled();
  });

  it('level >=3 uses d20+INT(+5) vs DC 10+level (CLA-322 shape)', async () => {
    const { logs, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 3, isCantrip: false }), d20: 7 });
    const result = await resolveMonsterGatedReaction({ action: ARCHMAGE_ACTION, monsterName: ARCHMAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(false);
    expect(logs.find(l => l.abilityName === 'Counterspell').description).toMatch(/d20 \(7\) \+ 5 = 12 vs DC 13 — failed — spell resolves/);
  });

  it('all 3 uses spent: counterspell_refused (uses), zero additional spend', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 5,
      store: { [`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 3 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ARCHMAGE_ACTION, monsterName: ARCHMAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(logs[0].description).toMatch(/3\/Day uses already spent/);
    expect(state[`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 3 });
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('same-round second click refuses via round latch with zero additional spend', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 3,
      store: { [`${ARCHMAGE}._counterspell_usedRound`]: 3, [`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ARCHMAGE_ACTION, monsterName: ARCHMAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(state[`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
  });

  it('no PC spell lastAttack: counterspell_refused (trigger), zero spend', async () => {
    const { state, logs, deps } = makeCounterDeps({ lastAttack: { attackerName: PC, attackName: 'Mace', weaponType: 'melee' } });
    const result = await resolveMonsterGatedReaction({ action: ARCHMAGE_ACTION, monsterName: ARCHMAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(state[`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('counterspellGate honors the authored 3-cap across fresh rounds until exhausted', () => {
    const gate = (used) => counterspellGate({ lastAttack: pcSpellAttack(), attackerIsPC: true, monsterName: ARCHMAGE, currentRound: used + 1, storedUses: { counterspell: used }, usedRound: 0, action: ARCHMAGE_ACTION });
    expect(gate(0).ok).toBe(true);
    expect(gate(2).ok).toBe(true);
    expect(gate(3).ok).toBe(false);
    expect(gate(3).reason).toBe('uses');
  });
});
