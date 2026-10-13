// L5-003 §8.3 (triage #1) — duration-clock producer tests.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('./expirationQueue.js', () => ({
    addExpiration: vi.fn(),
    // Mirror the real maturity rule (currentRound >= appliedRound + rounds);
    // the real processExpirationList has its own exhaustive suite.
    processExpirationList: (list, currentRound, _owner, _campaignName) => {
        const processed = [];
        let expiredCount = 0;
        for (const item of list) {
            const rounds = item.expiryRounds ?? Infinity;
            if (Number.isFinite(item.appliedRound) && currentRound >= item.appliedRound + rounds) expiredCount++;
            else processed.push(item);
        }
        return { processed, expiredCount, changed: expiredCount > 0 };
    },
}));
vi.mock('./turnStartEffects.js', () => ({ KEY: 'pendingExpirations' }));
vi.mock('../../encounters/combatData.js', () => ({ getCurrentCombatRound: vi.fn(() => 1) }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

import { clauseDurationRounds, zonesClockEnforcementLive, armDurationClockIfEnforced, drainRoundWrapClocks } from './zoneDurationClock.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from './expirationQueue.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';

const ZONES_ON = { mode: 'on', zones: true };

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getAllStoreKeys.mockReturnValue([]);
});

describe('clauseDurationRounds — initiative-20 lair cadence (§8.3 rank 3)', () => {
    it('initiative-count-20 durations map to rounds:1 (next round wrap)', () => {
        expect(clauseDurationRounds('until initiative count 20 next round (advisory)')).toBe(1);
        expect(clauseDurationRounds('until_initiative_count_20_next_round')).toBe(1);
        expect(clauseDurationRounds('until initiative count 20 on the next round (contested Charisma check to escape early — GM-enforced)')).toBe(1);
    });

    it('re-crest/dismiss/die-bounded rows are NOT clocked by a trailing initiative clause', () => {
        expect(clauseDurationRounds('until the dragon uses this lair action again or dies; mud hardens at initiative count 20 next round (advisory)')).toBeUndefined();
        expect(clauseDurationRounds('until dismissed or used again (advisory)')).toBeUndefined();
    });

    it('explicit round/minute counts still win over the initiative clause', () => {
        expect(clauseDurationRounds('2 rounds, ends earlier on initiative count 20')).toBe(2);
        expect(clauseDurationRounds('1 minute (advisory)')).toBe(10);
    });
});

describe('clauseDurationRounds (CLA-334 recipe)', () => {
    it('rounds text parses to the round count', () => {
        expect(clauseDurationRounds('1 round')).toBe(1);
        expect(clauseDurationRounds('2_rounds')).toBe(2);
        expect(clauseDurationRounds('until the end of next turn — 3 rounds')).toBe(3);
    });

    it('minutes ×10, hours ×600 (CLA-334)', () => {
        expect(clauseDurationRounds('1 minute')).toBe(10);
        expect(clauseDurationRounds('10 minutes')).toBe(100);
        expect(clauseDurationRounds('8 hours')).toBe(4800);
        expect(clauseDurationRounds('1 hour')).toBe(600);
    });

    it('indefinite / unauthored durations parse to NOTHING — never a guess', () => {
        expect(clauseDurationRounds('concentration')).toBeUndefined();
        expect(clauseDurationRounds('until dismissed')).toBeUndefined();
        expect(clauseDurationRounds(null)).toBeUndefined();
        expect(clauseDurationRounds(undefined)).toBeUndefined();
        expect(clauseDurationRounds('')).toBeUndefined();
    });
});

describe('zonesClockEnforcementLive', () => {
    it('off / flag-off / no-campaign ⇒ false', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(zonesClockEnforcementLive('test-campaign')).toBe(false);
        getRuntimeValue.mockReturnValue({ mode: 'off', zones: true });
        expect(zonesClockEnforcementLive('test-campaign')).toBe(false);
        getRuntimeValue.mockReturnValue({ mode: 'on', zones: false });
        expect(zonesClockEnforcementLive('test-campaign')).toBe(false);
        expect(zonesClockEnforcementLive(null)).toBe(false);
    });

    it('mode on + zones ⇒ true', () => {
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(zonesClockEnforcementLive('test-campaign')).toBe(true);
    });
});

