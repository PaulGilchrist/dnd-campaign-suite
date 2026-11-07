// @maintained-by-ai
// tvModeStore contract: idempotent set, listener notification on change only,
// unsubscribe stops delivery. The app shell reads this via useSyncExternalStore
// to hide the sidebar while the Initiative tracker is in TV mode.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { setTvModeActive, subscribeTvModeActive, getTvModeActive } from './tvModeStore.js';

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
