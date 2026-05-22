import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useActionPopup, {
  buildFeatureDetailHtml,
  buildAbilityDetailHtml,
} from './useActionPopup.js';

describe('buildFeatureDetailHtml', () => {
  it('returns HTML string when entity has details', () => {
    const entity = {
      name: 'Rage',
      description: 'Enter a rage',
      details: 'Lasts 1 minute',
    };
    const result = buildFeatureDetailHtml(entity);
    expect(result).toBe(
      '<b>Rage</b><br/>Enter a rage<br/><br/>Lasts 1 minute'
    );
  });

  it('returns null when entity has no details key', () => {
    const entity = {
      name: 'Rage',
      description: 'Enter a rage',
    };
    expect(buildFeatureDetailHtml(entity)).toBeNull();
  });

  it('returns null when details is an empty string', () => {
    const entity = {
      name: 'Rage',
      description: 'Enter a rage',
      details: '',
    };
    expect(buildFeatureDetailHtml(entity)).toBeNull();
  });
});

describe('buildAbilityDetailHtml', () => {
  const mockAbilityScores = [
    { full_name: 'Strength', desc: 'Strength measures bodily power.' },
    { full_name: 'Dexterity', desc: 'Dexterity measures agility.' },
  ];

  it('returns a function', () => {
    const handler = buildAbilityDetailHtml(mockAbilityScores);
    expect(typeof handler).toBe('function');
  });

  it('returned function returns HTML when name matches an ability score', () => {
    const handler = buildAbilityDetailHtml(mockAbilityScores);
    const result = handler('Strength');
    expect(result).toBe('<h3>Strength</h3>Strength measures bodily power.<br/>');
  });

  it('returned function returns null when name does not match', () => {
    const handler = buildAbilityDetailHtml(mockAbilityScores);
    expect(handler('Charisma')).toBeNull();
  });

  it('returned function returns null with empty array', () => {
    const handler = buildAbilityDetailHtml([]);
    expect(handler('Strength')).toBeNull();
  });
});

