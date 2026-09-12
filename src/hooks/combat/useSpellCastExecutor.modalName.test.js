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

  describe('castAction — bare modalName (non-automationPopup) handling', () => {
    it('calls setModalState with correct mapping when result has modalName and setModalState is provided', async () => {
      const props = makeProps();
      const setModalState = vi.fn();

      executeSpellCast.mockResolvedValue({
        modalName: 'massHealTarget',
        payload: { action: { name: 'Mass Heal' } },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(setModalState).toHaveBeenCalledWith({ massHealModal: { action: { name: 'Mass Heal' } } });
      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('falls back to setPopupHtml when result has modalName but setModalState is not provided', async () => {
      const props = makeProps();

      executeSpellCast.mockResolvedValue({
        modalName: 'fear',
        payload: { action: { name: 'Fear' } },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith({ action: { name: 'Fear' } });
      expect(props.setPopupHtml).toHaveBeenCalledTimes(1);
    });

    it('logs console.error for unknown modalName when setModalState is provided', async () => {
      const props = makeProps();
      const setModalState = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

      executeSpellCast.mockResolvedValue({
        modalName: 'unknownModalType',
        payload: { action: { name: 'Unknown' } },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useSpellCastExecutor] Unknown modalName from spell cast: unknownModalType'
      );
      expect(setModalState).not.toHaveBeenCalled();
      expect(props.setPopupHtml).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('unknown modalName without setModalState falls back to setPopupHtml (no error logged)', async () => {
      const props = makeProps();

      executeSpellCast.mockResolvedValue({
        modalName: 'totallyUnknown',
        payload: { data: 'unknown payload' },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      // Without setModalState, the code path goes directly to setPopupHtml(result.payload)
      // without calling handleModalResult, so unknown modalNames are silently passed through
      expect(props.setPopupHtml).toHaveBeenCalledWith({ data: 'unknown payload' });
    });

    it('automationPopup takes priority over bare modalName in result', async () => {
      const props = makeProps();
      const setModalState = vi.fn();

      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'popup', payload: '<div>Automation popup</div>' },
        modalName: 'massHealTarget',
        payload: { action: { name: 'Mass Heal' } },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      // automationPopup path fires first, so setPopupHtml is called with the automation payload
      expect(props.setPopupHtml).toHaveBeenCalledWith('<div>Automation popup</div>');
      expect(setModalState).not.toHaveBeenCalled();
    });

    it('bare modalName payload is preserved through to setModalState without transformation', async () => {
      const props = makeProps();
      const setModalState = vi.fn();
      const complexPayload = { targets: ['A', 'B', 'C'], spellLevel: 3, customFlag: true };

      executeSpellCast.mockResolvedValue({
        modalName: 'massCureWoundsTarget',
        payload: complexPayload,
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(setModalState).toHaveBeenCalledWith({ massCureWoundsModal: complexPayload });
    });

    it('bare modalName with empty payload object routes correctly', async () => {
      const props = makeProps();
      const setModalState = vi.fn();

      executeSpellCast.mockResolvedValue({
        modalName: 'calmEmotions',
        payload: {},
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(setModalState).toHaveBeenCalledWith({ calmEmotionsModal: {} });
    });

    it('bare modalName without payload field routes correctly with undefined', async () => {
      const props = makeProps();
      const setModalState = vi.fn();

      executeSpellCast.mockResolvedValue({
        modalName: 'hypnoticPattern',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(setModalState).toHaveBeenCalledWith({ hypnoticPatternModal: undefined });
    });
  });
});
