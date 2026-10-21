// @maintained-by-ai
// L5-003 §8.3 (triage #1) — duration-clock producer tests.
// The clock here is the repo's ROUND counter: entries mature at initiative
// seams (roundToSet / getCurrentCombatRound), NEVER on wall-clock time
// (no-timers MANDATORY). Source audit: Date.now() appears ONLY inside
// addEntry log payloads (benign logging category), never in maturity math.
// WRITE-face split: the until-stamp / single-write payload INSIDE
// addExpiration is owned VERBATIM by addExpiration.ba001-single-write.test.js;
// this file owns arm semantics (which args the clock is armed with), the
// initiative-20 round-wrap drain, and the T4 combat-scoped sweep seams'
// gates + delegation + log wording. Caller wiring (initiative/rest seams)
// is covered by createCreatureHandlers.test.jsx / initiative.test.jsx /
// restRules-*.test.js against this mocked module — not duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('./expirationQueue.js', () => ({
    addExpiration: vi.fn(),
    // Mirror the real maturity rule (currentRound >= appliedRound + rounds;
    // creature anchors mature ONLY when an activeName is supplied — the
    // round-wrap drain passes null, so anchored entries must survive there).
    // The exhaustive consumer suite lives in this folder's queue tests.
    processExpirationList: vi.fn((list, currentRound, _owner, _campaignName, activeName) => {
        const processed = [];
        let expiredCount = 0;
        for (const item of list) {
            const rounds = item.expiryRounds ?? Infinity;
            const isRoundExpired = Number.isFinite(item.appliedRound) && currentRound >= item.appliedRound + rounds;
            const isCreatureExpired = !!(item.expireOnCreatureName && activeName
                && item.expireOnCreatureName === activeName && currentRound > item.appliedRound);
            if (isRoundExpired || isCreatureExpired) expiredCount++;
            else processed.push(item);
        }
        return { processed, expiredCount, changed: expiredCount > 0 };
    }),
    // Mirror the real combat-scoped sweep (until === 'combat') so the seam
    // tests see realistic swept counts while owning only gate/delegation/log.
    sweepCombatScopedExpirations: vi.fn(({ campaignName, ownerName = null }) => {
        const keys = ownerName ? [ownerName] : (getAllStoreKeys() || []);
        let swept = 0;
        for (const key of keys) {
            const list = getRuntimeValue(key, 'pendingExpirations');
            if (!Array.isArray(list) || !list.length) continue;
            const doomed = list.filter((e) => e?.until === 'combat');
            if (!doomed.length) continue;
            swept += doomed.length;
            setRuntimeValue(key, 'pendingExpirations', list.filter((e) => e?.until !== 'combat'), campaignName);
        }
        return swept;
    }),
}));
vi.mock('./turnStartEffects.js', () => ({ KEY: 'pendingExpirations' }));
vi.mock('../../encounters/combatData.js', () => ({ getCurrentCombatRound: vi.fn(() => 1) }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

import { clauseDurationRounds, clauseCombatScopedDuration, durationArmNote, zonesClockEnforcementLive, armDurationClockIfEnforced, drainRoundWrapClocks, sweepNewCombatClocks, sweepRestClocks } from './zoneDurationClock.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration, sweepCombatScopedExpirations } from './expirationQueue.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';

const ZONES_ON = { mode: 'on', zones: true };

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getAllStoreKeys.mockReturnValue([]);
    getCurrentCombatRound.mockReturnValue(1);
});

describe('authored-duration parsing policy (CLA-334 recipe + no-timers T3)', () => {
    it('sub-minute durations parse to finite round counts; explicit rounds beat a trailing initiative clause', () => {
        const finite = [
            ['1 round', 1],
            ['2_rounds', 2],
            ['2 rounds', 2],
            ['until the end of next turn — 3 rounds', 3],
            ['2 rounds, ends earlier on initiative count 20', 2],
            // initiative-count-20 lair cadence ⇒ 1: matures at the very next round wrap (§8.3 rank 3)
            ['until initiative count 20 next round (advisory)', 1],
            ['until_initiative_count_20_next_round', 1],
            ['until initiative count 20 on the next round (contested Charisma check to escape early — GM-enforced)', 1],
        ];
        for (const [text, rounds] of finite) {
            expect(clauseDurationRounds(text)).toBe(rounds);
        }
    });

    it('authored >=1 MINUTE is COMBAT-SCOPED — never a minutes×10/hours×600 round countdown', () => {
        for (const text of ['1 minute', '10 minutes', '1 hour', '8 hours', '1 minute (advisory)']) {
            expect(clauseDurationRounds(text)).toBeUndefined();
            expect(clauseCombatScopedDuration(text)).toBe(true);
        }
        expect(clauseDurationRounds('2 rounds')).toBe(2);
        expect(clauseCombatScopedDuration('2 rounds')).toBe(false);
    });

    it('indefinite / re-crest-bounded / unauthored durations parse to NOTHING — never a fabricated clock (MA-1215)', () => {
        const unclocked = [
            'concentration',
            'until dismissed',
            'until dismissed or used again (advisory)',
            // BOUNDED BY RE-CREST, not by the trailing initiative clause — never clocked to the cadence
            'until the dragon uses this lair action again or dies; mud hardens at initiative count 20 next round (advisory)',
            null,
            undefined,
            '',
        ];
        for (const text of unclocked) {
            expect(clauseDurationRounds(text)).toBeUndefined();
            expect(clauseCombatScopedDuration(text)).toBe(false);
        }
    });
});

