// @maintained-by-ai
// Drain-to-evict branch for the save-prompt buckets (backlog 2026-11-03 CJ:
// after a full sweep the change-data store kept `pendingSavePrompts:{}` and
// `pendingSaveListenerPrompts:[]` as special keys — cosmetic dust until Admin
// Clear). Mirrors the concentration lane, where the last answered prompt
// DELETEs its key outright. Locks:
//  • the LAST row drained from either bucket DELETEs the key server-side and
//    evicts it from the local campaign store immediately (null echo then
//    re-removes on every tab via App.jsx applyStoreUpdate — a REMOVE, never
//    a resurrection);
//  • partial drains keep the bucket with the remaining rows (per-promptId
//    object / id array, 38382ce16) broadcast via POST, exactly as before;
//  • the double-sweep lanes (createSaveListener's save-result handler + its
//    finally) issue exactly ONE DELETE — no honest-404 churn;
//  • never a POST whose body is `{}` / `[]` for these keys.
// Uses the REAL useRuntimeState module (store + fetch lane), sibling
// convention to hooks/runtime/useRuntimeState.replaceRuntimeObject.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
    default: { guid: vi.fn(() => 'g-1') },
}));

vi.mock('../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import {
    hasRuntimeValue,
    setRuntimeValue,
    clearRuntimeState,
    getAllStoreKeys,
    listeners,
} from '../../../hooks/runtime/useRuntimeState.js';
import { dropPendingSavePrompt, createSaveListener } from './savePrompt.js';

const CAMPAIGN = 'test-campaign';
const SAVES_URL = `/api/campaigns/${CAMPAIGN}/pendingSavePrompts`;
const LISTENERS_URL = `/api/campaigns/${CAMPAIGN}/pendingSaveListenerPrompts`;

const flush = () => new Promise(r => setTimeout(r, 0));

let fetchSpy;

function clearAllStores() {
    for (const key of getAllStoreKeys()) clearRuntimeState(key);
    listeners.clear();
}

function fetchCallsFor(url, method) {
    return fetchSpy.mock.calls.filter(([u, opts]) => u === url && opts?.method === method);
}

function seedBuckets(rows, ids) {
    setRuntimeValue('campaign', 'pendingSavePrompts', rows, CAMPAIGN);
    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', ids, CAMPAIGN);
    fetchSpy.mockClear();
}

beforeEach(() => {
    clearAllStores();
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
});

describe('save-prompt buckets — drain-to-evict (last row fully evicts the key)', () => {
    it('full drain via Dismiss DELETEs BOTH bucket keys and persists no {} / []', () => {
        seedBuckets(
            { 'g-1': { promptId: 'g-1', campaignName: CAMPAIGN, targetName: 'Goblin' } },
            ['g-1']
        );

        dropPendingSavePrompt(CAMPAIGN, 'g-1');

        expect(fetchCallsFor(SAVES_URL, 'DELETE')).toHaveLength(1);
        expect(fetchCallsFor(LISTENERS_URL, 'DELETE')).toHaveLength(1);
        expect(fetchCallsFor(SAVES_URL, 'POST')).toHaveLength(0);
        expect(fetchCallsFor(LISTENERS_URL, 'POST')).toHaveLength(0);
        // Local campaign store evicts immediately (readers fall back to
        // defaults; the server null echo re-removes on every other tab).
        expect(hasRuntimeValue('campaign', 'pendingSavePrompts')).toBe(false);
        expect(hasRuntimeValue('campaign', 'pendingSaveListenerPrompts')).toBe(false);
    });

    it('repeated drains of an already-evicted bucket are inert (exactly one DELETE, no 404 churn)', () => {
        seedBuckets(
            { 'g-1': { promptId: 'g-1', campaignName: CAMPAIGN } },
            ['g-1']
        );

        dropPendingSavePrompt(CAMPAIGN, 'g-1');
        dropPendingSavePrompt(CAMPAIGN, 'g-1');

        expect(fetchCallsFor(SAVES_URL, 'DELETE')).toHaveLength(1);
        expect(fetchCallsFor(LISTENERS_URL, 'DELETE')).toHaveLength(1);
    });

    it('partial drain keeps both buckets, correctly keyed, broadcast via POST (38382ce16 shape)', () => {
        const survivor = { promptId: 'g-2', campaignName: CAMPAIGN, targetName: 'Goblin' };
        seedBuckets(
            { 'g-1': { promptId: 'g-1', campaignName: CAMPAIGN }, 'g-2': survivor },
            ['g-1', 'g-2']
        );

        dropPendingSavePrompt(CAMPAIGN, 'g-1');

        expect(fetchCallsFor(SAVES_URL, 'DELETE')).toHaveLength(0);
        expect(fetchCallsFor(LISTENERS_URL, 'DELETE')).toHaveLength(0);
        expect(hasRuntimeValue('campaign', 'pendingSavePrompts')).toBe(true);
        expect(hasRuntimeValue('campaign', 'pendingSaveListenerPrompts')).toBe(true);
        const savesPost = fetchCallsFor(SAVES_URL, 'POST').at(-1);
        expect(JSON.parse(savesPost[1].body)).toEqual({ value: { 'g-2': survivor } });
        const listenersPost = fetchCallsFor(LISTENERS_URL, 'POST').at(-1);
        expect(JSON.parse(listenersPost[1].body)).toEqual({ value: ['g-2'] });
    });

    it('createSaveListener resolve lane evicts on the last row — handler + finally sweep delete the key ONCE', async () => {
        const { promptId } = createSaveListener(CAMPAIGN, {
            targetName: 'Goblin', saveType: 'DEX', saveDc: 12,
        });
        expect(hasRuntimeValue('campaign', 'pendingSavePrompts')).toBe(true);
        fetchSpy.mockClear();

        window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success: true } }));
        await flush();

        // save-result handler drains the last row → DELETE; the finally-lane
        // re-read finds the key gone and writes/DELETes nothing.
        expect(fetchCallsFor(SAVES_URL, 'DELETE')).toHaveLength(1);
        expect(fetchCallsFor(SAVES_URL, 'POST')).toHaveLength(0);
        expect(hasRuntimeValue('campaign', 'pendingSavePrompts')).toBe(false);
    });

    it('createSaveListener partial resolve leaves the sibling row persisted (no eviction mid-queue)', async () => {
        const sibling = { promptId: 'g-2', campaignName: CAMPAIGN, targetName: 'Orc' };
        setRuntimeValue('campaign', 'pendingSavePrompts', { 'g-2': sibling }, CAMPAIGN);
        fetchSpy.mockClear();

        const { promptId } = createSaveListener(CAMPAIGN, {
            targetName: 'Goblin', saveType: 'DEX', saveDc: 12,
        });
        fetchSpy.mockClear();
        window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success: false } }));
        await flush();

        expect(fetchCallsFor(SAVES_URL, 'DELETE')).toHaveLength(0);
        const savesPost = fetchCallsFor(SAVES_URL, 'POST').at(-1);
        expect(JSON.parse(savesPost[1].body)).toEqual({ value: { 'g-2': sibling } });
    });
});
