// @maintained-by-ai: 2026-10-14
// CLA-389 routeCastModal decision table for THIS lane only: how showCastPopup
// unwraps a castResult shape and picks a sink. This file owns the top-level
// unwrap branches (runPostCastTriggers returns modal/popup results at the TOP
// level of castResult) plus the setModalState-less fallback and unknown-modal
// discard — shapes no sibling exercises.
//
// Covered elsewhere (NOT re-tested here): automationPopup-wrapped popup/modal
// results and getTargetInfo threading (castClick), forcedMode threading and
// attack-click dispatch (attackClick), confirm payment/metaCtx semantics
// (confirm), skip logging (skip), AoE modal guards (aoeClick), and the full
// MODAL_STATE_KEYS key map + payload pass-through
// (useSpellCastExecutor.modalRouting.test.js).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import {
  makeHookProps,
  makeAttack,
  makeSpell,
  makePlayerStats,
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

const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');

const SURGE_PAYLOAD = { featureName: 'Wild Magic Surge', campaignName: 'test-campaign' };

// Sorcerer queues metamagic from a damage click, then confirms with no-cost
// options — the CLA-389 lane where a post-cast trigger surfaces its result at
// the TOP level of castResult. Returns the props so tests read their sinks.
async function castWith(castResult, propOverrides = {}) {
  executeSpellCast.mockResolvedValue(castResult);
  const props = makeHookProps({
    playerStats: makePlayerStats({ spellAbilities: { spells: [makeSpell()] } }),
    ...propOverrides,
  });
  const { result } = renderHook(() => useActionSpellMetamagic(props));

  await act(async () => {
    await result.current.handleActionSpellDamageClick(makeAttack());
  });
  expect(result.current.pendingActionMetamagic).not.toBeNull();
  await act(async () => {
    result.current.handleActionMetamagicConfirm({ options: [], totalCost: 0 });
  });
  return props;
}

describe('useActionSpellMetamagic CLA-389 routeCastModal decision table', () => {
  setupBeforeEach();

  it.each([
    ['top-level type modal', { type: 'modal', modalName: 'wildMagicSurge', payload: SURGE_PAYLOAD }],
    ['top-level modalName (no type)', { modalName: 'wildMagicSurge', payload: SURGE_PAYLOAD }],
  ])('routes a %s castResult into setModalState, never as a popup', async (_label, castResult) => {
    const props = await castWith(castResult);

    expect(props.setModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: SURGE_PAYLOAD });
    expect(props.setPopupHtml).not.toHaveBeenCalled();
  });

  it('shows a top-level popup castResult (d20-gate info) via setPopupHtml, never as a modal', async () => {
    const gate = { type: 'automation_info', name: 'Wild Magic Surge', description: 'Rolled 11 (not a 20).' };
    const props = await castWith({ type: 'popup', payload: gate });

    expect(props.setPopupHtml).toHaveBeenCalledWith(gate);
    expect(props.setModalState).not.toHaveBeenCalled();
  });

  it('discards an unknown modalName without a popup fallback', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const props = await castWith({ type: 'modal', modalName: 'notAModal', payload: SURGE_PAYLOAD });

    expect(props.setModalState).not.toHaveBeenCalled();
    expect(props.setPopupHtml).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('falls back to setPopupHtml when a modal castResult arrives with no setModalState', async () => {
    const props = await castWith(
      { type: 'modal', modalName: 'wildMagicSurge', payload: SURGE_PAYLOAD },
      { setModalState: undefined },
    );

    expect(props.setPopupHtml).toHaveBeenCalledWith(SURGE_PAYLOAD);
  });
});
