// @maintained-by-ai
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import POILayer from './POILayer.jsx';
import { hexToPixel } from '../../services/maps/hexMapUtils.js';
import { HEX_SIZE } from '../../config/outdoorConfig';

// Regression pin for bug-hex-poi-enter-chip-dead-real-clicks (2026-10-30):
// the hex <svg> root calls setPointerCapture in its onPointerDown (pan/paint
// lanes), and pointer capture RETARGETS the ensuing click to the svg — the
// enter chip's child onClick was dead to real mouse input. The enterable hit
// rect must stopPropagation the pointerdown (house pattern: POIContextMenu's
// menu <g>, PartyMarkerLayer path, non-enterable branch via
// handlePoiPointerDown) so the capture seam never fires for a chip press.
// jsdom does not retarget clicks, so this file locks the CONTRACT the fix
// relies on: chip presses never reach the svg root's pointerdown handler.

const POINTER = { pointerId: 1, button: 0, bubbles: true, clientX: 100, clientY: 100 };

describe('POILayer — enter chip vs svg pointer capture', () => {
    let captureSpy;
    let rootDown;
    let rootClick;
    let props;

    beforeEach(() => {
        captureSpy = vi.fn();
        rootDown = vi.fn();
        rootClick = vi.fn();
        // jsdom has no pointer-capture implementation; stub it permissively
        // (mirrors the synthetic/assistive-pointer swallow in useItemDragging).
        Element.prototype.setPointerCapture = captureSpy;
        Element.prototype.releasePointerCapture = vi.fn();

        props = {
            // poi at (0,1) is adjacent (real hexDistance) to party at (0,0).
            pois: [
                { id: 'enterable-poi', type: 'dungeon', q: 0, r: 1, visible: true, label: null, linkedMap: 'dungeon-map.json' },
                { id: 'plain-poi', type: 'camp', q: 3, r: 3, visible: true, label: null },
            ],
            onPoiPointerDown: vi.fn(),
            onPoiContextMenu: vi.fn(),
            onPoiEnter: vi.fn(),
            poiDragging: null,
            poiHover: null,
            isLocalhost: true,
            partyPosition: { q: 0, r: 0 },
            validLinkedMaps: new Set(['dungeon-map.json']),
            roadStartPoiId: null,
        };
    });

    // Harness mirrors HexMap.jsx's svg root: EVERY pointerdown that reaches it
    // captures the pointer (the live behaviour that swallowed chip clicks).
    function renderInSvg() {
        return render(
            <svg
                data-testid="hex-svg"
                onPointerDown={(e) => {
                    rootDown(e);
                    captureSpy(e.pointerId);
                }}
                onClick={rootClick}
            >
                <POILayer {...props} />
            </svg>
        );
    }

    // Full browser click shape: pointerdown → pointerup → click, native and
    // bubbling (dispatch lane per Players.test.jsx precedent).
    function realGesture(el) {
        el.dispatchEvent(new PointerEvent('pointerdown', POINTER));
        el.dispatchEvent(new PointerEvent('pointerup', POINTER));
        el.dispatchEvent(new MouseEvent('click', { ...POINTER }));
    }

    it('a real pointer gesture on the enter chip never reaches the svg capture seam and still enters', () => {
        const { container } = renderInSvg();
        const chip = container.querySelector('g.poi-item-enterable rect[fill="transparent"]');

        realGesture(chip);

        // No svg-level pointerdown → no setPointerCapture → in a real browser
        // the click stays targeted on the chip and onClick survives.
        expect(rootDown).not.toHaveBeenCalled();
        expect(captureSpy).not.toHaveBeenCalled();
        // The chip's own onClick stopPropagation also keeps the click off the svg.
        expect(rootClick).not.toHaveBeenCalled();
        // Stopped, not swallowed: enter dispatched exactly once with the linked POI.
        expect(props.onPoiEnter).toHaveBeenCalledTimes(1);
        expect(props.onPoiEnter).toHaveBeenCalledWith(expect.objectContaining({ id: 'enterable-poi' }));
        expect(props.onPoiPointerDown).not.toHaveBeenCalled();
    });

    it('a press on the canvas beneath still routes to the svg root and captures (pan/paint preserved)', () => {
        const { container } = renderInSvg();
        const svg = container.querySelector('[data-testid="hex-svg"]');

        svg.dispatchEvent(new PointerEvent('pointerdown', POINTER));

        expect(rootDown).toHaveBeenCalledTimes(1);
        expect(captureSpy).toHaveBeenCalledWith(POINTER.pointerId);
    });

    it('the enter hit rect covers the full golden badge — no inert pixels below the chip', () => {
        const { container } = renderInSvg();
        const { y } = hexToPixel(0, 1, HEX_SIZE);
        const chip = container.querySelector('g.poi-item-enterable rect[fill="transparent"]');
        // Golden badge bottom edge = y + 24 + 14 = y + 38 ("Enter" text baseline y + 35).
        expect(Number(chip.getAttribute('y'))).toBeLessThanOrEqual(y - 18);
        expect(Number(chip.getAttribute('y')) + Number(chip.getAttribute('height'))).toBeGreaterThanOrEqual(y + 38);
    });

    it('non-enterable POI drag lane unchanged: pointerdown dispatches the POI id, right-click the menu', () => {
        const { container } = renderInSvg();
        const plain = container.querySelectorAll('g.poi-item')[1].querySelector('rect[fill="transparent"]');
        fireEvent.pointerDown(plain, { button: 0 });
        fireEvent.contextMenu(plain, { button: 2 });
        expect(props.onPoiPointerDown).toHaveBeenCalledWith('plain-poi', expect.any(Object));
        expect(props.onPoiContextMenu).toHaveBeenCalledWith('plain-poi', expect.any(Object));
    });
});
