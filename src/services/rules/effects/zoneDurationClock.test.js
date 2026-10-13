// L5-003 §8.3 (triage #1) — duration-clock producer tests.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));
vi.mock('./expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { clauseDurationRounds, zonesClockEnforcementLive, armDurationClockIfEnforced } from './zoneDurationClock.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from './expirationQueue.js';

const ZONES_ON = { mode: 'on', zones: true };

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
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
