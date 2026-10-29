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
 *  generate null / generate reject ..... null flipped to lawful zero-loot arms
 *                                          (#875 fix: guard short-circuits, catch
 *                                          never entered); reject kept separately
 *  award success ......................... kept + floor split, XP accumulation,
 *                                          exact log bytes, full state reset
 *  award all-no-loot / mixed items ... consolidated into "No loot filtering"
 *  award null characters ................. kept (zero-write guard battery)
 *  award log write fails ............... kept + state-preserved & no-XP assertions
 *  clear resets state .................. kept + zero-write assertion
 *  clear when already cleared .......... removed (near-vacuous)
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLootHandlers } from './useLootHandlers.js';
import { generateLootFromCombatSummary } from '../../services/items/lootGenerator.js';
import { depositCurrency } from '../../services/campaign/inventoryService.js';
import { addEntry } from '../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue, notify } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../services/items/lootGenerator.js', async (importOriginal) => ({
    ...await importOriginal(),
    generateLootFromCombatSummary: vi.fn(async () => ({ lootEntries: [], totalEncounterXp: 0 })),
}));

// Deposit boundary: the award seam POSTs parsed currency to /inventory/deposit
// and logs the credit. Never live (campaign lockdown), calls recorded verbatim.
const { depositCalls } = vi.hoisted(() => ({ depositCalls: [] }));

vi.mock('../../services/campaign/inventoryService.js', () => ({
    depositCurrency: vi.fn(async (campaignName, currency) => {
        depositCalls.push({ campaignName, currency });
        return { currency, items: [] };
    }),
}));

// The hook only touches getRuntimeValue/setRuntimeValue (XP lane) plus the
// campaign-bucket loot-draft lane (getStore/notify); mock the transport
// minimally with a fake campaign store so hydration/persistence/wipe are
// observable, and seed existing XP so the accumulate-on-award contract is pinned.
const xpSeed = new Map();

