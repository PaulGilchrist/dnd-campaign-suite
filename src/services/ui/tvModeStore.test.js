// @maintained-by-ai
// tvModeStore contract: idempotent set, listener notification on change only,
// unsubscribe stops delivery. The app shell reads this via useSyncExternalStore
// to hide the sidebar while the Initiative tracker is in TV mode. Plus the
// persisted pref slot (TvExitButton/App-level escape lane): localStorage is
// the single source of truth, saveTvPref writes + notifies on flips, and
// exitTvPresentation persists OFF (the shared exit seam).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    setTvModeActive, subscribeTvModeActive, getTvModeActive,
    getTvPref, subscribeTvPref, saveTvPref, exitTvPresentation,
} from './tvModeStore.js';

describe('tvModeStore', () => {
    afterEach(() => {
        setTvModeActive(false);
    });

    it('defaults to inactive and tracks set/clear', () => {
        expect(getTvModeActive()).toBe(false);
        setTvModeActive(true);
        expect(getTvModeActive()).toBe(true);
        setTvModeActive(false);
        expect(getTvModeActive()).toBe(false);
    });

    it('notifies subscribers only on actual changes', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeTvModeActive(listener);

        setTvModeActive(true);
        expect(listener).toHaveBeenCalledTimes(1);
        setTvModeActive(true); // no-op repeat must not re-notify
        expect(listener).toHaveBeenCalledTimes(1);
        setTvModeActive(false);
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        setTvModeActive(true);
        expect(listener).toHaveBeenCalledTimes(2);
        setTvModeActive(false);
    });
});

describe('tvModeStore pref slot', () => {
    afterEach(() => {
        saveTvPref(false);
        localStorage.clear();
    });

    it('reads the persisted pref straight from localStorage (no stale copy)', () => {
        expect(getTvPref()).toBe(false);
        localStorage.setItem('initiative-tv', '1');
        expect(getTvPref()).toBe(true);
        localStorage.setItem('initiative-tv', '0');
        expect(getTvPref()).toBe(false);
    });

    it('saveTvPref persists the pref and notifies only on actual flips', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeTvPref(listener);

        saveTvPref(true);
        expect(localStorage.getItem('initiative-tv')).toBe('1');
        expect(getTvPref()).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);

        saveTvPref(true); // no-op repeat must not re-notify
        expect(listener).toHaveBeenCalledTimes(1);

        saveTvPref(false);
        expect(localStorage.getItem('initiative-tv')).toBe('0');
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        saveTvPref(true);
        expect(listener).toHaveBeenCalledTimes(2);
        saveTvPref(false);
    });

    it('exitTvPresentation persists OFF (the shared corner-button exit seam)', () => {
        saveTvPref(true);
        // jsdom never holds fullscreen — the exit branch is guarded, the
        // pref write is the contract asserted here (live fullscreen face is
        // verified via Playwright).
        exitTvPresentation();
        expect(localStorage.getItem('initiative-tv')).toBe('0');
        expect(getTvPref()).toBe(false);
    });
});
