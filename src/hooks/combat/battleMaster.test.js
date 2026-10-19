// @maintained-by-ai
// Lane: hooks/combat — grant-side notification seam (NOT attack-post-processing consumption;
// that lives in attackPostProcessing.*.test.js). Module identity: battleMaster.js is the
// maneuver-SELECTION store reader + version-bump hook consumed by App.jsx (character-list
// memoization) and the maneuver dice suppliers (getKnownManeuvers / getSuperiorityDice)
// consumed by useLoggedDiceRollAttack.js and targetResolution.js — where they are MOCKED
// (useLoggedDiceRollAttack.test.js:108-111), so the real implementations are covered HERE only.
// Seams: grant/subscribe = runtime store (real, stateful — unmocked) → addStorageChangeListener
// → serial diff → version bump. No logging in this module (pure counter); turn-based mandate
// trivially satisfied (no timers, no wall-clock). Campaign pinned to test-campaign everywhere.
// Old→new map: isBattleMaster x2 → 4-row it.each; serial includes/ignores → exact-byte
// it.each (+ join/fallback row); serial "stable for identical" → REMOVED (tautology: two
// calls, same state — same-content re-write contract now lives as hook row 2);
// hook bumps/not-bump x5 → 5-row delta it.each with exact deltas; + getKnownManeuvers,
// + getSuperiorityDice (previously zero coverage anywhere).
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
    useBattleMasterSelectionVersion,
    battleMasterSelectionSerial,
    isBattleMaster,
    getKnownManeuvers,
    getSuperiorityDice,
    SELECTION_KEY,
} from './battleMaster.js';
import { setRuntimeValue, clearRuntimeState } from '../runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

const battleMaster = { name: 'BM', class: { name: 'Fighter', subclass: { name: 'Battle Master' } } };
const secondBattleMaster = { name: 'BM2', class: { name: 'Fighter', subclass: { name: 'Battle Master' } } };
const nonFighter = { name: 'Wizard', class: { name: 'Wizard', subclass: { name: 'Divination' } } };

beforeEach(() => {
    clearRuntimeState('BM');
    clearRuntimeState('BM2');
    clearRuntimeState('Wizard');
    setRuntimeValue('BM', SELECTION_KEY, [], CAMPAIGN);
    setRuntimeValue('BM2', SELECTION_KEY, [], CAMPAIGN);
    setRuntimeValue('Wizard', SELECTION_KEY, ['Trip Attack'], CAMPAIGN);
});

describe('isBattleMaster', () => {
    it.each([
        ['Battle Master subclass', battleMaster, true],
        ['other subclass on a Fighter-shaped sheet', { name: 'F', class: { name: 'Fighter', subclass: { name: 'Eldritch Knight' } } }, false],
        ['non-Battle-Master class', nonFighter, false],
        ['sheet with no class', { name: 'X' }, false],
        ['undefined', undefined, false],
    ])('accepts/rejects %s', (_label, character, expected) => {
        expect(isBattleMaster(character)).toBe(expected);
    });
});

describe('battleMasterSelectionSerial', () => {
    it.each([
        ['single Battle Master serializes selections as exact bytes', [battleMaster], 'BM:["Evasive Footwork"]'],
        ['non-Battle-Masters are omitted even with selections stored', [nonFighter], ''],
        ['multiple Battle Masters join with | and unwritten stores fall back to []',
            [battleMaster, secondBattleMaster], 'BM:["Evasive Footwork"]|BM2:[]'],
    ])('%s', (_label, characters, expected) => {
        setRuntimeValue('BM', SELECTION_KEY, ['Evasive Footwork'], CAMPAIGN);
        expect(battleMasterSelectionSerial(characters, CAMPAIGN)).toBe(expected);
    });
});

describe('getKnownManeuvers', () => {
    it.each([
        ['stored selection array is returned verbatim', 'BM', ['Trip Attack', 'Feinting Attack'], ['Trip Attack', 'Feinting Attack']],
        ['Battle Master with nothing stored yet gets []', 'FreshBM', null, []],
    ])('%s', (_label, name, stored, expected) => {
        if (stored) setRuntimeValue(name, SELECTION_KEY, stored, CAMPAIGN);
        expect(getKnownManeuvers(name, CAMPAIGN)).toEqual(expected);
    });
});

describe('getSuperiorityDice', () => {
    it.each([
        ['stored number is returned', 'BM', 5, 5],
        ['server-JSON string is coerced to a number', 'BM', '2', 2],
        ['unwritten store defaults to 4', 'FreshBM', null, 4],
    ])('%s', (_label, name, stored, expected) => {
        if (stored !== null) setRuntimeValue(name, 'superiorityDice', stored, CAMPAIGN);
        expect(getSuperiorityDice(name, CAMPAIGN)).toBe(expected);
    });
});

describe('useBattleMasterSelectionVersion', () => {
    it.each([
        ['bumps +1 when a Battle Master selection changes', [battleMaster], {}, 'BM', SELECTION_KEY, ['Evasive Footwork'], 1],
        ['silent when the same selection content is re-written', [battleMaster], { BM: ['Evasive Footwork'] }, 'BM', SELECTION_KEY, ['Evasive Footwork'], 0],
        ['silent when a listener fires but the serial is unchanged', [battleMaster], { BM: ['Evasive Footwork'] }, 'BM', 'superiorityDice', 3, 0],
        ['bumps +1 when the second of two Battle Masters changes', [battleMaster, secondBattleMaster], {}, 'BM2', SELECTION_KEY, ['Rally'], 1],
        ['silent when no Battle Master is present', [nonFighter], {}, 'Wizard', SELECTION_KEY, ['Trip Attack'], 0],
    ])('%s', (_label, characters, initialSelections, writeKey, writeKey2, value, expectedDelta) => {
        for (const [name, selections] of Object.entries(initialSelections)) {
            setRuntimeValue(name, SELECTION_KEY, selections, CAMPAIGN);
        }
        const { result } = renderHook(() => useBattleMasterSelectionVersion(characters, CAMPAIGN));
        const initial = result.current;

        act(() => {
            setRuntimeValue(writeKey, writeKey2, value, CAMPAIGN);
        });

        expect(result.current).toBe(initial + expectedDelta);
    });
});
