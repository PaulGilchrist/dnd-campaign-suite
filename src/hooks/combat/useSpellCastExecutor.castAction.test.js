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

  describe('castAction', () => {
    describe('executeSpellCast invocation', () => {
      it('passes spell, metaCtx, and options to executeSpellCast', async () => {
        const props = makeProps();
        executeSpellCast.mockResolvedValue(null);

        const { result } = renderHook(() =>
          useSpellCastExecutor(props)
        );

        const spell = makeSpell();
        const metaCtx = { slotLevel: 2 };

        await act(async () => {
          await result.current.castAction(spell, metaCtx);
        });

        expect(executeSpellCast).toHaveBeenCalledWith(
          spell,
          metaCtx,
          expect.objectContaining({
            rollAttack: props.rollAttack,
            rollDamage: props.rollDamage,
            playerStats: props.playerStats,
            getTargetInfo: props.getTargetInfo,
            campaignName: props.campaignName,
            mapName: props.mapName,
            characters: props.characters,
          })
        );
      });

      it('spreads extraMeta into the options object', async () => {
        const props = makeProps({ extraMeta: { customFlag: true } });
        executeSpellCast.mockResolvedValue(null);

        const { result } = renderHook(() =>
          useSpellCastExecutor(props)
        );

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(executeSpellCast).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.objectContaining({
            customFlag: true,
          })
        );
      });

      it('extracts attackerPos and targetPos from ref.current', async () => {
        const props = makeProps();
        executeSpellCast.mockResolvedValue(null);

        const ref = { current: { attackerPos: { x: 10, y: 20 }, targetPos: { x: 30, y: 40 } } };

        const { result } = renderHook(() =>
          useSpellCastExecutor({ ...props, cachedPosRef: ref })
        );

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(executeSpellCast).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.objectContaining({
            attackerPos: { x: 10, y: 20 },
            targetPos: { x: 30, y: 40 },
          })
        );
      });

      it('passes undefined attackerPos/targetPos when ref.current is null', async () => {
        const props = makeProps();
        executeSpellCast.mockResolvedValue(null);

        const ref = { current: null };

        const { result } = renderHook(() =>
          useSpellCastExecutor({ ...props, cachedPosRef: ref })
        );

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(executeSpellCast).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.objectContaining({
            attackerPos: undefined,
            targetPos: undefined,
          })
        );
      });
    });

    describe('result routing', () => {
      it('calls setPopupHtml with popup payload when result has automationPopup with type popup', async () => {
        const props = makeProps();
        const popupPayload = '<div>Spell cast!</div>';
        executeSpellCast.mockResolvedValue({
          automationPopup: { type: 'popup', payload: popupPayload },
        });

        const { result } = renderHook(() =>
          useSpellCastExecutor(props)
        );

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(props.setPopupHtml).toHaveBeenCalledWith(popupPayload);
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

      it('falls back to setPopupHtml when automationPopup type is modal but setModalState is not provided', async () => {
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

      it('calls setPopupHtml when result has modalName and setModalState is provided', async () => {
        const props = makeProps();
        const setModalState = vi.fn();

        executeSpellCast.mockResolvedValue({
          modalName: 'fear',
          payload: { action: { name: 'Fear' } },
        });

        const { result } = renderHook(() =>
          useSpellCastExecutor({ ...props, setModalState })
        );

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(setModalState).toHaveBeenCalledWith({ fearModal: { action: { name: 'Fear' } } });
        expect(props.setPopupHtml).not.toHaveBeenCalled();
      });

      it('calls setPopupHtml with heal data when result has targetName', async () => {
        const props = makeProps();

        executeSpellCast.mockResolvedValue({
          healAmount: 15,
          formula: '2d8+3',
          rolls: [4, 3, 5],
          targetName: 'Ally 1',
          bonusHeal: 3,
          bonusDetails: [{ amount: 3, name: 'Divine Favor' }],
        });

        const spell = makeSpell({ name: 'Cure Wounds' });

        const { result } = renderHook(() =>
          useSpellCastExecutor(props)
        );

        await act(async () => {
          await result.current.castAction(spell, {});
        });

        expect(props.setPopupHtml).toHaveBeenCalledWith({
          type: 'heal',
          name: 'Cure Wounds',
          formula: '2d8+3',
          rolls: [4, 3, 5],
          total: 15,
          targetName: 'Ally 1',
          finalHeal: 15,
          bonusHeal: 3,
          bonusHealDetail: '3 Divine Favor',
          healingRerollOriginalRolls: null,
          healingRerollDisplayRolls: null,
        });
      });

      it('uses rawTotal over healAmount for total when both are present', async () => {
        const props = makeProps();

        executeSpellCast.mockResolvedValue({
          healAmount: 10,
          rawTotal: 18,
          formula: '2d8+3',
          rolls: [4, 3, 5],
          targetName: 'Ally 1',
        });

        const { result } = renderHook(() =>
          useSpellCastExecutor(props)
        );

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(props.setPopupHtml).toHaveBeenCalledWith(
          expect.objectContaining({
            total: 18,
            finalHeal: 10,
          })
        );
      });

      it('does not call setPopupHtml when result is falsy', async () => {
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

      it('does not call setPopupHtml when result has no targetName and no automationPopup and no modalName', async () => {
        const props = makeProps();
        executeSpellCast.mockResolvedValue({ healAmount: 10, formula: '1d8' });

        const { result } = renderHook(() =>
          useSpellCastExecutor(props)
        );

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(props.setPopupHtml).not.toHaveBeenCalled();
      });
    });

    describe('ref cleanup', () => {
      it('clears ref.current after castAction completes (success)', async () => {
        const props = makeProps();
        executeSpellCast.mockResolvedValue(null);

        const ref = { current: { attackerPos: { x: 1 } } };

        const { result } = renderHook(() =>
          useSpellCastExecutor({ ...props, cachedPosRef: ref })
        );

        expect(ref.current).not.toBeNull();

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(ref.current).toBeNull();
      });

      it('clears ref.current after castAction completes (error caught)', async () => {
        const props = makeProps();
        executeSpellCast.mockRejectedValue(new Error('Cast failed'));

        const ref = { current: { attackerPos: { x: 1 } } };

        const { result } = renderHook(() =>
          useSpellCastExecutor({ ...props, cachedPosRef: ref })
        );

        expect(ref.current).not.toBeNull();

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(ref.current).toBeNull();
      });

      it('does not clear ref.current when executeSpellCast returns a falsy non-promise value', async () => {
        const props = makeProps();
        executeSpellCast.mockReturnValue(undefined);

        const ref = { current: { attackerPos: { x: 1 } } };

        const { result } = renderHook(() =>
          useSpellCastExecutor({ ...props, cachedPosRef: ref })
        );

        expect(ref.current).not.toBeNull();

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(ref.current).toEqual({ attackerPos: { x: 1 } });
      });
    });

    describe('error handling', () => {
      it('logs error to console when executeSpellCast rejects', async () => {
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

      it('logs error with the correct spell name when executeSpellCast throws', async () => {
        const props = makeProps();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
        executeSpellCast.mockRejectedValue(new Error('Cast failed'));

        const spell = makeSpell({ name: 'Burning Hands' });

        const { result } = renderHook(() =>
          useSpellCastExecutor(props)
        );

        await act(async () => {
          await result.current.castAction(spell, {});
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[useSpellCastExecutor] executeSpellCast error for Burning Hands:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });

      it('does not call setPopupHtml when executeSpellCast throws', async () => {
        const props = makeProps();
        executeSpellCast.mockRejectedValue(new Error('Cast failed'));

        const { result } = renderHook(() =>
          useSpellCastExecutor(props)
        );

        await act(async () => {
          await result.current.castAction(makeSpell(), {});
        });

        expect(props.setPopupHtml).not.toHaveBeenCalled();
      });
    });

    describe('automationPopup priority', () => {
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
    });
  });
});
