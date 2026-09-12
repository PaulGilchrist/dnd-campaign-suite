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

  describe('castAction — automationPopup handling', () => {
    it('calls setPopupHtml with popup payload when automationPopup type is popup', async () => {
      const props = makeProps();
      const popupPayload = '<div>Spell cast!</div>';
      executeSpellCast.mockResolvedValue({
        automationPopup: {
          type: 'popup',
          payload: popupPayload,
        },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(popupPayload);
    });

    it('calls setPopupHtml when automationPopup has no type field', async () => {
      const props = makeProps();
      const payload = '<div>Default popup</div>';
      executeSpellCast.mockResolvedValue({
        automationPopup: { payload },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(payload);
    });

    it('calls setPopupHtml with undefined payload when automationPopup has no payload', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'popup' },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(undefined);
    });

    it('calls setPopupHtml with non-string payload when automationPopup payload is an object', async () => {
      const props = makeProps();
      const payload = { key: 'value' };
      executeSpellCast.mockResolvedValue({
        automationPopup: {
          type: 'popup',
          payload,
        },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(payload);
    });

    it('calls setModalState when automationPopup type is modal and setModalState is provided', async () => {
      const props = makeProps();
      const setModalState = vi.fn();
      const modalPayload = { action: { name: 'Test' } };

      executeSpellCast.mockResolvedValue({
        automationPopup: {
          type: 'modal',
          modalName: 'massHealTarget',
          payload: modalPayload,
        },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, setModalState })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(setModalState).toHaveBeenCalledWith({ massHealModal: modalPayload });
      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('falls back to setPopupHtml when automationPopup type is modal but setModalState is undefined', async () => {
      const props = makeProps();
      const modalPayload = { action: { name: 'Test' } };

      executeSpellCast.mockResolvedValue({
        automationPopup: {
          type: 'modal',
          modalName: 'massHealTarget',
          payload: modalPayload,
        },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(modalPayload);
    });

    it('automationPopup takes priority over modalName in result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        automationPopup: { payload: '<div>Automation!</div>' },
        modalName: 'massHealTarget',
        payload: { action: { name: 'Mass Heal' } },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith('<div>Automation!</div>');
    });

    it('automationPopup takes priority over targetName/heal path in result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue({
        automationPopup: { payload: '<div>Automation!</div>' },
        healAmount: 10,
        targetName: 'Ally 1',
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith('<div>Automation!</div>');
    });

    it('clears ref.current after automationPopup result', async () => {
      const props = makeProps();
      const ref = { current: { attackerPos: { x: 1 } } };
      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'popup', payload: '<div>Done</div>' },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor({ ...props, cachedPosRef: ref })
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(ref.current).toBeNull();
    });

    it('does not call setPopupHtml when automationPopup has null result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('does not call setPopupHtml when automationPopup has undefined result', async () => {
      const props = makeProps();
      executeSpellCast.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('logs error to console when executeSpellCast rejects during automationPopup flow', async () => {
      const props = makeProps();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
      executeSpellCast.mockRejectedValue(new Error('Cast failed'));

      const { result } = renderHook(() =>
        useSpellCastExecutor(props)
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useSpellCastExecutor] executeSpellCast error for Fireball:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
