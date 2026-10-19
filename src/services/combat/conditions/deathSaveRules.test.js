// @maintained-by-ai
// Rules lane: deathSaveRules.js — the ONLY owner of death-save state-machine math.
// 5e thresholds (source hand-read 2026-10-19, no 2024 twin exists):
//   nat20 (or 18 when treat18AsNat20 — "Defy Death"-style passives) wakes at 1 HP
//   and wipes both tracks; roll >= 10 marks the first empty save slot, 3+ saves =
//   'stable'; roll < 10 marks one empty failure slot (nat1 marks TWO, clamped by
//   empty slots), 3+ failures = 'dead'; advantage rolls twice, best die decides,
//   nat1 only when BOTH dice are 1.
// Family map (do not duplicate here):
//   - DeathSavingThrows.test.jsx / DeathSavePromptModal.test.jsx — input lanes, mock
//     this module, pin routing + SSE store writes only
//   - initiative-callbacks.test.jsx #863 — death-save-result listener
//   - createCreatureHandlers.test.jsx — deathSaves reset on revive (store writes)
//   - LogDeathSave.test.jsx #877 — log rendering bytes
//   - spellGateHelpers (isStable consumer) — mocked in spellGates.wardingBond.test.js
//   - exhaustionRules.test.js — distinct module (exhaustion death, not saves)
// Method: full-object exact pins per table row (kills separate shape tests, #829);
// every expected byte hand-derived ONCE from the source, never re-run as oracle
// (#710/#815); boundary census 9/10, 18 flag on/off/19, nat1/nat20, threshold-2 vs
// -3 near-misses (#943/#986); sequence folded into one 4-call chain (#787); guards
// folded as rows (full save track, full failure track, #936); RNG stubbed at the
// diceRoller seam with explicit values only, spy counts pin consumption (#872/#973).
// Old->new: isStable x3 + isDead x3 -> threshold table; rollDeathSave nat20/18/
// mark-success/mark-failure/nat1/no-cross-channel-modify/preserve -> roll table;
// advantage x10 (incl. 3 shape tests + restoredToHp null) -> advantage table;
// slot-progression + input immutability -> chain test.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rollDeathSave, rollDeathSaveWithAdvantage, isStable, isDead } from './deathSaveRules.js';
import * as diceRoller from '../../dice/diceRoller.js';

let rollD20Spy;

beforeEach(() => {
  rollD20Spy = vi.spyOn(diceRoller, 'rollD20');
});

afterEach(() => {
  vi.restoreAllMocks();
});

function stubRolls(...values) {
  let index = 0;
  rollD20Spy.mockImplementation(() => values[index++]);
}

