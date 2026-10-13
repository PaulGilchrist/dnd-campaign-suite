// L5-003 §8.3 — cover adjudication tests (intervening creature half cover).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: (r) => (r === 'touch' ? 8 : /^\d+$/.test(String(r || '')) ? parseInt(r, 10) : null),
}));
vi.mock('../encounters/combatData.js', () => ({ getCurrentCombatRound: () => 1 }));
vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

import {
    isCoverEnforced,
    findInterveningCreature,
    stampCoverShot,
    adjudicateCoverShot,
    readCoverShot,
    COVER_SHOT_KEY,
    HALF_COVER_AC,
} from './coverService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../ui/logService.js';

const ZONES_ON = { mode: 'on', zones: true };

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});

describe('isCoverEnforced', () => {
    it('off / zones-off / no campaign ⇒ false', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(isCoverEnforced('test-campaign', '80 ft')).toBe(false);
        getRuntimeValue.mockReturnValue({ mode: 'on', zones: false });
        expect(isCoverEnforced('test-campaign', '80 ft')).toBe(false);
        expect(isCoverEnforced(null, '80 ft')).toBe(false);
    });

    it('live for ranged only — melee/touch/unparseable never adjudicate', () => {
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(isCoverEnforced('test-campaign', '80')).toBe(true);
        expect(isCoverEnforced('test-campaign', 'touch')).toBe(false);
        expect(isCoverEnforced('test-campaign', 'self')).toBe(false);
        expect(isCoverEnforced('test-campaign', null)).toBe(false);
    });
});

describe('findInterveningCreature', () => {
    const from = { gridX: 0, gridY: 0 };
    const to = { gridX: 6, gridY: 0 };

    it('a third creature token on the interior of the ray interposes', () => {
        const tokens = [{ name: 'Goblin', gridX: 3, gridY: 0 }];
        const found = findInterveningCreature({ from, to, tokens, attackerName: 'Hero', targetName: 'Mage' });
        expect(found?.name).toBe('Goblin');
    });

    it('attacker/target tokens themselves never count', () => {
        const tokens = [
            { name: 'Hero', gridX: 0, gridY: 0 },
            { name: 'Mage', gridX: 6, gridY: 0 },
        ];
        expect(findInterveningCreature({ from, to, tokens, attackerName: 'Hero', targetName: 'Mage' })).toBeNull();
    });

    it('off-line tokens and unplaced tokens never tax a clean shot', () => {
        const tokens = [
            { name: 'Stray', gridX: 3, gridY: 2 },
            { name: 'Ghost', gridX: null, gridY: null },
        ];
        expect(findInterveningCreature({ from, to, tokens, attackerName: 'Hero', targetName: 'Mage' })).toBeNull();
    });
});

describe('stampCoverShot / readCoverShot channel', () => {
    const blocker = { name: 'Goblin', gridX: 3, gridY: 0 };

    it('stamp writes ONE campaign value; read-back matches attacker+target+round', () => {
        const stamp = stampCoverShot({ campaignName: 'test-campaign', attackerName: 'Hero', targetName: 'Mage', blocker, round: 4 });
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, expect.objectContaining({ ac: HALF_COVER_AC, blocker: 'Goblin', round: 4 }), 'test-campaign');
        getRuntimeValue.mockImplementation((name, key) => (name === 'campaign' && key === COVER_SHOT_KEY ? stamp : null));
        expect(readCoverShot({ attackerName: 'Hero' }, 'Mage', 'test-campaign', 4)).toEqual(stamp);
    });

    it('wrong target / wrong round ⇒ null (stale stamp never taxes)', () => {
        const stamp = stampCoverShot({ campaignName: 'test-campaign', attackerName: 'Hero', targetName: 'Mage', blocker, round: 4 });
        getRuntimeValue.mockImplementation((name, key) => (name === 'campaign' && key === COVER_SHOT_KEY ? stamp : null));
        expect(readCoverShot({ attackerName: 'Hero' }, 'Other', 'test-campaign', 4)).toBeNull();
        expect(readCoverShot({ attackerName: 'Hero' }, 'Mage', 'test-campaign', 5)).toBeNull();
        expect(readCoverShot({ attackerName: 'SomeoneElse' }, 'Mage', 'test-campaign', 4)).toBeNull();
    });

    it('a CLEAR shot writes null — wiping any earlier stamp of the round', () => {
        expect(stampCoverShot({ campaignName: 'test-campaign', attackerName: 'Hero', targetName: 'Mage', blocker: null, round: 4 })).toBeNull();
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, null, 'test-campaign');
    });

    it('no stamp stored ⇒ read is null (enforcement-off byte-parity)', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(readCoverShot({ attackerName: 'Hero' }, 'Mage', 'test-campaign', 1)).toBeNull();
    });
});

describe('adjudicateCoverShot (gate-side)', () => {
    it('intervener ⇒ stamp −2 + one enforcement_cover log', () => {
        getRuntimeValue.mockImplementation((name, key) => (name === 'campaign' && key === 'enforcement' ? ZONES_ON : null));
        const stamp = adjudicateCoverShot({
            campaignName: 'test-campaign',
            attackerName: 'Hero',
            targetName: 'Mage',
            from: { gridX: 0, gridY: 0 },
            to: { gridX: 6, gridY: 0 },
            players: [{ name: 'Goblin', gridX: 3, gridY: 0 }],
        });
        expect(stamp?.ac).toBe(-2);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, expect.objectContaining({ ac: -2 }), 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'enforcement_cover' }));
    });

    it('clear line ⇒ stamp CLEARED (null written), no log', () => {
        adjudicateCoverShot({
            campaignName: 'test-campaign',
            attackerName: 'Hero',
            targetName: 'Mage',
            from: { gridX: 0, gridY: 0 },
            to: { gridX: 6, gridY: 0 },
            players: [{ name: 'Stray', gridX: 3, gridY: 4 }],
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', COVER_SHOT_KEY, null, 'test-campaign');
        expect(addEntry).not.toHaveBeenCalled();
    });
});
