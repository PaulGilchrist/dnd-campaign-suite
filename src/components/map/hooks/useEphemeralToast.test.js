// @maintained-by-ai
// Duration/dismiss pins for the shared map-notice channel (backlog
// 2026-11-03 CN: OA enforcement advisories auto-hid at 4000ms while their
// log row is permanent — producers now pass { sticky: true } and the toast
// waits for an explicit dismiss; every other lane keeps its timer).
// Timers here are display-only auto-hide (AGENTS.md benign UI category).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useEphemeralToast from './useEphemeralToast.js';

describe('useEphemeralToast', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('idle hook exposes a null, non-sticky message', () => {
        const { result } = renderHook(() => useEphemeralToast(4000));
        expect(result.current.message).toBeNull();
        expect(result.current.sticky).toBe(false);
    });

    it('non-sticky notice auto-hides exactly at the configured duration', () => {
        const { result } = renderHook(() => useEphemeralToast(4000));
        act(() => { result.current.show('Could not load "Test Map" — opened a fresh copy'); });
        expect(result.current.message).toBe('Could not load "Test Map" — opened a fresh copy');
        expect(result.current.sticky).toBe(false);
        act(() => { vi.advanceTimersByTime(3999); });
        expect(result.current.message).not.toBeNull();
        act(() => { vi.advanceTimersByTime(1); });
        expect(result.current.message).toBeNull();
    });

    it('default duration is 2500ms when none is configured', () => {
        const { result } = renderHook(() => useEphemeralToast());
        act(() => { result.current.show('snap'); });
        act(() => { vi.advanceTimersByTime(2499); });
        expect(result.current.message).toBe('snap');
        act(() => { vi.advanceTimersByTime(1); });
        expect(result.current.message).toBeNull();
    });

    it('sticky notice (enforcement lane) stays past the duration until dismissed', () => {
        const { result } = renderHook(() => useEphemeralToast(4000));
        act(() => {
            result.current.show('DraconicDragon reacts — Winged Kobold left their reach.', { sticky: true });
        });
        expect(result.current.sticky).toBe(true);
        act(() => { vi.advanceTimersByTime(60000); }); // far beyond 4000ms
        expect(result.current.message).toBe('DraconicDragon reacts — Winged Kobold left their reach.');
        act(() => { result.current.dismiss(); });
        expect(result.current.message).toBeNull();
        expect(result.current.sticky).toBe(false);
    });

    it('a later non-sticky show replaces a sticky notice and re-arms the timer', () => {
        const { result } = renderHook(() => useEphemeralToast(4000));
        act(() => { result.current.show('enforcement advisory', { sticky: true }); });
        act(() => { result.current.show('rejected-load notice'); });
        expect(result.current.message).toBe('rejected-load notice');
        expect(result.current.sticky).toBe(false);
        act(() => { vi.advanceTimersByTime(4000); });
        expect(result.current.message).toBeNull();
    });

    it('re-showing within the window resets the auto-hide countdown', () => {
        const { result } = renderHook(() => useEphemeralToast(4000));
        act(() => { result.current.show('first'); });
        act(() => { vi.advanceTimersByTime(3000); });
        act(() => { result.current.show('second'); });
        act(() => { vi.advanceTimersByTime(3000); });
        expect(result.current.message).toBe('second');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.message).toBeNull();
    });

    it('unmount clears the pending auto-hide timer', () => {
        const { result, unmount } = renderHook(() => useEphemeralToast(4000));
        act(() => { result.current.show('notice'); });
        unmount();
        expect(() => { vi.advanceTimersByTime(10000); }).not.toThrow();
    });
});
