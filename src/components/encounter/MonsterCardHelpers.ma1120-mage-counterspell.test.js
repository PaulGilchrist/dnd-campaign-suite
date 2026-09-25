// MA-1120: SRD Mage "Protective Magic" reaction was prose-only inert
// (name+trigger+description only → getGatedMonsterReaction null → zero
// affordance). DATA fix mirrors the MA-0300 Arcanaloth RAW-unlimited At
// Will sentinel: usage "At Will" + uses/maxUses 999 + automation
// {type:'reaction', trigger:'enemy_spell_cast', effect:'counterspell'}.
// RAW residual: the row prose offers a Counterspell-OR-Shield choice; the
// gated seam resolves Counterspell only (accepted per MA-0314 archmage).
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
const MAGE = 'Mage 1';
const PC = 'DivinationWizard';
// Mage INT 17 → +3 spellcasting mod (prose: "same spellcasting
// ability as Spellcasting" = Intelligence).
const INT_MOD = 3;

const MAGE_ACTION = monsters.find(m => m.index === 'mage').reactions[0];

function pcSpellAttack(overrides = {}) {
  return { attackerName: PC, targetName: MAGE, attackName: 'Fire Bolt', rollType: 'spell-attack', attackType: 'spell', damageSchool: 'Evocation', isCantrip: true, ...overrides };
}

function csWithPC(round = 1) {
  return { round, creatures: [{ name: PC, type: 'player' }, { name: MAGE, type: 'npc' }] };
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
      resolveSpellLevel: vi.fn(async la => (la?.isCantrip ? 0 : Number(la?.spellLevel ?? 3))),
    },
  };
}

describe('MA-1120 mage Protective Magic data-lock', () => {
  it('monsters.json mage reactions[0] carries the MA-0300 At Will sentinel + automation shape', () => {
    expect(MAGE_ACTION.name).toBe('Protective Magic');
    expect(MAGE_ACTION.trigger).toBe('The mage is targeted by a spell');
    expect(MAGE_ACTION.description).toMatch(/Counterspell<\/strong> or <strong>Shield/);
    expect(MAGE_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(MAGE_ACTION.maxUses).toBe(999);
    expect(MAGE_ACTION.uses).toBe(999);
    expect(getGatedMonsterReaction(MAGE_ACTION)?.effect).toBe('counterspell');
  });

  it('usage renders as honest "At Will" passthrough', () => {
    expect(MAGE_ACTION.usage).toBe('At Will');
    expect(formatActionUsage(MAGE_ACTION.usage)).toBe('At Will');
  });

  it('monsterReactionUsesRemaining counts down from the 999 RAW-unlimited sentinel', () => {
    expect(monsterReactionUsesRemaining(MAGE_ACTION, {})).toBe(999);
    expect(monsterReactionUsesRemaining(MAGE_ACTION, { counterspell: 4 })).toBe(995);
  });
});

describe('MA-1120 resolveMonsterGatedReaction — mage Protective Magic', () => {
  it('spell level <3 auto-countered, 1 spent, cast stamped counterspellResolved', async () => {
    const { state, logs, campaignWrites, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 1 }) });
    const result = await resolveMonsterGatedReaction({ action: MAGE_ACTION, monsterName: MAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(true);
    expect(state[`${MAGE}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Counterspell');
    expect(spend.description).toMatch(/auto-countered/);
    expect(campaignWrites[0]).toMatchObject({ counterspellResolved: true, counteredBy: MAGE });
    expect(deps.rollD20).not.toHaveBeenCalled();
  });

  it('level >=3 rolls d20+INT(+3) vs DC 10+level (CLA-322 shape)', async () => {
    const { logs, deps } = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 3, isCantrip: false }), d20: 10 });
    const result = await resolveMonsterGatedReaction({ action: MAGE_ACTION, monsterName: MAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.countered).toBe(true);
    expect(logs.find(l => l.abilityName === 'Counterspell').description).toMatch(/d20 \(10\) \+ 3 = 13 vs DC 13/);
  });

  it('same-round second click refuses via round latch with zero additional spend', async () => {
    const { state, logs, deps } = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 1 }),
      round: 3,
      store: { [`${MAGE}._counterspell_usedRound`]: 3, [`${MAGE}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: MAGE_ACTION, monsterName: MAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(state[`${MAGE}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
  });

  it('no PC spell lastAttack: counterspell_refused (trigger), zero spend', async () => {
    const { state, logs, deps } = makeCounterDeps({ lastAttack: { attackerName: PC, attackName: 'Mace', weaponType: 'melee' } });
    const result = await resolveMonsterGatedReaction({ action: MAGE_ACTION, monsterName: MAGE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('counterspell_refused');
    expect(state[`${MAGE}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('counterspellGate sentinel: 998 spends still admits (RAW-unlimited honest cap)', () => {
    const gate = (used) => counterspellGate({ lastAttack: pcSpellAttack({ spellLevel: 1 }), attackerIsPC: true, monsterName: MAGE, currentRound: used + 1, storedUses: { counterspell: used }, usedRound: 0, action: MAGE_ACTION });
    expect(gate(0).ok).toBe(true);
    expect(gate(998).ok).toBe(true);
    expect(gate(999).ok).toBe(false);
    expect(gate(999).reason).toBe('uses');
  });
});
