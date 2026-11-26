// @maintained-by-ai 2026-11-25
/* Lane: useRailClipped (Item 7, F19) — the horizontal-rail clipped detector
 * behind the Initiative edge-fade cue. jsdom reports zero layout metrics, so
 * the harness pins scrollWidth/clientWidth in a layout effect (layout effects
 * run before the hook's passive effect, so the very first measurement sees
 * them). ResizeObserver is the no-op stub from src/test/setup.js. */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useLayoutEffect, useRef } from 'react';
import useRailClipped from './useRailClipped.js';

function Harness({ scrollWidth, clientWidth, revision = 0, onClipped }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        Object.defineProperty(ref.current, 'scrollWidth', { value: scrollWidth, configurable: true });
        Object.defineProperty(ref.current, 'clientWidth', { value: clientWidth, configurable: true });
    }, [scrollWidth, clientWidth]);
    const clipped = useRailClipped(ref, revision);
    onClipped(clipped);
    return <div ref={ref} />;
}

describe('useRailClipped', () => {
    it('reports clipped when content overflows the box by more than 8px', () => {
        let last = null;
        render(<Harness scrollWidth={1080} clientWidth={1000} onClipped={(c) => { last = c; }} />);
        expect(last).toBe(true);
    });

    it('stays false when the rail fits (and within the 8px subpixel tolerance)', () => {
        let last = null;
        render(<Harness scrollWidth={1000} clientWidth={1000} onClipped={(c) => { last = c; }} />);
        expect(last).toBe(false);
        render(<Harness scrollWidth={1005} clientWidth={1000} onClipped={(c) => { last = c; }} />);
        expect(last).toBe(false);
    });

    it('re-measures when the revision changes (roster churn)', () => {
        let last = null;
        const view = render(<Harness scrollWidth={900} clientWidth={1000} revision={1} onClipped={(c) => { last = c; }} />);
        expect(last).toBe(false);
        view.rerender(<Harness scrollWidth={1400} clientWidth={1000} revision={2} onClipped={(c) => { last = c; }} />);
        expect(last).toBe(true);
    });
});
