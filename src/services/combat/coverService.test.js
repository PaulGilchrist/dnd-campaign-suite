// @maintained-by-ai
// L5-003 §8.3 lane — combat/coverService.js: intervening-CREATURE half cover (−2 AC).
//
// Contract here (GEOMETRY + CHANNEL, not the items/walls rules-table):
//   isCoverEnforced  — gate predicate: enforcement on + zones + genuinely ranged (> 8 ft touch).
//   findInterveningCreature — pure bresenham ray INTERIOR scan; first token along the ray wins.
//   stamp/readCoverShot — campaign store channel `_cover_shot`, keyed attacker+target+round.
//   adjudicateCoverShot — gate-side: ONE store write + ONE enforcement_cover log per shot.
//
// Family map — owned ELSEWHERE, cited not re-driven:
//   rules/combat/coverService.test.js   — computeCover items/walls table (half/¾/full, doors).
//   hooks/combat/targetAcComputation.test.js — AC-seam APPLICATION: −2 stacking on Barkskin floor.
//   combat/lineOfSightGate.test.js      — wall DENY at the §8.2 seam (runs this module live but
//                                          its enforcement store is off — cover branch never fires).
//   char-sheet/useCharActionsAttackHandlers* / useSpellCastExecutor — gate CALLERS (mocked there).
//
// Ray cells below are hand-derived ONCE from bresenham (never re-run as oracle):
//   (0,0)→(6,0):  interior (1,0)…(5,0) · (0,0)→(4,4): interior (1,1),(2,2),(3,3)
//   (0,0)→(4,2): (0,0),(1,0),(2,1),(3,1),(4,2) — interior (1,0),(2,1),(3,1)
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../encounters/combatData.js', () => ({ getCurrentCombatRound: () => 1 }));
vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
// rangeValidation and maps/lineOfSight stay UNMOCKED: pure, import-light, real thresholds.

import {
    isCoverEnforced,
    findInterveningCreature,
    stampCoverShot,
    readCoverShot,
    adjudicateCoverShot,
    COVER_SHOT_KEY,
    HALF_COVER_AC,
} from './coverService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../ui/logService.js';

const ZONES_ON = { mode: 'on', zones: true };
const from = { gridX: 0, gridY: 0 };
const to = { gridX: 6, gridY: 0 };
const blocker = { name: 'Goblin', gridX: 3, gridY: 0 };

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});

describe('isCoverEnforced', () => {
    it('off / zones-off / no campaign ⇒ false regardless of range', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(isCoverEnforced('test-campaign', '80 ft')).toBe(false);
        getRuntimeValue.mockReturnValue({ mode: 'on', zones: false });
        expect(isCoverEnforced('test-campaign', '80 ft')).toBe(false);
        expect(isCoverEnforced(null, '80 ft')).toBe(false);
    });

    it('live only beyond the 8-ft touch constant — boundary 8 false / 10 true, melee/self/unparseable never', () => {
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(isCoverEnforced('test-campaign', '80 ft')).toBe(true);
        expect(isCoverEnforced('test-campaign', '10')).toBe(true);
        expect(isCoverEnforced('test-campaign', '8')).toBe(false);   // exact touch constant: not ranged
        expect(isCoverEnforced('test-campaign', '5 ft')).toBe(false);
        expect(isCoverEnforced('test-campaign', 'touch')).toBe(false);
        expect(isCoverEnforced('test-campaign', 'self')).toBe(false);
        expect(isCoverEnforced('test-campaign', null)).toBe(false);
        expect(isCoverEnforced('test-campaign', 'mystery')).toBe(false);
    });
});

describe('findInterveningCreature — ray interior (pure)', () => {
    it('first non-combatant token on an interior cell interposes — straight, shallow, and diagonal rays', () => {
        // straight ray interior (1,0)…(5,0): earliest along the ray wins
        const straight = findInterveningCreature({
            from, to,
            tokens: [{ name: 'Goblin', gridX: 4, gridY: 0 }, { name: 'Shield', gridX: 2, gridY: 0 }],
            attackerName: 'Hero', targetName: 'Mage',
        });
        expect(straight).toEqual({ name: 'Shield', gridX: 2, gridY: 0 });

        // shallow ray hits (2,1), not the near-miss adjacent (2,0)
        const shallow = findInterveningCreature({
            from, to: { gridX: 4, gridY: 2 },
            tokens: [{ name: 'NearMiss', gridX: 2, gridY: 0 }, { name: 'Orc', gridX: 2, gridY: 1 }],
            attackerName: 'Hero', targetName: 'Mage',
        });
        expect(shallow?.name).toBe('Orc');

        // diagonal ray interior (1,1),(2,2),(3,3)
        const diagonal = findInterveningCreature({
            from, to: { gridX: 4, gridY: 4 },
            tokens: [{ name: 'Owlbear', gridX: 2, gridY: 2 }],
            attackerName: 'Hero', targetName: 'Mage',
        });
        expect(diagonal?.name).toBe('Owlbear');
    });

    it('clean shot: endpoints (even foreign tokens), off-line, unplaced, unnamed, and degenerate rays never tax', () => {
        const query = (tokens, f = from, t = to) =>
            findInterveningCreature({ from: f, to: t, tokens, attackerName: 'Hero', targetName: 'Mage' });
        // interior-only: foreign tokens standing ON the from/to cells do not interpose
        expect(query([{ name: 'Wall', gridX: 0, gridY: 0 }, { name: 'Cleric', gridX: 6, gridY: 0 }])).toBeNull();
        expect(query([{ name: 'Stray', gridX: 3, gridY: 2 }, { name: 'Ghost', gridX: null, gridY: null }, { gridX: 3, gridY: 0 }])).toBeNull();
        expect(query([blocker], from, from)).toBeNull();           // degenerate same-cell ray
        expect(query([blocker], { gridX: NaN, gridY: 0 }, to)).toBeNull(); // unpositioned end
        expect(query(null)).toBeNull();
    });
});

