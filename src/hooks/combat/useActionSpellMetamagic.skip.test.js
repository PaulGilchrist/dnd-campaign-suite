// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import {
  makeHookProps,
  makeSpell,
  makeAttack,
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

// Skip lane: handleActionMetamagicSkip must clear pending, log a free-cast
// spell entry (metamagic: [], spCost: 0), and fire the pending action with
// an empty metaCtx. Queuing, confirm payment, AoE guards, and modal routing
// are owned by the sibling lanes (castClick / confirm / aoeClick /
// modalRouting / attackClick).
describe('useActionSpellMetamagic - handleActionMetamagicSkip', () => {
  setupBeforeEach();

  const sorcererWith = (...spells) =>
    makeHookProps({
      playerStats: {
        name: 'TestSorcerer',
        class: { name: 'Sorcerer' },
        level: 5,
        spellAbilities: { spells },
      },
    });

  it('clears pending, logs a free-cast spell entry, and casts with empty metaCtx', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');

    const props = sorcererWith(makeSpell());
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      result.current.handleActionSpellDamageClick(makeAttack());
    });
    expect(result.current.pendingActionMetamagic).not.toBeNull();

    await act(async () => {
      result.current.handleActionMetamagicSkip();
    });

    expect(result.current.pendingActionMetamagic).toBeNull();
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'spell',
        characterName: 'TestSorcerer',
        spellName: 'Fireball',
        spellLevel: 3,
        castingTime: '1 Action',
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      }),
    );
    expect(executeSpellCast).toHaveBeenCalledTimes(1);
    expect(executeSpellCast.mock.calls[0][1]).toEqual({});
  });

  it('does not log or call spell services when skipping with no pending action', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { executeSpellCast } = await import('../../services/rules/spells/spellCastService.js');

    const { result } = renderHook(() => useActionSpellMetamagic(makeHookProps()));

    await act(async () => {
      result.current.handleActionMetamagicSkip();
    });

    expect(result.current.pendingActionMetamagic).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
    expect(executeSpellCast).not.toHaveBeenCalled();
  });

  it('logs fallback spellLevel 0 and castingTime "Action" when pending lacks them', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');

    const spell = makeSpell({ name: 'Silent Image', level: undefined, casting_time: undefined });
    const attack = { name: 'Silent Image', spellLevel: undefined, castingTime: undefined };

    const { result } = renderHook(() => useActionSpellMetamagic(sorcererWith(spell)));

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    await act(async () => {
      result.current.handleActionMetamagicSkip();
    });

    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        spellName: 'Silent Image',
        spellLevel: 0,
        castingTime: 'Action',
      }),
    );
  });
});
