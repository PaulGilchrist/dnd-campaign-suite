// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useRuler from './useRuler.js';

describe('useRuler', () => {
  const createMockEvent = (_gx, _gy) => ({
    preventDefault: vi.fn(),
    pointerId: 1,
  });

  const createMockGrid = (gx, gy) => ({
    gridX: gx,
    gridY: gy,
  });

  const createMockSvgRef = () => ({ current: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } });

  const getHook = () => {
    const { result } = renderHook(() => useRuler());
    return result;
  };

  describe('initial state', () => {
    it('should start with rulerMode false and all positions null', () => {
      const result = getHook();
      expect(result.current.rulerMode).toBe(false);
      expect(result.current.rulerStart).toBeNull();
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
    });
  });

  describe('setRulerMode', () => {
    it('should reset ruler state when disabling ruler mode', () => {
      const { result } = renderHook(() => useRuler());
      act(() => {
        result.current.setRulerMode(true);
      });
      const mockEvent1 = createMockEvent(1.5, 2.7);
      const mockSvgRef = createMockSvgRef();
      const mockGetGrid1 = createMockGrid(1.5, 2.7);
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent1,
          true,
          null,
          null,
          () => mockGetGrid1,
          mockSvgRef
        );
      });
      const mockEvent2 = createMockEvent(5.3, 6.8);
      const mockGetGrid2 = createMockGrid(5.3, 6.8);
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent2,
          true,
          result.current.rulerStart,
          result.current.rulerEnd,
          () => mockGetGrid2,
          mockSvgRef
        );
      });
      const mockEvent3 = createMockEvent(3, 3);
      const mockGetGrid3 = createMockGrid(3, 3);
      act(() => {
        result.current.handleRulerPointerMove(
          mockEvent3,
          true,
          result.current.rulerStart,
          null,
          () => mockGetGrid3
        );
      });
      expect(result.current.rulerStart).toEqual({ gridX: 1, gridY: 2 });
      expect(result.current.rulerEnd).toEqual({ gridX: 5, gridY: 6 });
      expect(result.current.rulerPreview).toEqual({ gridX: 3, gridY: 3 });
      act(() => {
        result.current.setRulerMode(false);
      });
      expect(result.current.rulerStart).toBeNull();
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
    });
  });

  describe('handleRulerPointerDown', () => {
    it('should do nothing when rulerMode is false', () => {
      const result = getHook();
      const mockEvent = createMockEvent(1, 1);
      const mockSvgRef = createMockSvgRef();
      const mockGetGrid = createMockGrid(1, 1);
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent,
          false,
          null,
          null,
          () => mockGetGrid,
          mockSvgRef
        );
      });
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.rulerStart).toBeNull();
    });

    it('should do nothing when getGridFromEvent returns null', () => {
      const result = getHook();
      const mockEvent = createMockEvent(1, 1);
      const mockSvgRef = createMockSvgRef();
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent,
          true,
          null,
          null,
          () => null,
          mockSvgRef
        );
      });
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.rulerStart).toBeNull();
    });

    it('should set rulerStart on first click', () => {
      const result = getHook();
      const mockEvent = createMockEvent(1.5, 2.7);
      const mockSvgRef = createMockSvgRef();
      const mockGetGrid = createMockGrid(1.5, 2.7);
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent,
          true,
          null,
          null,
          () => mockGetGrid,
          mockSvgRef
        );
      });
      expect(result.current.rulerStart).toEqual({ gridX: 1, gridY: 2 });
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should capture pointer on svg element', () => {
      const result = getHook();
      const mockEvent = createMockEvent(1, 1);
      const mockSvgRef = createMockSvgRef();
      const mockGetGrid = createMockGrid(1, 1);
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent,
          true,
          null,
          null,
          () => mockGetGrid,
          mockSvgRef
        );
      });
      expect(mockSvgRef.current.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('should set rulerEnd on second click', () => {
      const result = getHook();
      const mockEvent1 = createMockEvent(1.5, 2.7);
      const mockEvent2 = createMockEvent(5.3, 6.8);
      const mockSvgRef = createMockSvgRef();
      const mockGetGrid1 = createMockGrid(1.5, 2.7);
      const mockGetGrid2 = createMockGrid(5.3, 6.8);
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent1,
          true,
          null,
          null,
          () => mockGetGrid1,
          mockSvgRef
        );
      });
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent2,
          true,
          result.current.rulerStart,
          result.current.rulerEnd,
          () => mockGetGrid2,
          mockSvgRef
        );
      });
      expect(result.current.rulerEnd).toEqual({ gridX: 5, gridY: 6 });
      expect(result.current.rulerPreview).toBeNull();
    });

    it('should reset and start new ruler on third click', () => {
      const result = getHook();
      const mockEvent1 = createMockEvent(1.5, 2.7);
      const mockEvent2 = createMockEvent(5.3, 6.8);
      const mockEvent3 = createMockEvent(10.1, 11.9);
      const mockSvgRef = createMockSvgRef();
      const mockGetGrid1 = createMockGrid(1.5, 2.7);
      const mockGetGrid2 = createMockGrid(5.3, 6.8);
      const mockGetGrid3 = createMockGrid(10.1, 11.9);
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent1,
          true,
          null,
          null,
          () => mockGetGrid1,
          mockSvgRef
        );
      });
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent2,
          true,
          result.current.rulerStart,
          result.current.rulerEnd,
          () => mockGetGrid2,
          mockSvgRef
        );
      });
      act(() => {
        result.current.handleRulerPointerDown(
          mockEvent3,
          true,
          result.current.rulerStart,
          result.current.rulerEnd,
          () => mockGetGrid3,
          mockSvgRef
        );
      });
      expect(result.current.rulerStart).toEqual({ gridX: 10, gridY: 11 });
      expect(result.current.rulerEnd).toBeNull();
      expect(result.current.rulerPreview).toBeNull();
    });
  });

  describe('handleRulerPointerMove', () => {
    it('should do nothing when rulerMode is false', () => {
      const result = getHook();
      const mockEvent = createMockEvent(3, 4);
      act(() => {
        result.current.handleRulerPointerMove(
          mockEvent,
          false,
          { gridX: 1, gridY: 1 },
          null,
          () => createMockGrid(3, 4)
        );
      });
      expect(result.current.rulerPreview).toBeNull();
    });

    it('should do nothing when rulerStart is null', () => {
      const result = getHook();
      const mockEvent = createMockEvent(3, 4);
      act(() => {
        result.current.handleRulerPointerMove(
          mockEvent,
          true,
          null,
          null,
          () => createMockGrid(3, 4)
        );
      });
      expect(result.current.rulerPreview).toBeNull();
    });

    it('should do nothing when rulerEnd is already set', () => {
      const result = getHook();
      const mockEvent = createMockEvent(3, 4);
      act(() => {
        result.current.handleRulerPointerMove(
          mockEvent,
          true,
          { gridX: 1, gridY: 1 },
          { gridX: 2, gridY: 2 },
          () => createMockGrid(3, 4)
        );
      });
      expect(result.current.rulerPreview).toBeNull();
    });

    it('should update rulerPreview on move', () => {
      const result = getHook();
      const mockEvent = createMockEvent(5.7, 6.3);
      act(() => {
        result.current.handleRulerPointerMove(
          mockEvent,
          true,
          { gridX: 1, gridY: 1 },
          null,
          () => createMockGrid(5.7, 6.3)
        );
      });
      expect(result.current.rulerPreview).toEqual({ gridX: 5, gridY: 6 });
    });

    it('should do nothing when getGridFromEvent returns null', () => {
      const result = getHook();
      const mockEvent = createMockEvent(3, 4);
      act(() => {
        result.current.handleRulerPointerMove(
          mockEvent,
          true,
          { gridX: 1, gridY: 1 },
          null,
          () => null
        );
      });
      expect(result.current.rulerPreview).toBeNull();
    });
  });

  describe('handleRulerPointerUp', () => {
    it('should do nothing when rulerMode is false', () => {
      const result = getHook();
      const mockEvent = createMockEvent(1, 1);
      const mockSvgRef = createMockSvgRef();
      act(() => {
        result.current.handleRulerPointerUp(
          mockEvent,
          false,
          mockSvgRef
        );
      });
      expect(mockSvgRef.current.releasePointerCapture).not.toHaveBeenCalled();
    });

    it('should release pointer capture on svg element', () => {
      const result = getHook();
      const mockEvent = createMockEvent(1, 1);
      const mockSvgRef = createMockSvgRef();
      act(() => {
        result.current.handleRulerPointerUp(
          mockEvent,
          true,
          mockSvgRef
        );
      });
      expect(mockSvgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
    });
  });
});
