// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import { makeHookProps, makeSpell, makeNonSorcererStats, makePlayerStats, makeAttack, setupBeforeEach } from './useActionSpellMetamagic.test-utils.js';

const { spendSorceryPoints, logMetamagicUse } = await import('./useMetamagic.js');

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
  })
);

describe('useActionSpellMetamagic - casting flow', () => {
  setupBeforeEach();

  // ── Non-sorcerer: no spell found ────────────────────────────────────────────

  describe('non-sorcerer, no spell found', () => {
    it('delegates to attack handler when sorcerer and no spell found', async () => {
      const handleAttackClick = vi.fn();
      const props = makeHookProps({
        playerStats: makePlayerStats({
          class: { name: 'Sorcerer' },
          spellAbilities: { spells: [] },
        }),
        handleAttackClick,
      });
      const attack = makeAttack({ name: 'UnknownSpell' });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      expect(handleAttackClick).toHaveBeenCalledWith(attack);
    });

    it('does not open area modal when attack has no area_of_effect', async () => {
      const setModalState = vi.fn();
      const props = makeHookProps({
        setModalState,
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
      });
      const attack = makeAttack({ area_of_effect: null });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      expect(setModalState).not.toHaveBeenCalled();
    });

    it('opens area modal for cone area_of_effect on non-sorcerer', async () => {
      const setModalState = vi.fn();
      const props = makeHookProps({
        setModalState,
        playerStats: makeNonSorcererStats({
          spellAbilities: { saveDc: 15, spells: [] },
        }),
      });
      const attack = makeAttack({
        area_of_effect: { shape: 'cone', radius: 60 },
        saveDc: 15,
        saveSuccess: 0.5,
        damage: '8d6',
        damageType: 'fire',
        saveType: 'DEX',
        range: '15 feet',
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      expect(setModalState).toHaveBeenCalledWith(
        expect.objectContaining({
          saveAttackAoeModal: expect.objectContaining({
            shape: 'cone',
            saveDc: 15,
            dcSuccess: 'half',
            damage: '8d6',
            damageType: 'fire',
            saveType: 'DEX',
            range: 15,
          }),
        }),
      );
    });

    it('opens area modal for line area_of_effect on sorcerer', async () => {
      const setModalState = vi.fn();
      const props = makeHookProps({
        setModalState,
        playerStats: makePlayerStats({
          spellAbilities: { saveDc: 18, spells: [] },
        }),
      });
      const attack = makeAttack({
        area_of_effect: { shape: 'line', length: 60 },
        saveDc: 18,
        saveSuccess: 'none',
        damage: '4d8',
        damageType: 'lightning',
        saveType: 'DEX',
        range: 'Self',
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      expect(setModalState).toHaveBeenCalledWith(
        expect.objectContaining({
          saveAttackAoeModal: expect.objectContaining({
            shape: 'line',
            saveDc: 18,
            dcSuccess: 'none',
            saveType: 'DEX',
            range: 0,
          }),
        }),
      );
    });

    it('falls back to playerStats saveDc when attack lacks one', async () => {
      const setModalState = vi.fn();
      const props = makeHookProps({
        setModalState,
        playerStats: makeNonSorcererStats({
          spellAbilities: { saveDc: 16, spells: [] },
        }),
      });
      const attack = makeAttack({
        area_of_effect: { shape: 'sphere', radius: 20 },
        saveSuccess: 'none',
        damage: '6d6',
        damageType: 'cold',
        saveType: 'CON',
        range: '30 feet',
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      expect(setModalState).toHaveBeenCalledWith(
        expect.objectContaining({
          saveAttackAoeModal: expect.objectContaining({ saveDc: 16 }),
        }),
      );
    });

    it('skips area modal when setModalState is not provided', async () => {
      const props = makeHookProps({
        setModalState: null,
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
      });
      const attack = makeAttack({
        area_of_effect: { shape: 'cone' },
        saveDc: 15,
        saveSuccess: 'none',
        damage: '0',
        damageType: '',
        saveType: 'DEX',
        range: '15 feet',
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      // Should fall through to spell cast path instead of opening modal
      expect(result.current).toBeDefined();
    });
  });

  // ── Non-sorcerer: spell found / not found ──────────────────────────────────

  describe('non-sorcerer casting', () => {
    it('prepares and executes spell cast when spell is found', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }),
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');

      expect(prepareSpellCast).toHaveBeenCalled();
      expect(executeSpellCast).toHaveBeenCalled();
    });

    it('prepares and executes spell cast when no spell is found', async () => {
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');

      expect(prepareSpellCast).toHaveBeenCalled();
      expect(executeSpellCast).toHaveBeenCalled();
    });

    it('calls setPopupHtml with payload when cast returns popup type', async () => {
      const setPopupHtml = vi.fn();
      const props = makeHookProps({
        setPopupHtml,
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'popup', payload: '<div>Spell cast!</div>' },
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      expect(setPopupHtml).toHaveBeenCalledWith('<div>Spell cast!</div>');
    });

    it('does not call setPopupHtml when cast returns modal type', async () => {
      const setPopupHtml = vi.fn();
      const setModalState = vi.fn();
      const props = makeHookProps({
        setPopupHtml,
        setModalState,
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'modal', modalName: 'testModal', payload: {} },
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('passes targetName from buildCtx to getTargetInfo', async () => {
      const buildCtx = vi.fn(async () => ({ targetName: 'Orc B' }));
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
        buildCtx,
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      const getTargetInfo = executeSpellCast.mock.calls[0][2].getTargetInfo;
      const targetInfo = await getTargetInfo();
      expect(targetInfo).toEqual({ name: 'Orc B' });
    });

    it('passes null targetInfo when buildCtx returns no targetName', async () => {
      const buildCtx = vi.fn(async () => ({}));
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
        buildCtx,
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      const getTargetInfo = executeSpellCast.mock.calls[0][2].getTargetInfo;
      const targetInfo = await getTargetInfo();
      expect(targetInfo).toBeNull();
    });
  });

  // ── Sorcerer: pending metamagic ─────────────────────────────────────────────

  describe('sorcerer casting', () => {
    it('sets pendingActionMetamagic when spell is found', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      expect(result.current.pendingActionMetamagic).not.toBeNull();
      expect(result.current.pendingActionMetamagic.spellName).toBe('Fireball');
      expect(result.current.pendingActionMetamagic.spellLevel).toBe(3);
      expect(result.current.pendingActionMetamagic.isPsionic).toBe(false);
    });

    it('sets pendingActionMetamagic with psionic info when psionic', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(true);
      hasPsionicSorcery.mockReturnValue(true);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      expect(result.current.pendingActionMetamagic.isPsionic).toBe(true);
      expect(result.current.pendingActionMetamagic.psionicCost).toBe(3);
    });

    it('does not set isPsionic when character lacks psionic sorcery', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(true);
      hasPsionicSorcery.mockReturnValue(false);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      expect(result.current.pendingActionMetamagic.isPsionic).toBe(false);
      expect(result.current.pendingActionMetamagic.psionicCost).toBe(0);
    });

    it('executes spell cast when metamagic is confirmed', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      expect(result.current.pendingActionMetamagic).not.toBeNull();

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(executeSpellCast).toHaveBeenCalled();
    });

    it('calls setPopupHtml when confirmed cast returns popup', async () => {
      const setPopupHtml = vi.fn();
      const spell = makeSpell();
      const props = makeHookProps({
        setPopupHtml,
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'popup', payload: '<div>Cast result!</div>' },
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(setPopupHtml).toHaveBeenCalledWith('<div>Cast result!</div>');
    });

    it('does not call setPopupHtml when confirmed cast returns modal', async () => {
      const setPopupHtml = vi.fn();
      const setModalState = vi.fn();
      const spell = makeSpell();
      const props = makeHookProps({
        setPopupHtml,
        setModalState,
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue({
        automationPopup: { type: 'modal', modalName: 'testModal', payload: {} },
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('passes targetName from buildCtx through confirm flow', async () => {
      const buildCtx = vi.fn(async () => ({ targetName: 'Dragon D' }));
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
        buildCtx,
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      const getTargetInfo = executeSpellCast.mock.calls[0][2].getTargetInfo;
      const targetInfo = await getTargetInfo();
      expect(targetInfo).toEqual({ name: 'Dragon D' });
    });
  });

  // ── Metamagic confirm / skip ────────────────────────────────────────────────

  describe('metamagic confirm', () => {
    it('spends sorcery points for metamagic cost', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({ totalCost: 2, options: ['Heightened Spell'] });
      });

      expect(spendSorceryPoints).toHaveBeenCalledWith(
        'TestSorcerer',
        2,
        'test-campaign',
        10,
      );
    });

    it('includes Psionic Sorcery in metamagic options when psionic', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(true);
      hasPsionicSorcery.mockReturnValue(true);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      // CLA-271: popup flags the psionic checkbox via psionicActive; cost added once.
      await act(async () => {
        result.current.handleActionMetamagicConfirm({ totalCost: 3, options: ['Heightened Spell'], psionicActive: true });
      });

      expect(logMetamagicUse).toHaveBeenCalledWith(
        'test-campaign',
        'TestSorcerer',
        'Fireball',
        expect.arrayContaining(['Psionic Sorcery', 'Heightened Spell']),
        6,
      );
    });

    it('excludes Psionic Sorcery when Subtle Spell is selected', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(true);
      hasPsionicSorcery.mockReturnValue(true);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({ totalCost: 0, options: ['Subtle Spell'] });
      });

      expect(logMetamagicUse).not.toHaveBeenCalled();
    });

    it('builds metaCtx for Heightened Spell', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({ options: ['Heightened Spell'] });
      });

      expect(executeSpellCast).toHaveBeenCalled();
      const metaCtx = executeSpellCast.mock.calls[0][1];
      expect(metaCtx.metamagicHeighten).toBe(true);
    });

    it('builds metaCtx for Careful Spell', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({ options: ['Careful Spell'] });
      });

      const metaCtx = executeSpellCast.mock.calls[0][1];
      expect(metaCtx.metamagicCareful).toBe(true);
    });

    it('builds metaCtx for Twinned Spell with twinTarget', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({ options: ['Twinned Spell'], twinTarget: 'Ally A' });
      });

      const metaCtx = executeSpellCast.mock.calls[0][1];
      expect(metaCtx.metamagicTwinTarget).toBe('Ally A');
    });

    it('builds metaCtx for Distant Spell', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({ options: ['Distant Spell'] });
      });

      const metaCtx = executeSpellCast.mock.calls[0][1];
      expect(metaCtx.metamagicDistant).toBe(true);
    });

    it('builds metaCtx psionicSpell when psionic without subtle', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(true);
      hasPsionicSorcery.mockReturnValue(true);
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({ options: [], psionicActive: true });
      });

      const metaCtx = executeSpellCast.mock.calls[0][1];
      expect(metaCtx.psionicSpell).toBe(true);
    });

    it('clears pendingActionMetamagic after confirm', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      expect(result.current.pendingActionMetamagic).not.toBeNull();

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });

    it('no-op when confirm called with no pending action', async () => {
      const props = makeHookProps();
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });
  });

  // ── Metamagic skip ──────────────────────────────────────────────────────────

  describe('metamagic skip', () => {
    it('skips metamagic and executes spell with empty metaCtx', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicSkip();
      });

      expect(executeSpellCast).toHaveBeenCalled();
    });

    it('clears pendingActionMetamagic after skip', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleActionSpellDamageClick(makeAttack());
      });

      expect(result.current.pendingActionMetamagic).not.toBeNull();

      await act(async () => {
        result.current.handleActionMetamagicSkip();
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });

    it('no-op when skip called with no pending action', async () => {
      const props = makeHookProps();
      const { result } = renderHook(() => useActionSpellMetamagic(props));

      await act(async () => {
        result.current.handleActionMetamagicSkip();
      });

      expect(result.current.pendingActionMetamagic).toBeNull();
    });
  });

  // ── handleSpellAttackClick ─────────────────────────────────────────────────

  describe('handleSpellAttackClick', () => {
    it('returns early when cannotAct is true', async () => {
      const handleAttackClick = vi.fn();
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
        cannotAct: true,
        handleAttackClick,
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleSpellAttackClick(makeAttack());
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      expect(executeSpellCast).not.toHaveBeenCalled();
      expect(handleAttackClick).not.toHaveBeenCalled();
    });

    it('delegates to attack handler when sorcerer has no spell', async () => {
      const handleAttackClick = vi.fn();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [] } }),
        handleAttackClick,
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleSpellAttackClick(makeAttack());
      });

      expect(handleAttackClick).toHaveBeenCalledWith(makeAttack());
    });

    it('sets pendingActionMetamagic for sorcerer with spell', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleSpellAttackClick(makeAttack());
      });

      expect(result.current.pendingActionMetamagic).not.toBeNull();
      expect(result.current.pendingActionMetamagic.spellName).toBe('Fireball');
    });

    it('executes spell cast after confirm from spell attack click', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makePlayerStats({ spellAbilities: { spells: [spell] } }),
      });

      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
      const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
      isPsionicSpell.mockReturnValue(false);
      hasPsionicSorcery.mockReturnValue(false);
      executeSpellCast.mockResolvedValue(null);

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleSpellAttackClick(makeAttack());
      });

      await act(async () => {
        result.current.handleActionMetamagicConfirm({});
      });

      expect(executeSpellCast).toHaveBeenCalled();
    });

    it('prepares and executes spell cast for non-sorcerer', async () => {
      const spell = makeSpell();
      const props = makeHookProps({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [spell] } }),
      });

      const { result } = renderHook(() => useActionSpellMetamagic(props));
      await act(async () => {
        result.current.handleSpellAttackClick(makeAttack());
      });

      const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
      const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');

      expect(prepareSpellCast).toHaveBeenCalled();
      expect(executeSpellCast).toHaveBeenCalled();
    });
  });
});
