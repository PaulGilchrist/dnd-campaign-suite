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
  });

  // ── Ref management ─────────────────────────────────────────────────────

  describe('ref management', () => {
    it('creates an internal ref when no cachedPosRef is provided', () => {
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
        )
      );

      expect(result.current.cachedPosRef).toBeDefined();
      expect(result.current.cachedPosRef.current).toBeNull();
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

    it('passes attackerPos and targetPos from ref.current when set', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue(null);

      const ref = { current: { attackerPos: { x: 1 }, targetPos: { y: 2 } } };

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

      const spell = makeSpell();
      const metaCtx = {};

      await act(async () => {
        await result.current.castAction(spell, metaCtx);
      });

      expect(mockExecuteSpellCast).toHaveBeenCalledWith(
        spell,
        metaCtx,
        expect.objectContaining({
          attackerPos: { x: 1 },
          targetPos: { y: 2 },
        })
      );
    });

    it('passes empty attackerPos/targetPos when ref.current is null', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue(null);

      const ref = { current: null };

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

      const spell = makeSpell();
      const metaCtx = {};

      await act(async () => {
        await result.current.castAction(spell, metaCtx);
      });

      expect(mockExecuteSpellCast).toHaveBeenCalledWith(
        spell,
        metaCtx,
        expect.objectContaining({
          attackerPos: undefined,
          targetPos: undefined,
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

    it('returns early when executeSpellCast returns null', async () => {
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
        )
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('returns early when executeSpellCast returns undefined', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue(undefined);

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

    it('returns early when executeSpellCast returns a promise that resolves to null', async () => {
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
        )
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
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

    it('clears internal ref.current after castAction completes', async () => {
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
        )
      );

      expect(result.current.cachedPosRef.current).toBeNull();

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(result.current.cachedPosRef.current).toBeNull();
    });

    it('handles executeSpellCast throwing a promise rejection', async () => {
      const props = makeProps();
      const error = new Error('Cast failed');
      mockExecuteSpellCast.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error');

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

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useSpellCastExecutor] executeSpellCast error'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });

  // ── castAction — automationPopup result ────────────────────────────────

  describe('castAction — automationPopup result', () => {
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
  });

  // ── castAction — heal result ───────────────────────────────────────────

  describe('castAction — heal result', () => {
    it('sets popupHtml when result has healAmount > 0 and no automationPopup', async () => {
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

    it('uses rawTotal when available instead of healAmount for total', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 15,
        rawTotal: 20,
        formula: '2d8+3',
        rolls: [4, 3, 5],
        targetName: 'Ally 1',
        bonusHeal: 3,
        bonusDetails: [],
      });

      const spell = makeSpell({ name: 'Healing Word' });

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

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({ total: 20 })
      );
    });

    it('uses healAmount as total when rawTotal is missing', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 12,
        formula: '1d4+2',
        rolls: [3, 1],
        targetName: 'Ally 2',
        bonusHeal: 0,
        bonusDetails: [],
      });

      const spell = makeSpell({ name: 'Healing Word' });

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

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({ total: 12 })
      );
    });

    it('omits bonusHealDetail when bonusDetails is empty', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 8,
        formula: '1d4+1',
        rolls: [2, 1],
        targetName: 'Ally 1',
        bonusHeal: 0,
        bonusDetails: [],
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

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({ bonusHealDetail: '' })
      );
    });

    it('joins multiple bonusDetails with comma', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 20,
        formula: '2d8+3',
        rolls: [5, 4, 3],
        targetName: 'Ally 1',
        bonusHeal: 6,
        bonusDetails: [
          { amount: 3, name: 'Divine Favor' },
          { amount: 3, name: 'Champion' },
        ],
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

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({ bonusHealDetail: '3 Divine Favor, 3 Champion' })
      );
    });

    it('uses bonusHeal default of 0 when bonusHeal is missing', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '1d8',
        rolls: [5],
        targetName: 'Ally 1',
        bonusDetails: [],
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

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({ bonusHeal: 0 })
      );
    });

    it('uses empty rolls array when rolls is missing', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '1d8',
        targetName: 'Ally 1',
        bonusHeal: 0,
        bonusDetails: [],
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

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({ rolls: [] })
      );
    });

    it('does not set popupHtml when healAmount is 0', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 0,
        formula: '1d8',
        rolls: [],
        bonusDetails: [],
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

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('does not set popupHtml when healAmount is negative', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: -5,
        formula: '1d8',
        rolls: [],
        bonusDetails: [],
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

    it('returns a new castAction when playerStats changes', () => {
      const props = makeProps();
      const { result: r1 } = renderHook(({ p }) =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          p,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
        )
      , { initialProps: { p: makePlayerStats() } });

      const firstAction = r1.current.castAction;

      const { result: r2 } = renderHook(({ p }) =>
        useSpellCastExecutor(
          props.rollAttack,
          props.rollDamage,
          p,
          props.getTargetInfo,
          props.campaignName,
          props.mapName,
          props.characters,
          props.setPopupHtml,
        )
      , { initialProps: { p: makePlayerStats({ name: 'Different' }) } });

      expect(r2.current.castAction).not.toBe(firstAction);
    });
  });

  // ── Integration / flow tests ───────────────────────────────────────────

  describe('full cast flow', () => {
    it('completes the full castAction flow with automationPopup', async () => {
      const props = makeProps();
      const popupPayload = '<div>Shield activated!</div>';
      mockExecuteSpellCast.mockResolvedValue({
        automationPopup: { payload: popupPayload },
      });

      const ref = { current: { attackerPos: { x: 1 }, targetPos: { y: 2 } } };

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
          {},
          ref,
        )
      );

      expect(ref.current).not.toBeNull();

      await act(async () => {
        await result.current.castAction(makeSpell({ name: 'Shield' }), {});
      });

      expect(mockExecuteSpellCast).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          attackerPos: { x: 1 },
          targetPos: { y: 2 },
          campaignName: 'TestCampaign',
          mapName: 'TestMap',
        })
      );
      expect(props.setPopupHtml).toHaveBeenCalledWith(popupPayload);
      expect(ref.current).toBeNull();
    });

    it('completes the full castAction flow with heal result', async () => {
      const props = makeProps();
      mockExecuteSpellCast.mockResolvedValue({
        healAmount: 10,
        formula: '1d8+2',
        rolls: [5, 3],
        targetName: 'Ally 1',
        bonusHeal: 2,
        bonusDetails: [{ amount: 2, name: 'Divine Favor' }],
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
        await result.current.castAction(makeSpell({ name: 'Cure Wounds' }), {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'heal',
          name: 'Cure Wounds',
          finalHeal: 10,
          bonusHeal: 2,
          bonusHealDetail: '2 Divine Favor',
        })
      );
    });

    it('completes the full castAction flow with no result', async () => {
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
        )
      );

      await act(async () => {
        await result.current.castAction(makeSpell(), {});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('completes the full castAction flow when executeSpellCast returns no promise (early return)', async () => {
      const props = makeProps();
      // executeSpellCast returns undefined (no promise)
      mockExecuteSpellCast.mockReturnValue(undefined);

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
});
