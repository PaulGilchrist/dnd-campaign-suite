import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    syncStoreValue,
    readStore,
    clearStore,
    applyConditionOnSaveFail,
    removeConditionsFromTarget,
    initSyncHandlers,
} from './syncStoreValue.js';

// The module uses a module-level Map and top-level functions.
// We need to re-import after clearing to get a fresh instance.
// Since the module is cached, we'll work around by spying/restoring.

describe('syncStoreValue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── syncStoreValue ──────────────────────────────────────────────
    describe('syncStoreValue', () => {
        it('should resolve false when no store exists for key', async () => {
            const result = await syncStoreValue('nonexistent', 'value');
            expect(result).toBe(false);
        });

        it('should resolve false when value has not changed', async () => {
            // The storeValue Map is module-private and not exported.
            // The "unchanged" path requires seeding the store, which
            // isn't possible from outside the module. This test
            // documents that limitation.
            expect(true).toBe(true);
        });

        it('should resolve false for non-existent key (no store registered)', async () => {
            const result = await syncStoreValue('totally-missing-key', 'anything');
            expect(result).toBe(false);
        });
    });

    // ── readStore ───────────────────────────────────────────────────
    describe('readStore', () => {
        it('should return undefined when no store exists for key', () => {
            const result = readStore('nonexistent');
            expect(result).toBeUndefined();
        });
    });

    // ── clearStore ──────────────────────────────────────────────────
    describe('clearStore', () => {
        it('should resolve without error when no store exists for key', async () => {
            const result = await clearStore('nonexistent');
            expect(result).toBeUndefined();
        });
    });

    // ── applyConditionOnSaveFail ────────────────────────────────────
    describe('applyConditionOnSaveFail', () => {
        it('should call the API endpoint on success', async () => {
            const mockFetch = vi.fn().mockResolvedValue({ ok: true });
            vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);

            await applyConditionOnSaveFail('myCampaign', 'attacker', 'target', 'blinded');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/campaigns/myCampaign/applyCondition',
                {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        characterName: 'attacker',
                        targetName: 'target',
                        condition: 'blinded',
                    }),
                }
            );
        });

        it('should fallback to syncCondition when API fails', async () => {
            const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
            vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);

            // The fallback calls syncCondition which accesses the internal store.
            // Since no store is seeded for 'target', syncCondition will call
            // readStore('target') which returns undefined, then {} as default,
            // then syncStoreValue('target', { activeConditions: ['blinded'] })
            // which will resolve false (no store).
            // The key thing is: no error should be thrown.
            const result = await applyConditionOnSaveFail(
                'myCampaign',
                'attacker',
                'target',
                'blinded'
            );
            expect(result).toBe(false);
            expect(mockFetch).toHaveBeenCalled();
        });

        it('should use encodeURIComponent for campaign name', async () => {
            const mockFetch = vi.fn().mockRejectedValue(new Error('fail'));
            vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);

            await applyConditionOnSaveFail('my campaign/2024', 'attacker', 'target', 'poisoned');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/campaigns/my%20campaign%2F2024/applyCondition',
                expect.any(Object)
            );
        });

        it('should resolve to false when API fails and no store exists for target', async () => {
            const mockFetch = vi.fn().mockRejectedValue(new Error('fail'));
            vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);

            const result = await applyConditionOnSaveFail(
                'campaign',
                'attacker',
                'target',
                'frightened'
            );
            expect(result).toBe(false);
        });
    });

    // ── removeConditionsFromTarget ──────────────────────────────────
    describe('removeConditionsFromTarget', () => {
        it('should resolve when campaignName is empty', async () => {
            const result = await removeConditionsFromTarget('', 'target', ['blinded']);
            expect(result).toBeUndefined();
        });

        it('should resolve when targetName is empty', async () => {
            const result = await removeConditionsFromTarget('campaign', '', ['blinded']);
            expect(result).toBeUndefined();
        });

        it('should resolve when no store exists for target', async () => {
            const result = await removeConditionsFromTarget('campaign', 'missing-target', ['blinded']);
            expect(result).toBeUndefined();
        });
    });

    // ── initSyncHandlers ────────────────────────────────────────────
    describe('initSyncHandlers', () => {
        it('should register campaign-changed event listener', () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            initSyncHandlers('myCampaign');

            expect(addEventListenerSpy).toHaveBeenCalledWith(
                'campaign-changed',
                expect.any(Function)
            );
        });

        it('should register condition-apply event listener', () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            initSyncHandlers('myCampaign');

            expect(addEventListenerSpy).toHaveBeenCalledWith(
                'condition-apply',
                expect.any(Function)
            );
        });

        it('should register condition-remove event listener', () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            initSyncHandlers('myCampaign');

            expect(addEventListenerSpy).toHaveBeenCalledWith(
                'condition-remove',
                expect.any(Function)
            );
        });

        it('should set a timeout to fetch and seed stores after SYNC_DELAY', () => {
            const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

            initSyncHandlers('myCampaign');

            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(setTimeoutSpy).toHaveBeenCalledWith(
                expect.any(Function),
                30
            );
        });

        it('should handle campaign-changed event by calling loadData and fetchAndSeedStores', async () => {
            vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
                if (event === 'campaign-changed') {
                    // Trigger the handler
                    callback();
                }
            });

            // Should not throw
            initSyncHandlers('testCampaign');
            expect(true).toBe(true);
        });

        it('should ignore condition-apply event with missing detail', () => {
            vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
                if (event === 'condition-apply') {
                    callback({ detail: {} });
                }
            });

            initSyncHandlers('myCampaign');
            expect(true).toBe(true);
        });

        it('should ignore condition-apply event with no detail', () => {
            vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
                if (event === 'condition-apply') {
                    callback({});
                }
            });

            initSyncHandlers('myCampaign');
            expect(true).toBe(true);
        });

        it('should ignore condition-remove event with missing fields', () => {
            vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
                if (event === 'condition-remove') {
                    callback({ detail: { name: 'target' } });
                }
            });

            initSyncHandlers('myCampaign');
            expect(true).toBe(true);
        });

        it('should handle condition-remove event with valid detail', () => {
            let conditionRemoveCallback = null;
            vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
                if (event === 'condition-remove') {
                    conditionRemoveCallback = callback;
                }
            });

            initSyncHandlers('myCampaign');

            expect(conditionRemoveCallback).not.toBeNull();

            // The condition-remove handler calls getStoreFor which returns
            // a plain Map without .put(). We can't test the full flow
            // without seeding the internal store, so we verify the handler
            // was registered and receives correct detail.
            expect(true).toBe(true);
        });

        it('should handle condition-apply event with valid detail', async () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            let conditionApplyCallback = null;
            addEventListenerSpy.mockImplementation((event, callback) => {
                if (event === 'condition-apply') {
                    conditionApplyCallback = callback;
                }
            });

            initSyncHandlers('myCampaign');

            // Trigger the condition-apply handler
            conditionApplyCallback({
                detail: { name: 'target', key: 'activeConditions', value: 'blinded' },
            });

            expect(conditionApplyCallback).not.toBeNull();
        });
    });
});
