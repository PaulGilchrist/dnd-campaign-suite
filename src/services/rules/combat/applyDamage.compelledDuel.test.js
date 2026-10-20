// @maintained-by-ai
// Lane: Compelled Duel CONSUMER seam in applyDamageToTarget — damage landing on a
// duel target ends the duel ONLY when the attacker is neither the caster nor the
// target. This is the damage-trigger expiry lane; duel APPLICATION and the internal
// bytes of endCompelledDuel are owned by compelledDuelHandler.test.js:330-368
// (#1183-#1186 family) — never re-driven here.
//
// Producer bytes consulted (#967):
//   applyDamage.js:883            wardDamage > 0 gate — whole warded-events dispatch
//                                 (incl. the duel guard) skipped on immune/zero damage
//   applyDamage.js:569-579        endDuelIfDamagedByOther — :571 !attackerName ||
//                                 attackerName === creature.name short-circuit; :572-574
//                                 filter effect==='compelled_duel' && te.target===creature.name
//                                 && te.source!==attackerName; :576 endCompelledDuel(
//                                 duelEffects[0].source, creature.name, ..., `${attackerName}
//                                 damaged ${creature.name}, breaking the duel.`)
//   compelledDuelHandler.js:145-173  REAL, deliberately NOT mocked (store-faithful #1137):
//                                 writes the exact tuple-filtered campaign targetEffects with
//                                 skipSync=true + condition-removed log. Internals cited to
//                                 compelledDuelHandler.test.js:330-368 — this lane only proves
//                                 applyDamage REACHES it with the right arguments.
//   compelledDuelHandler.js:83-88    DUEL_TE verbatim BY NAME (#977/#993).
//
// Store-faithful stub (#1137/#1057): the duel lives on CAMPAIGN targetEffects — the
// guard reads ('campaign','targetEffects') only; keyed stub answers that key and
// undefined elsewhere through the producer's own || [] / Number(...|| 0) guards.
//
// Leg table (dup-map #1038) — one leg per production guard, byte-distinct fixtures:
// | # | leg                     | guard exercised          | fixture delta vs hit leg           |
// |---|-------------------------|--------------------------|------------------------------------|
// | 1 | third-party hit ends duel (exact write/log bytes #1160) | baseline | duel + surviving taunting_step decoy (#1183) |
// | 2 | caster hit → duel retained            | :573 source check      | attackerName === te.source       |
// | 3 | self-damage → duel retained           | :571 first clause      | attackerName === target name     |
// | 4 | no attacker → duel retained           | :571 second clause     | attackerName omitted             |
// | 5 | duel on another target → retained     | :573 te.target filter  | te.target 'Orc'                 |
// | 6 | no duel in store → zero-touch         | :575 length check      | targetEffects []                |
// | 7 | immune hit → guard never dispatched   | applyDamage.js:883     | immunities:['slashing'] → wardDamage 0 |
//
// Old -> new map:
//   old 1 'ends the duel when ... other than the caster'   → new 1 (exact retain-write
//       bytes replace the weak [] blob-clear assertion; strict note replaces stringContaining)
//   old 2 'does not end ... caster deals the damage'         → new 2 (retain census)
//   old 3 'does nothing when there is no compelled_duel'     → new 6 (retain census)
//   old 4 'does nothing when there is no attacker'           → new 4 (retain census)
//   NEW (blind spots closed): 3 self-damage, 5 other-target, 7 immune gate.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

// ── Mocks ──────────────────────────────────────────────────────
// compelledDuelHandler is intentionally NOT mocked — this lane verifies its REAL
// endCompelledDuel running against the mocked runtime store (store-faithful #1137).

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../combat/automation/automationPassives.js', () => ({
  getDamageReduction: vi.fn(() => null),
  getDamageResistances: vi.fn(() => []),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Globals ─────────────────────────────────────────────────────
// Belt for any direct fetch from an unmocked service; logService is mocked above.
global.fetch = vi.fn(() => new Promise(() => {}));

