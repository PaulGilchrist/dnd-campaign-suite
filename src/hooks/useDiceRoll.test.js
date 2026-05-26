import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDiceRoll from './useDiceRoll.js';

describe('useDiceRoll', () => {
  it('returns popupHtml initially null', () => {
    const { result } = renderHook(() => useDiceRoll());
    expect(result.current.popupHtml).toBeNull();
  });

  it('rollAbilityCheck sets popupHtml with roll result', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAbilityCheck('Strength', 5);
    });
    expect(result.current.popupHtml).toMatchObject({ name: 'Strength', bonus: 5 });
  });

  it('rollSavingThrow sets popupHtml', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollSavingThrow('Dexterity', 3);
    });
    expect(result.current.popupHtml).toMatchObject({ name: 'Dexterity', bonus: 3 });
  });

  it('rollSkillCheck sets popupHtml', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollSkillCheck('Stealth', 7);
    });
    expect(result.current.popupHtml).toMatchObject({ name: 'Stealth', bonus: 7 });
  });

  it('rollInitiative sets popupHtml', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollInitiative(2);
    });
    expect(result.current.popupHtml).toMatchObject({ name: 'Initiative', bonus: 2 });
  });

  it('rollAttack sets popupHtml with attack name', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAttack('Longsword', 7);
    });
    expect(result.current.popupHtml).toMatchObject({ name: 'Longsword', bonus: 7 });
  });

  it('rollDamage sets popupHtml', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollDamage('Longsword', '1d8+3', 7, [5], 3);
    });
    expect(result.current.popupHtml).toMatchObject({ name: 'Longsword', formula: '1d8+3', type: 'damage' });
  });

  it('setPopupHtml can clear the popup', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAbilityCheck('Strength', 5);
    });
    expect(result.current.popupHtml).not.toBeNull();
    act(() => {
      result.current.setPopupHtml(null);
    });
    expect(result.current.popupHtml).toBeNull();
  });
});
