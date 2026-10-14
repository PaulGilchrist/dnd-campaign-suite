import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import usePopup from './usePopup.js';

describe('usePopup', () => {
  describe('initialization', () => {
    it('should return showPopup, popupHtml, and setPopupHtml', () => {
      const { result } = renderHook(() => usePopup(() => ''));
      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
    });

    it('should initialize popupHtml to null', () => {
      const { result } = renderHook(() => usePopup(() => ''));
      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('showPopup', () => {
    it('should set popupHtml when buildHtml returns a truthy value', () => {
      const buildHtml = vi.fn(() => '<p>hello</p>');
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => result.current.showPopup({ id: 1 }));
      expect(result.current.popupHtml).toBe('<p>hello</p>');
    });

    it('should not set popupHtml when buildHtml returns a falsy value', () => {
      const buildHtml = vi.fn(() => null);
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => result.current.showPopup({ id: 1 }));
      expect(result.current.popupHtml).toBeNull();
    });

    it('should pass the entity to buildHtml', () => {
      const buildHtml = vi.fn(() => '');
      const entity = { type: 'monster', hp: 50 };
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => result.current.showPopup(entity));
      expect(buildHtml).toHaveBeenCalledWith(entity);
    });

    it('should update popupHtml on successive showPopup calls', () => {
      const buildHtml = vi.fn((e) => `<p>${e.name}</p>`);
      const { result } = renderHook(() => usePopup(buildHtml));
      act(() => result.current.showPopup({ name: 'A' }));
      expect(result.current.popupHtml).toBe('<p>A</p>');
      act(() => result.current.showPopup({ name: 'B' }));
      expect(result.current.popupHtml).toBe('<p>B</p>');
    });
  });

  describe('setPopupHtml', () => {
    it('should update popupHtml to any value including null', () => {
      const { result } = renderHook(() => usePopup(() => ''));
      act(() => result.current.setPopupHtml('<p>custom</p>'));
      expect(result.current.popupHtml).toBe('<p>custom</p>');
      act(() => result.current.setPopupHtml(null));
      expect(result.current.popupHtml).toBeNull();
    });
  });
});