// ── Fixtures (verbatim producer bytes #977/#993) ───────────────

const CAMPAIGN = 'TestCampaign';

// Verbatim compelledDuelHandler.js:83-88 shape.
const DUEL_TE = { target: 'Goblin', effect: 'compelled_duel', source: 'Paladin', duration: 'concentration' };
// Decoy on the SAME target: endCompelledDuel removes only the matching (target, effect,
// source) tuple, so this must SURVIVE the removal write byte-for-byte (#1183).
const DECOY_TE = { target: 'Goblin', effect: 'taunting_step', source: 'Paladin' };

function makeNpc(name, extra = {}) {
  return {
    name,
    type: 'monster',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

// Campaign-scoped duel store stub (#1137/#1057): answers ONLY the key the guard reads.
function stubDuelStore(targetEffects) {
  getRuntimeValue.mockImplementation((charName, key) => {
    if (charName === 'campaign' && key === 'targetEffects') return targetEffects;
    return undefined;
  });
}

// Duel-scoped write census (#1026/#1036): the ONLY lane the guard may touch.
function duelWrites() {
  return setRuntimeValue.mock.calls.filter(([name, key]) => name === 'campaign' && key === 'targetEffects');
}

function duelRemovalLogs() {
  return addEntry.mock.calls
    .map(([, entry]) => entry)
    .filter(e => e && e.condition === 'Compelled Duel' && e.action === 'removed');
}

// ── Tests ───────────────────────────────────────────────────────

describe('Compelled Duel — damage expiry in applyDamageToTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
    global.fetch.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ends the duel when a third party damages the duel target — exact retain-write and removal-log bytes', async () => {
    stubDuelStore([DUEL_TE, DECOY_TE]);
    const cs = { round: 1, creatures: [makeNpc('Goblin')] };

    const result = await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], {
      campaignName: CAMPAIGN,
      characters: [],
      attackerName: 'Orc',
    });

    expect(result.finalDamage).toBe(10);
    expect(result.newHp).toBe(20);
    // Single campaign-store write: duel tuple gone, decoy survives verbatim (#1183).
    expect(duelWrites()).toEqual([
      ['campaign', 'targetEffects', [DECOY_TE], CAMPAIGN, true],
    ]);
    expect(duelRemovalLogs()).toHaveLength(1);
    expect(duelRemovalLogs()[0]).toEqual(expect.objectContaining({
      type: 'condition',
      characterName: 'Goblin',
      condition: 'Compelled Duel',
      reason: 'Compelled Duel ended',
      note: 'Orc damaged Goblin, breaking the duel.',
    }));
  });

  it.each([
    ['caster damage — only NON-caster damage ends the duel', [DUEL_TE, DECOY_TE], {}, 'Paladin'],
    ['self-damage — guard short-circuits before the store read', [DUEL_TE, DECOY_TE], {}, 'Goblin'],
    ['no attacker recorded — guard short-circuits', [DUEL_TE, DECOY_TE], {}, undefined],
    ['duel sits on another target — te.target filter excludes this victim', [{ ...DUEL_TE, target: 'Orc' }, DECOY_TE], {}, 'Orc'],
    ['no duel in the store — zero-touch', [], {}, 'Orc'],
    ['immune hit — wardDamage 0 never dispatches the warded-events guard', [DUEL_TE, DECOY_TE], { immunities: ['slashing'] }, 'Orc'],
  ])('%s — duel is retained', async (_label, targetEffects, creatureExtra, attackerName) => {
    stubDuelStore(targetEffects);
    const cs = { round: 1, creatures: [makeNpc('Goblin', creatureExtra)] };

    const result = await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], {
      campaignName: CAMPAIGN,
      characters: [],
      attackerName,
    });

    expect(result.finalDamage).toBe(creatureExtra.immunities ? 0 : 10);
    expect(duelWrites()).toEqual([]);
    expect(duelRemovalLogs()).toEqual([]);
  });
});
