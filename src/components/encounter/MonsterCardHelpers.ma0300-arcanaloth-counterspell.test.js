// @maintained-by-ai
// MA-0300: Arcanaloth Counterspell reaction was prose-only inert (no
// automation metadata → getGatedMonsterReaction null → zero affordance).
// DATA fix mirrors the live MA-0013 Aberrant Cultist template. RAW note: the
// arcanaloth prose carries NO per-day limit; the seam's reactionMaxUses
// defaults to 1 when uses are absent, so the row honestly documents
// RAW-unlimited via usage "At Will" + a 999 sentinel maxUses (finite number
// required by the seam; reset GM-enforced advisory per CLA-325).
// Ownership map after #422/#508/#505 trim: BY-name disk lock for this row
// (#387; cited data-shape owner by chip lane ma0300-arcanaloth-chip #421 —
// chip render + counter echo never restated here). Uses arithmetic + the
// plain-row null-negative are owned ONCE by gated-reaction.test.js:62-69;
// the gate limit-999 arm lives there too (:330-340). The usage-less
// "fabricates a 1/Day cap" seam leg lives once in the MA-0305 twin lane
// (:79-91). CLA-322 dispel-check arithmetic is owned by
// resolveCounterspellCheck (:198-208) — the old d20+INT(+5) leg here was
// self-ref (the test injected its own spellAbilityMod). Counterspell-
// specific arms that stay: disk lock + the RAW-unlimited press ladder
// (auto-counter, spends 1 per counter, fresh-round second counter never
// refused — the MA-0013 cultist caps 2/Day and At-Will parry never spends,
// so this ladder is owned nowhere else).
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
  it('monsters.json arcanaloth reactions[0] carries the MA-0013 automation shape, honest "At Will" + 999 sentinel, arms the gate', () => {
    expect(ARCANA_ACTION.name).toBe('Counterspell');
    expect(ARCANA_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'enemy_spell_cast', effect: 'counterspell' });
    expect(ARCANA_ACTION.usage).toBe('At Will');
    expect(ARCANA_ACTION.maxUses).toBe(999);
    expect(ARCANA_ACTION.uses).toBe(999);
    expect(getGatedMonsterReaction(ARCANA_ACTION)?.effect).toBe('counterspell');
  });

  it('cantrip press auto-counters (1 spent, cast stamped, no roll) and the RAW-unlimited sentinel admits a fresh-round second counter — never caps', async () => {
    const press1 = makeCounterDeps({ lastAttack: pcSpellAttack({ spellLevel: 0 }) });
    const first = await resolveMonsterGatedReaction({ action: ARCANA_ACTION, monsterName: ARCANA, campaignName: CAMPAIGN, deps: press1.deps });
    expect(first.ok).toBe(true);
    expect(first.countered).toBe(true);
    expect(press1.state[`${ARCANA}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ counterspell: 1 });
    const spend = press1.logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Counterspell');
    expect(spend.description).toMatch(/Fire Bolt/);
    expect(spend.description).toMatch(/auto-countered/);
    expect(press1.campaignWrites[0]).toMatchObject({ counterspellResolved: true, counteredBy: ARCANA, counteredSpell: 'Fire Bolt' });
    expect(press1.deps.rollD20).not.toHaveBeenCalled();

    // Fresh round, fresh cast, 1 already spent: a usage-less row would refuse
    // at the default 1/Day cap (MA-0305 lane :79-91); the authored sentinel
    // holds open and counts the ladder up to 2.
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
