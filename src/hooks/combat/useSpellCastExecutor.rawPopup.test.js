// @maintained-by-ai: 2026-10-14
// CLA-389: owns the bare {type:'popup'} cast-result seam — trigger results
// (Wild Magic Surge non-20 roll, once-per-turn refusal) that arrive outside an
// automationPopup wrapper must reach setPopupHtml, never be silently swallowed.
// Exhaustive modalName key-map routing lives in useSpellCastExecutor.modalRouting.test.js;
// automationPopup precedence in useSpellCastExecutor.automationPopup.test.js;
// falsy-result silence in useSpellCastExecutor.healResult.test.js and castAction.test.js.
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

// CLA-389 trigger-result payloads: non-20 surge roll and once-per-turn refusal.
const RAW_POPUP_PAYLOADS = [
  [
    'non-20 surge roll',
    {
      type: 'automation_info',
      name: 'Wild Magic Surge',
      description: 'Wild Magic Surge: Rolled 7 (not a 20). No surge occurs.',
    },
  ],
  [
    'once-per-turn refusal',
    {
      type: 'automation_info',
      name: 'Wild Magic Surge',
      description: 'Wild Magic Surge can only be used once per turn.',
    },
  ],
];

describe('useSpellCastExecutor — raw {type:popup} results (CLA-389)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(RAW_POPUP_PAYLOADS)(
    'surfaces bare popup result for %s via setPopupHtml, modal state untouched',
    async (_label, payload) => {
      const setModalState = vi.fn();
      const props = makeProps({ setModalState });
      executeSpellCast.mockResolvedValue({ type: 'popup', payload });

      const { result } = renderHook(() => useSpellCastExecutor(props));
      await act(async () => {
        await result.current.castAction({ name: 'Magic Missile' }, {});
      });

      expect(props.setPopupHtml).toHaveBeenCalledWith(payload);
      expect(setModalState).not.toHaveBeenCalled();
    },
  );
});
