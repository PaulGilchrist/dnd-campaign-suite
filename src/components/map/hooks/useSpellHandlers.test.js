// @maintained-by-ai
// Lane: map spell-tools interaction core (#904-#912 series; ruler #911 / select-move #912 / drag #905+#910).
// Owner of the pointer -> state contract of useSpellHandlers: instant placement (sphere/cylinder),
// press-drag drafts (cone/cube/line), drag/rotate gesture lifecycles on existing overlays, exact
// angle math, zero-write guard matrix, and pointer-capture lifecycle (no capture leaks, #905/#910).
// Not owned here: overlay persistence/SSE transport (useSpellOverlay.test.js) and DOM event routing
// (Map-tool-handlers.test.jsx, which mocks this hook entirely). useSpellOverlay is queued NEXT for
// the spell-tools split.
// Old->new map: 16 pointer-down tests -> instant/draft/drag/rotate + 5-case guard matrix;
// pointer-up tests -> full cast gesture; 7 drag-move tests -> drag lifecycle + refuse-guard tests;
// 9 drag-end tests -> flush lifecycle + exact-angle rotate + guards.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useSpellHandlers from './useSpellHandlers.js';
import { OverlayShape, createOverlay } from '../../../models/SpellOverlay.js';

const DEFAULT_COLOR = 'rgba(255,80,60,0.07)';

const defaultEvent = (overrides = {}) => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  button: 0,
  pointerId: 7,
  clientX: 200,
  clientY: 200,
  ...overrides,
});

// grid 5.3/7.8 floors to cell (5,7); clientToSVG passes coords through unless screenPt is pinned.
const getHook = ({ rulerMode = false, grid = { gridX: 5.3, gridY: 7.8 }, screenPt, shapeParams = {}, svgRef = { current: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } } } = {}) => {
  const mocks = {
    getGridFromEvent: vi.fn(() => grid),
    clientToSVG: vi.fn((cx, cy) => (screenPt === undefined ? { x: cx, y: cy } : screenPt)),
    addOverlay: vi.fn(),
    updateOverlay: vi.fn(),
    updateOverlayImmediate: vi.fn(),
    svgRef,
  };
  const { result } = renderHook(() => useSpellHandlers({ rulerMode, ...mocks, shapeParams }));
  return { result, mocks };
};

