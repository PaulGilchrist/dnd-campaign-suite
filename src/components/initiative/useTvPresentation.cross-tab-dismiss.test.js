// @maintained-by-ai
// Lane: useTvPresentation victory-banner CROSS-TAB dismissal (bug-victory-dismiss-not-retired-in-sibling-tab-same-context).
// Law: the dismiss stamp lives in localStorage, i.e. per browser CONTEXT. When a
// sibling tab of the same context dismisses the banner, its write fires a
// `storage` event in every OTHER same-origin tab — the hook must listen for it
// and re-evaluate the gate so the sibling's mounted banner retires live
// (pre-fix face: tab B kept rendering "Victory!" while its own localStorage
// already said dismissed, with no mechanism to notice, until a reload).
// Unrelated-key storage events must never hide the banner.
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTvPresentation } from './useTvPresentation.js';

let lastCombatResult = null;

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((_key, prop) => (prop === 'lastCombatResult' ? lastCombatResult : null)),
}));

const STAMP = { stamp: 7, rounds: 3, foes: 2, defeated: 2, survivors: 2, partySize: 2, wipe: false, celebrated: true, attackEvidence: '{"attackerName":"Alice"}' };

const player = { name: 'Alice', type: 'player', initiative: '18' };

const mount = () => renderHook(() => useTvPresentation({
    campaignName: 'test-campaign',
    displayCreatures: [player],
    activeCreatureName: 'Alice',
    showToast: vi.fn(),
}));

// Simulate a sibling tab's localStorage write: browsers persist it in the SHARED
// store and dispatch `storage` only in the other tabs — mimic both halves.
const siblingWrite = (key, value) => {
    localStorage.setItem(key, value);
    act(() => {
        window.dispatchEvent(new window.StorageEvent('storage', { key, newValue: value }));
    });
};

beforeEach(() => {
    localStorage.clear();
    lastCombatResult = STAMP;
});

describe('useTvPresentation — sibling-tab dismissal retires a mounted banner', () => {
    it('a storage event for the dismiss key at the current stamp unmounts the banner', () => {
        const { result } = mount();
        expect(result.current.victoryVisible).toBe(true);
        siblingWrite('initiative-victory-dismissed', '7');
        expect(result.current.victoryVisible).toBe(false);
    });

    it('a storage event at a DIFFERENT stamp leaves the banner up (fresh celebrate re-shows)', () => {
        const { result } = mount();
        siblingWrite('initiative-victory-dismissed', '6');
        expect(result.current.victoryVisible).toBe(true);
    });

    it('storage events for unrelated keys never hide the banner', () => {
        const { result } = mount();
        siblingWrite('initiative-tv', '1');
        expect(result.current.victoryVisible).toBe(true);
    });

    it('the listener detaches on unmount and a re-mount honors the persisted stamp', () => {
        const { unmount } = mount();
        unmount();
        expect(() => siblingWrite('initiative-victory-dismissed', '7')).not.toThrow();
        // Re-mounting reads the persisted stamp directly — banner stays retired.
        expect(mount().result.current.victoryVisible).toBe(false);
    });
});
