// @maintained-by-ai
// choiceStorage.js is a thin, stable wrapper: key mangling plus delegation to the
// in-memory runtime store (fetch is inert in tests via src/test/setup.js).
// This suite pins that public contract and should need no churn as the app changes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearRuntimeState } from '../../../hooks/runtime/useRuntimeState.js';
import { getChosenRuntimeValue, setChosenRuntimeValue } from './choiceStorage.js';

function resetRuntime() {
    clearRuntimeState('alice');
    clearRuntimeState('bob');
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'alice',
        campaignName: 'TestCampaign',
        ...overrides,
    };
}

beforeEach(() => {
    resetRuntime();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('getChosenRuntimeValue / setChosenRuntimeValue', () => {
    it('stores and retrieves various value types including falsy values', () => {
        const stats = makePlayerStats();

        setChosenRuntimeValue(stats, 'Number', 42, 'num');
        setChosenRuntimeValue(stats, 'BooleanTrue', true, 'bool');
        setChosenRuntimeValue(stats, 'BooleanFalse', false, 'disabled');
        setChosenRuntimeValue(stats, 'Zero', 0, 'zero');
        setChosenRuntimeValue(stats, 'EmptyString', '', 'empty');
        setChosenRuntimeValue(stats, 'Null', null, 'field');
        setChosenRuntimeValue(stats, 'Array', ['a', 'b'], 'arr');
        setChosenRuntimeValue(stats, 'Object', { key: 'val' }, 'obj');

        expect(getChosenRuntimeValue(stats, 'Number', 'num')).toBe(42);
        expect(getChosenRuntimeValue(stats, 'BooleanTrue', 'bool')).toBe(true);
        expect(getChosenRuntimeValue(stats, 'BooleanFalse', 'disabled')).toBe(false);
        expect(getChosenRuntimeValue(stats, 'Zero', 'zero')).toBe(0);
        expect(getChosenRuntimeValue(stats, 'EmptyString', 'empty')).toBe('');
        expect(getChosenRuntimeValue(stats, 'Null', 'field')).toBeNull();
        expect(getChosenRuntimeValue(stats, 'Array', 'arr')).toEqual(['a', 'b']);
        expect(getChosenRuntimeValue(stats, 'Object', 'obj')).toEqual({ key: 'val' });
    });

    it('isolates values by feature name, suffix, and player', () => {
        const stats = makePlayerStats();
        const otherPlayer = makePlayerStats({ name: 'bob' });

        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(stats, 'Cold Shield', 'Ice', 'chosenType');
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire2', 'chosenType2');
        setChosenRuntimeValue(otherPlayer, 'Fire Shield', 'Cold', 'chosenType');

        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
        expect(getChosenRuntimeValue(stats, 'Cold Shield', 'chosenType')).toBe('Ice');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType2')).toBe('Fire2');
        expect(getChosenRuntimeValue(otherPlayer, 'Fire Shield', 'chosenType')).toBe('Cold');
    });

    it('treats a missing suffix as part of the key contract (unsuffixed key is distinct)', () => {
        const stats = makePlayerStats();

        setChosenRuntimeValue(stats, 'Fire Shield', 'Base');
        setChosenRuntimeValue(stats, 'Fire Shield', 'Typed', 'chosenType');

        expect(getChosenRuntimeValue(stats, 'Fire Shield')).toBe('Base');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Typed');
    });

    it('reads back null for keys that were never written', () => {
        const stats = makePlayerStats();

        // The runtime store returns null (not undefined) for missing keys;
        // pin this so consumers relying on falsy checks keep working.
        expect(getChosenRuntimeValue(stats, 'Never Set', 'chosenType')).toBeNull();
    });

    it('posts writes to playerStats.campaignName by default', () => {
        const stats = makePlayerStats();
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toContain('/api/campaigns/TestCampaign/alice');
        expect(options.method).toBe('POST');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
    });

    it('routes writes to a campaignName override instead of playerStats.campaignName', () => {
        const stats = makePlayerStats();
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType', 'OverrideCampaign');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url] = fetchSpy.mock.calls[0];
        expect(url).toContain('/api/campaigns/OverrideCampaign/alice');
        expect(url).not.toContain('TestCampaign');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType', 'OverrideCampaign')).toBe('Fire');
    });
});
