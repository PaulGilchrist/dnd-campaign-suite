// @cleaned-by-ai
import { describe, it, expect, beforeEach } from 'vitest';
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

    it('supports campaignName override for both write and read', () => {
        const stats = makePlayerStats();
        setChosenRuntimeValue(stats, 'Fire Shield', 'Fire', 'chosenType', 'OverrideCampaign');
        const result = getChosenRuntimeValue(stats, 'Fire Shield', 'chosenType', 'OverrideCampaign');
        expect(result).toBe('Fire');
    });
});
