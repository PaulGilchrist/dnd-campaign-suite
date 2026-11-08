// @maintained-by-ai
// assertCanAct split-party read: the denial reason surfaces through the loud
// enforcement sinks (popup + enforcement_denied audit row) when the acting
// PC's combatSummary mirror row carries away===true. Fast-path (enforcement
// off) untouched — pinned against the harness in assertCanAct.test.js.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { creaturesMirror } = vi.hoisted(() => ({ creaturesMirror: { list: [] } }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getStore: vi.fn(() => ({ get: (k) => (k === 'creatures' ? creaturesMirror.list : null) })),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

import { assertCanAct } from './assertCanAct.js';
import { getRuntimeValue, setRuntimeValue, getStore } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const ON = { mode: 'on', turnLock: false, actionEconomy: false };

let consoleErrorSpy;
beforeEach(() => {
    vi.resetAllMocks();
    getRuntimeValue.mockImplementation((characterKey, key) => (key === 'enforcement' ? ON : null));
    setRuntimeValue.mockImplementation(() => {});
    getStore.mockImplementation(() => ({ get: (k) => (k === 'creatures' ? creaturesMirror.list : null) }));
    addEntry.mockImplementation(async () => ({}));
    creaturesMirror.list = [];
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleErrorSpy.mockRestore());

describe('assertCanAct — split-party away lane', () => {
    it('away PC denied with popup + enforcement_denied audit row', () => {
        creaturesMirror.list = [{ name: 'Ann', type: 'player', initiative: '', away: true }];
        const setPopupHtml = vi.fn();
        const result = assertCanAct({ campaignName: 'test-campaign', creatureName: 'Ann', bucket: 'action', source: 'test', setPopupHtml });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('away from the party');
        expect(setPopupHtml).toHaveBeenCalled();
        const entry = addEntry.mock.calls.find(c => c[1]?.type === 'enforcement_denied');
        expect(entry?.[1]?.reason).toContain('away from the party');
    });
    it('present PC allowed', () => {
        creaturesMirror.list = [{ name: 'Ann', type: 'player', initiative: '12' }];
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Ann' }).allowed).toBe(true);
    });
    it('enforcement OFF ⇒ away is advisory, never denies (Levels 1–4 untouched)', () => {
        creaturesMirror.list = [{ name: 'Ann', type: 'player', away: true }];
        getRuntimeValue.mockImplementation(() => ({ mode: 'off' }));
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Ann' }).allowed).toBe(true);
    });
    it('NPC names are never away (player-row-only read)', () => {
        creaturesMirror.list = [{ name: 'Goblin', type: 'npc', away: true }];
        expect(assertCanAct({ campaignName: 'test-campaign', creatureName: 'Goblin' }).allowed).toBe(true);
    });
});
