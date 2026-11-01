// @maintained-by-ai
// Lane: useDeleteRequest — the shared pendingDelete staging mechanics
// (backlog 2026-11-01 BA extraction of the 37112c75b inline seam). OWNED
// here: arm stores the descriptor (state + ref), cancel is fully inert (the
// confirm closure NEVER runs), confirm fires the closure exactly once and
// disarms, re-arm replaces the pending descriptor (last wins, no queue), and
// same-tick confirm acts on the EXACTLY-armed descriptor via the ref mirror
// before any state commit. Lane wiring rides the consumers' tests
// (usePlacedItems / usePoiManagement / useSpellOverlay).
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useDeleteRequest from './useDeleteRequest.js';

describe('useDeleteRequest', () => {
    it('arms a descriptor into pendingDelete and disarms on cancel WITHOUT running confirm', () => {
        const { result } = renderHook(() => useDeleteRequest());
        expect(result.current.pendingDelete).toBeNull();

        const confirm = vi.fn();
        act(() => { result.current.requestDelete({ label: 'QA Shrine', confirm }); });
        expect(result.current.pendingDelete).toMatchObject({ label: 'QA Shrine' });

        act(() => { result.current.cancelDelete(); });
        expect(result.current.pendingDelete).toBeNull();
        expect(confirm).not.toHaveBeenCalled();
    });

    it('confirm runs the staged closure exactly once, then clears the arm', () => {
        const { result } = renderHook(() => useDeleteRequest());
        const confirm = vi.fn();
        act(() => { result.current.requestDelete({ label: 'x', confirm }); });
        act(() => { result.current.confirmDelete(); });
        expect(confirm).toHaveBeenCalledTimes(1);
        expect(result.current.pendingDelete).toBeNull();
        // A second confirm after disarm is inert (no ghost re-fire).
        act(() => { result.current.confirmDelete(); });
        expect(confirm).toHaveBeenCalledTimes(1);
    });

    it('re-arm replaces the descriptor (last wins); confirm fires only the newest', () => {
        const { result } = renderHook(() => useDeleteRequest());
        const first = vi.fn();
        const second = vi.fn();
        act(() => {
            result.current.requestDelete({ label: 'first', confirm: first });
            result.current.requestDelete({ label: 'second', confirm: second });
        });
        expect(result.current.pendingDelete.label).toBe('second');
        act(() => { result.current.confirmDelete(); });
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('confirm in the SAME tick as the arm acts on the armed descriptor (ref mirror)', () => {
        const { result } = renderHook(() => useDeleteRequest());
        const confirm = vi.fn();
        act(() => {
            result.current.requestDelete({ label: 'same tick', confirm });
            // pendingDelete state has not committed yet, but the ref has.
            result.current.confirmDelete();
        });
        expect(confirm).toHaveBeenCalledTimes(1);
    });

    it('confirm with nothing armed is inert', () => {
        const { result } = renderHook(() => useDeleteRequest());
        expect(() => {
            act(() => { result.current.confirmDelete(); });
        }).not.toThrow();
        expect(result.current.pendingDelete).toBeNull();
    });
});
