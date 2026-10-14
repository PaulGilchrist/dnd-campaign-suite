import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLootHandlers } from './useLootHandlers.js';

vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../services/items/lootGenerator.js', () => ({
    generateLootFromCombatSummary: vi.fn(),
}));

// Shared store for the useRuntimeState mock
const lootTestStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => lootTestStore),
    useSyncedState: vi.fn((key, prop, defaultValue) => {
        const storeKey = `${key}-${prop}`;
        if (!lootTestStore.has(storeKey)) {
            lootTestStore.set(storeKey, { value: defaultValue, setter: null });
        }
        const entry = lootTestStore.get(storeKey);
        if (!entry.setter) {
            entry.setter = vi.fn((newValue) => { entry.value = newValue; });
        }
        return [entry.value, entry.setter];
    }),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_key, _prop) => null),
    setRuntimeValue: vi.fn((_key, prop, value, _campaign) => {
        lootTestStore.set(`${_key}-${prop}`, value);
    }),
    setRuntimeObject: vi.fn(),
}));

describe('useLootHandlers', () => {
    const campaignName = 'test-campaign';
    const characters = [
        { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20 } },
        { name: 'Bob', computedStats: { hitPoints: 15, currentHitPoints: 15 } },
    ];
    const combatSummary = { round: 1, creatures: [] };

    beforeEach(() => {
        vi.clearAllMocks();
        lootTestStore.clear();
    });

    describe('initial state', () => {
        it('should return initial state with empty loot data and all flags false', () => {
            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            expect(result.current.lootData).toEqual({ lootEntries: [], totalEncounterXp: 0 });
            expect(result.current.generatingLoot).toBe(false);
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.showAwardLoot).toBe(false);
            expect(result.current.awardingLoot).toBe(false);
        });

        it('should return all handler functions and setters', () => {
            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            expect(result.current.handleGenerateLoot).toBeDefined();
            expect(result.current.handleAwardLoot).toBeDefined();
            expect(result.current.handleClearLoot).toBeDefined();
            expect(result.current.setLootData).toBeDefined();
            expect(result.current.setLootTextValue).toBeDefined();
            expect(result.current.setShowAwardLoot).toBeDefined();
        });
    });

    describe('handleGenerateLoot', () => {
        it('should set loot data and text when generation succeeds', async () => {
            const lootResult = {
                lootEntries: ['Gold coins (100)', 'Silver sword'],
                totalEncounterXp: 200,
            };
            const { generateLootFromCombatSummary } = await import('../../services/items/lootGenerator.js');
            vi.mocked(generateLootFromCombatSummary).mockResolvedValue(lootResult);

            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                await result.current.handleGenerateLoot();
            });

            expect(generateLootFromCombatSummary).toHaveBeenCalledWith(
                combatSummary,
                characters,
                campaignName
            );
            expect(result.current.lootData).toEqual(lootResult);
            expect(result.current.lootTextValue).toBe('Gold coins (100)\nSilver sword');
            expect(result.current.generatingLoot).toBe(false);
        });

        it('should handle null result from generation gracefully', async () => {
            const { generateLootFromCombatSummary } = await import('../../services/items/lootGenerator.js');
            vi.mocked(generateLootFromCombatSummary).mockResolvedValue(null);

            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                await result.current.handleGenerateLoot();
            });

            expect(result.current.lootData).toEqual({ lootEntries: [], totalEncounterXp: 0 });
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.generatingLoot).toBe(false);
        });

        it('should log error and keep clean state when generation fails', async () => {
            const { generateLootFromCombatSummary } = await import('../../services/items/lootGenerator.js');
            vi.mocked(generateLootFromCombatSummary).mockRejectedValue(new Error('Generation failed'));

            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                await result.current.handleGenerateLoot();
            });

            expect(consoleSpy).toHaveBeenCalledWith('Failed to generate loot:', expect.any(Error));
            expect(result.current.generatingLoot).toBe(false);
            expect(result.current.lootData).toEqual({ lootEntries: [], totalEncounterXp: 0 });

            consoleSpy.mockRestore();
        });
    });

    describe('handleAwardLoot', () => {
        it('should distribute XP equally among characters and write log entries', async () => {
            const { addEntry } = await import('../../services/ui/logService.js');
            addEntry.mockResolvedValue({});

            const { setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
            setRuntimeValue.mockClear();

            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['Gold coins (100)', 'Silver sword'], totalEncounterXp: 200 });
                result.current.setLootTextValue('Gold coins (100)\nSilver sword');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'xp', 100, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'xp', 100, campaignName);

            expect(addEntry).toHaveBeenCalledTimes(2);

            const lootCall = vi.mocked(addEntry).mock.calls[0];
            expect(lootCall[0]).toBe(campaignName);
            expect(lootCall[1].type).toBe('loot');
            expect(lootCall[1].lootItems).toEqual(['Gold coins (100)', 'Silver sword']);
            expect(lootCall[1].xpPerChar).toBe(100);
            expect(lootCall[1].totalEncounterXp).toBe(200);

            const encounterCall = vi.mocked(addEntry).mock.calls[1];
            expect(encounterCall[0]).toBe(campaignName);
            expect(encounterCall[1].type).toBe('encounter');
            expect(encounterCall[1].action).toBe('loot_awarded');
            expect(encounterCall[1].xpPerChar).toBe(100);

            expect(result.current.lootData).toEqual({ lootEntries: [], totalEncounterXp: 0 });
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.showAwardLoot).toBe(false);
        });

        it('should skip loot log entry when all items are "No loot for these monsters"', async () => {
            const { addEntry } = await import('../../services/ui/logService.js');
            addEntry.mockResolvedValue({});

            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['No loot for these monsters'], totalEncounterXp: 50 });
                result.current.setLootTextValue('No loot for these monsters');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(vi.mocked(addEntry).mock.calls[0][1].type).toBe('encounter');
            expect(vi.mocked(addEntry).mock.calls[0][1].action).toBe('loot_awarded');
        });

        it('should write loot log with only real items when some are "No loot for these monsters"', async () => {
            const { addEntry } = await import('../../services/ui/logService.js');
            addEntry.mockResolvedValue({});

            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['No loot for these monsters', 'Gold coins'], totalEncounterXp: 100 });
                result.current.setLootTextValue('No loot for these monsters\nGold coins');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            expect(addEntry).toHaveBeenCalledTimes(2);
            const lootCall = vi.mocked(addEntry).mock.calls[0];
            expect(lootCall[1].lootItems).toEqual(['Gold coins']);
        });

        it('should handle null/undefined characters array without crashing', async () => {
            const { addEntry } = await import('../../services/ui/logService.js');
            addEntry.mockResolvedValue({});

            const { setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
            setRuntimeValue.mockClear();

            const { result } = renderHook(() => useLootHandlers(campaignName, null, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['Gold'], totalEncounterXp: 200 });
                result.current.setLootTextValue('Gold');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(vi.mocked(addEntry).mock.calls[1][1].xpPerChar).toBe(200);
        });

        it('should log error and reset awarding flag when awarding fails', async () => {
            const { addEntry } = await import('../../services/ui/logService.js');
            addEntry.mockRejectedValue(new Error('Log failed'));

            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['Gold'], totalEncounterXp: 100 });
                result.current.setLootTextValue('Gold');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            expect(consoleSpy).toHaveBeenCalledWith('Failed to award loot:', expect.any(Error));
            expect(result.current.awardingLoot).toBe(false);

            consoleSpy.mockRestore();
        });
    });

    describe('handleClearLoot', () => {
        it('should reset all loot state to initial values', async () => {
            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['Gold'], totalEncounterXp: 100 });
                result.current.setLootTextValue('Gold coins');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                result.current.handleClearLoot();
            });

            expect(result.current.lootData).toEqual({ lootEntries: [], totalEncounterXp: 0 });
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.showAwardLoot).toBe(false);
        });

        it('should be safe to call when already cleared', async () => {
            const { result } = renderHook(() => useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.handleClearLoot();
            });

            expect(result.current.lootData).toEqual({ lootEntries: [], totalEncounterXp: 0 });
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.showAwardLoot).toBe(false);
        });
    });
});
