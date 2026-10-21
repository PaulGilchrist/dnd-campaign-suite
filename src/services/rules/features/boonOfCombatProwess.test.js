// @maintained-by-ai
// FT-007: Boon of Combat Prowess once-per-turn round latch — OWNER lane.
// This service owns only the latch bytes: the key string (hardcoded verbatim
// by the re-arm lanes in initiative/navigationHandlers.js:58, Initiative.jsx:84
// and restRules-constants.js) plus the stamp/consult semantics. The round number
// is FORWARDED from getCurrentCombatRound; miss-to-hit conversion math lives in
// the attack pipeline, availability gating in contextBuilder-sync (passives
// tests), and the null-clear re-arm lanes in useInitiativeEffects/restRules —
// none of those are re-pinned here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Faithful in-memory model of the runtime store lane this latch occupies.
const store = new Map();

vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import {
    BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY,
    boonOfCombatProwessLocked,
    markBoonOfCombatProwessUsed,
} from './boonOfCombatProwess.js';

describe('FT-007 Boon of Combat Prowess round latch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store.clear();
        getRuntimeValue.mockImplementation((name, key) => store.get(`${name}:${key}`) ?? null);
        setRuntimeValue.mockImplementation((name, key, value) => {
            store.set(`${name}:${key}`, value);
            return Promise.resolve();
        });
        getCurrentCombatRound.mockReturnValue(1);
    });

    it('shares the exact key literal the re-arm lanes hardcode', () => {
        // initiative/navigationHandlers.js, Initiative.jsx and restRules-constants.js
        // clear/re-arm this latch by RAW STRING — renaming the value would silently
        // strand the latch locked for the holder after every combat.
        expect(BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY).toBe('_Boon_of_Combat_Prowess_usedRound');
    });

    it('is locked only for the round the latch was spent', () => {
        // Consult forwards the exact identity tuple to the store lane.
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(false);
        expect(getRuntimeValue).toHaveBeenCalledWith(
            'Monk', BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY, 'camp');

        // Spent this round → locked (the store may echo the stamp back as a
        // string through server JSON — the latch must still read it as locked).
        getCurrentCombatRound.mockReturnValue(4);
        store.set(`Monk:${BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY}`, '4');
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(true);

        // Round advanced → re-armed (round-wrap/initiative clears covered in the
        // useInitiativeEffects lane; this is the natural round-advance re-arm).
        getCurrentCombatRound.mockReturnValue(5);
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(false);

        // Missing round source consults as round 1 — the same default the real
        // combatData.getCurrentCombatRound returns, so stamp/consult agree.
        getCurrentCombatRound.mockReturnValue(undefined);
        store.set(`Monk:${BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY}`, 1);
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(true);
    });

    it('spending stamps the forwarded round and locks the rest of that round', async () => {
        getCurrentCombatRound.mockReturnValue(7);
        await expect(markBoonOfCombatProwessUsed('Monk', 'camp')).resolves.toBe(7);

        // Exact write signature: (characterKey, key, value, campaignName). No
        // skipSync exists on the setRuntimeValue route (useRuntimeState.js:78),
        // and this is a player-initiated self-cast — it must POST and broadcast.
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Monk', BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY, 7, 'camp');

        // Round-trip against the store: locked for the rest of round 7,
        // re-armed at round 8.
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(true);
        getCurrentCombatRound.mockReturnValue(8);
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(false);
    });
});
