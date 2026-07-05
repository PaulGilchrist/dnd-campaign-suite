// @cleaned-by-ai
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import usePopup from './usePopup.js';

describe('usePopup', () => {
  describe('initialization', () => {
    it('should initialize with popupHtml as null and required functions defined', () => {
      const buildHtml = vi.fn(() => '<p>Test</p>');
      const { result } = renderHook(() => usePopup(buildHtml));
      expect(result.current.popupHtml).toBeNull();
      expect(result.current.showPopup).toBeInstanceOf(Function);
      expect(result.current.setPopupHtml).toBeInstanceOf(Function);
    });
  });

  describe('showPopup behavior', () => {
    it('should call buildHtml with the entity and set popupHtml when truthy', () => {
      const buildHtml = vi.fn(() => '<p>Test HTML</p>');
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.showPopup({ id: 1, name: 'Test Entity' });
      });
      expect(buildHtml).toHaveBeenCalledWith({ id: 1, name: 'Test Entity' });
      expect(result.current.popupHtml).toBe('<p>Test HTML</p>');
    });

    it('should pass the entity to buildHtml correctly', () => {
      const buildHtml = vi.fn((entity) => `<div>${entity.id}</div>`);
      const entity = { id: 42, type: 'monster', hp: 100 };
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.showPopup(entity);
      });
      expect(buildHtml).toHaveBeenCalledWith(entity);
      expect(result.current.popupHtml).toBe('<div>42</div>');
    });

    it('should handle showPopup with null or undefined entity', () => {
      const buildHtml = vi.fn(() => '<p>Test</p>');
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.showPopup(null);
      });
      expect(buildHtml).toHaveBeenNthCalledWith(1, null);
      act(() => {
        result.current.showPopup(undefined);
      });
      expect(buildHtml).toHaveBeenNthCalledWith(2, undefined);
      expect(result.current.popupHtml).toBe('<p>Test</p>');
    });

    it('should handle showPopup with empty object entity', () => {
      const buildHtml = vi.fn((entity) => `<p>${JSON.stringify(entity)}</p>`);
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.showPopup({});
      });
      expect(result.current.popupHtml).toBe('<p>{}</p>');
    });

    it('should update popupHtml on subsequent showPopup calls', () => {
      const buildHtml = vi.fn((entity) => `<p>${entity.name}</p>`);
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.showPopup({ name: 'First' });
      });
      expect(result.current.popupHtml).toBe('<p>First</p>');
      act(() => {
        result.current.showPopup({ name: 'Second' });
      });
      expect(result.current.popupHtml).toBe('<p>Second</p>');
    });

    it('should handle buildHtml that throws an error', () => {
      const buildHtml = vi.fn(() => { throw new Error('Build error'); });
      const { result } = renderHook(() => usePopup(buildHtml));
      expect(() => {
        act(() => {
          result.current.showPopup({ id: 1 });
        });
      }).toThrow('Build error');
      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('falsy buildHtml return values', () => {
    const falsyValues = [null, '', 0, false, undefined];
    for (const falsyVal of falsyValues) {
      it(`should not set popupHtml when buildHtml returns ${JSON.stringify(falsyVal)}`, () => {
        const buildHtml = vi.fn(() => falsyVal);
        const { result } = renderHook(() => usePopup(buildHtml));
        act(() => {
          result.current.showPopup({ id: 1 });
        });
        expect(result.current.popupHtml).toBeNull();
      });
    }
  });

  describe('truthy buildHtml return values', () => {
    it('should set popupHtml when buildHtml returns a number', () => {
      const buildHtml = vi.fn(() => 42);
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.showPopup({ id: 1 });
      });
      expect(result.current.popupHtml).toBe(42);
    });

    it('should set popupHtml when buildHtml returns an object', () => {
      const buildHtml = vi.fn(() => ({ html: 'test' }));
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.showPopup({ id: 1 });
      });
      expect(result.current.popupHtml).toEqual({ html: 'test' });
    });
  });

  describe('setPopupHtml direct usage', () => {
    it('should allow direct setPopupHtml calls', () => {
      const buildHtml = vi.fn(() => '<p>Test</p>');
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.setPopupHtml('<p>Direct set</p>');
      });
      expect(result.current.popupHtml).toBe('<p>Direct set</p>');
    });
  });

  describe('buildHtml edge cases', () => {
    it('should handle buildHtml that returns HTML with special characters, newlines, and embedded scripts', () => {
      const buildHtml = vi.fn(() => '<p>Line 1\nLine 2</p><script>alert(1)</script>');
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.showPopup({ id: 1 });
      });
      expect(result.current.popupHtml).toBe('<p>Line 1\nLine 2</p><script>alert(1)</script>');
    });

    it('should handle buildHtml that returns very long HTML', () => {
      const longHtml = '<p>' + 'x'.repeat(10000) + '</p>';
      const buildHtml = vi.fn(() => longHtml);
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => {
        result.current.showPopup({ id: 1 });
      });
      expect(result.current.popupHtml).toBe(longHtml);
    });
  });

  describe('DOM rendering', () => {
    function TestComponent({ buildHtml }) {
      const { showPopup, popupHtml, setPopupHtml } = usePopup(buildHtml);
      return (
        <div>
          <button onClick={() => showPopup({ name: 'Test' })}>Show Popup</button>
          <button onClick={() => setPopupHtml('<p>New HTML</p>')}>Set HTML</button>
          {popupHtml && <div data-testid="popup" dangerouslySetInnerHTML={{ __html: popupHtml }} />}
        </div>
      );
    }

    it('should return showPopup function and render the buttons', () => {
      const buildHtml = vi.fn(() => '<p>Test HTML</p>');
      render(<TestComponent buildHtml={buildHtml} />);
      expect(screen.getByText('Show Popup')).toBeInTheDocument();
      expect(screen.getByText('Set HTML')).toBeInTheDocument();
    });

    it('should call buildHtml with the entity and display the popup', () => {
      const buildHtml = vi.fn(() => '<p>Test HTML</p>');
      render(<TestComponent buildHtml={buildHtml} />);
      fireEvent.click(screen.getByText('Show Popup'));
      expect(buildHtml).toHaveBeenCalledWith({ name: 'Test' });
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    it('should not display popup when buildHtml returns null', () => {
      const buildHtml = vi.fn(() => null);
      render(<TestComponent buildHtml={buildHtml} />);
      fireEvent.click(screen.getByText('Show Popup'));
      expect(buildHtml).toHaveBeenCalled();
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    it('should not display popup when buildHtml returns empty string', () => {
      const buildHtml = vi.fn(() => '');
      render(<TestComponent buildHtml={buildHtml} />);
      fireEvent.click(screen.getByText('Show Popup'));
      expect(buildHtml).toHaveBeenCalled();
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    it('should update the popup content with custom HTML', () => {
      const buildHtml = vi.fn(() => '<p>Test</p>');
      render(<TestComponent buildHtml={buildHtml} />);
      fireEvent.click(screen.getByText('Set HTML'));
      expect(screen.getByTestId('popup')).toBeInTheDocument();
      expect(screen.getByTestId('popup').innerHTML).toBe('<p>New HTML</p>');
    });
  });
});
