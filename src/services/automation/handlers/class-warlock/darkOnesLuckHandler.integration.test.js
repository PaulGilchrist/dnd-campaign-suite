// @maintained-by-ai
// Integration sub-lane for darkOnesLuckHandler: exercises the REAL runtime store
// (getStore / getRuntimeValue / setRuntimeValue) end-to-end — cross-store reads
// ('campaign' lastAttack vs player uses), the null-default ?? maxUses fallback,
// and the store write-back after consuming a use. Popup description formatting,
// rollType branches, and attackerName filtering are owned by the mock-based main
// suite darkOnesLuckHandler.test.js (mockRuntime router) — do not duplicate here.
// Deterministic: die roll is never pinned (asserts cover store state + original
// totals only), fetch is inert via src/test/setup.js, turn-based — no game timers.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStore } from '../../../../hooks/runtime/useRuntimeState.js';
import { handle } from './darkOnesLuckHandler.js';

const campaignName = 'test-campaign';
const playerName = 'HexbladeWarlockTest';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { addEntry } = await import('../../../ui/logService.js');

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 1,
        class: { name: 'Warlock', major: { name: 'Fiend Patron' } },
        abilities: [{ name: 'Charisma', bonus: 2 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: "Dark One's Own Luck",
        automation: { type: 'dark_ones_luck', diceExpression: '1d10' },
        ...overrides,
    };
}

describe('darkOnesLuckHandler integration with runtime store', () => {
    beforeEach(() => {
        getStore(playerName).clear();
        getStore('campaign').clear();
        vi.clearAllMocks();
    });

    it('should consume a use in the real store and log when enhancing a check', async () => {
        const store = getStore(playerName);
        store.set('darkOnesLuckUses', 2);

        const campaignStore = getStore('campaign');
        const lastAttack = {
            rollType: 'check',
            attackerName: playerName,
            d20: 3,
            bonus: 3,
            checkName: 'Stealth check'
        };
        campaignStore.set('lastAttack', lastAttack);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result).toBeDefined();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe("Dark One's Own Luck");
        // Store-seeded lastAttack fields surfaced through the real getRuntimeValue read
        expect(result.payload.description).toContain('Stealth check');
        expect(result.payload.description).toContain('d20(3) + 3 = 6');
        // Write-back seam: the player store actually decremented (2 → 1)
        expect(store.get('darkOnesLuckUses')).toBe(1);
        // Campaign store untouched
        expect(campaignStore.get('lastAttack')).toEqual(lastAttack);
        // Every automation logs its use
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: playerName,
            abilityName: "Dark One's Own Luck",
        }));
    });

    it('should default uses to CHA modifier when the store key was never seeded', async () => {
        // Real getRuntimeValue returns null for absent keys — handler must apply ?? maxUses
        const store = getStore(playerName);

        const campaignStore = getStore('campaign');
        campaignStore.set('lastAttack', {
            rollType: 'check',
            attackerName: playerName,
            d20: 3,
            bonus: 3,
            checkName: 'Stealth check'
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Stealth check');
        // CHA modifier 2 (from abilities) → maxUses 2 → consumed to 1 in the real store
        expect(store.get('darkOnesLuckUses')).toBe(1);
    });

    it('should reject with zero seeded uses without falling back to maxUses or mutating state', async () => {
        const store = getStore(playerName);
        store.set('darkOnesLuckUses', 0);

        // Valid recent roll present: proves the uses guard fires before the recency guard
        const campaignStore = getStore('campaign');
        campaignStore.set('lastAttack', {
            rollType: 'check',
            attackerName: playerName,
            d20: 3,
            bonus: 3,
            checkName: 'Stealth check'
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('no uses remaining');
        // Real 0 round-trips as 0 — ?? (not ||) semantics — and nothing is mutated
        expect(store.get('darkOnesLuckUses')).toBe(0);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('should reject and leave player state untouched when campaign store has no lastAttack', async () => {
        const store = getStore(playerName);
        store.set('darkOnesLuckUses', 1);
        // Campaign store stays empty — pins the absent-key read default across stores

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result).toBeDefined();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent ability check');
        // No side effects on rejection
        expect(store.get('darkOnesLuckUses')).toBe(1);
        expect(addEntry).not.toHaveBeenCalled();
    });
});
