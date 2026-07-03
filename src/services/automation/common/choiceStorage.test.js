// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { clearRuntimeState } from '../../../hooks/runtime/useRuntimeState.js';
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
});

afterEach(() => {
    resetRuntime();
});

describe('getChosenRuntimeValue / setChosenRuntimeValue', () => {
    it('returns null when no value has been stored', () => {
        const stats = makePlayerStats();
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBeNull();
    });

    it('stores and retrieves a value via set/get roundtrip', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Fire');
    });

    it('overwrites an existing value for the same key', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        setChosenRuntimeValue(stats, 'Fire Shield', 'Cold', 'chosenType');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBe('Cold');
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

    it('handles spaces and hyphens in names', () => {
        const stats = makePlayerStats({ name: 'diana-prime' });
        setChosenRuntimeValue(stats, 'Damage Types', ['Fire', 'Cold'], 'chosenTypes');
        expect(getChosenRuntimeValue(stats, 'Damage Types', 'chosenTypes')).toEqual(['Fire', 'Cold']);
    });

    it('supports campaignName override for both write and read', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType', 'OverrideCampaign');
        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType', 'OverrideCampaign');
        expect(result).toBe('Fire');
    });

    it('clears state for a character when it is removed from runtime', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType');
        clearRuntimeState('alice');
        expect(getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType')).toBeNull();
    });
});
