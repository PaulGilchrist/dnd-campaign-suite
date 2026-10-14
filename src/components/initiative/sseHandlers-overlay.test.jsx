import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOverlayHandler } from './sseHandlers.js';

describe('createOverlayHandler', () => {
    let handler;
    let setOverlays;
    let prev;

    beforeEach(() => {
        vi.clearAllMocks();
        prev = [];
        setOverlays = vi.fn((fn) => {
            const next = typeof fn === 'function' ? fn(prev) : fn;
            prev = next;
            return next;
        });
        handler = createOverlayHandler('test-campaign');
    });

    describe('early returns', () => {
        it('should ignore null event', () => {
            handler(null, setOverlays);
            expect(setOverlays).not.toHaveBeenCalled();
        });

        it('should ignore event with no key', () => {
            handler({ data: {} }, setOverlays);
            expect(setOverlays).not.toHaveBeenCalled();
        });

        it('should ignore event with key not starting with spell-overlay-', () => {
            handler({ key: 'change-test-campaign-combatSummary' }, setOverlays);
            expect(setOverlays).not.toHaveBeenCalled();
        });

        it('should ignore spell-overlay events for a different campaign', () => {
            handler({ key: 'spell-overlay-other-campaign', data: {} }, setOverlays);
            expect(setOverlays).not.toHaveBeenCalled();
        });
    });

    describe('add action', () => {
        it('should add unique overlays to the list', () => {
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'add', overlays: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] } },
                setOverlays,
            );
            expect(setOverlays).toHaveBeenCalledTimes(1);
            const result = setOverlays.mock.calls[0][0]([]);
            expect(result).toEqual([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]);
        });

        it('should filter out duplicates by id, keeping existing entries', () => {
            prev = [{ id: 'a', label: 'A' }];
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'add', overlays: [{ id: 'a', label: 'A updated' }, { id: 'c', label: 'C' }] } },
                setOverlays,
            );
            const result = setOverlays.mock.calls[0][0](prev);
            expect(result).toEqual([{ id: 'a', label: 'A' }, { id: 'c', label: 'C' }]);
        });

        it('should not call setOverlays when overlays array is empty', () => {
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'add', overlays: [] } },
                setOverlays,
            );
            expect(setOverlays).not.toHaveBeenCalled();
        });

        it('should not call setOverlays when data is missing overlays property', () => {
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'add' } },
                setOverlays,
            );
            expect(setOverlays).not.toHaveBeenCalled();
        });
    });

    describe('update action', () => {
        it('should replace overlays matching by id', () => {
            prev = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'update', overlays: [{ id: 'a', label: 'A updated' }] } },
                setOverlays,
            );
            const result = setOverlays.mock.calls[0][0](prev);
            expect(result).toEqual([{ id: 'a', label: 'A updated' }, { id: 'b', label: 'B' }]);
        });

        it('should not change overlays with no matching id', () => {
            prev = [{ id: 'a', label: 'A' }];
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'update', overlays: [{ id: 'z', label: 'Z' }] } },
                setOverlays,
            );
            const result = setOverlays.mock.calls[0][0](prev);
            expect(result).toEqual([{ id: 'a', label: 'A' }]);
        });

        it('should not call setOverlays when overlays array is empty', () => {
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'update', overlays: [] } },
                setOverlays,
            );
            expect(setOverlays).not.toHaveBeenCalled();
        });
    });

    describe('remove action', () => {
        it('should remove the overlay matching overlayId', () => {
            prev = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'remove', overlayId: 'b' } },
                setOverlays,
            );
            const result = setOverlays.mock.calls[0][0](prev);
            expect(result).toEqual([{ id: 'a', label: 'A' }, { id: 'c', label: 'C' }]);
        });

        it('should filter out all overlays with matching overlayId', () => {
            prev = [{ id: 'b', label: 'B' }, { id: 'b', label: 'B dup' }];
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'remove', overlayId: 'b' } },
                setOverlays,
            );
            const result = setOverlays.mock.calls[0][0](prev);
            expect(result).toEqual([]);
        });

        it('should not call setOverlays when overlayId is missing', () => {
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'remove' } },
                setOverlays,
            );
            expect(setOverlays).not.toHaveBeenCalled();
        });

        it('should call setOverlays when removing from empty array', () => {
            prev = [];
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'remove', overlayId: 'a' } },
                setOverlays,
            );
            expect(setOverlays).toHaveBeenCalledTimes(1);
            const result = setOverlays.mock.calls[0][0](prev);
            expect(result).toEqual([]);
        });
    });

    describe('clear action', () => {
        it('should clear all overlays by passing empty array to setOverlays', () => {
            prev = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'clear' } },
                setOverlays,
            );
            expect(setOverlays).toHaveBeenCalledTimes(1);
            expect(setOverlays.mock.calls[0][0]).toEqual([]);
        });

        it('should clear even when existing overlays is empty', () => {
            prev = [];
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'clear' } },
                setOverlays,
            );
            expect(setOverlays).toHaveBeenCalledTimes(1);
            expect(setOverlays.mock.calls[0][0]).toEqual([]);
        });

        it('should not call setOverlays when event.data is null (action undefined)', () => {
            prev = [{ id: 'a', label: 'A' }];
            handler(
                { key: 'spell-overlay-test-campaign', data: null },
                setOverlays,
            );
            expect(setOverlays).not.toHaveBeenCalled();
        });
    });

    describe('unknown action', () => {
        it('should ignore unknown action types', () => {
            handler(
                { key: 'spell-overlay-test-campaign', data: { action: 'unknown' } },
                setOverlays,
            );
            expect(setOverlays).not.toHaveBeenCalled();
        });

        it('should ignore event with no action', () => {
            handler(
                { key: 'spell-overlay-test-campaign', data: {} },
                setOverlays,
            );
            expect(setOverlays).not.toHaveBeenCalled();
        });
    });
});