describe('stampCoverShot / readCoverShot channel', () => {
    it('stamp writes ONE exact −2 value, campaign-pinned; read-back matches attacker+target+round', () => {
        const stamp = stampCoverShot({ campaignName: 'test-campaign', attackerName: 'Hero', targetName: 'Mage', blocker, round: 4 });
        expect(stamp).toEqual({ attackerName: 'Hero', targetName: 'Mage', ac: HALF_COVER_AC, blocker: 'Goblin', cell: '3,0', round: 4 });
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, stamp, 'test-campaign');

        getRuntimeValue.mockImplementation((name, key) => (name === 'campaign' && key === COVER_SHOT_KEY ? stamp : null));
        expect(readCoverShot({ attackerName: 'Hero' }, 'Mage', 'test-campaign', 4)).toEqual(stamp);
        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, 'test-campaign');
    });

    it('wrong target / attacker / stale round ⇒ null; roundless stamp never expires; empty store ⇒ null', () => {
        const stamp = stampCoverShot({ campaignName: 'test-campaign', attackerName: 'Hero', targetName: 'Mage', blocker, round: 4 });
        const timeless = stampCoverShot({ campaignName: 'test-campaign', attackerName: 'Hero', targetName: 'Mage', blocker });
        expect(timeless).toEqual({ attackerName: 'Hero', targetName: 'Mage', ac: -2, blocker: 'Goblin', cell: '3,0', round: null });
        const store = { [COVER_SHOT_KEY]: null };
        getRuntimeValue.mockImplementation((name, key) => (name === 'campaign' && key === COVER_SHOT_KEY ? store[key] : null));

        store[COVER_SHOT_KEY] = stamp;
        expect(readCoverShot({ attackerName: 'Hero' }, 'Other', 'test-campaign', 4)).toBeNull();
        expect(readCoverShot({ attackerName: 'SomeoneElse' }, 'Mage', 'test-campaign', 4)).toBeNull();
        expect(readCoverShot({ attackerName: 'Hero' }, 'Mage', 'test-campaign', 5)).toBeNull();
        expect(readCoverShot(null, 'Mage', 'test-campaign', 4)).toEqual(stamp); // nameless context defers to stamp

        store[COVER_SHOT_KEY] = timeless;
        expect(readCoverShot({ attackerName: 'Hero' }, 'Mage', 'test-campaign', 99)).toEqual(timeless);

        store[COVER_SHOT_KEY] = null;
        expect(readCoverShot({ attackerName: 'Hero' }, 'Mage', 'test-campaign', 1)).toBeNull(); // enforcement-off byte-parity
    });

    it('clear shot writes null (wipes stale stamp); missing campaign/attacker/target ⇒ null, zero writes', () => {
        expect(stampCoverShot({ campaignName: 'test-campaign', attackerName: 'Hero', targetName: 'Mage', blocker: null, round: 4 })).toBeNull();
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, null, 'test-campaign');

        setRuntimeValue.mockClear();
        expect(stampCoverShot({ attackerName: 'Hero', targetName: 'Mage', blocker })).toBeNull();
        expect(stampCoverShot({ campaignName: 'test-campaign', targetName: 'Mage', blocker })).toBeNull();
        expect(stampCoverShot({ campaignName: 'test-campaign', attackerName: 'Hero', blocker })).toBeNull();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('missing target name ⇒ read null without consulting the store', () => {
        expect(readCoverShot({ attackerName: 'Hero' }, null, 'test-campaign', 1)).toBeNull();
        expect(getRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('adjudicateCoverShot (gate-side)', () => {
    it('intervener ⇒ exact −2 stamp with round from combatData + ONE enforcement_cover log (exact bytes)', () => {
        getRuntimeValue.mockImplementation((name, key) => (name === 'campaign' && key === 'enforcement' ? ZONES_ON : null));
        const stamp = adjudicateCoverShot({
            campaignName: 'test-campaign',
            attackerName: 'Hero',
            targetName: 'Mage',
            from,
            to,
            players: [{ name: 'Stray', gridX: 3, gridY: 4 }, blocker, { name: 'Ghost', gridX: null, gridY: null }],
        });
        expect(stamp).toEqual({ attackerName: 'Hero', targetName: 'Mage', ac: -2, blocker: 'Goblin', cell: '3,0', round: 1 });
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, stamp, 'test-campaign');
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_cover',
            creature: 'Hero',
            target: 'Mage',
            description: 'Half cover (−2 AC): Goblin interposes at (3,0) between Hero and Mage (enforcement: zones).',
            timestamp: expect.any(Number),
        });
    });

    it('clear line ⇒ ONE null write (stamp cleared), no log', () => {
        const stamp = adjudicateCoverShot({
            campaignName: 'test-campaign',
            attackerName: 'Hero',
            targetName: 'Mage',
            from,
            to,
            players: [{ name: 'Stray', gridX: 3, gridY: 4 }, { name: 'Ghost', gridX: null, gridY: null }],
        });
        expect(stamp).toBeNull();
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, null, 'test-campaign');
        expect(addEntry).not.toHaveBeenCalled();
    });
});
