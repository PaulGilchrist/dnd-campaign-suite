// @maintained-by-ai: 2026-10-14
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { renderHook, act } from '@testing-library/react';
import { useSpellCastExecutor } from './useSpellCastExecutor.js';

function makeSpell(overrides = {}) {
  return { name: 'Fireball', ...overrides };
}

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

describe('useSpellCastExecutor — error handling', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // Authoritative seam: the .catch() in runCast logs the rejection value
  // VERBATIM (never coerced to e.message) and never renders a popup or modal.
  it.each([
    ['Error', new Error('Cast failed')],
    ['string', 'string error'],
    ['undefined', undefined],
    ['null', null],
  ])('logs %s rejections verbatim without popup or modal', async (_label, value) => {
    const setModalState = vi.fn();
    const props = makeProps({ setModalState });
    executeSpellCast.mockRejectedValue(value);

    const { result } = renderHook(() => useSpellCastExecutor(props));

    await act(async () => {
      await result.current.castAction(makeSpell(), {});
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useSpellCastExecutor] executeSpellCast error for Fireball:',
      value,
    );
    expect(props.setPopupHtml).not.toHaveBeenCalled();
    expect(setModalState).not.toHaveBeenCalled();
  });

  it('remains usable after a cast rejection — next cast routes normally', async () => {
    const props = makeProps();
    executeSpellCast
      .mockRejectedValueOnce(new Error('First cast failed'))
      .mockResolvedValueOnce({ automationPopup: { type: 'popup', payload: '<div>Recovered</div>' } });

    const { result } = renderHook(() => useSpellCastExecutor(props));

    await act(async () => {
      await result.current.castAction(makeSpell(), {});
    });
    expect(props.setPopupHtml).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.castAction(makeSpell(), {});
    });
    expect(executeSpellCast).toHaveBeenCalledTimes(2);
    expect(props.setPopupHtml).toHaveBeenCalledWith('<div>Recovered</div>');
  });
});