describe('zonesClockEnforcementLive', () => {
    it('true ONLY with campaign + mode on + zones flag', () => {
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(zonesClockEnforcementLive('test-campaign')).toBe(true);
        for (const enforcement of [null, undefined, { mode: 'off', zones: true }, { mode: 'on', zones: false }]) {
            getRuntimeValue.mockReturnValue(enforcement);
            expect(zonesClockEnforcementLive('test-campaign')).toBe(false);
        }
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(zonesClockEnforcementLive(null)).toBe(false);
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

    it('live + authored >=1 minute ⇒ ONE merged COMBAT-SCOPED arm (rounds: Infinity, until: combat — no countdown)', () => {
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(armDurationClockIfEnforced(base)).toBe('combat');
        expect(addExpiration).toHaveBeenCalledTimes(1);
        // Arming ARGS are this module's contract; the until-stamped payload
        // written INSIDE addExpiration is owned VERBATIM by
        // addExpiration.ba001-single-write.test.js.
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Dragon',
            targetName: 'Dragon',
            effects: base.effects,
            campaignName: 'test-campaign',
            rounds: Infinity,
            until: 'combat',
        });
        expect(durationArmNote('combat')).toContain('combat-scoped');
        expect(durationArmNote('combat')).toContain('next initiative roll or a rest');
    });

    it('live + sub-minute rounds ⇒ finite round clock with exact args (no until key)', () => {
        getRuntimeValue.mockReturnValue(ZONES_ON);
        expect(armDurationClockIfEnforced({ ...base, durationText: '2 rounds' })).toBe(2);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Dragon',
            targetName: 'Dragon',
            effects: base.effects,
            campaignName: 'test-campaign',
            rounds: 2,
        });
        expect(durationArmNote(2)).toBe('2 rounds (enforcement: zones)');
    });

    it('NEVER arms — returns null with ZERO writes whenever enforcement is off or nothing is authored', () => {
        const noArmCases = [
            [{ ...base }, null, 'enforcement absent'],
            [{ ...base }, { mode: 'off', zones: true }, 'enforcement mode off'],
            [{ ...base }, { mode: 'on', zones: false }, 'zones flag off even with text present'],
            [{ ...base, campaignName: null }, ZONES_ON, 'no campaign'],
            [{ ...base, ownerName: null }, ZONES_ON, 'no owner store'],
            [{ ...base, effects: [] }, ZONES_ON, 'empty effects'],
            [{ ...base, durationText: 'concentration' }, ZONES_ON, 'concentration stays concentration'],
            [{ ...base, durationText: 'until dismissed' }, ZONES_ON, 'dismiss-bounded'],
            [{ ...base, durationText: null }, ZONES_ON, 'no duration text'],
        ];
        for (const [ctx, enforcement] of noArmCases) {
            getRuntimeValue.mockReturnValue(enforcement);
            expect(armDurationClockIfEnforced(ctx)).toBeNull();
        }
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

    it('enforcement off / no campaign ⇒ zero scans, zero writes (byte-parity)', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(drainRoundWrapClocks({ campaignName: 'test-campaign', roundToSet: 2 })).toBe(0);
        expect(drainRoundWrapClocks({ campaignName: null, roundToSet: 2 })).toBe(0);
        expect(getAllStoreKeys).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('zones ON: matures round clocks at the wrap, rewrites the dirty store once, logs — creature-anchored entries SURVIVE the wrap', () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'enforcement') return ZONES_ON;
            if (name === 'Dragon' && key === 'pendingExpirations') return [lairEntry(1), lairEntry(1, 5)];
            if (name === 'Hero' && key === 'pendingExpirations') return [{ ...lairEntry(0, Infinity), expireOnCreatureName: 'Hero' }];
            return null;
        });
        getAllStoreKeys.mockReturnValue(['campaign', 'Dragon', 'Hero']);
        expect(drainRoundWrapClocks({ campaignName: 'test-campaign', roundToSet: 2 })).toBe(1);
        // one rewrite carrying the un-matured entry only; the anchored Hero
        // store must NOT be touched (drain passes activeName: null — if it
        // leaked its store key as activeName, the anchored entry would expire)
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('Dragon', 'pendingExpirations', [lairEntry(1, 5)], 'test-campaign');
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            automationType: 'enforcement_clock_expired',
            description: expect.stringContaining('Initiative-20 cadence: 1 zone/effect clock expired at the round-2 wrap'),
        }));
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

    it('no roundToSet falls back to getCurrentCombatRound at the seam', () => {
        getCurrentCombatRound.mockReturnValue(2);
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'enforcement') return ZONES_ON;
            if (key === 'pendingExpirations') return [lairEntry(1)];
            return null;
        });
        getAllStoreKeys.mockReturnValue(['Dragon']);
        expect(drainRoundWrapClocks({ campaignName: 'test-campaign' })).toBe(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('Dragon', 'pendingExpirations', [], 'test-campaign');
    });
});

