// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearRuntimeState, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getChosenRuntimeValue, setChosenRuntimeValue } from './choiceStorage.js';

// ── Helpers ─────────────────────────────────────────────────────

function resetRuntime() {
    localStorage.clear();
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

// ── Tests ───────────────────────────────────────────────────────

beforeEach(() => {
    resetRuntime();
    vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
    });
});

afterEach(() => {
    resetRuntime();
    vi.restoreAllMocks();
});

describe('getChosenRuntimeValue', () => {
    it('returns null when no value has been stored', () => {
        const stats = makePlayerStats();
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBeNull();
    });

    it('returns the value set via setChosenRuntimeValue', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
    });

    it('returns different values for different feature names', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(stats, 'Cold Shield', 'Ice', 'chosenType');

        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
        expect(getChosenRuntimeValue(stats, 'Cold Shield', 'chosenType')).toBe('Ice');
    });

    it('returns different values for the same name with different suffixes', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire2', 'chosenType2');

        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType2')).toBe('Fire2');
    });

    it('returns different values for different players with the same name and suffix', () => {
        const alice = makePlayerStats({ name: 'alice' });
        const bob = makePlayerStats({ name: 'bob' });

        setChosenRuntimeValue(alice, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(bob, 'Fire Shield', 'Cold', 'chosenType');

        expect(getChosenRuntimeValue(alice, 'Fire Shield', 'chosenType')).toBe('Fire');
        expect(getChosenRuntimeValue(bob, 'Fire Shield', 'chosenType')).toBe('Cold');
    });

    it('stores and retrieves various value types', () => {
        const stats = makePlayerStats();

        setChosenRuntimeValue(stats, 'Number', 42, 'num');
        setChosenRuntimeValue(stats, 'Boolean', true, 'bool');
        setChosenRuntimeValue(stats, 'Zero', 0, 'zero');
        setChosenRuntimeValue(stats, 'EmptyString', '', 'empty');
        setChosenRuntimeValue(stats, 'Array', ['a', 'b'], 'arr');
        setChosenRuntimeValue(stats, 'Object', { key: 'val' }, 'obj');

        expect(getChosenRuntimeValue(stats, 'Number', 'num')).toBe(42);
        expect(getChosenRuntimeValue(stats, 'Boolean', 'bool')).toBe(true);
        expect(getChosenRuntimeValue(stats, 'Zero', 'zero')).toBe(0);
        expect(getChosenRuntimeValue(stats, 'EmptyString', 'empty')).toBe('');
        expect(getChosenRuntimeValue(stats, 'Array', 'arr')).toEqual(['a', 'b']);
        expect(getChosenRuntimeValue(stats, 'Object', 'obj')).toEqual({ key: 'val' });
    });

    it('persists values across spaces in feature names', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Damage Types', ['Fire', 'Cold'], 'chosenTypes');
        expect(getChosenRuntimeValue(stats, 'Damage Types', 'chosenTypes')).toEqual(['Fire', 'Cold']);
    });

    it('persists values across spaces in player names', () => {
        const stats = makePlayerStats({ name: 'multi word' });
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
    });

    it('persists values across hyphens in player names', () => {
        const stats = makePlayerStats({ name: 'diana-prime' });
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
    });

    it('uses campaignName from playerStats when no override is provided', () => {
        const stats = makePlayerStats({ campaignName: 'MyCampaign' });
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        // Verify the runtime store entry exists under the correct campaign-scoped key
        const storeValue = getRuntimeValue('alice', '_Fire_Shield_chosenType');
        expect(storeValue).toBe('Fire');
    });

    it('clears state for a character when it is removed from runtime', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        clearRuntimeState('alice');

        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBeNull();
    });
});

describe('setChosenRuntimeValue', () => {
    it('stores a value in the runtime store', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        expect(getRuntimeValue('alice', '_Fire_Shield_chosenType')).toBe('Fire');
    });

    it('overwrites an existing value for the same key', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(stats, 'Fire Shield', 'Cold', 'chosenType');

        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Cold');
    });

    it('does not affect values for different suffixes', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(stats, 'Fire Shield', 'Cold', 'chosenType2');

        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType2')).toBe('Cold');
    });

    it('does not affect values for different names', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(stats, 'Cold Shield', 'Ice', 'chosenType');

        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
        expect(getChosenRuntimeValue(stats, 'Cold Shield', 'chosenType')).toBe('Ice');
    });

    it('does not affect values for different players', () => {
        const alice = makePlayerStats({ name: 'alice' });
        const bob = makePlayerStats({ name: 'bob' });

        setChosenRuntimeValue(alice, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(bob, 'Fire Shield', 'Cold', 'chosenType');

        expect(getChosenRuntimeValue(alice, 'Fire Shield', 'chosenType')).toBe('Fire');
        expect(getChosenRuntimeValue(bob, 'Fire Shield', 'chosenType')).toBe('Cold');
    });

    it('calls fetch to persist the value to the server', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal('fetch', fetchMock);

        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/campaigns/TestCampaign/alice',
            expect.objectContaining({
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
            })
        );
    });

    it('includes the runtime key and value in the fetch body', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal('fetch', fetchMock);

        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.value['_Fire_Shield_chosenType']).toBe('Fire');
    });

    it('uses the override campaignName in the fetch URL when provided', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal('fetch', fetchMock);

        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType', 'OverrideCampaign');

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/campaigns/OverrideCampaign/alice',
            expect.any(Object)
        );
    });

    it('uses the override campaignName for reads when provided', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType', 'OverrideCampaign');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType', 'OverrideCampaign');
        expect(result).toBe('Fire');
    });

    it('handles boolean false as a valid value', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Flag', false, 'enabled');
        expect(getChosenRuntimeValue(stats, 'Flag', 'enabled')).toBe(false);
    });

    it('handles null as a stored value', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'NullField', null, 'field');
        expect(getChosenRuntimeValue(stats, 'NullField', 'field')).toBeNull();
    });
});
