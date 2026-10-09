// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import {
  makeHookProps,
  makePlayerStats,
  makeNonSorcererStats,
  setupBeforeEach,
} from './useActionSpellMetamagic.test-utils.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(() => Promise.resolve(null)),
}));

describe('useActionSpellMetamagic', () => {
  setupBeforeEach();

  describe('return value', () => {
    it('returns an object with all expected properties', () => {
      const props = makeHookProps();
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      expect(result.current).toHaveProperty('pendingActionMetamagic');
      expect(result.current).toHaveProperty('isBonusSorcerer');
      expect(result.current).toHaveProperty('handleActionMetamagicConfirm');
      expect(result.current).toHaveProperty('handleActionMetamagicSkip');
      expect(result.current).toHaveProperty('handleActionSpellDamageClick');
      expect(result.current).toHaveProperty('handleSpellAttackClick');
    });

    it('returns functions for all action handlers', () => {
      const props = makeHookProps();
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      expect(typeof result.current.handleActionMetamagicConfirm).toBe('function');
      expect(typeof result.current.handleActionMetamagicSkip).toBe('function');
      expect(typeof result.current.handleActionSpellDamageClick).toBe('function');
      expect(typeof result.current.handleSpellAttackClick).toBe('function');
    });

    it('returns null for pendingActionMetamagic initially', () => {
      const props = makeHookProps();
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      expect(result.current.pendingActionMetamagic).toBeNull();
    });

    it('sets isBonusSorcerer to true when class is Sorcerer', () => {
      const props = makeHookProps({ playerStats: makePlayerStats() });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      expect(result.current.isBonusSorcerer).toBe(true);
    });

    it('sets isBonusSorcerer to false when class is not Sorcerer', () => {
      const props = makeHookProps({ playerStats: makeNonSorcererStats() });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      expect(result.current.isBonusSorcerer).toBe(false);
    });

    it('sets isBonusSorcerer to false when playerStats.class is undefined', () => {
      const props = makeHookProps({ playerStats: { name: 'TestChar' } });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      expect(result.current.isBonusSorcerer).toBe(false);
    });
  });

  describe('handleActionMetamagicConfirm', () => {
    it('clears pending state and no-ops when called without pending action', async () => {
      const props = makeHookProps();
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });

    it('no-ops when called with null result and no pending action', async () => {
      const props = makeHookProps();
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleActionMetamagicConfirm(null);
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });

    it('no-ops when called with undefined result and no pending action', async () => {
      const props = makeHookProps();
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleActionMetamagicConfirm(undefined);
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });
  });

  describe('handleActionMetamagicSkip', () => {
    it('clears pending state and no-ops when called without pending action', async () => {
      const props = makeHookProps();
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleActionMetamagicSkip();
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });
  });

  describe('handleActionSpellDamageClick', () => {
    it('returns early for non-sorcerer without area effect when no spell found', async () => {
      const { prepareSpellCast } = await import(
        '../../services/rules/spells/spellPreparationService.js'
      );
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );

      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
      });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      const attack = { name: 'UnknownSpell', area_of_effect: null };

      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      expect(prepareSpellCast).toHaveBeenCalled();
      expect(executeSpellCast).toHaveBeenCalled();
    });

    it('delegates to handleAttackClick for sorcerer when no spell found and no area effect', async () => {
      const handleAttackClick = vi.fn();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [] } }),
        handleAttackClick,
      });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      const attack = { name: 'UnknownSpell', area_of_effect: null };

      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      expect(handleAttackClick).toHaveBeenCalledWith(attack);
    });

    it('does not set pendingActionMetamagic for non-sorcerer without spell', async () => {
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
      });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      const attack = { name: 'Fireball', area_of_effect: null };

      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });
  });

  describe('handleSpellAttackClick', () => {
    it('returns early without any action when cannotAct is true', async () => {
      const handleAttackClick = vi.fn();
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { prepareSpellCast } = await import(
        '../../services/rules/spells/spellPreparationService.js'
      );

      const props = makeHookProps({
        cannotAct: true,
        handleAttackClick,
        playerStats: makePlayerStats({ spellAbilities: { spells: [] } }),
      });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      const attack = { name: 'Fireball' };

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(handleAttackClick).not.toHaveBeenCalled();
      expect(executeSpellCast).not.toHaveBeenCalled();
      expect(prepareSpellCast).not.toHaveBeenCalled();
    });

    it('delegates to handleAttackClick for sorcerer when no spell found', async () => {
      const handleAttackClick = vi.fn();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [] } }),
        handleAttackClick,
      });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      const attack = { name: 'UnknownSpell' };

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(handleAttackClick).toHaveBeenCalledWith(attack);
    });

    it('delegates to handleAttackClick for non-sorcerer when no spell found', async () => {
      const handleAttackClick = vi.fn();
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
        handleAttackClick,
      });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      const attack = { name: 'UnknownSpell' };

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(handleAttackClick).toHaveBeenCalledWith(attack);
    });
  });
});
