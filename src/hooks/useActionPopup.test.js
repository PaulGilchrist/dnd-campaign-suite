import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useActionPopup, {
  buildFeatureDetailHtml,
  buildAbilityDetailHtml,
} from './useActionPopup.js';

vi.mock('./usePopup.js', () => ({
  default: (buildHtml) => {
    const React = require('react');
    const [popupHtml, setPopupHtml] = React.useState(null);
    const showPopup = React.useCallback((entity) => {
      const html = buildHtml(entity);
      if (html) {
        setPopupHtml(html);
      }
    }, [buildHtml]);
    return { showPopup, popupHtml, setPopupHtml };
  },
}));

describe('useActionPopup', () => {
  describe('buildFeatureDetailHtml', () => {
    it('should return HTML with name, description, and details', () => {
      const entity = {
        name: 'Second Wind',
        description: 'You have a limited well of stamina.',
        details: 'You can use a bonus action to regain 1d10 + fighter level hit points.',
      };

      const result = buildFeatureDetailHtml(entity);
      expect(result).toBe(
        '<b>Second Wind</b><br/>You have a limited well of stamina.<br/><br/>You can use a bonus action to regain 1d10 + fighter level hit points.'
      );
    });

    it('should return null when entity has no details', () => {
      const entity = {
        name: 'Simple Feature',
        description: 'Just a description.',
      };

      const result = buildFeatureDetailHtml(entity);
      expect(result).toBeNull();
    });

    it('should return null when details is empty string', () => {
      const entity = {
        name: 'Simple Feature',
        description: 'Just a description.',
        details: '',
      };

      const result = buildFeatureDetailHtml(entity);
      expect(result).toBeNull();
    });
  });

  describe('buildAbilityDetailHtml', () => {
    it('should return a function that looks up ability by name', () => {
      const allAbilityScores = [
        { full_name: 'Strength', desc: 'Measures physical power.' },
        { full_name: 'Dexterity', desc: 'Measures agility.' },
      ];

      const lookup = buildAbilityDetailHtml(allAbilityScores);

      const result = lookup('Strength');
      expect(result).toBe('<h3>Strength</h3>Measures physical power.<br/>');
    });

    it('should return null for unknown ability', () => {
      const allAbilityScores = [
        { full_name: 'Strength', desc: 'Measures physical power.' },
      ];

      const lookup = buildAbilityDetailHtml(allAbilityScores);

      const result = lookup('Unknown');
      expect(result).toBeNull();
    });

    it('should match full_name case-sensitively', () => {
      const allAbilityScores = [
        { full_name: 'Strength', desc: 'Measures physical power.' },
      ];

      const lookup = buildAbilityDetailHtml(allAbilityScores);

      const result = lookup('strength');
      expect(result).toBeNull();
    });
  });

  describe('preset selection', () => {
    it('should return showPopup, popupHtml, and setPopupHtml for feature preset', () => {
      const { result } = renderHook(() => useActionPopup('feature'));

      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
      expect(typeof result.current.showPopup).toBe('function');
    });

    it('should return handlers for spell preset', () => {
      const { result } = renderHook(() => useActionPopup('spell'));

      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
    });

    it('should return handlers for ability preset', () => {
      const { result } = renderHook(() =>
        useActionPopup('ability', { allAbilityScores: [] })
      );

      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
    });

    it('should return handlers for custom function preset', () => {
      const customHandler = (entity) => `<b>${entity.name}</b>`;
      const { result } = renderHook(() => useActionPopup(customHandler));

      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
    });

    it('should return null handler for unknown preset', () => {
      const { result } = renderHook(() => useActionPopup('unknown'));

      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
    });
  });

  describe('showPopup behavior', () => {
    it('should set popupHtml when buildHtml returns content', () => {
      const { result } = renderHook(() => useActionPopup('feature'));

      act(() => {
        result.current.showPopup({
          name: 'Test',
          description: 'Desc',
          details: 'Details here',
        });
      });

      expect(result.current.popupHtml).toContain('<b>Test</b>');
    });

    it('should not set popupHtml when buildHtml returns null', () => {
      const { result } = renderHook(() => useActionPopup('feature'));

      act(() => {
        result.current.showPopup({ name: 'Test', description: 'Desc' });
      });

      expect(result.current.popupHtml).toBeNull();
    });

    it('should use custom function when passed as preset', () => {
      const customHandler = (entity) => `<b>${entity.name}</b>`;
      const { result } = renderHook(() => useActionPopup(customHandler));

      act(() => {
        result.current.showPopup({ name: 'Fireball' });
      });

      expect(result.current.popupHtml).toBe('<b>Fireball</b>');
    });

    it('should not show popup for unknown preset', () => {
      const { result } = renderHook(() => useActionPopup('unknown'));

      act(() => {
        result.current.showPopup({ name: 'Test', details: 'Stuff' });
      });

      expect(result.current.popupHtml).toBeNull();
    });
  });
});
