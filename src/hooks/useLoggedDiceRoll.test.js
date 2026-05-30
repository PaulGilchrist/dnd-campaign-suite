import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useLoggedDiceRoll from './useLoggedDiceRoll.js';

vi.mock('./useDiceRoll.js', () => ({
  default: () => ({ popupHtml: null, setPopupHtml: vi.fn() })
}));
vi.mock('../services/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15)
}));
vi.mock('../services/utils.js', () => ({
  default: { getName: vi.fn((name) => name) }
}));
vi.mock('../services/storage.js', () => ({
  default: {
    get: vi.fn((key) => localStorage.getItem(key)),
    set: vi.fn((key, val) => localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val))),
    getProperty: vi.fn(() => null),
    setProperty: vi.fn(() => {})
  }
}));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  window.dispatchEvent = vi.fn();
});

describe('useLoggedDiceRoll', () => {
  it('should return initial popupHtml as null', () => {
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    expect(result.current.popupHtml).toBeNull();
  });

  it('should return all expected methods', () => {
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    expect(result.current).toHaveProperty('popupHtml');
    expect(result.current).toHaveProperty('setPopupHtml');
    expect(result.current).toHaveProperty('rollAbilityCheck');
    expect(result.current).toHaveProperty('rollSavingThrow');
    expect(result.current).toHaveProperty('rollSkillCheck');
    expect(result.current).toHaveProperty('rollInitiative');
    expect(result.current).toHaveProperty('rollAttack');
    expect(result.current).toHaveProperty('rollDamage');
  });

  it('rollAbilityCheck should call setPopupHtml with correct object', () => {
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    act(() => {
      result.current.rollAbilityCheck('Strength', 5);
    });
    expect(result.current.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'd20', rollType: 'check', name: 'Strength', bonus: 5 })
    );
  });

  it('rollSavingThrow should call setPopupHtml with rollType save', () => {
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    act(() => {
      result.current.rollSavingThrow('Dexterity', 3);
    });
    expect(result.current.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'd20', rollType: 'save', name: 'Dexterity', bonus: 3 })
    );
  });

  it('rollSkillCheck should call setPopupHtml with rollType skill', () => {
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    act(() => {
      result.current.rollSkillCheck('Stealth', 7);
    });
    expect(result.current.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'd20', rollType: 'skill', name: 'Stealth', bonus: 7 })
    );
  });

  it('rollInitiative should call setPopupHtml with name Initiative', () => {
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    act(() => {
      result.current.rollInitiative(2);
    });
    expect(result.current.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'd20', rollType: 'initiative', name: 'Initiative', bonus: 2 })
    );
  });

  it('rollAttack should call setPopupHtml with rollType attack', () => {
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    act(() => {
      result.current.rollAttack('Longsword', 7);
    });
    expect(result.current.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'd20', rollType: 'attack', name: 'Longsword', bonus: 7 })
    );
  });

  it('rollDamage should call setPopupHtml with type damage', () => {
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    act(() => {
      result.current.rollDamage('Longsword', '1d8+3', 7, [5], 3);
    });
    expect(result.current.setPopupHtml).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'damage', name: 'Longsword', formula: '1d8+3', bonus: 0 })
    );
  });

  it('should call fetch to log the roll entry', () => {
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    act(() => {
      result.current.rollAbilityCheck('Strength', 5);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/campaigns/test-campaign/log',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('rollInitiative should update combatSummary in localStorage when it exists', () => {
    const combatSummary = {
      creatures: [
        { type: 'player', name: 'Gandalf the Grey', initiative: '0' },
        { type: 'monster', name: 'Goblin', initiative: '10' },
      ],
    };
    localStorage.setItem('combatSummary', JSON.stringify(combatSummary));

    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf the Grey', 'test-campaign'));
    act(() => {
      result.current.rollInitiative(2);
    });
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
  });

  it('rollInitiative should not throw when combatSummary is not in localStorage', () => {
    localStorage.removeItem('combatSummary');
    const { result } = renderHook(() => useLoggedDiceRoll('Gandalf', 'test-campaign'));
    expect(() => {
      act(() => {
        result.current.rollInitiative(2);
      });
    }).not.toThrow();
  });
});