describe('no-timers T4 — combat-scoped sweeps (new initiative roll / rests)', () => {
    const combatEntry = () => ({
        target: 'Dragon',
        effects: [{ type: 'remove_target_effect', effectKey: 'stinking_cloud', source: 'Dragon', target: 'Dragon' }],
        appliedRound: 1,
        expiryRounds: Infinity,
        expireOnCreatureName: null,
        until: 'combat',
    });
    const legacyEntry = () => ({
        target: 'Hero',
        effects: [{ type: 'remove_target_effect', effectKey: 'bless', source: 'Cleric', target: 'Hero' }],
        appliedRound: 1,
        expiryRounds: 2,
        expireOnCreatureName: null,
    });

    it('enforcement OFF ⇒ zero scans, zero writes, zero log (byte-parity)', async () => {
        getRuntimeValue.mockReturnValue(null);
        expect(await sweepNewCombatClocks('test-campaign')).toBe(0);
        expect(getAllStoreKeys).not.toHaveBeenCalled();
        expect(sweepCombatScopedExpirations).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('new initiative roll: gates live, delegates the ALL-stores sweep, logs the swept count', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'enforcement') return ZONES_ON;
            if (name === 'Dragon' && key === 'pendingExpirations') return [legacyEntry(), combatEntry()];
            return null;
        });
        getAllStoreKeys.mockReturnValue(['campaign', 'Dragon']);
        expect(await sweepNewCombatClocks('test-campaign')).toBe(1);
        // delegation WITHOUT ownerName = every store; the until:'combat'
        // filter + survivor rewrite INSIDE the queue is owned by the
        // expirationQueue suite (see sweep at #1285 clear-side lane).
        expect(sweepCombatScopedExpirations).toHaveBeenCalledWith({ campaignName: 'test-campaign' });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            automationType: 'enforcement_clock_expired',
            description: expect.stringContaining('New initiative roll: 1 combat-scoped effect ended'),
        }));
    });

    it('rests sweep short AND long with their own wording (unconditional by design — combat-scoped entries only exist while armed)', async () => {
        for (const [restKind, wording] of [
            ['short', 'Short rest: 1 combat-scoped effect ended'],
            ['long', 'Long rest: 1 combat-scoped effect ended'],
        ]) {
            vi.clearAllMocks();
            getRuntimeValue.mockImplementation((name, key) =>
                (name === 'Dragon' && key === 'pendingExpirations' ? [combatEntry()] : null));
            getAllStoreKeys.mockReturnValue(['Dragon']);
            expect(await sweepRestClocks('test-campaign', restKind)).toBe(1);
            expect(sweepCombatScopedExpirations).toHaveBeenCalledWith({ campaignName: 'test-campaign' });
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                automationType: 'enforcement_clock_expired',
                description: expect.stringContaining(wording),
            }));
        }
    });

    it('nothing armed ⇒ zero writes, zero log at every sweep seam', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'enforcement') return ZONES_ON;
            if (key === 'pendingExpirations') return [legacyEntry()];
            return null;
        });
        getAllStoreKeys.mockReturnValue(['Dragon']);
        expect(await sweepNewCombatClocks('test-campaign')).toBe(0);
        expect(await sweepRestClocks('test-campaign', 'short')).toBe(0);
        expect(await sweepRestClocks('test-campaign', 'long')).toBe(0);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
