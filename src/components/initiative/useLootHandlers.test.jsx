// @maintained-by-ai
/**
 * useLootHandlers — handler-seam contract for the Initiative loot UI.
 *
 * Lane: user-driven loot generate / award / clear handlers (renderHook).
 * Generator internals are owned by src/services/items/lootGenerator*.test.js
 * (mocked here at the boundary); campaign log + runtime-store writes are
 * boundary-mocked and asserted as exact payload bytes, exact-once.
 * Auto-award encounter entries are owned by autoRewardService.test.js — no overlap.
 *
 * Old -> new map (12 -> 7):
 *  initial-state defaults ................ removed (vacuous useState defaults;
 *                                              failure/clear tests re-pin the same bytes)
 *  "returns all functions" toBeDefined . removed (API-surface noise)
 *  generate success ...................... kept + pending-flag & exact-once call
 *  generate null / generate reject ..... consolidated into "generate failure"
 *  award success ......................... kept + floor split, XP accumulation,
 *                                          exact log bytes, full state reset
 *  award all-no-loot / mixed items ... consolidated into "No loot filtering"
 *  award null characters ................. kept (zero-write guard battery)
 *  award log write fails ............... kept + state-preserved & no-XP assertions
 *  clear resets state .................. kept + zero-write assertion
 *  clear when already cleared .......... removed (near-vacuous)
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLootHandlers } from './useLootHandlers.js';
import { generateLootFromCombatSummary } from '../../services/items/lootGenerator.js';
import { addEntry } from '../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../services/items/lootGenerator.js', () => ({
    generateLootFromCombatSummary: vi.fn(async () => ({ lootEntries: [], totalEncounterXp: 0 })),
}));

// The hook only touches getRuntimeValue/setRuntimeValue; mock the transport
// minimally and seed existing XP so the accumulate-on-award contract is pinned.
const xpSeed = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key) => (key === 'xp' ? xpSeed.get(name) ?? 0 : 0)),
    setRuntimeValue: vi.fn(),
}));

describe('useLootHandlers', () => {
    const campaignName = 'test-campaign';
    const characters = [
        { name: 'Alice' },
        { name: 'Bob' },
    ];
    const combatSummary = { round: 1, creatures: [] };
    const EMPTY = { lootEntries: [], totalEncounterXp: 0 };

    beforeEach(() => {
        vi.clearAllMocks(); // preserves implementations, clears calls
        xpSeed.clear();
    });

    describe('handleGenerateLoot', () => {
        it('raises the pending flag, calls the generator once, and populates loot state', async () => {
            let resolveGen;
            generateLootFromCombatSummary.mockReturnValueOnce(
                new Promise(resolve => { resolveGen = resolve; })
            );
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            act(() => { result.current.handleGenerateLoot(); });
            expect(result.current.generatingLoot).toBe(true);

            await act(async () => {
                resolveGen({ lootEntries: ['Gold coins (100)', 'Silver sword'], totalEncounterXp: 200 });
            });

            expect(generateLootFromCombatSummary).toHaveBeenCalledTimes(1);
            expect(generateLootFromCombatSummary).toHaveBeenCalledWith(combatSummary, characters, campaignName);
            expect(result.current.generatingLoot).toBe(false);
            expect(result.current.lootData).toEqual({ lootEntries: ['Gold coins (100)', 'Silver sword'], totalEncounterXp: 200 });
            expect(result.current.lootTextValue).toBe('Gold coins (100)\nSilver sword');
            // Generating loot must not touch persisted game state
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        // Source bug pinned honestly: a null resolve currently throws inside the
        // handler (unguarded lootResult.lootEntries.join) and lands in the same
        // catch as a rejection — both observable as logged error + untouched state.
        it.each([
            ['resolves null', () => generateLootFromCombatSummary.mockResolvedValueOnce(null)],
            ['rejects', () => generateLootFromCombatSummary.mockRejectedValueOnce(new Error('Generation failed'))],
        ])('logs the error and leaves loot state untouched when the generator %s', async (_label, setupGenerator) => {
            setupGenerator();
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                await result.current.handleGenerateLoot();
            });

            expect(consoleSpy).toHaveBeenCalledWith('Failed to generate loot:', expect.any(Error));
            expect(result.current.generatingLoot).toBe(false);
            expect(result.current.lootData).toEqual(EMPTY);
            expect(result.current.lootTextValue).toBe('');
            expect(setRuntimeValue).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('handleAwardLoot', () => {
        it('floor-splits XP, accumulates onto existing XP, logs both entries verbatim, and resets loot state', async () => {
            xpSeed.set('Alice', 500); // Bob starts at 0 via getRuntimeValue default

            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['Gold coins (100)', 'Silver sword'], totalEncounterXp: 201 });
                result.current.setLootTextValue('Gold coins (100)\nSilver sword');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            // floor(201 / 2) = 100 XP per character, added to whatever is stored
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'Alice', 'xp', 600, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'Bob', 'xp', 100, campaignName);

            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenNthCalledWith(1, campaignName, {
                type: 'loot',
                encounterName: 'Combat',
                lootItems: ['Gold coins (100)', 'Silver sword'],
                xpPerChar: 100,
                totalEncounterXp: 201,
            });
            expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, {
                type: 'encounter',
                action: 'loot_awarded',
                encounterName: 'Combat',
                xpPerChar: 100,
                totalEncounterXp: 201,
                lootItems: ['Gold coins (100)', 'Silver sword'],
            });

            expect(result.current.lootData).toEqual(EMPTY);
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.showAwardLoot).toBe(false);
            expect(result.current.awardingLoot).toBe(false);
        });

        it('skips the loot log entry when every item is "No loot", and logs only real items when mixed', async () => {
            // Case A: all "No loot" -> no loot entry, but XP is still awarded
            const first = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));
            await act(async () => {
                first.result.current.setLootData({ lootEntries: ['No loot for these monsters'], totalEncounterXp: 50 });
                first.result.current.setLootTextValue('No loot for these monsters');
            });
            await act(async () => {
                await first.result.current.handleAwardLoot();
            });

            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'encounter',
                action: 'loot_awarded',
                encounterName: 'Combat',
                xpPerChar: 25,
                totalEncounterXp: 50,
                lootItems: ['No loot for these monsters'],
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'xp', 25, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'xp', 25, campaignName);

            addEntry.mockClear();
            setRuntimeValue.mockClear();

            // Case B: mixed -> loot entry contains only the real items
            const second = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));
            await act(async () => {
                second.result.current.setLootData({ lootEntries: ['No loot for these monsters', 'Gold coins'], totalEncounterXp: 100 });
                second.result.current.setLootTextValue('No loot for these monsters\nGold coins');
            });
            await act(async () => {
                await second.result.current.handleAwardLoot();
            });

            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenNthCalledWith(1, campaignName, {
                type: 'loot',
                encounterName: 'Combat',
                lootItems: ['Gold coins'],
                xpPerChar: 50,
                totalEncounterXp: 100,
            });
        });

        it('with characters null writes no XP but still logs the encounter award', async () => {
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, null, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['Gold'], totalEncounterXp: 200 });
                result.current.setLootTextValue('Gold');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            expect(getRuntimeValue).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, {
                type: 'encounter',
                action: 'loot_awarded',
                encounterName: 'Combat',
                xpPerChar: 200, // full pool, no one to split with
                totalEncounterXp: 200,
                lootItems: ['Gold'],
            });
            expect(result.current.showAwardLoot).toBe(false);
        });

        it('logs the error and preserves loot state for retry when the log write fails', async () => {
            addEntry.mockRejectedValueOnce(new Error('Log failed'));
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['Gold'], totalEncounterXp: 100 });
                result.current.setLootTextValue('Gold');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            expect(consoleSpy).toHaveBeenCalledWith('Failed to award loot:', expect.any(Error));
            // Failure happened on the loot entry; nothing downstream executed
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            // State preserved so the GM can retry the award
            expect(result.current.lootData).toEqual({ lootEntries: ['Gold'], totalEncounterXp: 100 });
            expect(result.current.lootTextValue).toBe('Gold');
            expect(result.current.showAwardLoot).toBe(true);
            expect(result.current.awardingLoot).toBe(false);

            consoleSpy.mockRestore();
        });
    });

    describe('handleClearLoot', () => {
        it('resets all loot state locally without writing to log or runtime store', async () => {
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['Gold'], totalEncounterXp: 100 });
                result.current.setLootTextValue('Gold coins');
                result.current.setShowAwardLoot(true);
            });

            act(() => { result.current.handleClearLoot(); });

            expect(result.current.lootData).toEqual(EMPTY);
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.showAwardLoot).toBe(false);
            expect(addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