describe('armDurationClockIfEnforced', () => {
    const base = {
        campaignName: 'test-campaign',
        ownerName: 'Dragon',
        targetName: 'Dragon',
        effects: [{ type: 'remove_target_effect', effectKey: 'lair_darkness', source: 'Dragon', target: 'Dragon' }],
        durationText: '1 minute',
    };

    it('enforcement OFF ⇒ null with ZERO clock writes (byte-parity)', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(armDurationClockIfEnforced(base)).toBeNull();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('zones flag OFF ⇒ zero writes even with the text present', () => {
        getRuntimeValue.mockReturnValue({ mode: 'on', zones: false });
        expect(armDurationClockIfEnforced(base)).toBeNull();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('indefinite duration NEVER fabricates a clock', () => {
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(armDurationClockIfEnforced({ ...base, durationText: 'concentration' })).toBeNull();
        expect(armDurationClockIfEnforced({ ...base, durationText: null })).toBeNull();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('live + authored duration ⇒ ONE merged clock entry (CLA-334 rounds)', () => {
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(armDurationClockIfEnforced(base)).toBe(10);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Dragon',
            targetName: 'Dragon',
            effects: base.effects,
            campaignName: 'test-campaign',
            rounds: 10,
        });
    });

    it('empty effects / missing owner ⇒ no write even when live', () => {
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(armDurationClockIfEnforced({ ...base, effects: [] })).toBeNull();
        expect(armDurationClockIfEnforced({ ...base, ownerName: null })).toBeNull();
        expect(addExpiration).not.toHaveBeenCalled();
    });
});

describe('drainRoundWrapClocks — initiative-20 cadence seam (rank 3)', () => {
    const lairEntry = (appliedRound, expiryRounds = 1) => ({
        target: 'Hero',
        effects: [{ type: 'remove_target_effect', effectKey: 'lair_fog_cloud', source: 'Dragon', target: 'Hero' }],
        appliedRound,
        expiryRounds,
        expireOnCreatureName: null,
    });

    it('enforcement off ⇒ zero scans, zero writes', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(drainRoundWrapClocks({ campaignName: 'test-campaign', roundToSet: 2 })).toBe(0);
        expect(getAllStoreKeys).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('zones ON: matures round clocks across ALL stores at the wrap, rewrites each dirty store once', () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'enforcement') return ZONES_ON;
            if (name === 'Dragon' && key === 'pendingExpirations') return [lairEntry(1), lairEntry(1, 5)];
            return null;
        });
        getAllStoreKeys.mockReturnValue(['campaign', 'Dragon', 'Hero']);
        expect(drainRoundWrapClocks({ campaignName: 'test-campaign', roundToSet: 2 })).toBe(1);
        // one rewrite carrying the un-matured entry only
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('Dragon', 'pendingExpirations', [lairEntry(1, 5)], 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: 'enforcement_clock_expired' }));
    });

    it('nothing matured ⇒ no writes, no log', () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'enforcement') return ZONES_ON;
            if (key === 'pendingExpirations') return [lairEntry(1, 5)];
            return null;
        });
        getAllStoreKeys.mockReturnValue(['Dragon']);
        expect(drainRoundWrapClocks({ campaignName: 'test-campaign', roundToSet: 2 })).toBe(0);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('no roundToSet falls back to getCurrentCombatRound', () => {
        getCurrentCombatRound.mockReturnValue(2);
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'enforcement') return ZONES_ON;
            if (key === 'pendingExpirations') return [lairEntry(1)];
            return null;
        });
        getAllStoreKeys.mockReturnValue(['Dragon']);
        expect(drainRoundWrapClocks({ campaignName: 'test-campaign' })).toBe(1);
    });

    it('no campaign ⇒ 0', () => {
        expect(drainRoundWrapClocks({ roundToSet: 2 })).toBe(0);
    });
});
