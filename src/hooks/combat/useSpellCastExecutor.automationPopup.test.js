// @maintained-by-ai: 2026-10-14
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

// Cast Fireball with a stubbed cast result; returns the props so tests can
// assert on setPopupHtml / setModalState routing.
async function castWithResult(result, propOverrides = {}) {
  executeSpellCast.mockResolvedValue(result);
  const props = makeProps(propOverrides);
  const { result: hook } = renderHook(() => useSpellCastExecutor(props));
  await act(async () => {
    await hook.current.castAction({ name: 'Fireball' }, {});
  });
  return props;
}

describe('useSpellCastExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('castAction — automationPopup routing', () => {
    // Every non-modal (or modal-without-setModalState) automationPopup shape
    // funnels through the same setPopupHtml(popup.payload) else-branch.
    it.each([
      ['type popup', { type: 'popup', payload: '<div>Spell cast!</div>' }],
      ['missing type', { payload: '<div>Default popup</div>' }],
      ['unknown type with object payload', { type: 'heal', payload: { key: 'value' } }],
      ['missing payload', { type: 'popup' }],
      ['type modal without setModalState', { type: 'modal', modalName: 'massHealTarget', payload: '<div>Mass heal</div>' }],
    ])('%s → setPopupHtml(payload)', async (_label, automationPopup) => {
      const props = await castWithResult({ automationPopup });

      expect(props.setPopupHtml).toHaveBeenCalledWith(automationPopup.payload);
    });

    it('type modal routes to setModalState via the modal key map, not setPopupHtml', async () => {
      const setModalState = vi.fn();
      const payload = { action: { name: 'Test' } };

      const props = await castWithResult(
        { automationPopup: { type: 'modal', modalName: 'massHealTarget', payload } },
        { setModalState }
      );

      expect(setModalState).toHaveBeenCalledWith({ massHealModal: payload });
      expect(props.setPopupHtml).not.toHaveBeenCalled();
    });

    it('automationPopup takes priority over modalName, raw popup, and heal fields', async () => {
      const setModalState = vi.fn();

      const props = await castWithResult(
        {
          automationPopup: { payload: '<div>Automation!</div>' },
          type: 'popup',
          payload: '<div>Raw popup</div>',
          modalName: 'massHealTarget',
          targetName: 'Ally 1',
          healAmount: 10,
        },
        { setModalState }
      );

      expect(props.setPopupHtml).toHaveBeenCalledTimes(1);
      expect(props.setPopupHtml).toHaveBeenCalledWith('<div>Automation!</div>');
      expect(setModalState).not.toHaveBeenCalled();
    });
  });
});
