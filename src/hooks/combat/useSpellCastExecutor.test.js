// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellCastExecutor } from './useSpellCastExecutor.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockExecuteSpellCast = vi.fn();

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: (...args) => mockExecuteSpellCast(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    ...overrides,
  };
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSpellCastExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Return value structure ─────────────────────────────────────────────

  describe('return value', () => {
    it('returns an object with castAction and cachedPosRef', () => {
      const props = makeProps();
      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
          props.extraMeta,
        )
      );

      expect(result.current).toHaveProperty('castAction');
      expect(result.current).toHaveProperty('cachedPosRef');
      expect(typeof result.current.castAction).toBe('function');
      expect(result.current.cachedPosRef).toHaveProperty('current');
    });

    it('uses the provided cachedPosRef when given', () => {
      const externalRef = { current: { attackerPos: { x: 1, y: 2 } } };
      const props = makeProps();
      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
          props.extraMeta,
          externalRef,
        )
      );

      expect(result.current.cachedPosRef).toBe(externalRef);
    });
  });

  // ── castAction — executeSpellCast invocation ────────────────────────────

  describe('castAction', () => {
    it('calls executeSpellCast with correct arguments', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
          props.extraMeta,
        )
      );

      const spell = makeSpell();
      const metaCtx = { slotLevel: 2 };

      await act(async () => {
        await result.current.castAction(spell, metaCtx);
      });

      expect(mockExecuteSpellCast).toHaveBeenCalledWith(
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

    it('passes extraMeta into the options object', async () => {
      const props = makeProps({ extraMeta: { customFlag: true } });
      mockExecuteSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
          props.extraMeta,
        )
      );

      const spell = makeSpell();
      const metaCtx = {};

      await act(async () => {
        await result.current.castAction(spell, metaCtx);
      });

      expect(mockExecuteSpellCast).toHaveBeenCalledWith(
        spell,
        metaCtx,
        expect.objectContaining({
          customFlag: true,
        })
      );
    });

    it('clears ref.current after castAction completes', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue(null);

      const ref = { current: { attackerPos: { x: 1 } } };

      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
          props.extraMeta,
          ref,
        )
      );

      expect(ref.current).not.toBeNull();

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(ref.current).toBeNull();
    });
  });

  // ── castAction — result handling ───────────────────────────────────────

  describe('castAction — result handling', () => {
    it('sets popupHtml when result has automationPopup', async () => {
      const props = makeProps();
      const popupPayload = '<div>Spell cast!</div>';
      mockExecuteSpellCast.mockResolvedValue({
        automationPopup: { payload: popupPayload },
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
        )
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(popupPayload);
    });

    it('prefers automationPopup over healAmount display', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        automationPopup: { payload: '<div>Automation!</div>' },
        healAmount: 10,
      });

      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
        )
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith('<div>Automation!</div>');
    });

    it('sets popupHtml for heal results with no automationPopup', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 15,
        formula: '2d8+3',
        rolls: [4, 3, 5],
        targetName: 'Ally 1',
        bonusHeal: 3,
        bonusDetails: [{ amount: 3, name: 'Divine Favor' }],
      });

      const spell = makeSpell({ name: 'Cure Wounds' });

      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
        )
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
      });
    });

    it('does not set popupHtml when result is null, zero, or negative', async () => {
      const props = makeProps();

      // null result
      mockExecuteSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
        )
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
      vi.clearAllMocks();

      // healAmount = 0
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 0,
        formula: '1d8',
        rolls: [],
        bonusDetails: [],
      });

      const { result: result2 } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
        )
      );

      await act(async () => {
        await result2.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
      vi.clearAllMocks();

      // healAmount < 0
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: -5,
        formula: '1d8',
        rolls: [],
        bonusDetails: [],
      });

      const { result: result3 } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
        )
      );

      await act(async () => {
        await result3.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('does not set popupHtml when executeSpellCast throws', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockRejectedValue(new Error('Cast failed'));

      const { result } = renderHook(() =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          props.playerStats,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
        )
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });
  });

  // ── useCallback stability ──────────────────────────────────────────────

  describe('useCallback stability', () => {
    it('returns the same castAction function when props do not change', () => {
      const props = makeProps();
      const ref = { current: null };
      const extraMeta = {};

      const { result, rerender } = renderHook(
        ({ p, em, r }) =>
          useSpellCastExecutor(
            p.rollAttack,
            p.rollDamage,
            p.playerStats,
            p.getTargetInfo,
            p.campaignName,
            p.mapName,
            p.characters,
            p.setPopupHtml,
            em,
            r,
          ),
        {
          initialProps: { p: props, em: extraMeta, r: ref },
        }
      );

      const firstAction = result.current.castAction;

      rerender({ p: props, em: extraMeta, r: ref });

      expect(result.current.castAction).toBe(firstAction);
    });
  });
});