describe('useSpellHandlers', () => {
  describe('pointer down: instant placement (no draft)', () => {
    it.each([
      [OverlayShape.SPHERE, {}, { shape: 'sphere', startGridX: 5, startGridY: 7, angle: 0, radiusFt: 20, coneAngle: 0, widthFt: 0, distanceFt: 0, sizeFt: 0, color: DEFAULT_COLOR }],
      [OverlayShape.CYLINDER, {}, { shape: 'cylinder', startGridX: 5, startGridY: 7, angle: 0, radiusFt: 20, coneAngle: 0, widthFt: 0, distanceFt: 0, sizeFt: 0, color: DEFAULT_COLOR }],
      [OverlayShape.SPHERE, { radiusFt: 30, color: 'rgba(0,100,255,0.5)' }, { shape: 'sphere', startGridX: 5, startGridY: 7, angle: 0, radiusFt: 30, coneAngle: 0, widthFt: 0, distanceFt: 0, sizeFt: 0, color: 'rgba(0,100,255,0.5)' }],
    ])('%s click on empty grid writes one overlay from shapeParams, no draft', (shape, params, expected) => {
      const { result, mocks } = getHook({ shapeParams: params });
      act(() => {
        result.current.handleSpellPointerDown(defaultEvent(), shape, []);
      });
      expect(mocks.addOverlay).toHaveBeenCalledTimes(1);
      const { id, ...overlay } = mocks.addOverlay.mock.calls[0][0];
      expect(id).toEqual(expect.any(String));
      expect(overlay).toEqual(expected);
      expect(result.current.spellDraft).toBeNull();
      expect(result.current.dragOverlay).toBeNull();
      expect(result.current.rotateOverlay).toBeNull();
    });
  });

  describe('pointer down: press-drag drafts', () => {
    it.each([OverlayShape.CONE, OverlayShape.CUBE, OverlayShape.LINE])(
      '%s press on empty grid opens a draft and writes nothing',
      (shape) => {
        const { result, mocks } = getHook();
        act(() => {
          result.current.handleSpellPointerDown(defaultEvent({ clientX: 100, clientY: 200 }), shape, []);
        });
        expect(mocks.addOverlay).not.toHaveBeenCalled();
        expect(result.current.spellDraft).toEqual({ startGridX: 5, startGridY: 7, startScreenX: 100, startScreenY: 200, angle: 0 });
      }
    );

    it('casts a cone: press drafts, drag points, release places exactly one overlay then clears the draft', () => {
      const params = { coneAngle: 90, distanceFt: 30 };
      const { result, mocks } = getHook({ shapeParams: params });
      act(() => {
        result.current.handleSpellPointerDown(defaultEvent({ clientX: 100, clientY: 200 }), OverlayShape.CONE, []);
      });
      const event = defaultEvent({ clientX: 200, clientY: 50 });
      act(() => {
        result.current.handleSpellPointerMove(event, result.current.spellDraft);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(result.current.spellDraft.angle).toBeCloseTo(303.69, 2);

      act(() => {
        result.current.handleSpellPointerUp(event, result.current.spellDraft, OverlayShape.CONE, mocks.addOverlay, params);
      });
      expect(mocks.addOverlay).toHaveBeenCalledTimes(1);
      const { id, angle, ...overlay } = mocks.addOverlay.mock.calls[0][0];
      expect(id).toEqual(expect.any(String));
      expect(angle).toBeCloseTo(303.69, 2);
      expect(overlay).toEqual({ shape: 'cone', startGridX: 5, startGridY: 7, coneAngle: 90, distanceFt: 30, radiusFt: 0, widthFt: 0, sizeFt: 0, color: DEFAULT_COLOR });
      expect(result.current.spellDraft).toBeNull();
    });

    it('ignores pointer move and up when there is no draft', () => {
      const { result, mocks } = getHook();
      const event = defaultEvent();
      act(() => {
        result.current.handleSpellPointerMove(event, null);
      });
      act(() => {
        result.current.handleSpellPointerUp(event, null, OverlayShape.CONE, mocks.addOverlay, {});
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mocks.addOverlay).not.toHaveBeenCalled();
      expect(result.current.spellDraft).toBeNull();
    });
  });

  describe('pointer down: manipulating an existing overlay beats placement', () => {
    it('grabs inside an existing sphere: drags it, captures the pointer, never places', () => {
      const sphere = createOverlay(OverlayShape.SPHERE, 4, 6);
      const { result, mocks } = getHook();
      const event = defaultEvent();
      act(() => {
        result.current.handleSpellPointerDown(event, OverlayShape.SPHERE, [sphere]);
      });
      expect(result.current.dragOverlay).toEqual({ overlayId: sphere.id, offsetX: 1, offsetY: 1 });
      expect(result.current.rotateOverlay).toBeNull();
      expect(result.current.spellDraft).toBeNull();
      expect(result.current.spellDragActiveRef.current).toBe(true);
      expect(mocks.addOverlay).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mocks.svgRef.current.setPointerCapture).toHaveBeenCalledTimes(1);
      expect(mocks.svgRef.current.setPointerCapture).toHaveBeenCalledWith(7);
    });

    it('grabs a cone near the edge to rotate, at the apex to drag, and survives a missing svg element', () => {
      const cone = createOverlay(OverlayShape.CONE, 0, 0);
      const nearEdge = getHook({ grid: { gridX: 5.3, gridY: 0.8 } });
      act(() => {
        nearEdge.result.current.handleSpellPointerDown(defaultEvent(), OverlayShape.CONE, [cone]);
      });
      expect(nearEdge.result.current.rotateOverlay).toEqual({ overlayId: cone.id, originX: 20, originY: 20, startAngle: 0, offsetAngle: 45 });
      expect(nearEdge.result.current.dragOverlay).toBeNull();
      expect(nearEdge.mocks.addOverlay).not.toHaveBeenCalled();

      const atApex = getHook({ grid: { gridX: 0.3, gridY: 0.8 } });
      act(() => {
        atApex.result.current.handleSpellPointerDown(defaultEvent(), OverlayShape.CONE, [cone]);
      });
      expect(atApex.result.current.rotateOverlay).toBeNull();
      expect(atApex.result.current.dragOverlay).toEqual({ overlayId: cone.id, offsetX: 0, offsetY: 0 });

      const noSvg = getHook({ grid: { gridX: 5.3, gridY: 0.8 }, svgRef: { current: null } });
      act(() => {
        noSvg.result.current.handleSpellPointerDown(defaultEvent(), OverlayShape.CONE, [cone]);
      });
      expect(noSvg.result.current.rotateOverlay).not.toBeNull();
    });
  });

  describe('drag and rotate lifecycles', () => {
    it('drags an overlay: move repositions via updateOverlay, release flushes and ends the capture', () => {
      const sphere = createOverlay(OverlayShape.SPHERE, 4, 6);
      const { result, mocks } = getHook();
      act(() => {
        result.current.handleSpellPointerDown(defaultEvent(), OverlayShape.SPHERE, [sphere]);
      });
      const drag = result.current.dragOverlay;

      mocks.getGridFromEvent.mockReturnValue({ gridX: 8.6, gridY: 3.2 });
      const moveEvent = defaultEvent();
      act(() => {
        result.current.handleSpellDragMove(moveEvent, drag, null, [sphere]);
      });
      expect(moveEvent.preventDefault).toHaveBeenCalled();
      expect(mocks.updateOverlay).toHaveBeenCalledTimes(1);
      expect(mocks.updateOverlay.mock.calls[0][0]).toEqual({ id: sphere.id, shape: 'sphere', startGridX: 7, startGridY: 2, angle: 0, radiusFt: 20, coneAngle: 0, widthFt: 0, distanceFt: 0, sizeFt: 0, color: DEFAULT_COLOR });
      expect(mocks.updateOverlayImmediate).not.toHaveBeenCalled();

      mocks.getGridFromEvent.mockReturnValue({ gridX: 9.4, gridY: 4.9 });
      act(() => {
        result.current.handleSpellDragEnd(defaultEvent(), drag, null, [sphere], mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).toHaveBeenCalledTimes(1);
      expect(mocks.updateOverlayImmediate.mock.calls[0][0]).toMatchObject({ id: sphere.id, startGridX: 8, startGridY: 3 });
      expect(mocks.svgRef.current.releasePointerCapture).toHaveBeenCalledWith(7);
      expect(result.current.dragOverlay).toBeNull();
      expect(result.current.spellDragActiveRef.current).toBe(false);
    });

    it('rotates with exact angle math, wrapping negative results into [0, 360)', () => {
      const cone = createOverlay(OverlayShape.CONE, 0, 0);
      const { result, mocks } = getHook();
      const rotate = { overlayId: cone.id, originX: 20, originY: 20, startAngle: 0, offsetAngle: 45 };

      mocks.clientToSVG.mockReturnValue({ x: 20, y: 120 });
      act(() => {
        result.current.handleSpellDragMove(defaultEvent(), null, rotate, [cone]);
      });
      expect(mocks.updateOverlay).toHaveBeenCalledTimes(1);
      expect(mocks.updateOverlay.mock.calls[0][0]).toMatchObject({ id: cone.id, shape: 'cone', startGridX: 0, startGridY: 0, angle: 45 });

      // Cursor straight below the origin (270deg) with a 315deg grab offset wraps to exactly 315.
      mocks.clientToSVG.mockReturnValue({ x: 20, y: -60 });
      const wrapped = { ...rotate, offsetAngle: 315 };
      act(() => {
        result.current.handleSpellDragMove(defaultEvent(), null, wrapped, [cone]);
      });
      expect(mocks.updateOverlay).toHaveBeenCalledTimes(2);
      expect(mocks.updateOverlay.mock.calls[1][0].angle).toBe(315);

      act(() => {
        result.current.handleSpellDragEnd(defaultEvent(), null, wrapped, [cone], mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).toHaveBeenCalledTimes(1);
      expect(mocks.updateOverlayImmediate.mock.calls[0][0]).toMatchObject({ id: cone.id, shape: 'cone', startGridX: 0, startGridY: 0, angle: 315 });
      expect(mocks.svgRef.current.releasePointerCapture).toHaveBeenCalledWith(7);
      expect(result.current.rotateOverlay).toBeNull();
    });
  });

  describe('guards: zero writes, no stuck gestures', () => {
    it.each([
      { scenario: 'ruler mode is active', opts: { rulerMode: true } },
      { scenario: 'the pointer maps to no grid cell', opts: { grid: null } },
      { scenario: 'the user right-clicks an existing overlay', opts: { button: 2 } },
      { scenario: 'clientToSVG fails over an existing overlay', opts: { screenPt: null } },
      { scenario: 'no placement tool is active', opts: { grid: { gridX: 99, gridY: 99 }, spellMode: null } },
    ])('pointer down is inert when $scenario', ({ opts }) => {
      const sphere = createOverlay(OverlayShape.SPHERE, 4, 6);
      const { spellMode = OverlayShape.SPHERE, ...hookOpts } = opts;
      const { result, mocks } = getHook(hookOpts);
      act(() => {
        result.current.handleSpellPointerDown(defaultEvent({ button: opts.button ?? 0 }), spellMode, [sphere]);
      });
      expect(mocks.addOverlay).not.toHaveBeenCalled();
      expect(mocks.svgRef.current.setPointerCapture).not.toHaveBeenCalled();
      expect(result.current.spellDraft).toBeNull();
      expect(result.current.dragOverlay).toBeNull();
      expect(result.current.rotateOverlay).toBeNull();
      expect(result.current.spellDragActiveRef.current).toBe(false);
    });

    // #913: pointerdown fires for ALL mouse buttons; only the primary button may
    // create, move, or rotate overlays. Previously the e.button guard sat inside the
    // hit-test loop, so non-primary clicks on EMPTY grid fell through to placement.
    // Map right-button ownership: pan is left-only (useZoomPan.js:52), the native
    // menu is suppressed at Map.jsx:416 — right/middle must be fully inert here.
    it.each([1, 2])(
      'pointer down with button %i on empty grid is fully inert for instant shapes',
      (button) => {
        const { result, mocks } = getHook();
        const event = defaultEvent({ button });
        act(() => {
          result.current.handleSpellPointerDown(event, OverlayShape.SPHERE, []);
        });
        expect(mocks.addOverlay).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
        expect(mocks.svgRef.current.setPointerCapture).not.toHaveBeenCalled();
        expect(result.current.spellDraft).toBeNull();
        expect(result.current.dragOverlay).toBeNull();
        expect(result.current.rotateOverlay).toBeNull();
        expect(result.current.spellDragActiveRef.current).toBe(false);
      }
    );

    it.each([OverlayShape.CONE, OverlayShape.CUBE, OverlayShape.LINE])(
      'right-click pointer down on empty grid opens no %s draft',
      (shape) => {
        const { result, mocks } = getHook();
        const event = defaultEvent({ button: 2, clientX: 100, clientY: 200 });
        act(() => {
          result.current.handleSpellPointerDown(event, shape, []);
        });
        expect(result.current.spellDraft).toBeNull();
        expect(mocks.addOverlay).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
      }
    );

    it('non-primary pointer up never commits a live draft; primary release commits exactly once', () => {
      const params = { coneAngle: 90, distanceFt: 30 };
      const { result, mocks } = getHook({ shapeParams: params });
      act(() => {
        result.current.handleSpellPointerDown(defaultEvent({ clientX: 100, clientY: 200 }), OverlayShape.CONE, []);
      });
      const rightUp = defaultEvent({ button: 2, clientX: 200, clientY: 50 });
      act(() => {
        result.current.handleSpellPointerUp(rightUp, result.current.spellDraft, OverlayShape.CONE, mocks.addOverlay, params);
      });
      expect(mocks.addOverlay).not.toHaveBeenCalled();
      expect(result.current.spellDraft).not.toBeNull();

      const leftUp = defaultEvent({ clientX: 200, clientY: 50 });
      act(() => {
        result.current.handleSpellPointerUp(leftUp, result.current.spellDraft, OverlayShape.CONE, mocks.addOverlay, params);
      });
      expect(mocks.addOverlay).toHaveBeenCalledTimes(1);
      expect(result.current.spellDraft).toBeNull();
    });

    it('non-primary pointer up never ends a live drag gesture; primary release ends it and flushes', () => {
      const sphere = createOverlay(OverlayShape.SPHERE, 4, 6);
      const { result, mocks } = getHook();
      act(() => {
        result.current.handleSpellPointerDown(defaultEvent(), OverlayShape.SPHERE, [sphere]);
      });
      const drag = result.current.dragOverlay;

      act(() => {
        result.current.handleSpellDragEnd(defaultEvent({ button: 2 }), drag, null, [sphere], mocks.svgRef);
      });
      expect(result.current.dragOverlay).not.toBeNull();
      expect(result.current.spellDragActiveRef.current).toBe(true);
      expect(mocks.updateOverlayImmediate).not.toHaveBeenCalled();
      expect(mocks.svgRef.current.releasePointerCapture).not.toHaveBeenCalled();

      act(() => {
        result.current.handleSpellDragEnd(defaultEvent(), result.current.dragOverlay, null, [sphere], mocks.svgRef);
      });
      expect(result.current.dragOverlay).toBeNull();
      expect(result.current.spellDragActiveRef.current).toBe(false);
      expect(mocks.svgRef.current.releasePointerCapture).toHaveBeenCalledTimes(1);
    });

    it('drag move refuses unresolvable targets; drag end still clears state and releases capture', () => {
      const sphere = createOverlay(OverlayShape.SPHERE, 4, 6);
      const { result, mocks } = getHook();
      act(() => {
        result.current.handleSpellPointerDown(defaultEvent(), OverlayShape.SPHERE, [sphere]);
      });
      const drag = result.current.dragOverlay;

      mocks.getGridFromEvent.mockReturnValue(null);
      act(() => {
        result.current.handleSpellDragMove(defaultEvent(), drag, null, [sphere]);
      });
      act(() => {
        result.current.handleSpellDragMove(defaultEvent(), { ...drag, overlayId: 'gone' }, null, [sphere]);
      });
      act(() => {
        result.current.handleSpellDragMove(defaultEvent(), null, null, [sphere]);
      });
      expect(mocks.updateOverlay).not.toHaveBeenCalled();

      act(() => {
        result.current.handleSpellDragEnd(defaultEvent(), drag, null, [sphere], mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).not.toHaveBeenCalled();
      expect(result.current.dragOverlay).toBeNull();
      expect(result.current.spellDragActiveRef.current).toBe(false);
      expect(mocks.svgRef.current.releasePointerCapture).toHaveBeenCalledWith(7);

      // With the grid resolved again, a stale overlay id still must not write.
      mocks.getGridFromEvent.mockReturnValue({ gridX: 9.4, gridY: 4.9 });
      act(() => {
        result.current.handleSpellDragEnd(defaultEvent(), { ...drag, overlayId: 'gone' }, null, [sphere], mocks.svgRef);
      });
      act(() => {
        result.current.handleSpellDragEnd(defaultEvent(), null, null, [sphere], mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).not.toHaveBeenCalled();
    });

    it('rotate move and end refuse unresolvable targets but always clear state and capture', () => {
      const cone = createOverlay(OverlayShape.CONE, 0, 0);
      const { result, mocks } = getHook({ grid: { gridX: 5.3, gridY: 0.8 } });
      act(() => {
        result.current.handleSpellPointerDown(defaultEvent(), OverlayShape.CONE, [cone]);
      });
      const rotate = result.current.rotateOverlay;

      mocks.clientToSVG.mockReturnValue(null);
      act(() => {
        result.current.handleSpellDragMove(defaultEvent(), null, rotate, [cone]);
      });
      expect(mocks.updateOverlay).not.toHaveBeenCalled();
      act(() => {
        result.current.handleSpellDragMove(defaultEvent(), null, { ...rotate, overlayId: 'gone' }, [cone]);
      });
      expect(mocks.updateOverlay).not.toHaveBeenCalled();

      act(() => {
        result.current.handleSpellDragEnd(defaultEvent(), null, rotate, [cone], mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).not.toHaveBeenCalled();
      expect(result.current.rotateOverlay).toBeNull();
      expect(result.current.spellDragActiveRef.current).toBe(false);
      expect(mocks.svgRef.current.releasePointerCapture).toHaveBeenCalledWith(7);
    });

    it('drag end still flushes the final position when the svg element is gone', () => {
      const sphere = createOverlay(OverlayShape.SPHERE, 4, 6);
      const { result, mocks } = getHook();
      act(() => {
        result.current.handleSpellPointerDown(defaultEvent(), OverlayShape.SPHERE, [sphere]);
      });
      mocks.getGridFromEvent.mockReturnValue({ gridX: 9.4, gridY: 4.9 });
      act(() => {
        result.current.handleSpellDragEnd(defaultEvent(), result.current.dragOverlay, null, [sphere], { current: null });
      });
      expect(mocks.updateOverlayImmediate).toHaveBeenCalledTimes(1);
      expect(mocks.updateOverlayImmediate.mock.calls[0][0]).toMatchObject({ id: sphere.id, startGridX: 8, startGridY: 3 });
      expect(result.current.spellDragActiveRef.current).toBe(false);
    });
  });
});
