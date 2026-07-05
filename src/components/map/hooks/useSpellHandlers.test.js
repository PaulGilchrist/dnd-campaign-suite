// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useSpellHandlers from './useSpellHandlers.js';
import { OverlayShape, createOverlay } from '../../../models/SpellOverlay.js';

describe('useSpellHandlers', () => {
  const mockShapeParams = {};
  const mockOverlays = [
    createOverlay(OverlayShape.CONE, 5, 5, 90),
    createOverlay(OverlayShape.LINE, 3, 3, 45),
    createOverlay(OverlayShape.SPHERE, 1, 1, 0),
  ];

  const createMocks = () => {
    const getGridFromEvent = vi.fn(() => ({ gridX: 5.3, gridY: 7.8 }));
    const clientToSVG = vi.fn((cx, cy) => ({ x: cx, y: cy }));
    const addOverlay = vi.fn();
    const updateOverlay = vi.fn();
    const updateOverlayImmediate = vi.fn();
    const svgRef = { current: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } };
    return {
      getGridFromEvent,
      clientToSVG,
      addOverlay,
      shapeParams: mockShapeParams,
      updateOverlay,
      updateOverlayImmediate,
      svgRef,
    };
  };

  const getHook = (overrides = {}) => {
    const mocks = { ...createMocks(), ...overrides };
    const { result } = renderHook(() =>
      useSpellHandlers({
        rulerMode: overrides.rulerMode ?? false,
        getGridFromEvent: mocks.getGridFromEvent,
        clientToSVG: mocks.clientToSVG,
        addOverlay: mocks.addOverlay,
        shapeParams: mocks.shapeParams,
        updateOverlay: mocks.updateOverlay,
        updateOverlayImmediate: mocks.updateOverlayImmediate,
        svgRef: mocks.svgRef,
      })
    );
    return { result, mocks };
  };

  describe('handleSpellPointerDown', () => {
    it('should return early if rulerMode is active', () => {
      const { result, mocks } = getHook({ rulerMode: true });
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, OverlayShape.SPHERE, mockOverlays);
      });
      expect(mocks.getGridFromEvent).not.toHaveBeenCalled();
      expect(mocks.addOverlay).not.toHaveBeenCalled();
    });

    it('should not set drag/rotate if hit-test matches sphere (no drag on sphere)', () => {
      const { result } = getHook();
      const sphereOnly = [mockOverlays[2]];
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0, clientX: 200, clientY: 200 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, null, sphereOnly);
      });
      expect(result.current.dragOverlay).toBeNull();
      expect(result.current.rotateOverlay).toBeNull();
    });

    it('should return early if no grid from event', () => {
      const { result, mocks } = getHook();
      mocks.getGridFromEvent.mockReturnValue(null);
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, OverlayShape.SPHERE, mockOverlays);
      });
      expect(mocks.addOverlay).not.toHaveBeenCalled();
    });

    it('should create sphere overlay and add it', () => {
      const { result, mocks } = getHook();
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, OverlayShape.SPHERE, mockOverlays);
      });
      expect(mocks.addOverlay).toHaveBeenCalled();
      const overlay = mocks.addOverlay.mock.calls[0][0];
      expect(overlay.shape).toBe(OverlayShape.SPHERE);
      expect(overlay.startGridX).toBe(5);
      expect(overlay.startGridY).toBe(7);
    });

    it('should create cylinder overlay and add it', () => {
      const { result, mocks } = getHook();
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, OverlayShape.CYLINDER, mockOverlays);
      });
      expect(mocks.addOverlay).toHaveBeenCalled();
      const overlay = mocks.addOverlay.mock.calls[0][0];
      expect(overlay.shape).toBe(OverlayShape.CYLINDER);
    });

    it('should set spellDraft for cone shape', () => {
      const { result } = getHook();
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0, clientX: 100, clientY: 200 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, OverlayShape.CONE, mockOverlays);
      });
      expect(result.current.spellDraft).not.toBeNull();
      expect(result.current.spellDraft.startGridX).toBe(5);
      expect(result.current.spellDraft.startGridY).toBe(7);
      expect(result.current.spellDraft.startScreenX).toBe(100);
      expect(result.current.spellDraft.startScreenY).toBe(200);
      expect(result.current.spellDraft.angle).toBe(0);
    });

    it('should hit-test overlays and set dragOverlay for matching overlay', () => {
      const { result, mocks } = getHook();
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0, clientX: 200, clientY: 200 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, null, mockOverlays);
      });
      expect(mocks.getGridFromEvent).toHaveBeenCalled();
      expect(result.current.dragOverlay).not.toBeNull();
      expect(result.current.dragOverlay.overlayId).toBeDefined();
    });

    it('should set rotateOverlay for cone near edge', () => {
      const mockCone = createOverlay(OverlayShape.CONE, 0, 0, 0);
      const coneOverlays = [mockCone];
      const { result, mocks } = getHook();
      mocks.getGridFromEvent.mockReturnValue({ gridX: 5.3, gridY: 0.8 });
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0, clientX: 200, clientY: 200 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, null, coneOverlays);
      });
      expect(result.current.rotateOverlay).not.toBeNull();
      expect(result.current.rotateOverlay.overlayId).toBe(mockCone.id);
    });

    it('should not set rotate overlay for cone at origin', () => {
      const mockCone = createOverlay(OverlayShape.CONE, 0, 0, 0);
      const coneOverlays = [mockCone];
      const { result, mocks } = getHook();
      mocks.getGridFromEvent.mockReturnValue({ gridX: 0.3, gridY: 0.8 });
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0, clientX: 200, clientY: 200 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, null, coneOverlays);
      });
      expect(result.current.rotateOverlay).toBeNull();
      expect(result.current.dragOverlay).not.toBeNull();
    });

    it('should not drag if right-click (button !== 0)', () => {
      const { result } = getHook();
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 2, clientX: 200, clientY: 200 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, null, mockOverlays);
      });
      expect(result.current.dragOverlay).toBeNull();
      expect(result.current.rotateOverlay).toBeNull();
    });

    it('should not set drag/rotate if hit-test fails (no overlay at grid)', () => {
      const { result, mocks } = getHook();
      mocks.getGridFromEvent.mockReturnValue({ gridX: 99, gridY: 99 });
      const mockEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), button: 0, clientX: 200, clientY: 200 };
      act(() => {
        result.current.handleSpellPointerDown(mockEvent, null, mockOverlays);
      });
      expect(result.current.dragOverlay).toBeNull();
      expect(result.current.rotateOverlay).toBeNull();
    });
  });

  describe('handleSpellPointerMove', () => {
    it('should return early if no spellDraft', () => {
      const { result, mocks } = getHook();
      const mockEvent = { preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellPointerMove(mockEvent, null);
      });
      expect(mocks.getGridFromEvent).not.toHaveBeenCalled();
    });

    it('should update spellDraft angle on move', () => {
      const { result } = getHook();
      const initialDraft = { startScreenX: 100, startScreenY: 100, startGridX: 5, startGridY: 7, angle: 0 };
      act(() => {
        result.current.setSpellDraft(initialDraft);
      });
      const mockEvent = { preventDefault: vi.fn(), clientX: 200, clientY: 200 };
      act(() => {
        result.current.handleSpellPointerMove(mockEvent, initialDraft);
      });
      expect(result.current.spellDraft).not.toBeNull();
      expect(result.current.spellDraft.angle).toBeGreaterThan(0);
    });
  });

  describe('handleSpellPointerUp', () => {
    it('should return early if no spellDraft', () => {
      const { result, mocks } = getHook();
      const mockEvent = { preventDefault: vi.fn(), clientX: 200, clientY: 100 };
      act(() => {
        result.current.handleSpellPointerUp(mockEvent, null, OverlayShape.CONE, mocks.addOverlay, mocks.shapeParams);
      });
      expect(mocks.addOverlay).not.toHaveBeenCalled();
      expect(result.current.spellDraft).toBeNull();
    });

    it('should create overlay with computed angle and add it', () => {
      const { result, mocks } = getHook();
      const initialDraft = { startScreenX: 100, startScreenY: 100, startGridX: 5, startGridY: 7, angle: 0 };
      const mockEvent = { preventDefault: vi.fn(), clientX: 200, clientY: 100 };
      act(() => {
        result.current.handleSpellPointerUp(mockEvent, initialDraft, OverlayShape.CONE, mocks.addOverlay, mocks.shapeParams);
      });
      expect(mocks.addOverlay).toHaveBeenCalled();
      const overlay = mocks.addOverlay.mock.calls[0][0];
      expect(overlay.shape).toBe(OverlayShape.CONE);
      expect(overlay.startGridX).toBe(5);
      expect(overlay.startGridY).toBe(7);
      expect(result.current.spellDraft).toBeNull();
    });

    it('should clear spellDraft after creating overlay', () => {
      const { result, mocks } = getHook();
      const initialDraft = { startScreenX: 100, startScreenY: 100, startGridX: 3, startGridY: 4, angle: 0 };
      const mockEvent = { preventDefault: vi.fn(), clientX: 150, clientY: 150 };
      act(() => {
        result.current.handleSpellPointerUp(mockEvent, initialDraft, OverlayShape.LINE, mocks.addOverlay, mocks.shapeParams);
      });
      expect(result.current.spellDraft).toBeNull();
    });
  });

  describe('handleSpellDragMove', () => {
    it('should update overlay position for dragOverlay', () => {
      const { result, mocks } = getHook();
      const dragOv = { overlayId: mockOverlays[0].id, offsetX: 0, offsetY: 0 };
      const mockEvent = { preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragMove(mockEvent, dragOv, null, mockOverlays);
      });
      expect(mocks.updateOverlay).toHaveBeenCalled();
      const updated = mocks.updateOverlay.mock.calls[0][0];
      expect(updated.startGridX).toBe(5);
      expect(updated.startGridY).toBe(7);
    });

    it('should compute offset correctly for drag move', () => {
      const { result, mocks } = getHook();
      const dragOv = { overlayId: mockOverlays[0].id, offsetX: 1, offsetY: 2 };
      const mockEvent = { preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragMove(mockEvent, dragOv, null, mockOverlays);
      });
      expect(mocks.updateOverlay).toHaveBeenCalled();
      const updated = mocks.updateOverlay.mock.calls[0][0];
      expect(updated.startGridX).toBe(4);
      expect(updated.startGridY).toBe(5);
    });

    it('should update overlay angle for rotateOverlay', () => {
      const { result, mocks } = getHook();
      const rotateOv = {
        overlayId: mockOverlays[0].id,
        originX: 210,
        originY: 210,
        startAngle: 90,
        offsetAngle: 0,
      };
      mocks.clientToSVG.mockReturnValue({ x: 300, y: 210 });
      const mockEvent = { preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragMove(mockEvent, null, rotateOv, mockOverlays);
      });
      expect(mocks.updateOverlay).toHaveBeenCalled();
      const updated = mocks.updateOverlay.mock.calls[0][0];
      expect(updated.angle).toBeGreaterThan(0);
      expect(updated.angle).toBeLessThan(360);
    });

    it('should return early if dragOverlay or rotateOverlay references missing overlay', () => {
      const { result, mocks } = getHook();
      const mockEvent = { preventDefault: vi.fn() };

      const dragOv = { overlayId: 'nonexistent', offsetX: 0, offsetY: 0 };
      act(() => {
        result.current.handleSpellDragMove(mockEvent, dragOv, null, mockOverlays);
      });
      expect(mocks.updateOverlay).not.toHaveBeenCalled();

      const rotateOv = {
        overlayId: 'nonexistent',
        originX: 210,
        originY: 210,
        startAngle: 90,
        offsetAngle: 0,
      };
      act(() => {
        result.current.handleSpellDragMove(mockEvent, null, rotateOv, mockOverlays);
      });
      expect(mocks.updateOverlay).not.toHaveBeenCalled();
    });

    it('should do nothing if neither dragOverlay nor rotateOverlay', () => {
      const { result, mocks } = getHook();
      const mockEvent = { preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragMove(mockEvent, null, null, mockOverlays);
      });
      expect(mocks.updateOverlay).not.toHaveBeenCalled();
    });

    it('should handle negative angle wrap-around for rotation', () => {
      const { result, mocks } = getHook();
      const rotateOv = {
        overlayId: mockOverlays[0].id,
        originX: 210,
        originY: 210,
        startAngle: 90,
        offsetAngle: 100,
      };
      mocks.clientToSVG.mockReturnValue({ x: 210, y: 300 });
      const mockEvent = { preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragMove(mockEvent, null, rotateOv, mockOverlays);
      });
      expect(mocks.updateOverlay).toHaveBeenCalled();
      const updated = mocks.updateOverlay.mock.calls[0][0];
      expect(updated.angle).toBeGreaterThanOrEqual(0);
      expect(updated.angle).toBeLessThan(360);
    });
  });

  describe('handleSpellDragEnd', () => {
    it('should update overlay position immediately on drag end', () => {
      const { result, mocks } = getHook();
      const dragOv = { overlayId: mockOverlays[0].id, offsetX: 0, offsetY: 0 };
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragEnd(mockEvent, dragOv, null, mockOverlays, mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).toHaveBeenCalled();
      const updated = mocks.updateOverlayImmediate.mock.calls[0][0];
      expect(updated.startGridX).toBe(5);
      expect(updated.startGridY).toBe(7);
      expect(result.current.dragOverlay).toBeNull();
    });

    it('should update overlay angle immediately on rotate end', () => {
      const { result, mocks } = getHook();
      const rotateOv = {
        overlayId: mockOverlays[0].id,
        originX: 210,
        originY: 210,
        startAngle: 90,
        offsetAngle: 0,
      };
      mocks.clientToSVG.mockReturnValue({ x: 300, y: 210 });
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragEnd(mockEvent, null, rotateOv, mockOverlays, mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).toHaveBeenCalled();
      const updated = mocks.updateOverlayImmediate.mock.calls[0][0];
      expect(updated.angle).toBeGreaterThan(0);
      expect(updated.angle).toBeLessThan(360);
      expect(result.current.rotateOverlay).toBeNull();
    });

    it('should release pointer capture on svgRef', () => {
      const { result, mocks } = getHook();
      const dragOv = { overlayId: mockOverlays[0].id, offsetX: 0, offsetY: 0 };
      const mockEvent = { pointerId: 42, preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragEnd(mockEvent, dragOv, null, mockOverlays, mocks.svgRef);
      });
      expect(mocks.svgRef.current.releasePointerCapture).toHaveBeenCalledWith(42);
    });

    it('should reset spellDragActiveRef to false', () => {
      const { result } = getHook();
      act(() => {
        result.current.spellDragActiveRef.current = true;
      });
      expect(result.current.spellDragActiveRef.current).toBe(true);
      const dragOv = { overlayId: mockOverlays[0].id, offsetX: 0, offsetY: 0 };
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragEnd(mockEvent, dragOv, null, mockOverlays, { current: { releasePointerCapture: vi.fn() } });
      });
      expect(result.current.spellDragActiveRef.current).toBe(false);
    });

    it('should do nothing if drag or rotate overlay id not found', () => {
      const { result, mocks } = getHook();
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };

      const dragOv = { overlayId: 'nonexistent', offsetX: 0, offsetY: 0 };
      act(() => {
        result.current.handleSpellDragEnd(mockEvent, dragOv, null, mockOverlays, mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).not.toHaveBeenCalled();
      expect(result.current.dragOverlay).toBeNull();

      const rotateOv = {
        overlayId: 'nonexistent',
        originX: 210,
        originY: 210,
        startAngle: 90,
        offsetAngle: 0,
      };
      act(() => {
        result.current.handleSpellDragEnd(mockEvent, null, rotateOv, mockOverlays, mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).not.toHaveBeenCalled();
      expect(result.current.rotateOverlay).toBeNull();
    });

    it('should not call releasePointerCapture if svgRef.current is null', () => {
      const { result, mocks } = getHook({ svgRef: { current: null } });
      const dragOv = { overlayId: mockOverlays[0].id, offsetX: 0, offsetY: 0 };
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragEnd(mockEvent, dragOv, null, mockOverlays, mocks.svgRef);
      });
      expect(result.current.spellDragActiveRef.current).toBe(false);
    });

    it('should not update if no grid on drag end', () => {
      const { result, mocks } = getHook();
      mocks.getGridFromEvent.mockReturnValue(null);
      const dragOv = { overlayId: mockOverlays[0].id, offsetX: 0, offsetY: 0 };
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragEnd(mockEvent, dragOv, null, mockOverlays, mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).not.toHaveBeenCalled();
      expect(result.current.dragOverlay).toBeNull();
    });

    it('should not update angle if clientToSVG returns null on rotate end', () => {
      const { result, mocks } = getHook();
      const rotateOv = {
        overlayId: mockOverlays[0].id,
        originX: 210,
        originY: 210,
        startAngle: 90,
        offsetAngle: 0,
      };
      mocks.clientToSVG.mockReturnValue(null);
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleSpellDragEnd(mockEvent, null, rotateOv, mockOverlays, mocks.svgRef);
      });
      expect(mocks.updateOverlayImmediate).not.toHaveBeenCalled();
      expect(result.current.rotateOverlay).toBeNull();
    });
  });
});