describe('useActionPopup', () => {
  describe('preset: "feature"', () => {
    it('sets popupHtml when showPopup is called with a feature that has details', () => {
      const { result } = renderHook(() => useActionPopup('feature'));

      expect(result.current.popupHtml).toBeNull();

      act(() => {
        result.current.showPopup({
          name: 'Rage',
          description: 'Enter a rage',
          details: 'Lasts 1 minute',
        });
      });

      expect(result.current.popupHtml).toBe(
        '<b>Rage</b><br/>Enter a rage<br/><br/>Lasts 1 minute'
      );
    });

    it('leaves popupHtml as null when feature lacks details', () => {
      const { result } = renderHook(() => useActionPopup('feature'));

      act(() => {
        result.current.showPopup({
          name: 'Rage',
          description: 'Enter a rage',
        });
      });

      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('preset: "spell"', () => {
    it('sets popupHtml when showPopup is called with a spell that has a desc', () => {
      const { result } = renderHook(() => useActionPopup('spell'));

      act(() => {
        result.current.showPopup({
          name: 'Fireball',
          desc: 'A bright streak flashes from your finger.',
        });
      });

      expect(result.current.popupHtml).toContain('Fireball');
      expect(result.current.popupHtml).toContain(
        'A bright streak flashes from your finger.'
      );
    });

    it('includes higher_level content when present and non-empty', () => {
      const { result } = renderHook(() => useActionPopup('spell'));

      act(() => {
        result.current.showPopup({
          name: 'Fireball',
          desc: 'A bright streak flashes from your finger.',
          higher_level: 'When cast at 6th level, damage increases.',
        });
      });

      expect(result.current.popupHtml).toContain('At higher levels.');
      expect(result.current.popupHtml).toContain(
        'When cast at 6th level, damage increases.'
      );
    });

    it('does not include higher_level when it is empty string', () => {
      const { result } = renderHook(() => useActionPopup('spell'));

      act(() => {
        result.current.showPopup({
          name: 'Fireball',
          desc: 'A bright streak flashes from your finger.',
          higher_level: '',
        });
      });

      expect(result.current.popupHtml).not.toContain('At higher levels.');
    });

    it('does not include higher_level when it is not a string', () => {
      const { result } = renderHook(() => useActionPopup('spell'));

      act(() => {
        result.current.showPopup({
          name: 'Fireball',
          desc: 'A bright streak flashes from your finger.',
          higher_level: null,
        });
      });

      expect(result.current.popupHtml).not.toContain('At higher levels.');
    });

    it('leaves popupHtml as null when spell lacks a desc', () => {
      const { result } = renderHook(() => useActionPopup('spell'));

      act(() => {
        result.current.showPopup({ name: 'Fireball' });
      });

      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('preset: "ability"', () => {
    const mockAbilities = [
      {
        full_name: 'Strength',
        desc: 'Strength measures bodily power.',
      },
    ];

    it('sets popupHtml when name matches an ability score', () => {
      const { result } = renderHook(() =>
        useActionPopup('ability', { allAbilityScores: mockAbilities })
      );

      act(() => {
        result.current.showPopup('Strength');
      });

      expect(result.current.popupHtml).toBe(
        '<h3>Strength</h3>Strength measures bodily power.<br/>'
      );
    });

    it('leaves popupHtml as null when name does not match', () => {
      const { result } = renderHook(() =>
        useActionPopup('ability', { allAbilityScores: mockAbilities })
      );

      act(() => {
        result.current.showPopup('Charisma');
      });

      expect(result.current.popupHtml).toBeNull();
    });

    it('leaves popupHtml as null when ability scores list is empty', () => {
      const { result } = renderHook(() =>
        useActionPopup('ability', { allAbilityScores: [] })
      );

      act(() => {
        result.current.showPopup('Strength');
      });

      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('preset: custom function', () => {
    it('uses the custom function to build HTML', () => {
      const customFn = vi.fn(
        (entity) => `<div>${entity.label}</div>`
      );
      const { result } = renderHook(() => useActionPopup(customFn));

      act(() => {
        result.current.showPopup({ label: 'Custom Content' });
      });

      expect(customFn).toHaveBeenCalledWith({ label: 'Custom Content' });
      expect(result.current.popupHtml).toBe('<div>Custom Content</div>');
    });

    it('leaves popupHtml as null when custom function returns null', () => {
      const customFn = vi.fn(() => null);
      const { result } = renderHook(() => useActionPopup(customFn));

      act(() => {
        result.current.showPopup({ label: 'Will not show' });
      });

      expect(customFn).toHaveBeenCalled();
      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('preset: unknown string', () => {
    it('uses a noop handler that always returns null', () => {
      const { result } = renderHook(() => useActionPopup('unknown'));

      act(() => {
        result.current.showPopup({ anything: 'value' });
      });

      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('state transitions and edge cases', () => {
    it('updates popupHtml when showPopup is called multiple times', () => {
      const { result } = renderHook(() => useActionPopup('feature'));

      act(() => {
        result.current.showPopup({
          name: 'First',
          description: 'first',
          details: 'First detail',
        });
      });
      expect(result.current.popupHtml).toContain('First');

      act(() => {
        result.current.showPopup({
          name: 'Second',
          description: 'second',
          details: 'Second detail',
        });
      });
      expect(result.current.popupHtml).toContain('Second');
    });

    it('setPopupHtml directly updates the HTML', () => {
      const { result } = renderHook(() => useActionPopup('feature'));

      act(() => {
        result.current.setPopupHtml('<p>Direct HTML</p>');
      });

      expect(result.current.popupHtml).toBe('<p>Direct HTML</p>');
    });

    it('preserves previous popupHtml when showPopup receives entity without content', () => {
      const { result } = renderHook(() => useActionPopup('feature'));

      act(() => {
        result.current.showPopup({
          name: 'Shown',
          description: 'desc',
          details: 'Some detail',
        });
      });
      expect(result.current.popupHtml).toContain('Shown');

      // Now call showPopup with a feature lacking details — popupHtml should NOT change
      act(() => {
        result.current.showPopup({
          name: 'Hidden',
          description: 'no details',
        });
      });

      // The previous popupHtml should still be there since the handler returned null
      expect(result.current.popupHtml).toContain('Shown');
    });
  });
});
