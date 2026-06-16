import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePopup from './usePopup.js';

describe('usePopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with popupHtml as null', () => {
    const buildHtml = vi.fn(() => '<p>Test</p>');
    const { result } = renderHook(() => usePopup(buildHtml));
    expect(result.current.popupHtml).toBeNull();
    expect(result.current.showPopup).toBeDefined();
    expect(result.current.setPopupHtml).toBeDefined();
  });

  it('should call buildHtml with entity when showPopup is called', () => {
    const buildHtml = vi.fn(() => '<p>Test</p>');
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1, name: 'Test Entity' });
    });
    expect(buildHtml).toHaveBeenCalledWith({ id: 1, name: 'Test Entity' });
  });

  it('should set popupHtml when buildHtml returns non-null HTML', () => {
    const buildHtml = vi.fn(() => '<p>Test HTML</p>');
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBe('<p>Test HTML</p>');
  });

  it('should not set popupHtml when buildHtml returns null', () => {
    const buildHtml = vi.fn(() => null);
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBeNull();
  });

  it('should not set popupHtml when buildHtml returns empty string', () => {
    const buildHtml = vi.fn(() => '');
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBeNull();
  });

  it('should not set popupHtml when buildHtml returns 0', () => {
    const buildHtml = vi.fn(() => 0);
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBeNull();
  });

  it('should not set popupHtml when buildHtml returns false', () => {
    const buildHtml = vi.fn(() => false);
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBeNull();
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

  it('should return setPopupHtml function', () => {
    const buildHtml = vi.fn(() => '<p>Test</p>');
    const { result } = renderHook(() => usePopup(buildHtml));
    expect(typeof result.current.setPopupHtml).toBe('function');
  });

  it('should allow direct setPopupHtml calls', () => {
    const buildHtml = vi.fn(() => '<p>Test</p>');
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.setPopupHtml('<p>Direct set</p>');
    });
    expect(result.current.popupHtml).toBe('<p>Direct set</p>');
  });

  it('should handle buildHtml that returns HTML with special characters', () => {
    const buildHtml = vi.fn(() => '<p>Test &amp; "quotes" &lt;tags&gt;</p>');
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBe('<p>Test &amp; "quotes" &lt;tags&gt;</p>');
  });

  it('should handle buildHtml that returns HTML with newlines', () => {
    const buildHtml = vi.fn(() => '<p>Line 1\nLine 2</p>');
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBe('<p>Line 1\nLine 2</p>');
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

  it('should handle buildHtml that returns HTML with embedded scripts', () => {
    const buildHtml = vi.fn(() => '<p>Safe HTML</p><script>alert(1)</script>');
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBe('<p>Safe HTML</p><script>alert(1)</script>');
  });

  it('should handle buildHtml that returns undefined', () => {
    const buildHtml = vi.fn(() => undefined);
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBeNull();
  });

  it('should set popupHtml when buildHtml returns a number (truthy)', () => {
    const buildHtml = vi.fn(() => 42);
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toBe(42);
  });

  it('should set popupHtml when buildHtml returns an object (truthy)', () => {
    const buildHtml = vi.fn(() => ({ html: 'test' }));
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup({ id: 1 });
    });
    expect(result.current.popupHtml).toEqual({ html: 'test' });
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

  it('should handle showPopup with null entity', () => {
    const buildHtml = vi.fn(() => '<p>Test</p>');
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup(null);
    });
    expect(buildHtml).toHaveBeenCalledWith(null);
    expect(result.current.popupHtml).toBe('<p>Test</p>');
  });

  it('should handle showPopup with undefined entity', () => {
    const buildHtml = vi.fn(() => '<p>Test</p>');
    const { result } = renderHook(() => usePopup(buildHtml));
    act(() => {
      result.current.showPopup(undefined);
    });
    expect(buildHtml).toHaveBeenCalledWith(undefined);
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
});