const { campaignStore } = vi.hoisted(() => ({ campaignStore: new Map() }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key) => {
        if (name === 'campaign') return campaignStore.has(key) ? campaignStore.get(key) : null;
        return key === 'xp' ? xpSeed.get(name) ?? 0 : 0;
    }),
    setRuntimeValue: vi.fn((name, key, value) => {
        if (name === 'campaign') campaignStore.set(key, value);
    }),
    getStore: vi.fn((name) => (name === 'campaign' ? campaignStore : new Map())),
    notify: vi.fn(),
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
        vi.useFakeTimers(); // loot-draft save-debounce must never leak across tests
        xpSeed.clear();
        campaignStore.clear();
        depositCalls.length = 0;
    });

    afterEach(() => {
        vi.useRealTimers();
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

        // Lawful-shape pin (flipped from the old honest-crash-through-catch pin,
        // #875): the handler normalizes the producer result once, so null and
        // absent-lootEntries resolve to the producer's own zero-loot constant
        // (lootGenerator.js:335/:380) WITHOUT throwing — the catch (whose sole
        // statement is console.error) must never be entered on these arms.
        it.each([
            ['[] zero-loot verbatim', { lootEntries: [], totalEncounterXp: 0 }, EMPTY, ''],
            ['null', null, EMPTY, ''],
            ['absent lootEntries key (#1348)', { totalEncounterXp: 120 }, { lootEntries: [], totalEncounterXp: 120 }, ''],
            ['absent both keys (#1348)', {}, EMPTY, ''],
        ])('populates honest zero-loot state and never enters the catch when the generator resolves %s', async (_label, resolution, expectedData, expectedText) => {
            generateLootFromCombatSummary.mockResolvedValueOnce(resolution);
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                await result.current.handleGenerateLoot();
            });

            // Guard short-circuits — the incidental catcher stays silent.
            expect(consoleSpy).not.toHaveBeenCalled();
            expect(result.current.generatingLoot).toBe(false);
            expect(result.current.lootData).toEqual(expectedData);
            expect(result.current.lootTextValue).toBe(expectedText);
            expect(setRuntimeValue).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('logs the error and leaves loot state untouched when the generator rejects', async () => {
            generateLootFromCombatSummary.mockRejectedValueOnce(new Error('Generation failed'));
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
                // 2026-10-29-AC: the 'loot' row above owns the per-line record;
                // the paired award row suppresses the duplicate lootItems list.
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
                // 2026-10-29-AC criteria 2+3: no loot row was written, so the
                // award row still carries the xp fields, and the sentinel is
                // never persisted on ANY row (previously lootItems held it).
            });
            expect(JSON.stringify(addEntry.mock.calls)).not.toContain('No loot for these monsters');
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
            // Criterion 1: paired award row carries only the xp fields.
            expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, {
                type: 'encounter',
                action: 'loot_awarded',
                encounterName: 'Combat',
                xpPerChar: 50,
                totalEncounterXp: 100,
            });
            // Criterion 3: sentinel never persisted on any row.
            expect(JSON.stringify(addEntry.mock.calls)).not.toContain('No loot for these monsters');
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

            // characters null ⇒ zero XP-lane traffic. (getRuntimeValue is also
            // called by loot-draft hydration — only the XP reads are forbidden.)
            expect(getRuntimeValue.mock.calls.filter(([, key]) => key === 'xp')).toEqual([]);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, {
                type: 'encounter',
                action: 'loot_awarded',
                encounterName: 'Combat',
                xpPerChar: 200, // full pool, no one to split with
                totalEncounterXp: 200,
                // 2026-10-29-AC: lootItems suppressed (loot row owns the lines).
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

        it('deposits pp/gp/sp/cp parsed from currency lines into party inventory and logs the credit', async () => {
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['70 platinum pieces, 3 gold pieces, 2 silver coins'], totalEncounterXp: 200 });
                result.current.setLootTextValue('70 platinum pieces, 3 gold pieces, 2 silver coins\n"Shield +1" (Rare, Shield)\nNo loot for these monsters');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            // Currency credited once, exact amounts, through the server deposit route
            expect(depositCurrency).toHaveBeenCalledTimes(1);
            expect(depositCalls).toEqual([{
                campaignName,
                currency: { pp: 70, gp: 3, sp: 2, cp: 0 },
            }]);

            // Existing award logs untouched (loot + loot_awarded), deposit appended
            expect(addEntry).toHaveBeenCalledTimes(3);
            // 2026-10-29-AC: loot row owns the per-line record, sentinel-filtered.
            expect(addEntry).toHaveBeenNthCalledWith(1, campaignName, expect.objectContaining({
                type: 'loot',
                lootItems: ['70 platinum pieces, 3 gold pieces, 2 silver coins', '"Shield +1" (Rare, Shield)'],
            }));
            expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, expect.objectContaining({ type: 'encounter', action: 'loot_awarded' }));
            expect(addEntry.mock.calls[1][1]).not.toHaveProperty('lootItems'); // suppression
            expect(JSON.stringify(addEntry.mock.calls)).not.toContain('No loot for these monsters');
            const depositLog = addEntry.mock.calls[2][1];
            expect(depositLog.type).toBe('inventory_transfer');
            expect(depositLog.message).toContain('Loot currency deposited to party inventory');
            expect(depositLog.message).toContain('70 pp');
            expect(depositLog.message).toContain('3 gp');
            expect(depositLog.message).toContain('2 sp');

            // XP grant + panel clear preserved unchanged (criterion 3)
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.showAwardLoot).toBe(false);
        });

        it('writes zero currency change and no deposit log when loot text has no currency lines', async () => {
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['"Ring of Feather Falling" (Rare, Ring)'], totalEncounterXp: 100 });
                result.current.setLootTextValue('"Ring of Feather Falling" (Rare, Ring)\nNo loot for these monsters');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            expect(depositCurrency).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(result.current.lootTextValue).toBe('');
        });

        it('completes the award and clears the panel when the deposit route fails', async () => {
            depositCurrency.mockRejectedValueOnce(new Error('deposit down'));
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['50 gp'], totalEncounterXp: 100 });
                result.current.setLootTextValue('50 gp');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            // Award (logs + XP) still completes; failure is loud, not swallowed.
            // 2026-10-29-AC: '50 gp' is a currency-only award — the 'loot' row
            // is skipped (criteria 2/6), so with the deposit down the single
            // surviving row is the loot_awarded rewards record.
            expect(consoleSpy).toHaveBeenCalledWith('Failed to deposit loot currency to party inventory:', expect.any(Error));
            expect(addEntry).toHaveBeenCalledTimes(1); // no phantom deposit log
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({ type: 'encounter', action: 'loot_awarded' }));
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(result.current.showAwardLoot).toBe(false);
            expect(result.current.lootTextValue).toBe('');

            consoleSpy.mockRestore();
        });

        // 2026-10-29-AC criteria 2/6: currency-only award — no 'loot' row (the
        // deposit row owns the currency), loot_awarded keeps the xp fields.
        it('currency-only award writes no loot row — loot_awarded carries the xp fields plus the deposit row', async () => {
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => {
                result.current.setLootData({ lootEntries: ['70 platinum pieces'], totalEncounterXp: 100 });
                result.current.setLootTextValue('70 platinum pieces');
                result.current.setShowAwardLoot(true);
            });

            await act(async () => {
                await result.current.handleAwardLoot();
            });

            expect(depositCurrency).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenNthCalledWith(1, campaignName, {
                type: 'encounter',
                action: 'loot_awarded',
                encounterName: 'Combat',
                xpPerChar: 50,
                totalEncounterXp: 100,
            });
            expect(addEntry.mock.calls.some(([, e]) => e.type === 'loot')).toBe(false);
            expect(addEntry.mock.calls[1][1].type).toBe('inventory_transfer');
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

    // 2026-10-29 improve: the loot panel is GM scratch state — text + generated
    // lootData persist through the runtime store's campaign-bucket 'loot-draft'
    // key so a view-switch (unmount → remount) re-displays the panel verbatim;
    // award-complete and clear-× wipe the key via the per-key DELETE lane.
    describe('loot draft persistence (campaign scratch key)', () => {
        const DRAFT = { text: 'Gold coins (100)', lootEntries: ['Gold coins (100)'], totalEncounterXp: 200 };

        it('hydrates text + generated lootData from the persisted draft on mount, without echo-writing', () => {
            campaignStore.set('loot-draft', DRAFT);
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            expect(result.current.lootTextValue).toBe('Gold coins (100)');
            expect(result.current.lootData).toEqual({ lootEntries: ['Gold coins (100)'], totalEncounterXp: 200 });
            // Hydration is a read: mounting must never write the draft back.
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(notify).not.toHaveBeenCalled();
        });

        it('persists typed draft text to the campaign store after the save-debounce (not per keystroke)', () => {
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            act(() => { result.current.setLootTextValue('A hand-typed gem'); });
            expect(setRuntimeValue).not.toHaveBeenCalled(); // debounced

            act(() => { vi.advanceTimersByTime(500); });
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'loot-draft', {
                text: 'A hand-typed gem', lootEntries: [], totalEncounterXp: 0,
            }, campaignName);
        });

        it('flushes a pending draft synchronously on unmount, and the next mount re-hydrates it verbatim', () => {
            const { result, unmount } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            act(() => { result.current.setLootTextValue('Switching views mid-debounce'); });
            unmount(); // no timer advanced — the flush must be synchronous

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'loot-draft', {
                text: 'Switching views mid-debounce', lootEntries: [], totalEncounterXp: 0,
            }, campaignName);

            const remount = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));
            expect(remount.result.current.lootTextValue).toBe('Switching views mid-debounce');
        });

        it('generated suggestions + XP persist and re-display after an unmount/remount', async () => {
            generateLootFromCombatSummary.mockResolvedValueOnce({ lootEntries: ['Pearl necklace'], totalEncounterXp: 500 });
            const { result, unmount } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => { await result.current.handleGenerateLoot(); });
            act(() => { vi.advanceTimersByTime(500); });
            expect(campaignStore.get('loot-draft')).toEqual({ text: 'Pearl necklace', lootEntries: ['Pearl necklace'], totalEncounterXp: 500 });

            unmount();
            const remount = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));
            expect(remount.result.current.lootTextValue).toBe('Pearl necklace');
            expect(remount.result.current.lootData).toEqual({ lootEntries: ['Pearl necklace'], totalEncounterXp: 500 });
        });

        it('clear-× wipes the persisted draft via store-key removal + per-key DELETE, and a fresh mount shows empty', () => {
            campaignStore.set('loot-draft', DRAFT);
            const fetchSpy = vi.spyOn(globalThis, 'fetch');
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            act(() => { result.current.handleClearLoot(); });

            expect(campaignStore.has('loot-draft')).toBe(false);
            expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/loot-draft', { method: 'DELETE' });
            expect(notify).toHaveBeenCalledWith('campaign');
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.lootData).toEqual(EMPTY);

            // Fresh mount post-wipe: honest empty panel, zero store writes.
            const remount = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));
            expect(remount.result.current.lootTextValue).toBe('');
            expect(remount.result.current.lootData).toEqual(EMPTY);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            fetchSpy.mockRestore();
        });

        it('award-complete wipes the persisted draft — XP grants stay the only setRuntimeValue writes', async () => {
            campaignStore.set('loot-draft', DRAFT);
            const fetchSpy = vi.spyOn(globalThis, 'fetch');
            const { result } = renderHook(() =>
                useLootHandlers(campaignName, characters, combatSummary));

            await act(async () => { await result.current.handleAwardLoot(); });

            // Draft exits via the DELETE lane, never an empty-value POST.
            expect(setRuntimeValue).toHaveBeenCalledTimes(2); // 2 × XP grants
            expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'Alice', 'xp', 100, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'Bob', 'xp', 100, campaignName);
            expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/loot-draft', { method: 'DELETE' });
            expect(campaignStore.has('loot-draft')).toBe(false);
            expect(result.current.lootTextValue).toBe('');
            expect(result.current.lootData).toEqual(EMPTY);
            fetchSpy.mockRestore();
        });
    });
});
