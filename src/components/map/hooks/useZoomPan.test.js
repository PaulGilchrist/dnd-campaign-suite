// @maintained-by-ai
// useZoomPan — square-map transform lane. Distinct from hex-map zoom lane (#807):
// this hook mirrors zoomValueRef/panValueRefs via effects, so sequential wheel events
// compound with no hex zoomRef staleness quirk — feed inputs, pin output bytes.
// Old(30) -> new(13): vacuous NaN pan mock (matrixTransform closed over args never
// passed) replaced with an honest affine fake; weak not.toBe(0) anchor checks -> exact
// pan bytes; duplicate accumulate/compound, split preventDefault, and reset-again tests
// consolidated. Consumer files (Map*.test.jsx) mock this hook wholesale — no overlap.
// #917: releasePointerCapture was a bare vi.fn() that never threw, hiding the defect
// (handlePanEnd released a capture handlePanStart never acquired -> real browsers throw
// NotFoundError). Upgraded to a faithful capture-tracking element (house faithful-mock
// canon, fix#10r spirit): release throws NotFoundError unless that pointerId is captured.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useZoomPan from './useZoomPan.js';

// Pinned literals — the exact contract of useZoomPan. Do not import from config.
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

// Honest SVG fake: a mutable point whose matrixTransform applies the real affine
// formula, driven by whatever coordinates the hook assigns. Not order-dependent,
// no canned return values. Default screen-CTM inverse is scale(2).
// Faithful pointer-capture ledger (real Element.prototype semantics): capture arms a
// pointerId; release of an un-captured (or mismatched) pointerId throws NotFoundError.
const SCALE_2 = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };
const makeSvg = ({ ctm = { inverse: () => SCALE_2 } } = {}) => {
  const captured = new Set();
  return {
    createSVGPoint: vi.fn(() => {
      const pt = { x: 0, y: 0 };
      pt.matrixTransform = (m) => ({
        x: m.a * pt.x + m.c * pt.y + m.e,
        y: m.b * pt.x + m.d * pt.y + m.f,
      });
      return pt;
    }),
    getScreenCTM: vi.fn(() => ctm),
    // Assertion surface: captured.has(id) mirrors live capture state of this element.
    captured,
    hasPointerCapture: vi.fn((id) => captured.has(id)),
    setPointerCapture: vi.fn((id) => { captured.add(id); }),
    releasePointerCapture: vi.fn((id) => {
      if (!captured.has(id)) {
        // jsdom exposes DOMException via globalThis; explicit access keeps eslint's
        // no-undef globals block untouched (test-scope edit constraint).
        throw new globalThis.DOMException(
          `Failed to execute 'releasePointerCapture': no active capture for pointerId ${id}`,
          'NotFoundError'
        );
      }
      captured.delete(id);
    }),
  };
};

const wheelEvent = (deltaY, overrides = {}) => ({
  metaKey: true,
  preventDefault: vi.fn(),
  clientX: 100,
  clientY: 100,
  deltaY,
  ...overrides,
});

