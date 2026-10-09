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
  makeSpell,
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

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  }),
);

describe('useActionSpellMetamagic - handleSpellAttackClick', () => {
  setupBeforeEach();

  // ── Early return / cannotAct ──────────────────────────────────────────────

  describe('cannotAct guard', () => {
    it('returns early without calling handleAttackClick or spell services when cannotAct is true', async () => {
      const handleAttackClick = vi.fn();
      const props = makeHookProps({ cannotAct: true, handleAttackClick });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { prepareSpellCast } = await import(
        '../../services/rules/spells/spellPreparationService.js'
      );

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(handleAttackClick).not.toHaveBeenCalled();
      expect(executeSpellCast).not.toHaveBeenCalled();
      expect(prepareSpellCast).not.toHaveBeenCalled();
    });

    it('still returns the full API when cannotAct is true', () => {
      const props = makeHookProps({ cannotAct: true });
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      expect(result.current).toHaveProperty('handleSpellAttackClick');
      expect(result.current).toHaveProperty('handleActionMetamagicConfirm');
      expect(result.current).toHaveProperty('handleActionMetamagicSkip');
      expect(result.current).toHaveProperty('handleActionSpellDamageClick');
    });
  });

  // ── Non-sorcerer path ─────────────────────────────────────────────────────

  describe('non-sorcerer', () => {
    const nonSorcererProps = (overrides = {}) =>
      makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
        ...overrides,
      });

    it('calls handleAttackClick when spell is not found', async () => {
      const handleAttackClick = vi.fn();
      const props = nonSorcererProps({ handleAttackClick });

      const attack = { name: 'UnknownSpell', spellLevel: 0, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(handleAttackClick).toHaveBeenCalledWith(attack);
    });

    it('calls prepareSpellCast and executeSpellCast when spell is found', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }),
      });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { prepareSpellCast } = await import(
        '../../services/rules/spells/spellPreparationService.js'
      );

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(prepareSpellCast).toHaveBeenCalled();
      expect(executeSpellCast).toHaveBeenCalled();
    });

    it('calls setPopupHtml when automationPopup type is popup', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }),
        setPopupHtml: vi.fn(),
      });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );

      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'popup', payload: '<div>Attack cast!</div>' },
      });

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith('<div>Attack cast!</div>');
    });

    it('does not call setPopupHtml when automationPopup type is modal', async () => {
      const spell = makeSpell();
      const setModalState = vi.fn();
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }),
        setPopupHtml: vi.fn(),
        setModalState,
      });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );

      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'modal', modalName: 'testModal', payload: {} },
      });

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('passes targetName from buildCtx to getTargetInfo', async () => {
      const spell = makeSpell();
      const buildCtx = vi.fn(async () => ({ targetName: 'Orc B' }));
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }),
        buildCtx,
      });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(executeSpellCast).toHaveBeenCalled();
      const getTargetInfo = executeSpellCast.mock.calls[0][2].getTargetInfo;
      const targetInfo = await getTargetInfo();
      expect(targetInfo).toEqual({ name: 'Orc B' });
    });

    it('passes empty buildCtx result as null targetInfo', async () => {
      const spell = makeSpell();
      const buildCtx = vi.fn(async () => ({}));
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }),
        buildCtx,
      });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(executeSpellCast).toHaveBeenCalled();
      const getTargetInfo = executeSpellCast.mock.calls[0][2].getTargetInfo;
      const targetInfo = await getTargetInfo();
      expect(targetInfo).toBeNull();
    });

    it('CLA-230: threads ctx.forcedMode into the metaCtx passed to executeSpellCast', async () => {
      const spell = makeSpell();
      const buildCtx = vi.fn(async () => ({ targetName: 'Zombie 1', forcedMode: 'advantage' }));
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }),
        buildCtx,
      });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(executeSpellCast).toHaveBeenCalled();
      const metaCtxArg = executeSpellCast.mock.calls[0][1];
      expect(metaCtxArg.forcedMode).toBe('advantage');
    });

    it('CLA-230: does not invent forcedMode when ctx has none', async () => {
      const spell = makeSpell();
      const buildCtx = vi.fn(async () => ({ targetName: 'Zombie 1' }));
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }),
        buildCtx,
      });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      const metaCtxArg = executeSpellCast.mock.calls[0][1];
      expect(metaCtxArg.forcedMode).toBeUndefined();
    });
  });

  // ── Sorcerer path ─────────────────────────────────────────────────────────

  describe('sorcerer', () => {
    const sorcererProps = (overrides = {}) =>
      makeHookProps({
        playerStats: {
          name: 'TestSorcerer',
          class: { name: 'Sorcerer' },
          level: 5,
          spellAbilities: { spells: [] },
          ...overrides,
        },
        ...overrides,
      });

    it('calls handleAttackClick when spell is not found', async () => {
      const handleAttackClick = vi.fn();
      const props = sorcererProps({ handleAttackClick });

      const attack = { name: 'UnknownSpell', spellLevel: 0, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(handleAttackClick).toHaveBeenCalledWith(attack);
    });

    it('sets pendingActionMetamagic when spell is found', async () => {
      const spell = makeSpell();
      const props = sorcererProps({ spellAbilities: { spells: [spell] } });
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(result.current.pendingActionMetamagic).not.toBeNull();
      expect(result.current.pendingActionMetamagic.spellName).toBe('Fireball');
      expect(result.current.pendingActionMetamagic.spellLevel).toBe(3);
      expect(result.current.pendingActionMetamagic.isPsionic).toBe(false);
      expect(result.current.pendingActionMetamagic.psionicCost).toBe(0);
    });

    it('sets isPsionic and psionicCost when spell is psionic and sorcerer has psionic sorcery', async () => {
      const spell = makeSpell();
      const props = sorcererProps({ spellAbilities: { spells: [spell] } });
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(true);
      hasPsionicSorcery.mockReturnValue(true);

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(result.current.pendingActionMetamagic.isPsionic).toBe(true);
      expect(result.current.pendingActionMetamagic.psionicCost).toBe(3);
    });

    it('does not set isPsionic when sorcerer lacks psionic sorcery even if spell is psionic', async () => {
      const spell = makeSpell();
      const props = sorcererProps({ spellAbilities: { spells: [spell] } });
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(true);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(result.current.pendingActionMetamagic.isPsionic).toBe(false);
      expect(result.current.pendingActionMetamagic.psionicCost).toBe(0);
    });

    it('uses spell.casting_time from spell object', async () => {
      const spell = makeSpell({ casting_time: '1 Bonus Action' });
      const props = sorcererProps({ spellAbilities: { spells: [spell] } });
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(result.current.pendingActionMetamagic.castingTime).toBe('1 Bonus Action');
    });

    it('falls back to default castingTime when spell has no casting_time', async () => {
      const spell = makeSpell({ casting_time: undefined });
      const props = sorcererProps({ spellAbilities: { spells: [spell] } });
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      // The hook uses spell.casting_time which falls back to 'Action' (not '1 Action')
      expect(result.current.pendingActionMetamagic.castingTime).toBe('Action');
    });

    it('uses spell.level as fallback for attack.spellLevel', async () => {
      const spell = makeSpell({ level: 4 });
      const props = sorcererProps({ spellAbilities: { spells: [spell] } });
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 0, area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(result.current.pendingActionMetamagic.spellLevel).toBe(4);
    });

    it('uses spell.level when attack is missing spellLevel', async () => {
      const spell = makeSpell({ level: 5 });
      const props = sorcererProps({ spellAbilities: { spells: [spell] } });
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: undefined, area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(result.current.pendingActionMetamagic.spellLevel).toBe(5);
    });

    it('calls executeSpellCast when pending action is confirmed', async () => {
      const spell = makeSpell();
      const props = sorcererProps({ spellAbilities: { spells: [spell] } });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(result.current.pendingActionMetamagic).not.toBeNull();

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(executeSpellCast).toHaveBeenCalled();
    });

    it('calls setPopupHtml when confirmed action returns popup automationPopup', async () => {
      const spell = makeSpell();
      const props = sorcererProps({
        spellAbilities: { spells: [spell] },
        setPopupHtml: vi.fn(),
      });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'popup', payload: '<div>Attack result!</div>' },
      });

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith('<div>Attack result!</div>');
    });

    it('does not call setPopupHtml when confirmed action returns modal automationPopup', async () => {
      const spell = makeSpell();
      const setModalState = vi.fn();
      const props = sorcererProps({
        spellAbilities: { spells: [spell] },
        setPopupHtml: vi.fn(),
        setModalState,
      });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'modal', modalName: 'testModal', payload: {} },
      });

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('passes targetName from buildCtx to getTargetInfo on confirm', async () => {
      const spell = makeSpell();
      const buildCtx = vi.fn(async () => ({ targetName: 'Goblin A' }));
      const props = sorcererProps({ spellAbilities: { spells: [spell] }, buildCtx });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(executeSpellCast).toHaveBeenCalled();
      const getTargetInfo = executeSpellCast.mock.calls[0][2].getTargetInfo;
      const targetInfo = await getTargetInfo();
      expect(targetInfo).toEqual({ name: 'Goblin A' });
    });

    it('passes null targetInfo when buildCtx has no targetName on confirm', async () => {
      const spell = makeSpell();
      const buildCtx = vi.fn(async () => ({}));
      const props = sorcererProps({ spellAbilities: { spells: [spell] }, buildCtx });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(executeSpellCast).toHaveBeenCalled();
      const getTargetInfo = executeSpellCast.mock.calls[0][2].getTargetInfo;
      const targetInfo = await getTargetInfo();
      expect(targetInfo).toBeNull();
    });

    it('CLA-230: threads ctx.forcedMode through the metamagic-resolved confirm cast', async () => {
      const spell = makeSpell();
      const buildCtx = vi.fn(async () => ({ targetName: 'Zombie 1', forcedMode: 'advantage' }));
      const props = sorcererProps({ spellAbilities: { spells: [spell] }, buildCtx });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      const metaCtxArg = executeSpellCast.mock.calls[0][1];
      expect(metaCtxArg.forcedMode).toBe('advantage');
    });

    it('CLA-230: metamagic-provided forcedMode (e.g. innate sorcery) wins over ctx value', async () => {
      const spell = makeSpell();
      const buildCtx = vi.fn(async () => ({ targetName: 'Zombie 1', forcedMode: 'advantage' }));
      const props = sorcererProps({ spellAbilities: { spells: [spell] }, buildCtx });
      const { executeSpellCast } = await import(
        '../../services/rules/spells/spellCastService.js'
      );
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      // Call the pending action directly — handleActionMetamagicConfirm builds its own
      // metaCtx and never sets forcedMode, so this verifies the guard: an explicit
      // forcedMode already in metaCtx (e.g. innate sorcery) must not be overwritten.
      await act(async () => {
        result.current.pendingActionMetamagic.action({ forcedMode: 'normal' });
      });

      const metaCtxArg = executeSpellCast.mock.calls[0][1];
      expect(metaCtxArg.forcedMode).toBe('normal');
    });

    it('clears pendingActionMetamagic after confirm', async () => {
      const spell = makeSpell();
      const props = sorcererProps({ spellAbilities: { spells: [spell] } });
      const { isPsionicSpell, hasPsionicSorcery } = await import(
        '../../services/rules/spells/metamagicRules.js'
      );

      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const attack = { name: 'Fireball', spellLevel: 3, castingTime: '1 Action', area_of_effect: null };

      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleSpellAttackClick(attack);
      });

      expect(result.current.pendingActionMetamagic).not.toBeNull();

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });
  });
});
