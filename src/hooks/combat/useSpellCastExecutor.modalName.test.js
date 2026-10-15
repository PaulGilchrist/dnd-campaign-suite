// @maintained-by-ai: 2026-10-14
// Owns modalName field-derivation semantics only: how a bare (non-automationPopup)
// modalName result is dispatched, including the unknown-name guard. The full
// modalName→modal-state key map lives in useSpellCastExecutor.modalRouting.test.js;
// automationPopup precedence lives in useSpellCastExecutor.automationPopup.test.js.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { renderHook, act } from '@testing-library/react';
import { useSpellCastExecutor } from './useSpellCastExecutor.js';

function makeProps(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: { name: 'TestCaster' },
    getTargetInfo: vi.fn(),
    campaignName: 'TestCampaign',
    mapName: 'TestMap',
    characters: [],
    setPopupHtml: vi.fn(),
    extraMeta: {},
    ...overrides,
  };
}

// Cast Fireball with a stubbed bare-modalName result; returns the props plus
// setModalState so tests can assert dispatch without repeating the seam setup.
async function castWithModalNameResult(result, propOverrides = {}) {
  executeSpellCast.mockResolvedValue(result);
  const setModalState = propOverrides.setModalState ?? vi.fn();
  const props = makeProps({ ...propOverrides, setModalState });
  const { result: hook } = renderHook(() => useSpellCastExecutor(props));
  await act(async () => {
    await hook.current.castAction({ name: 'Fireball' }, {});
  });
  return { props, setModalState };
}

describe('useSpellCastExecutor — bare modalName derivation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs console.error and routes nowhere when modalName is missing from the key map', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
    try {
      const { props, setModalState } = await castWithModalNameResult({
        modalName: 'unknownModalType',
        payload: { action: { name: 'Unknown' } },
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useSpellCastExecutor] Unknown modalName from spell cast: unknownModalType'
      );
      expect(setModalState).not.toHaveBeenCalled();
      expect(props.setPopupHtml).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('stays silent on the known-name side of the guard — known modalName never logs the unknown-name error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
    try {
      const { setModalState } = await castWithModalNameResult({
        modalName: 'massHealTarget',
        payload: { action: { name: 'Mass Heal' } },
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ massHealModal: { action: { name: 'Mass Heal' } } });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
