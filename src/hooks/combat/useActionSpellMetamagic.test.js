// @maintained-by-ai: 2026-10-14
// Base lane: hook mount/state basics and the isBonusSorcerer metamagic gate only.
// Behaviour lanes own the paths: castClick, attackClick, aoeClick, confirm, skip, modalRouting.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import {
  makeHookProps,
  makePlayerStats,
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

describe('useActionSpellMetamagic (base)', () => {
  setupBeforeEach();

  it('mounts with null pending state and the full handler API', () => {
    const { result } = renderHook(() => useActionSpellMetamagic(makeHookProps()));

    expect(result.current.pendingActionMetamagic).toBeNull();
    expect(result.current).toMatchObject({
      handleActionMetamagicConfirm: expect.any(Function),
      handleActionMetamagicSkip: expect.any(Function),
      handleActionSpellDamageClick: expect.any(Function),
      handleSpellAttackClick: expect.any(Function),
    });
  });

  it.each([
    ['Sorcerer', makePlayerStats(), true],
    ['Wizard', makeNonSorcererStats(), false],
    ['class-less character', { name: 'TestChar' }, false],
  ])('isBonusSorcerer gate: %s → %s', (_label, playerStats, expected) => {
    const { result } = renderHook(() =>
      useActionSpellMetamagic(makeHookProps({ playerStats })),
    );

    expect(result.current.isBonusSorcerer).toBe(expected);
  });
});
