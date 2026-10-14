import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

import {
    checkOncePerTurn,
    checkOncePerTurnWithSkip,
    markOncePerTurn,
    setSkipFlag,
    clearSkipFlag,
} from './oncePerTurn.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';

const CAMPAIGN = 'test-campaign';
const PLAYER_STATS = { name: 'TestCharacter' };

function mockCombatContext(ctx) {
    damageUtils.getCombatContext.mockResolvedValue(ctx);
}

beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
});

// ── checkOncePerTurn ───────────────────────────────────────────

describe('checkOncePerTurn', () => {
    it('returns null when no stored value (feature is usable)', async () => {
        mockCombatContext({ round: 3, activeCreatureName: 'TestCharacter' });

        const result = await checkOncePerTurn('Cunning Strike', '_CunningStrike_usedRound', 'TestCharacter', CAMPAIGN);

        expect(result).toBeNull();
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
            'TestCharacter',
            '_CunningStrike_usedRound'
        );
    });

    it('returns popup when stored is a legacy number matching current round', async () => {
        mockCombatContext({ round: 3, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue.mockReturnValue(3);

        const result = await checkOncePerTurn('Cunning Strike', '_CunningStrike_usedRound', 'TestCharacter', CAMPAIGN);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cunning Strike',
                description: 'Cunning Strike can only be used once per turn.',
            },
        });
    });

    it('returns null when stored is a legacy number from a previous round', async () => {
        mockCombatContext({ round: 4, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue.mockReturnValue(3);

        const result = await checkOncePerTurn('Cunning Strike', '_CunningStrike_usedRound', 'TestCharacter', CAMPAIGN);

        expect(result).toBeNull();
    });

    it('returns null when stored new-format round+1 and creature matches', async () => {
        mockCombatContext({ round: 4, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestCharacter' });

        const result = await checkOncePerTurn('Cunning Strike', '_CunningStrike_usedRound', 'TestCharacter', CAMPAIGN);

        expect(result).toBeNull();
    });

    it('returns popup when stored new-format same round different creature', async () => {
        mockCombatContext({ round: 3, activeCreatureName: 'OtherCreature' });
        runtimeState.getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestCharacter' });

        const result = await checkOncePerTurn('Cunning Strike', '_CunningStrike_usedRound', 'TestCharacter', CAMPAIGN);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cunning Strike',
                description: 'Cunning Strike can only be used once per turn.',
            },
        });
    });

    // FT-082: re-arm is round-scoped off the holder's own store. A stale
    // cs.activeCreatureName mirror must NOT block re-arm on the holder's
    // next turn (old behavior degraded once-per-turn to once-per-2-rounds).
    it('returns null when stored new-format round+1 but mirror creature does not match (stale mirror)', async () => {
        mockCombatContext({ round: 4, activeCreatureName: 'OtherCreature' });
        runtimeState.getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestCharacter' });

        const result = await checkOncePerTurn('Cunning Strike', '_CunningStrike_usedRound', 'TestCharacter', CAMPAIGN);

        expect(result).toBeNull();
    });

    it('returns null when current round > stored round + 1', async () => {
        mockCombatContext({ round: 5, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestCharacter' });

        const result = await checkOncePerTurn('Cunning Strike', '_CunningStrike_usedRound', 'TestCharacter', CAMPAIGN);

        expect(result).toBeNull();
    });

    it('returns null when combat context is null (defaults round=1, creature=null)', async () => {
        damageUtils.getCombatContext.mockResolvedValue(null);
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const result = await checkOncePerTurn('Feature', '_key', 'TestCharacter', CAMPAIGN);

        expect(result).toBeNull();
    });
});

// ── checkOncePerTurnWithSkip ───────────────────────────────────

describe('checkOncePerTurnWithSkip', () => {
    it('returns null when no stored value and no skip (feature is usable)', async () => {
        mockCombatContext({ round: 3, activeCreatureName: 'TestCharacter' });

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toBeNull();
    });

    it('returns popup when stored legacy number matches current round', async () => {
        mockCombatContext({ round: 3, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(3)  // stored
            .mockReturnValueOnce(null); // skipped

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Feature',
                description: 'Feature can only be used once per turn.',
            },
        });
    });

    it('returns null when stored legacy number is from previous round', async () => {
        mockCombatContext({ round: 4, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(3)  // stored legacy
            .mockReturnValueOnce(null); // skipped

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toBeNull();
    });

    it('returns null when stored new-format round+1 and creature matches', async () => {
        mockCombatContext({ round: 4, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce({ round: 3, activeCreature: 'TestCharacter' })
            .mockReturnValueOnce(null);

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toBeNull();
    });

    it('returns popup when stored new-format same round different creature', async () => {
        mockCombatContext({ round: 3, activeCreatureName: 'OtherCreature' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce({ round: 3, activeCreature: 'TestCharacter' })
            .mockReturnValueOnce(null);

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Feature',
                description: 'Feature can only be used once per turn.',
            },
        });
    });

    // FT-082: round-scoped re-arm — a stale cs.activeCreatureName mirror
    // must not block re-arm in a later round.
    it('returns null when stored new-format round+1 but mirror creature does not match (stale mirror)', async () => {
        mockCombatContext({ round: 4, activeCreatureName: 'OtherCreature' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce({ round: 3, activeCreature: 'TestCharacter' })
            .mockReturnValueOnce(null);

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toBeNull();
    });

    it('returns null when current round > stored round + 1', async () => {
        mockCombatContext({ round: 5, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce({ round: 3, activeCreature: 'TestCharacter' })
            .mockReturnValueOnce(null);

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toBeNull();
    });

    it('returns popup when skip flag is legacy number matching current round', async () => {
        mockCombatContext({ round: 3, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(null)    // stored (not used)
            .mockReturnValueOnce(3);       // skipped legacy

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Feature',
                description: 'Feature was not used this turn.',
            },
        });
    });

    it('returns null when skip flag is legacy number from previous round', async () => {
        mockCombatContext({ round: 4, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(null)    // stored
            .mockReturnValueOnce(3);       // skipped legacy

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toBeNull();
    });

    // FT-082: skip-flag re-arm is round-scoped; creature mismatch no longer
    // blocks once the round has advanced.
    it('returns popup when skip flag is new-format same round (creature mismatch)', async () => {
        mockCombatContext({ round: 3, activeCreatureName: 'OtherCreature' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(null)
            .mockReturnValueOnce({ round: 3, activeCreature: 'TestCharacter' });

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Feature',
                description: 'Feature was not used this turn.',
            },
        });
    });

    it('returns null when skip flag is new-format and round > stored round AND creature matches', async () => {
        mockCombatContext({ round: 4, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(null)
            .mockReturnValueOnce({ round: 3, activeCreature: 'TestCharacter' });

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toBeNull();
    });

    it('returns popup when both stored and skipped are set and both block', async () => {
        mockCombatContext({ round: 3, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue
            .mockReturnValueOnce(3)         // stored legacy
            .mockReturnValueOnce(3);        // skipped legacy

        const result = await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            PLAYER_STATS,
            CAMPAIGN
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Feature',
                description: 'Feature can only be used once per turn.',
            },
        });
    });

    it('uses playerStats.name for both getRuntimeValue calls', async () => {
        mockCombatContext({ round: 2, activeCreatureName: 'TestCharacter' });
        runtimeState.getRuntimeValue.mockReturnValue(null);

        const stats = { name: 'MyCharacter' };
        await checkOncePerTurnWithSkip(
            'Feature',
            '_usedKey',
            '_skipKey',
            stats,
            CAMPAIGN
        );

        expect(runtimeState.getRuntimeValue).toHaveBeenNthCalledWith(
            1,
            'MyCharacter',
            '_usedKey',
            CAMPAIGN
        );
        expect(runtimeState.getRuntimeValue).toHaveBeenNthCalledWith(
            2,
            'MyCharacter',
            '_skipKey',
            CAMPAIGN
        );
    });
});

// ── markOncePerTurn ────────────────────────────────────────────

describe('markOncePerTurn', () => {
    it('stores { round, activeCreature } and returns it', async () => {
        mockCombatContext({ round: 5, activeCreatureName: 'TestCharacter' });

        const result = await markOncePerTurn('Feature', '_usedKey', PLAYER_STATS, CAMPAIGN);

        expect(result).toEqual({ round: 5, activeCreature: 'TestCharacter' });
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestCharacter',
            '_usedKey',
            { round: 5, activeCreature: 'TestCharacter' },
            CAMPAIGN
        );
    });

    it('falls back to playerStats.name when activeCreatureName is null', async () => {
        mockCombatContext({ round: 1, activeCreatureName: null });

        const result = await markOncePerTurn('Feature', '_usedKey', PLAYER_STATS, CAMPAIGN);

        expect(result).toEqual({ round: 1, activeCreature: 'TestCharacter' });
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestCharacter',
            '_usedKey',
            { round: 1, activeCreature: 'TestCharacter' },
            CAMPAIGN
        );
    });

    // FT-082: the cs.activeCreatureName mirror goes stale mid-combat
    // (pitfall 30) — the stamp must always carry the holder's name.
    it('stamps playerStats.name even when the cs mirror is stale', async () => {
        mockCombatContext({ round: 2, activeCreatureName: 'AasimarTest' });

        const result = await markOncePerTurn('Hamstring', '_Hamstring_usedRound', { name: 'EvasiveFighter' }, CAMPAIGN);

        expect(result).toEqual({ round: 2, activeCreature: 'EvasiveFighter' });
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'EvasiveFighter',
            '_Hamstring_usedRound',
            { round: 2, activeCreature: 'EvasiveFighter' },
            CAMPAIGN
        );
    });

    // FT-082 end-to-end latch semantics (same module, real functions):
    // stamp in round 2 → refuse for the rest of round 2 → re-arm in round 3
    // even while the mirror stays stale.
    it('refuses in the stamped round and re-arms in the next round despite stale mirror', async () => {
        mockCombatContext({ round: 2, activeCreatureName: 'AasimarTest' });
        runtimeState.getRuntimeValue.mockReturnValue(null);
        const stamp = await markOncePerTurn('Hamstring', '_Hamstring_usedRound', { name: 'EvasiveFighter' }, CAMPAIGN);
        runtimeState.getRuntimeValue.mockReturnValue(stamp);

        const refused = await checkOncePerTurn('Hamstring', '_Hamstring_usedRound', 'EvasiveFighter', CAMPAIGN);
        expect(refused?.payload?.description).toContain('once per turn');

        mockCombatContext({ round: 3, activeCreatureName: 'AasimarTest' });
        const available = await checkOncePerTurn('Hamstring', '_Hamstring_usedRound', 'EvasiveFighter', CAMPAIGN);
        expect(available).toBeNull();
    });
});

// ── setSkipFlag ────────────────────────────────────────────────

describe('setSkipFlag', () => {
    it('stores { round, activeCreature } for the skip key and returns it', async () => {
        mockCombatContext({ round: 5, activeCreatureName: 'TestCharacter' });

        const result = await setSkipFlag('_skipKey', PLAYER_STATS, CAMPAIGN);

        expect(result).toEqual({ round: 5, activeCreature: 'TestCharacter' });
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestCharacter',
            '_skipKey',
            { round: 5, activeCreature: 'TestCharacter' },
            CAMPAIGN
        );
    });

    it('falls back to playerStats.name when activeCreatureName is null', async () => {
        mockCombatContext({ round: 1, activeCreatureName: null });

        const result = await setSkipFlag('_skipKey', PLAYER_STATS, CAMPAIGN);

        expect(result).toEqual({ round: 1, activeCreature: 'TestCharacter' });
    });
});

// ── clearSkipFlag ──────────────────────────────────────────────

describe('clearSkipFlag', () => {
    it('sets the skip key to null', async () => {
        mockCombatContext({ round: 5, activeCreatureName: 'TestCharacter' });

        await clearSkipFlag('_skipKey', PLAYER_STATS, CAMPAIGN);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestCharacter',
            '_skipKey',
            null,
            CAMPAIGN
        );
    });
});
