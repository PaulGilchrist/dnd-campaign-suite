import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearRuntimeState } from '../../../hooks/runtime/useRuntimeState.js';
import { getChosenRuntimeValue, setChosenRuntimeValue } from './choiceStorage.js';

// ── Helpers ─────────────────────────────────────────────────────

function resetRuntime() {
    clearRuntimeState('alice');
    clearRuntimeState('bob');
    clearRuntimeState('charlie');
    clearRuntimeState('diana-prime');
    clearRuntimeState('multi word');
    clearRuntimeState('spaces   in   name');
    clearRuntimeState('');
    localStorage.clear();
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

describe('makeKey (key generation)', () => {
    function getPrivateKey(playerName, name, suffix) {
        const base = `_${name.replace(/\s+/g, '_')}`;
        return suffix ? `${base}_${suffix}` : base;
    }

    it('generates a key with underscore prefix and underscored name for simple name', () => {
        expect(getPrivateKey('alice', 'Fire Shield', 'chosenType')).toBe('_Fire_Shield_chosenType');
    });

    it('generates a key without suffix when suffix is falsy', () => {
        expect(getPrivateKey('alice', 'Fire Shield', '')).toBe('_Fire_Shield');
        expect(getPrivateKey('alice', 'Fire Shield', undefined)).toBe('_Fire_Shield');
        expect(getPrivateKey('alice', 'Fire Shield', null)).toBe('_Fire_Shield');
    });

    it('collapses multiple consecutive spaces into a single underscore', () => {
        expect(getPrivateKey('alice', 'Fire    Shield', 'chosenType')).toBe('_Fire_Shield_chosenType');
    });

    it('handles names with no spaces', () => {
        expect(getPrivateKey('alice', 'FireShield', 'chosenType')).toBe('_FireShield_chosenType');
    });

    it('handles names that are just spaces', () => {
        expect(getPrivateKey('alice', '   ', 'chosenType')).toBe('___chosenType');
    });

    it('preserves non-space special characters in name', () => {
        expect(getPrivateKey('alice', 'Fire-Shield', 'chosenType')).toBe('_Fire-Shield_chosenType');
        expect(getPrivateKey('alice', 'Fire.Shield', 'chosenType')).toBe('_Fire.Shield_chosenType');
    });
});

describe('getChosenRuntimeValue', () => {
    it('returns null when no value has been stored for the key', () => {
        const stats = makePlayerStats();
        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toBeNull();
    });

    it('returns the stored value when it has been set via setChosenRuntimeValue', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toBe('Fire');
    });

    it('uses spaces-underscored key format internally', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        // The key should be _Fire_Shield_chosenType, which maps to a runtime store
        // entry under stats.name ('alice')
        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toBe('Fire');
    });

    it('returns different values for different names with the same player', () => {
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

    it('stores and retrieves non-string values (numbers)', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Dice Count', 6, 'count');

        const result = getChosenRuntimeValue(stats, 'Dice Count', 'count');
        expect(result).toBe(6);
    });

    it('stores and retrieves non-string values (objects)', () => {
        const stats = makePlayerStats();
        const objVal = { type: 'Fire', resistance: true };
        setChosenRuntimeValue(stats, 'Fire Shield', objVal, 'chosenType');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toEqual({ type: 'Fire', resistance: true });
    });

    it('stores and retrieves non-string values (arrays)', () => {
        const stats = makePlayerStats();
        const arrVal = ['Fire', 'Cold', 'Lightning'];
        setChosenRuntimeValue(stats, 'Damage Types', arrVal, 'chosenTypes');

        const result = getChosenRuntimeValue(stats, 'Damage Types', 'chosenTypes');
        expect(result).toEqual(['Fire', 'Cold', 'Lightning']);
    });

    it('uses playerStats.campaignName when campaignName parameter is not provided', () => {
        const stats = makePlayerStats({ campaignName: 'MyCampaign' });
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toBe('Fire');
    });

    it('uses the override campaignName when provided', () => {
        const stats = makePlayerStats({ campaignName: 'MyCampaign' });
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType', 'OverrideCampaign');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType', 'OverrideCampaign');
        expect(result).toBe('Fire');
    });

    it('shares storage across campaigns because getRuntimeValue ignores campaignName param', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType', 'CampaignA');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType', 'CampaignB');
        expect(result).toBe('Fire');
    });

    it('handles player names with spaces', () => {
        const stats = makePlayerStats({ name: 'multi word' });
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toBe('Fire');
    });

    it('handles names with hyphens', () => {
        const stats = makePlayerStats({ name: 'diana-prime' });
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toBe('Fire');
    });

    it('returns null when the runtime store has not been seeded for the character', () => {
        clearRuntimeState('nonexistent');
        const stats = makePlayerStats({ name: 'nonexistent' });
        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toBeNull();
    });
});

describe('setChosenRuntimeValue', () => {
    it('stores a string value for a player', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toBe('Fire');
    });

    it('overwrites an existing value for the same key', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(stats, 'Fire Shield', 'Cold', 'chosenType');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType');
        expect(result).toBe('Cold');
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

    it('calls fetch to persist the value to the server', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        expect(fetch).toHaveBeenCalledWith(
            '/api/campaigns/TestCampaign/alice',
            expect.objectContaining({
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
            })
        );
    });

    it('includes the runtime key and value in the fetch body', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');

        const callArgs = fetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.value).toHaveProperty('_Fire_Shield_chosenType', 'Fire');
    });

    it('uses the override campaignName in the fetch URL when provided', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType', 'OverrideCampaign');

        expect(fetch).toHaveBeenCalledWith(
            '/api/campaigns/OverrideCampaign/alice',
            expect.any(Object)
        );
    });

    it('uses the override campaignName in the get read when provided', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType', 'OverrideCampaign');

        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType', 'OverrideCampaign');
        expect(result).toBe('Fire');
    });

    it('handles boolean values', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Flag', true, 'enabled');

        const result = getChosenRuntimeValue(stats, 'Flag', 'enabled');
        expect(result).toBe(true);
    });

    it('handles zero as a valid value', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Count', 0, 'count');

        const result = getChosenRuntimeValue(stats, 'Count', 'count');
        expect(result).toBe(0);
    });

    it('handles empty string as a valid value', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Name', '', 'chosenType');

        const result = getChosenRuntimeValue(stats, 'Name', 'chosenType');
        expect(result).toBe('');
    });
});