describe('deathSaveRules', () => {
  it.each([
    ['isStable', [], false],
    ['isStable', [true, true, false], false],
    ['isStable', [true, false, true, true], true],
    ['isStable', [0, null, undefined, false], false],
    ['isDead', [], false],
    ['isDead', [true, true, false], false],
    ['isDead', [true, true, true], true],
    ['isDead', [true, true, true, true], true],
  ])('%s(%j) -> %s', (fnName, track, expected) => {
    expect({ isStable, isDead }[fnName](track)).toBe(expected);
  });

  describe('rollDeathSave', () => {
    it.each([
      [
        'natural 20 wakes at 1 HP and wipes both full tracks',
        [true, true, true], [true, true, true], [20], false,
        { newSaves: [false, false, false], newFailures: [false, false, false], result: 'nat20', roll: 20, isNat20: true, isNat1: false, restoredToHp: 1 },
      ],
      [
        'natural 1 marks TWO failures from empty',
        [false, false, false], [false, false, false], [1], false,
        { newSaves: [false, false, false], newFailures: [true, true, false], result: 'failure', roll: 1, isNat20: false, isNat1: true, restoredToHp: null },
      ],
      [
        'natural 1 clamps to the last empty slot and kills',
        [false, false, false], [true, true, false], [1], false,
        { newSaves: [false, false, false], newFailures: [true, true, true], result: 'dead', roll: 1, isNat20: false, isNat1: true, restoredToHp: null },
      ],
      [
        '9 fails one slot, just below the 10 threshold',
        [true, false, false], [false, false, false], [9], false,
        { newSaves: [true, false, false], newFailures: [true, false, false], result: 'failure', roll: 9, isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        '10 succeeds on the threshold and the 3rd mark stabilizes',
        [true, true, false], [true, false, false], [10], false,
        { newSaves: [true, true, true], newFailures: [true, false, false], result: 'stable', roll: 10, isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        'success with no empty save slot stays stable, saves unchanged',
        [true, true, true], [false, false, false], [12], false,
        { newSaves: [true, true, true], newFailures: [false, false, false], result: 'stable', roll: 12, isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        'failure with no empty failure slot stays dead',
        [true, false, false], [true, true, true], [5], false,
        { newSaves: [true, false, false], newFailures: [true, true, true], result: 'dead', roll: 5, isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        'treat18AsNat20: 18 wakes and resets non-empty tracks',
        [true, false, false], [true, true, false], [18], true,
        { newSaves: [false, false, false], newFailures: [false, false, false], result: 'nat20', roll: 18, isNat20: true, isNat1: false, restoredToHp: 1 },
      ],
      [
        'flag off: 18 is an ordinary success',
        [false, false, false], [false, false, false], [18], false,
        { newSaves: [true, false, false], newFailures: [false, false, false], result: 'success', roll: 18, isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        'flag on but 19 is never treated as nat20',
        [false, false, false], [false, false, false], [19], true,
        { newSaves: [true, false, false], newFailures: [false, false, false], result: 'success', roll: 19, isNat20: false, isNat1: false, restoredToHp: null },
      ],
    ])('%s', (_desc, saves, failures, dice, treat18AsNat20, expected) => {
      stubRolls(...dice);
      expect(rollDeathSave(saves, failures, treat18AsNat20)).toEqual(expected);
      expect(rollD20Spy).toHaveBeenCalledTimes(1);
    });

    it('chains four rolls: success -> nat1 double fail -> success -> stable, inputs untouched', () => {
      const saves = [false, false, false];
      const failures = [false, false, false];
      stubRolls(15, 1, 12, 10);

      const first = rollDeathSave(saves, failures);
      expect(first).toEqual({ newSaves: [true, false, false], newFailures: [false, false, false], result: 'success', roll: 15, isNat20: false, isNat1: false, restoredToHp: null });

      const second = rollDeathSave(first.newSaves, first.newFailures);
      expect(second).toEqual({ newSaves: [true, false, false], newFailures: [true, true, false], result: 'failure', roll: 1, isNat20: false, isNat1: true, restoredToHp: null });

      const third = rollDeathSave(second.newSaves, second.newFailures);
      expect(third).toEqual({ newSaves: [true, true, false], newFailures: [true, true, false], result: 'success', roll: 12, isNat20: false, isNat1: false, restoredToHp: null });

      const fourth = rollDeathSave(third.newSaves, third.newFailures);
      expect(fourth).toEqual({ newSaves: [true, true, true], newFailures: [true, true, false], result: 'stable', roll: 10, isNat20: false, isNat1: false, restoredToHp: null });

      expect(rollD20Spy).toHaveBeenCalledTimes(4);
      expect(saves).toEqual([false, false, false]);
      expect(failures).toEqual([false, false, false]);
    });
  });

  describe('rollDeathSaveWithAdvantage', () => {
    it.each([
      [
        'takes the higher die, in either order',
        [3, 17], [false, false, false], [false, false, false], false,
        { newSaves: [true, false, false], newFailures: [false, false, false], result: 'success', roll: 17, rolls: [3, 17], isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        'takes the higher die, mirrored dice order',
        [17, 3], [false, false, false], [false, false, false], false,
        { newSaves: [true, false, false], newFailures: [false, false, false], result: 'success', roll: 17, rolls: [17, 3], isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        'best die nat20 wakes at 1 HP and wipes both full tracks',
        [5, 20], [true, true, true], [true, true, true], false,
        { newSaves: [false, false, false], newFailures: [false, false, false], result: 'nat20', roll: 20, rolls: [5, 20], isNat20: true, isNat1: false, restoredToHp: 1 },
      ],
      [
        'nat1 requires BOTH dice — 1 vs 15 is a plain success',
        [1, 15], [false, false, false], [false, false, false], false,
        { newSaves: [true, false, false], newFailures: [false, false, false], result: 'success', roll: 15, rolls: [1, 15], isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        'double ones mark TWO failures from empty',
        [1, 1], [false, false, false], [false, false, false], false,
        { newSaves: [false, false, false], newFailures: [true, true, false], result: 'failure', roll: 1, rolls: [1, 1], isNat20: false, isNat1: true, restoredToHp: null },
      ],
      [
        'double ones clamp into the last empty slot and kill',
        [1, 1], [false, false, false], [true, true, false], false,
        { newSaves: [false, false, false], newFailures: [true, true, true], result: 'dead', roll: 1, rolls: [1, 1], isNat20: false, isNat1: true, restoredToHp: null },
      ],
      [
        'best die 9 fails on the threshold',
        [6, 9], [false, false, false], [false, false, false], false,
        { newSaves: [false, false, false], newFailures: [true, false, false], result: 'failure', roll: 9, rolls: [6, 9], isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        'best die 10 stabilizes on the threshold',
        [1, 10], [true, true, false], [false, false, false], false,
        { newSaves: [true, true, true], newFailures: [false, false, false], result: 'stable', roll: 10, rolls: [1, 10], isNat20: false, isNat1: false, restoredToHp: null },
      ],
      [
        'treat18AsNat20: best die 18 wakes',
        [5, 18], [true, false, false], [false, false, false], true,
        { newSaves: [false, false, false], newFailures: [false, false, false], result: 'nat20', roll: 18, rolls: [5, 18], isNat20: true, isNat1: false, restoredToHp: 1 },
      ],
    ])('%s', (_desc, dice, saves, failures, treat18AsNat20, expected) => {
      stubRolls(...dice);
      expect(rollDeathSaveWithAdvantage(saves, failures, treat18AsNat20)).toEqual(expected);
      expect(rollD20Spy).toHaveBeenCalledTimes(2);
    });
  });
});