describe('useZoomPan', () => {
  it('starts at zoom 1, pan 0,0, no active pan', () => {
    const { result } = renderHook(() => useZoomPan({ current: null }));
    expect(result.current.zoom).toBe(1);
    expect(result.current.panX).toBe(0);
    expect(result.current.panY).toBe(0);
    expect(result.current.panning).toBeNull();
  });

  it('zoomIn multiplies by 1.25 per click and clamps at MAX_ZOOM (4)', () => {
    const { result } = renderHook(() => useZoomPan({ current: null }));
    act(() => { result.current.zoomIn(); });
    expect(result.current.zoom).toBe(1.25);
    act(() => {
      for (let i = 0; i < 10; i++) result.current.zoomIn();
    });
    expect(result.current.zoom).toBe(MAX_ZOOM);
    act(() => { result.current.zoomIn(); });
    expect(result.current.zoom).toBe(MAX_ZOOM);
  });

  it('zoomOut multiplies by 0.8 per click and clamps at MIN_ZOOM (0.25)', () => {
    const { result } = renderHook(() => useZoomPan({ current: null }));
    act(() => { result.current.zoomOut(); });
    expect(result.current.zoom).toBe(0.8);
    act(() => {
      for (let i = 0; i < 10; i++) result.current.zoomOut();
    });
    expect(result.current.zoom).toBe(MIN_ZOOM);
    act(() => { result.current.zoomOut(); });
    expect(result.current.zoom).toBe(MIN_ZOOM);
  });

  it('resetView restores zoom 1 and pan 0,0 after zooming and panning', () => {
    const svgRef = { current: makeSvg() };
    const { result } = renderHook(() => useZoomPan(svgRef));
    act(() => {
      result.current.handlePanStart({ button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 0, 0);
    });
    act(() => {
      result.current.handlePanMove({ clientX: 120, clientY: 140, preventDefault: vi.fn() });
    });
    act(() => { result.current.zoomIn(); });
    expect(result.current.panX).toBe(-40);
    expect(result.current.panY).toBe(-80);
    act(() => { result.current.resetView(); });
    expect(result.current.zoom).toBe(1);
    expect(result.current.panX).toBe(0);
    expect(result.current.panY).toBe(0);
  });

  it('gridCenter maps grid indices to cell centers (cell size 40) exactly, including negatives', () => {
    const { result } = renderHook(() => useZoomPan({ current: null }));
    expect(result.current.gridCenterX(0)).toBe(20);
    expect(result.current.gridCenterX(1)).toBe(60);
    expect(result.current.gridCenterX(-1)).toBe(-20);
    expect(result.current.gridCenterX(5)).toBe(220);
    expect(result.current.gridCenterY(0)).toBe(20);
    expect(result.current.gridCenterY(1)).toBe(60);
    expect(result.current.gridCenterY(-1)).toBe(-20);
    expect(result.current.gridCenterY(5)).toBe(220);
  });

  it('clientToSVG converts client coords through the inverse screen CTM, and returns null without a point or CTM', () => {
    const svgRef = { current: makeSvg() };
    const { result } = renderHook(() => useZoomPan(svgRef));
    expect(result.current.clientToSVG(100, 200)).toEqual({ x: 200, y: 400 });

    const nullRef = renderHook(() => useZoomPan({ current: null }));
    expect(nullRef.result.current.clientToSVG(100, 200)).toBeNull();

    const noCtmRef = { current: makeSvg({ ctm: null }) };
    const noCtm = renderHook(() => useZoomPan(noCtmRef));
    expect(noCtm.result.current.clientToSVG(100, 200)).toBeNull();
  });

  it('getGridFromEvent divides SVG coords by cell size without flooring, and returns null without an SVG', () => {
    const svgRef = { current: makeSvg() };
    const { result } = renderHook(() => useZoomPan(svgRef));
    // client(55, 70) -> scale(2) -> SVG(110, 140) -> grid(2.75, 3.5): fractional stays fractional
    expect(result.current.getGridFromEvent({ clientX: 55, clientY: 70 })).toEqual({ gridX: 2.75, gridY: 3.5 });

    const nullRef = renderHook(() => useZoomPan({ current: null }));
    expect(nullRef.result.current.getGridFromEvent({ clientX: 55, clientY: 70 })).toBeNull();
  });

  it('pan starts only for a left button on a live SVG; other buttons and a null SVG stay inert', () => {
    const svg = makeSvg();
    const svgRef = { current: svg };
    const { result } = renderHook(() => useZoomPan(svgRef));
    const left = { button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault: vi.fn() };
    act(() => { result.current.handlePanStart(left, 5, 7); });
    expect(left.preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.panning).toEqual({ startX: 200, startY: 200, startPanX: 5, startPanY: 7 });

    const right = { button: 2, pointerId: 2, clientX: 100, clientY: 100, preventDefault: vi.fn() };
    act(() => { result.current.handlePanStart(right, 5, 7); });
    expect(right.preventDefault).not.toHaveBeenCalled();
    expect(result.current.panning).toEqual({ startX: 200, startY: 200, startPanX: 5, startPanY: 7 });

    const nullRef = renderHook(() => useZoomPan({ current: null }));
    const onNullSvg = { button: 0, pointerId: 3, clientX: 100, clientY: 100, preventDefault: vi.fn() };
    act(() => { nullRef.result.current.handlePanStart(onNullSvg, 0, 0); });
    // Button gate passes before the SVG guard, so default is still prevented...
    expect(onNullSvg.preventDefault).toHaveBeenCalledTimes(1);
    // ...but no pan session begins without an SVG to measure against.
    expect(nullRef.result.current.panning).toBeNull();
  });

  it('pan move offsets pan by the SVG-space drag delta exactly; pan end clears state and releases capture; later moves are inert', () => {
    const svg = makeSvg();
    const svgRef = { current: svg };
    const { result } = renderHook(() => useZoomPan(svgRef));
    act(() => { result.current.handlePanStart({ button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 5, 7); });
    const move = { clientX: 120, clientY: 140, preventDefault: vi.fn() };
    act(() => { result.current.handlePanMove(move); });
    // client(120,140) -> scale(2) -> SVG(240,280); start SVG(200,200) => d=(40,80)
    expect(result.current.panX).toBe(-35);
    expect(result.current.panY).toBe(-73);
    expect(move.preventDefault).toHaveBeenCalledTimes(1);

    act(() => { result.current.handlePanEnd({ pointerId: 1 }); });
    expect(result.current.panning).toBeNull();
    expect(svg.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(svg.captured.has(1)).toBe(false);

    const afterEnd = { clientX: 999, clientY: 999, preventDefault: vi.fn() };
    act(() => { result.current.handlePanMove(afterEnd); });
    expect(afterEnd.preventDefault).not.toHaveBeenCalled();
    expect(result.current.panX).toBe(-35);
    expect(result.current.panY).toBe(-73);
  });

  // #917(a) capture pairing ledger (house canon: useRuler.js :22-27 validates then
  // captures; useItemDragging fix#53 / usePlayerDragging fix#54 same invariant).
  // Pre-fix RED: no capture armed mid-drag and handlePanEnd's orphan release threw
  // NotFoundError on the faithful mock. panning !== null now strictly implies captured.
  it('#917 pan end releases exactly the capture pan start armed — full gesture never throws', () => {
    const svg = makeSvg();
    const { result } = renderHook(() => useZoomPan({ current: svg }));
    const down = { button: 0, pointerId: 7, clientX: 100, clientY: 100, preventDefault: vi.fn() };
    expect(() => { act(() => { result.current.handlePanStart(down, 0, 0); }); }).not.toThrow();
    expect(svg.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(svg.setPointerCapture).toHaveBeenCalledWith(7);
    expect(svg.hasPointerCapture(7)).toBe(true); // panning armed => captured armed

    act(() => { result.current.handlePanMove({ clientX: 110, clientY: 110, preventDefault: vi.fn() }); });
    expect(svg.hasPointerCapture(7)).toBe(true); // held across the whole drag, incl. out-of-svg
    expect(result.current.panX).toBe(-20);
    expect(result.current.panY).toBe(-20);

    expect(() => { act(() => { result.current.handlePanEnd({ pointerId: 7 }); }); }).not.toThrow();
    expect(svg.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(svg.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(svg.hasPointerCapture(7)).toBe(false);
    expect(result.current.panning).toBeNull();

    // Second gesture after a clean release: paired again, no orphan, no throw.
    expect(() => { act(() => { result.current.handlePanStart(down, 0, 0); }); }).not.toThrow();
    expect(svg.hasPointerCapture(7)).toBe(true);
    expect(() => { act(() => { result.current.handlePanEnd({ pointerId: 7 }); }); }).not.toThrow();
    expect(svg.hasPointerCapture(7)).toBe(false);
    expect(svg.releasePointerCapture).toHaveBeenCalledTimes(2);
  });

  // #917(a) failed-start table (mirrors fix#53's zero-capture pins): every bail in
  // handlePanStart happens before the capture, so a failed down arms nothing and the
  // matching up must not touch releasePointerCapture (pre-fix: orphan NotFoundError).
  it('#917 failed pan starts arm zero capture; matching pan ends release nothing', () => {
    const svg = makeSvg();
    const { result } = renderHook(() => useZoomPan({ current: svg }));

    const right = { button: 2, pointerId: 3, clientX: 100, clientY: 100, preventDefault: vi.fn() };
    expect(() => { act(() => { result.current.handlePanStart(right, 0, 0); }); }).not.toThrow();
    expect(svg.setPointerCapture).not.toHaveBeenCalled();
    expect(result.current.panning).toBeNull();
    expect(() => { act(() => { result.current.handlePanEnd({ pointerId: 3 }); }); }).not.toThrow();
    expect(svg.releasePointerCapture).not.toHaveBeenCalled();

    // No-CTM start: clientToSVG bails before the commit, so nothing is captured.
    const noCtmSvg = makeSvg({ ctm: null });
    const noCtm = renderHook(() => useZoomPan({ current: noCtmSvg }));
    const down = { button: 0, pointerId: 4, clientX: 100, clientY: 100, preventDefault: vi.fn() };
    expect(() => { act(() => { noCtm.result.current.handlePanStart(down, 0, 0); }); }).not.toThrow();
    expect(noCtmSvg.setPointerCapture).not.toHaveBeenCalled();
    expect(noCtm.result.current.panning).toBeNull();
    expect(() => { act(() => { noCtm.result.current.handlePanEnd({ pointerId: 4 }); }); }).not.toThrow();
    expect(noCtmSvg.releasePointerCapture).not.toHaveBeenCalled();

    // End with no preceding start at all: bails on null panning, zero release calls.
    const freshSvg = makeSvg();
    const fresh = renderHook(() => useZoomPan({ current: freshSvg }));
    expect(() => { act(() => { fresh.result.current.handlePanEnd({ pointerId: 9 }); }); }).not.toThrow();
    expect(freshSvg.releasePointerCapture).not.toHaveBeenCalled();
    expect(fresh.result.current.panning).toBeNull();
  });

  // #917(b) a sub-threshold wheel tick keeps factor === 1 — there is nothing to zoom.
  // Pre-fix RED: the fall-through wrote setZoom/setPanX/setPanY every tick, and the
  // lossy x-(x-pan) round trip churned the held pan bytes (-19.9 -> ...006) plus an
  // extra re-render even though the zoom factor was 1.
  it('#917 sub-threshold wheel ticks perform zero zoom/pan writes; crossing fires byte-exact', () => {
    let renders = 0;
    const svgRef = { current: makeSvg() };
    const { result } = renderHook(() => { renders += 1; return useZoomPan(svgRef); });

    // Arm a non-representable held pan via a real gesture: svg start(200,200),
    // move delta (20,20) => panX = panY = fl(0.1 - 20) = -19.9.
    act(() => { result.current.handlePanStart({ button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault: vi.fn() }, 0.1, 0.1); });
    act(() => { result.current.handlePanMove({ clientX: 110, clientY: 110, preventDefault: vi.fn() }); });
    act(() => { result.current.handlePanEnd({ pointerId: 1 }); });
    expect(result.current.panX).toBe(-19.9);
    expect(result.current.panY).toBe(-19.9);

    // Below the 20-delta threshold: factor stays 1 => zero writes.
    const rendersBefore = renders;
    const hold = wheelEvent(-15);
    expect(() => { act(() => { result.current.handleWheel(hold); }); }).not.toThrow();
    expect(hold.preventDefault).toHaveBeenCalledTimes(1); // default handling intact
    expect(result.current.zoom).toBe(1);
    expect(result.current.panX).toBe(-19.9); // churn pre-fix: -19.900000000000006
    expect(result.current.panY).toBe(-19.9);
    expect(renders).toBe(rendersBefore); // zero writes => zero re-renders (SSE/POST churn)

    // Accumulation still works across the guard: crossing fires once, byte-exact.
    expect(() => { act(() => { result.current.handleWheel(wheelEvent(-10)); }); }).not.toThrow(); // accumulated -25
    expect(result.current.zoom).toBe(1.05);
    expect(result.current.panX).toBe(-9.428571428571416);
    expect(result.current.panY).toBe(-9.428571428571416);
    expect(renders).toBe(rendersBefore + 1); // the real zoom renders exactly once
  });

  it('wheel without metaKey is fully inert; wheel with metaKey but no SVG prevents default but does not zoom', () => {
    const svgRef = { current: makeSvg() };
    const { result } = renderHook(() => useZoomPan(svgRef));
    const plain = wheelEvent(-30, { metaKey: false });
    act(() => { result.current.handleWheel(plain); });
    expect(plain.preventDefault).not.toHaveBeenCalled();
    expect(result.current.zoom).toBe(1);
    expect(result.current.panX).toBe(0);
    expect(result.current.panY).toBe(0);

    const nullRef = renderHook(() => useZoomPan({ current: null }));
    const noSvg = wheelEvent(-30);
    act(() => { nullRef.result.current.handleWheel(noSvg); });
    expect(noSvg.preventDefault).toHaveBeenCalledTimes(1);
    expect(nullRef.result.current.zoom).toBe(1);
  });

  it('trackpad wheel zooms to the cursor with exact zoom and pan bytes in each direction', () => {
    const inRef = { current: makeSvg() };
    const zoomInCase = renderHook(() => useZoomPan(inRef));
    // client(100,100) -> scale(2) -> anchor SVG(200,200)
    const inEvent = wheelEvent(-30);
    act(() => { zoomInCase.result.current.handleWheel(inEvent); });
    expect(inEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(zoomInCase.result.current.zoom).toBe(1.05);
    expect(zoomInCase.result.current.panX).toBe(9.523809523809547);
    expect(zoomInCase.result.current.panY).toBe(9.523809523809547);

    const outCase = renderHook(() => useZoomPan({ current: makeSvg() }));
    const outEvent = wheelEvent(30);
    act(() => { outCase.result.current.handleWheel(outEvent); });
    expect(outEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(outCase.result.current.zoom).toBe(0.95);
    expect(outCase.result.current.panX).toBe(-10.52631578947367);
    expect(outCase.result.current.panY).toBe(-10.52631578947367);
  });

  it('wheel accumulates deltaY until it crosses the 20 threshold, fires once, then restarts accumulation', () => {
    const { result } = renderHook(() => useZoomPan({ current: makeSvg() }));
    const small = () => wheelEvent(-15);

    const e1 = small();
    act(() => { result.current.handleWheel(e1); });
    expect(result.current.zoom).toBe(1);
    expect(result.current.panX).toBe(0);
    expect(result.current.panY).toBe(0);

    const e2 = small();
    act(() => { result.current.handleWheel(e2); });
    expect(result.current.zoom).toBe(1.05);
    expect(result.current.panX).toBe(9.523809523809547);

    // Accumulator reset after firing: this alone (-15) must not fire again.
    const e3 = small();
    act(() => { result.current.handleWheel(e3); });
    expect(result.current.zoom).toBe(1.05);
  });

  it('consecutive wheel gestures compound multiplicatively and clamp at MIN/MAX_ZOOM', () => {
    const { result } = renderHook(() => useZoomPan({ current: makeSvg() }));
    act(() => { result.current.handleWheel(wheelEvent(-30)); });
    act(() => { result.current.handleWheel(wheelEvent(-30)); });
    expect(result.current.zoom).toBe(1.1025);

    // Pinch-in at the ceiling: extra wheel events hold the exact max.
    act(() => { result.current.resetView(); });
    act(() => {
      for (let i = 0; i < 7; i++) result.current.zoomIn();
    });
    expect(result.current.zoom).toBe(MAX_ZOOM);
    act(() => { result.current.handleWheel(wheelEvent(-300)); });
    expect(result.current.zoom).toBe(MAX_ZOOM);

    // Pinch-out at the floor: hold the exact min.
    act(() => { result.current.resetView(); });
    act(() => {
      for (let i = 0; i < 7; i++) result.current.zoomOut();
    });
    expect(result.current.zoom).toBe(MIN_ZOOM);
    act(() => { result.current.handleWheel(wheelEvent(300)); });
    expect(result.current.zoom).toBe(MIN_ZOOM);
  });
});
