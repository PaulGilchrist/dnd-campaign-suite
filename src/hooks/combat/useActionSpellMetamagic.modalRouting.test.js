// @created-by-ai
// CLA-389: the metamagic cast lanes of useActionSpellMetamagic previously had
// an empty branch that DISCARDED modal-type cast results (Wild Magic Surge
// chooser). The payloads must route into sheet modal state through the same
// key map the verified useSpellCastExecutor lane uses.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import {
  makeHookProps,
  makePlayerStats,
  makeNonSorcererStats,
  makeSpell,
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

const SURGE_MODAL_PAYLOAD = {
  featureName: 'Wild Magic Surge',
  surgeTable: [{ min: 1, max: 100, effect: 'Teleport 60 ft' }],
  campaignName: 'test-campaign',
  mode: 'roll',
  roll: 42,
};

describe('useActionSpellMetamagic CLA-389 modal routing', () => {
  setupBeforeEach();

  it('routes a top-level wildMagicSurge modal result into setModalState (sorcerer spell-attack lane)', async () => {
    const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
    executeSpellCast.mockResolvedValue({
      type: 'modal',
      modalName: 'wildMagicSurge',
      payload: SURGE_MODAL_PAYLOAD,
    });

    const setModalState = vi.fn();
    const setPopupHtml = vi.fn();
    const spell = makeSpell({ level: 1 });
    const playerStats = makePlayerStats({
      spellAbilities: { spells: [spell] },
    });
    const props = makeHookProps({ playerStats, setModalState, setPopupHtml });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      await result.current.handleSpellAttackClick({ name: spell.name, spellLevel: 1 });
    });
    await act(async () => {
      result.current.handleActionMetamagicConfirm({ options: [], totalCost: 0 });
    });

    expect(executeSpellCast).toHaveBeenCalled();
    expect(setModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: SURGE_MODAL_PAYLOAD });
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  it('routes an automationPopup-wildMagicSurge modal result into setModalState (non-sorcerer known-spell lane)', async () => {
    const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
    executeSpellCast.mockResolvedValue({
      automationPopup: {
        type: 'modal',
        modalName: 'wildMagicSurge',
        payload: SURGE_MODAL_PAYLOAD,
      },
    });

    const setModalState = vi.fn();
    const spell = makeSpell({ level: 1 });
    const playerStats = makeNonSorcererStats({
      spellAbilities: { spells: [spell] },
    });
    const props = makeHookProps({ playerStats, setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      await result.current.handleSpellAttackClick({ name: spell.name, spellLevel: 1 });
    });

    expect(executeSpellCast).toHaveBeenCalled();
    expect(setModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: SURGE_MODAL_PAYLOAD });
  });

  it('shows a top-level d20-gate info popup (not discarded) via setPopupHtml', async () => {
    const gatePopup = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Wild Magic Surge',
        description: 'Wild Magic Surge: Rolled 11 (not a 20). No surge occurs.',
      },
    };
    const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
    executeSpellCast.mockResolvedValue(gatePopup);

    const setModalState = vi.fn();
    const setPopupHtml = vi.fn();
    const spell = makeSpell({ level: 1 });
    const playerStats = makePlayerStats({
      spellAbilities: { spells: [spell] },
    });
    const props = makeHookProps({ playerStats, setModalState, setPopupHtml });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      await result.current.handleSpellAttackClick({ name: spell.name, spellLevel: 1 });
    });
    await act(async () => {
      result.current.handleActionMetamagicConfirm({ options: [], totalCost: 0 });
    });

    expect(setPopupHtml).toHaveBeenCalledWith(gatePopup.payload);
    expect(setModalState).not.toHaveBeenCalledWith(expect.objectContaining({ wildMagicSurgeModal: expect.anything() }));
  });

  it('controlledChaos-mode modal payload routes to wildMagicSurgeModal', async () => {
    const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');
    executeSpellCast.mockResolvedValue({
      type: 'modal',
      modalName: 'wildMagicSurge',
      payload: { ...SURGE_MODAL_PAYLOAD, mode: 'controlledChaos', roll1: 19, roll2: 73 },
    });

    const setModalState = vi.fn();
    const spell = makeSpell({ level: 1 });
    const playerStats = makePlayerStats({
      spellAbilities: { spells: [spell] },
    });
    const props = makeHookProps({ playerStats, setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      await result.current.handleSpellAttackClick({ name: spell.name, spellLevel: 1 });
    });
    await act(async () => {
      result.current.handleActionMetamagicConfirm({ options: [], totalCost: 0 });
    });

    expect(setModalState).toHaveBeenCalledWith(expect.objectContaining({
      wildMagicSurgeModal: expect.objectContaining({ mode: 'controlledChaos' }),
    }));
  });
});
