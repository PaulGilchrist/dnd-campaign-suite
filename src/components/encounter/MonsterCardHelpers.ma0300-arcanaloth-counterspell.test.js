// @maintained-by-ai 2026-11-28
// MA-0300: Arcanaloth Counterspell reaction was prose-only inert (no
// automation metadata → getGatedMonsterReaction null → zero affordance).
// DATA fix mirrors the live MA-0013 Aberrant Cultist template. RAW note: the
// arcanaloth prose carries NO per-day limit; the seam's reactionMaxUses
// defaults to 1 when uses are absent, so the row honestly documents
// RAW-unlimited via usage "At Will" + a 999 sentinel maxUses (finite number
// required by the seam; reset GM-enforced advisory per CLA-325).
// Ownership map (cross-file cites are describe-block references, never line
// numbers): BY-name disk lock for this row lives ONLY here (#387; the chip
// lane MonsterAction.ma0300-arcanaloth-chip owns chip render + counter echo
// — never restated). Cut legs + owners in
// MonsterCardHelpers.gated-reaction.test.js: uses arithmetic + plain-row
// null-negative → 'MA-0006 gated monster reaction registry'; gate limit-999
// admit → 'MA-0341 Parry owner — registry + gate truth tables' (parryGate
// limit-999 row); usage-less "fabricates a 1/Day cap" seam → 'MA-0013
// usage-less-row seam — fabricated 1/Day cap (relocated from ma0305)';
// CLA-322 dispel-check arithmetic → 'MA-0013 Counterspell registry + pure
// check' (resolveCounterspellCheck — the old d20+INT(+5) leg here was
// self-ref, the test injected its own spellAbilityMod); generic counterspell
// press mechanics (auto-counters no-roll, ability_use log, cast stamp) +
// zero-spend refusals → 'MA-0013 resolveMonsterGatedReaction — Counterspell'.
// What stays unique to this file: the disk lock + the RAW-unlimited press
// ladder (spends 1 per counter, fresh-round second counter never refused —
// the MA-0013 cultist caps 2/Day and At-Will parry never spends, so this
// ladder is owned nowhere else).
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const CAMPAIGN = 'test-campaign';
const ARCANA = 'Arcanaloth 1';
const PC = 'DivinationWizard';

const ARCANA_ACTION = monsters.find(m => m.index === 'arcanaloth').reactions[0];

function pcSpellAttack(overrides = {}) {
  return { attackerName: PC, targetName: ARCANA, attackName: 'Fire Bolt', rollType: 'attack', damageSchool: 'Evocation', isCantrip: true, ...overrides };
}

function csWithPC(round = 1) {
  return { round, creatures: [{ name: PC, type: 'player' }, { name: ARCANA, type: 'npc' }] };
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
      resolveSpellLevel: vi.fn(async la => (la?.isCantrip ? 0 : 3)),
    },
  };
}

describe('MA-0300 arcanaloth Counterspell — disk lock + RAW-unlimited sentinel', () => {
  it('monsters.json arcanaloth reactions[0] is disk-verbatim (MA-0013 shape, honest "At Will" + 999 sentinel), arms the gate', () => {
    expect(ARCANA_ACTION).toEqual({
      name: 'Counterspell',
      description: "The arcanaloth casts <em>Counterspell</em> in response to that spell's trigger, using the same spellcasting ability as Spellcasting.",
      usage: 'At Will',
      uses: 999,
      maxUses: 999,
      automation: { type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' },
    });
    expect(getGatedMonsterReaction(ARCANA_ACTION)?.effect).toBe('counterspell');
  });

  it('RAW-unlimited press ladder: each counter spends 1, fresh-round second counter admitted — never caps', async () => {
    // Generic press mechanics (auto-counters no-roll, ability_use log text,
    // counterspellResolved cast stamp) are owned once by gated-reaction
    // 'MA-0013 resolveMonsterGatedReaction — Counterspell'; only the
    // spend-count ladder unique to this 999-sentinel row is asserted here.
    const press1 = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 0 }) });
    const first = await resolveMonsterGatedReaction({ action: ARCANA_ACTION, monsterName: ARCANA, campaignName: CAMPAIGN, deps: press1.deps });
    expect(first.ok).toBe(true);
    expect(first.countered).toBe(true);
    expect(press1.state[`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });

    // Fresh round, fresh cast, 1 already spent: a usage-less row would refuse
    // at the default 1/Day cap (owner: gated-reaction 'MA-0013 usage-less-row
    // seam'); the authored sentinel holds open and counts the ladder up to 2.
    const press2 = makeCounterDeps({
      lastAttack: pcSpellAttack({ spellLevel: 0 }),
      round: 4,
      store: { [`${ARCANA}._counterspell_usedRound`]: 2, [`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]: { counterspell: 1 } },
    });
    const second = await resolveMonsterGatedReaction({ action: ARCANA_ACTION, monsterName: ARCANA, campaignName: CAMPAIGN, deps: press2.deps });
    expect(second.ok).toBe(true);
    expect(press2.logs.some(l => l.automationType === 'counterspell_refused')).toBe(false);
    expect(press2.state[`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 2 });
  });
});
