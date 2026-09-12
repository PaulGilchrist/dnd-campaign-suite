// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { renderHook, act } from '@testing-library/react';
import { useSpellCastExecutor } from './useSpellCastExecutor.js';

function makePlayerStats(overrides = {}) {
  return { name: 'TestCaster', ...overrides };
}

function makeSpell(overrides = {}) {
  return { name: 'Fireball', ...overrides };
}

function makeProps(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(),
    campaignName: 'TestCampaign',
    mapName: 'TestMap',
    characters: [],
    setPopupHtml: vi.fn(),
    extraMeta: {},
    ...overrides,
  };
}

describe('useSpellCastExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling — behavior not covered elsewhere', () => {
    it('does not call setModalState when executeSpellCast throws', async () => {
      const props = makeProps();
      const setModalState = vi.fn();
      executeSpellCast.mockRejectedValue(new Error('Cast failed'));

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(setModalState).not.toHaveBeenCalled();
      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('hook remains usable after a cast error', async () => {
      const props = makeProps();
      executeSpellCast
        .mockRejectedValueOnce(new Error('First cast failed'))
        .mockResolvedValueOnce(null);

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('handles non-Error rejection values (string)', async () => {
      const props = makeProps();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
      executeSpellCast.mockRejectedValue('string error');

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useSpellCastExecutor] executeSpellCast error for Fireball:',
        'string error',
      );

      expect(props.setPopupHtml).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('handles undefined rejection value', async () => {
      const props = makeProps();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
      executeSpellCast.mockRejectedValue(undefined);

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useSpellCastExecutor] executeSpellCast error for Fireball:',
        undefined,
      );

      expect(props.setPopupHtml).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('handles null rejection value', async () => {
      const props = makeProps();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
      executeSpellCast.mockRejectedValue(null);

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useSpellCastExecutor] executeSpellCast error for Fireball:',
        null,
      );

      expect(props.setPopupHtml).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
