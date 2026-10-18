// @maintained-by-ai
// MA-0314: Archmage "Protective Magic (3/Day)" reaction was prose-only inert
// (bare name+description row → getGatedMonsterReaction null → zero affordance).
// DATA fix mirrors the verified MA-0013 Aberrant Cultist / MA-0300 Arcanaloth
// templates: usage "3/Day" + numeric uses/maxUses + automation
// {type:'reaction', trigger:'enemy_spell_cast', effect:'counterspell'}.
// RAW residual: the row prose offers a Counterspell-OR-Shield choice; the
// gated seam resolves Counterspell only (accepted per MA-0300 pattern).
// Trim #518-map: generic counterspell seams cited-removed — uses arithmetic
// + plain-row null-negative gated-reaction.test.js:62-69; CLA-322 check
// arithmetic :198-208; auto/check press walk + spend + cast stamp :219-242;
// zero-spend refusals incl. no-spell trigger and same-round latch
// :244-259 (mage twin ma1120:104/:116 repeats latch+trigger too);
// formatActionUsage string passthrough usage.test.js:10; At-Will press
// ladder ma0300:77-102. The ≥3 d20+INT leg was dropped as self-ref
// (#517 catch — spellAbilityMod was test-injected); the archmage's INT +5
// is instead pinned BY NAME on disk. Archmage-distinct residue owned here:
// the 3/Day economy fingerprint (distinct cap — cultist 2/Day, arcanaloth/
// mage/arch-hag 999 At-Will sentinels) exercised right at that limit:
// last admissible press spends to 0 with the "3/Day · 0 left today" byte,
// and the cap-exhausted press refuses zero-spend with "3/Day uses spent".
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const CAMPAIGN = 'test-campaign';
const ARCHMAGE = 'Archmage 1';
const PC = 'DivinationWizard';

// BY-name disk lock (#518 read: distinct authored economy, not sentinel).
const ARCHMAGE_REC = monsters.find(m => m.name === 'Archmage');
const ARCHMAGE_ACTION = ARCHMAGE_REC.reactions[0];

function pcSpellAttack(overrides = {}) {
  return { attackerName: PC, targetName: ARCHMAGE, attackName: 'Fire Bolt', rollType: 'attack', damageSchool: 'Evocation', isCantrip: true, ...overrides };
}

function csWithPC(round = 1) {
  return { round, creatures: [{ name: PC, type: 'player' }, { name: ARCHMAGE, type: 'npc' }] };
}

function makeCounterDeps({ lastAttack = pcSpellAttack(), round = 1, store = {} } = {}) {
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
      rollD20: vi.fn(() => 20),
      spellAbilityMod: ARCHMAGE_REC.ability_score_modifiers.int,
      resolveSpellLevel: vi.fn(async la => (la?.isCantrip ? 0 : 3)),
    },
  };
}

describe('MA-0314 archmage Protective Magic disk fingerprint (BY NAME)', () => {
  it('Archmage reactions[0]: honest 3/Day economy + automation arms the gate; INT +5 pinned on disk', () => {
    expect(ARCHMAGE_REC.index).toBe('archmage');
    expect(ARCHMAGE_ACTION.name).toBe('Protective Magic (3/Day)');
    expect(ARCHMAGE_ACTION.usage).toBe('3/Day');
    expect(ARCHMAGE_ACTION.uses).toBe(3);
    expect(ARCHMAGE_ACTION.maxUses).toBe(3);
    expect(ARCHMAGE_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(getGatedMonsterReaction(ARCHMAGE_ACTION)?.effect).toBe('counterspell');
    // prose "same spellcasting ability as Spellcasting" = Intelligence, disk byte.
    expect(ARCHMAGE_REC.ability_scores.int).toBe(20);
    expect(ARCHMAGE_REC.ability_score_modifiers.int).toBe(5);
  });
});

describe('MA-0314 resolveMonsterGatedReaction — archmage 3/Day ladder at its limit', () => {
  it('last admissible press (2/3 spent): auto-counters, stamps 3rd spend, "3/Day · 0 left today", cast stamped', async () => {
    const { state, logs, campaignWrites, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 5,
      store: { [`${ARCHMAGE}._counterspell_usedRound`]: 2, [`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 2 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ARCHMAGE_ACTION, monsterName: ARCHMAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(true);
    expect(result.remaining).toBe(0);
    expect(state[`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 3 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Counterspell');
    expect(spend.description).toMatch(/Fire Bolt/);
    expect(spend.description).toMatch(/auto-countered/);
    expect(spend.description).toMatch(/3\/Day · 0 left today/);
    expect(campaignWrites[0]).toMatchObject({ counterspellResolved: true, counteredBy: ARCHMAGE, counteredSpell: 'Fire Bolt' });
    expect(deps.rollD20).not.toHaveBeenCalled();
  });

  it('3/3 spent on a fresh round: counterspell_refused (uses) with the archmage 3-cap byte, zero additional spend', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 5,
      store: { [`${ARCHMAGE}._counterspell_usedRound`]: 4, [`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 3 } },
    });
    const result = await resolveMonsterGatedReaction({ action: ARCHMAGE_ACTION, monsterName: ARCHMAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(logs[0].description).toMatch(/3\/Day uses already spent/);
    expect(state[`${ARCHMAGE}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 3 });
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });
});
