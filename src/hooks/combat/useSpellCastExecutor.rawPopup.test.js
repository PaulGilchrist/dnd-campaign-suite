// CLA-389: raw {type:'popup'} trigger results (Wild Magic Surge non-20 roll /
// once-per-turn refusal) must not be silently swallowed by castAction.
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

function renderWith(props) {
  return renderHook(() =>
    useSpellCastExecutor(props)
  );
}

describe('useSpellCastExecutor — raw {type:popup} results (CLA-389)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces raw popup trigger result via setPopupHtml', async () => {
    const props = makeProps();
    const payload = {
      type: 'automation_info',
      name: 'Wild Magic Surge',
      description: 'Wild Magic Surge: Rolled 7 (not a 20). No surge occurs.',
    };
    executeSpellCast.mockResolvedValue({ type: 'popup', payload });

    const { result } = renderWith(props);
    await act(async () => {
      await result.current.castAction({ name: 'Magic Missile' }, {});
    });

    expect(props.setPopupHtml).toHaveBeenCalledWith(payload);
  });

  it('surfaces once-per-turn refusal raw popup via setPopupHtml', async () => {
    const props = makeProps();
    const payload = {
      type: 'automation_info',
      name: 'Wild Magic Surge',
      description: 'Wild Magic Surge can only be used once per turn.',
    };
    executeSpellCast.mockResolvedValue({ type: 'popup', payload });

    const { result } = renderWith(props);
    await act(async () => {
      await result.current.castAction({ name: 'Magic Missile' }, {});
    });

    expect(props.setPopupHtml).toHaveBeenCalledWith(payload);
  });

  it('still routes modal results to setModalState, not setPopupHtml', async () => {
    const setModalState = vi.fn();
    const props = makeProps({ setModalState });
    executeSpellCast.mockResolvedValue({
      type: 'modal',
      modalName: 'wildMagicSurge',
      payload: { mode: 'roll', roll: 42 },
    });

    const { result } = renderWith(props);
    await act(async () => {
      await result.current.castAction({ name: 'Magic Missile' }, {});
    });

    expect(setModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: { mode: 'roll', roll: 42 } });
    expect(props.setPopupHtml).not.toHaveBeenCalled();
  });

  it('does not call setPopupHtml when result is null', async () => {
    const props = makeProps();
    executeSpellCast.mockResolvedValue(null);

    const { result } = renderWith(props);
    await act(async () => {
      await result.current.castAction({ name: 'Magic Missile' }, {});
    });

    expect(props.setPopupHtml).not.toHaveBeenCalled();
  });
});
