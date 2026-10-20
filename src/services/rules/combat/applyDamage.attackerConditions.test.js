// @maintained-by-ai
// Lane: applyDamage attacker-condition riders — effects keyed off the ATTACKER,
// dispatched only inside handleWardedDamageEvents when damage actually lands.
//
// Producer bytes consulted (#967):
//   applyDamage.js:883            wardDamage > 0 gate — whole attacker-rider dispatch skipped on 0
//   applyDamage.js:814-817        attackerName && attackerName !== creature.name gate
//   psychicVeilService.js:3-19    REAL service (deliberately NOT mocked): Psychic Veil buff hit →
//                                 filter 'invisible' from activeConditions THEN strip buff from
//                                 activeBuffs (deterministic write order :12 → :16)
//   applyDamage.js:563-567        preserveInvisibleOnStealthAttack — documented NO-OP stub;
//                                 Supreme Sneak preservation is structural (no attacker-condition
//                                 write path exists), so no behavioral test can discriminate it (#1035)
//
// Generic arithmetic (resistance/immunity halving truth-tables) is owned by
// applyDamage.helpers.test.js:52-84 (#1182 cla023 disk-driven B/P/S) — NOT re-driven here;
// immunity appears only as a reach fixture to zero wardDamage for the gate leg (#1022).
//
// Leg table (dup-map #1038) — one leg per production guard, byte-distinct fixtures:
// | # | leg                        | guard exercised            | fixture delta vs hit leg      |
// |---|----------------------------|----------------------------|-------------------------------|
// | 1 | hit strips stacked rider | psychicVeilService body  | baseline (exact filtered bytes #1160) |
// | 2 | immune → no dispatch       | applyDamage.js:883       | Skeleton immunities:['psychic'] → wardDamage 0 |
// | 3 | no buff → no rider       | psychicVeilService.js:6  | condition present, buff absent (distinct #948) |
// | 4 | self-damage → no rider   | applyDamage.js:814       | attackerName === targetName   |
//
// Old -> new map:
//   old 1 'removes Psychic Veil buff and Invisible condition...' → new 1 (stacked stack + exact
//       rider-write census replaces two loose not/toHaveBeenCalledWith pairs)
//   old 2 'does not remove ... (immune)'                          → new 2 (rider census widened)
//   old 3 'does not remove ... lacks the buff'                    → new 3 (rider census widened)
//   old 4 'Supreme Sneak — preserve Invisible...'                 → DELETED vacuous (preserveInvisible
//       OnStealthAttack is a no-op stub; assertion passed for any stealthAttackCost value —
//       never reached an observable labeled branch #1035/#1160)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Mocks ──────────────────────────────────────────────────────
// psychicVeilService is intentionally NOT mocked — this lane verifies it running
// for real against the mocked runtime store (store-faithful #1137/#1091).

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
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

const PSYCHIC_VEIL = { name: 'Psychic Veil' };
const RIDER_INACTIVE_BUFF = { name: 'Expeditious Retreat' };
// Multi-effect stacks so the filter result is exact, not a blob-clear (#1160/#1036).
const VEILED_CONDITIONS = ['invisible', 'poisoned'];
const VEILED_BUFFS = [PSYCHIC_VEIL, RIDER_INACTIVE_BUFF];

function makeNpc(name, extra = {}) {
  return {
    name,
    type: 'monster',
    maxHp: 10,
    currentHp: 10,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function makePlayerCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 20,
    currentHp: 20,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function makePlayerCharacter(name) {
  return {
    name,
    level: 5,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
    },
  };
}

// Runtime stub: only the attacker's veil keys are non-default; every other key
// reads undefined/[] through the producer's own Array.isArray guards (#1137).
function stubVeiledAttacker(name, { buffs, conditions }) {
  getRuntimeValue.mockImplementation((charName, key) => {
    if (charName !== name) return undefined;
    if (key === 'activeBuffs') return buffs;
    if (key === 'activeConditions') return conditions;
    if (key === 'currentHitPoints') return 20;
    return undefined;
  });
}

// Rider-scoped write census (#1026): the ONLY attacker keys the lane may touch.
function riderWrites(attackerName) {
  return setRuntimeValue.mock.calls.filter(
    ([name, key]) => name === attackerName && (key === 'activeConditions' || key === 'activeBuffs')
  );
}

// ── Tests ───────────────────────────────────────────────────────

describe('Psychic Veil — attacker rider on damage landing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
    global.fetch.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('strips Invisible and the Psychic Veil buff from the attacker on a landed Psychic hit — exact filtered bytes, conditions before buffs', async () => {
    const cs = { round: 1, creatures: [makeNpc('Goblin')] };
    stubVeiledAttacker('Warlock', { buffs: VEILED_BUFFS, conditions: VEILED_CONDITIONS });

    const result = await applyDamageToTarget(cs, 'Goblin', 5, ['Psychic'], {
      campaignName: CAMPAIGN,
      characters: [makePlayerCharacter('Warlock')],
      attackerName: 'Warlock',
    });

    expect(result.finalDamage).toBe(5);
    expect(result.newHp).toBe(5);
    expect(riderWrites('Warlock')).toEqual([
      ['Warlock', 'activeConditions', ['poisoned'], CAMPAIGN],
      ['Warlock', 'activeBuffs', [RIDER_INACTIVE_BUFF], CAMPAIGN],
    ]);
  });

  it('leaves the veiled attacker untouched when the Psychic hit is immune (wardDamage 0 skips the attacker-rider dispatch)', async () => {
    const cs = { round: 1, creatures: [makeNpc('Skeleton', { immunities: ['psychic'] })] };
    stubVeiledAttacker('Warlock', { buffs: VEILED_BUFFS, conditions: VEILED_CONDITIONS });

    const result = await applyDamageToTarget(cs, 'Skeleton', 5, ['Psychic'], {
      campaignName: CAMPAIGN,
      characters: [makePlayerCharacter('Warlock')],
      attackerName: 'Warlock',
    });

    expect(result.finalDamage).toBe(0);
    expect(riderWrites('Warlock')).toEqual([]);
  });

  it('leaves an attacker untouched when Invisible is present but the Psychic Veil buff is not (rider keys off the buff, not the condition)', async () => {
    const cs = { round: 1, creatures: [makeNpc('Goblin')] };
    stubVeiledAttacker('Fighter', { buffs: [RIDER_INACTIVE_BUFF], conditions: VEILED_CONDITIONS });

    await applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], {
      campaignName: CAMPAIGN,
      characters: [makePlayerCharacter('Fighter')],
      attackerName: 'Fighter',
    });

    expect(riderWrites('Fighter')).toEqual([]);
  });

  it('does not fire on self-damage — the rider requires a distinct attacker even with the full veil stack armed', async () => {
    const cs = { round: 1, creatures: [makePlayerCreature('Warlock')] };
    stubVeiledAttacker('Warlock', { buffs: VEILED_BUFFS, conditions: VEILED_CONDITIONS });

    const result = await applyDamageToTarget(cs, 'Warlock', 5, ['Psychic'], {
      campaignName: CAMPAIGN,
      characters: [makePlayerCharacter('Warlock')],
      attackerName: 'Warlock',
    });

    expect(result.newHp).toBe(15);
    expect(riderWrites('Warlock')).toEqual([]);
  });
});
