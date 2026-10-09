// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

describe('useActionSpellMetamagic - handleActionMetamagicSkip', () => {
  setupBeforeEach();

  // ── Skip with pending action ─────────────────────────────────────────────

  it('clears pending and logs spell entry when skipping with a pending action', async () => {
    const spell = makeSpell();
    const props = makeHookProps({
      playerStats: {
        name: 'TestSorcerer',
        class: { name: 'Sorcerer' },
        level: 5,
        spellAbilities: { spells: [spell] },
      },
    });
    const { addEntry } = await import('../../services/ui/logService.js');
    const { isPsionicSpell, hasPsionicSorcery } = await import(
      '../../services/rules/spells/metamagicRules.js'
    );
    const { executeSpellCast } = await import(
      '../../services/rules/spells/spellCastService.js'
    );

    isPsionicSpell.mockReturnValue(false);
    hasPsionicSorcery.mockReturnValue(false);
    executeSpellCast.mockResolvedValue(null);

    const attack = makeAttack({ name: 'Fireball', spellLevel: 3, castingTime: '1 Action' });

    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
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
    expect(executeSpellCast).toHaveBeenCalled();
  });

  it('does not log or call spell services when skipping with no pending action', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    const { executeSpellCast } = await import(
      '../../services/rules/spells/spellCastService.js'
    );

    const props = makeHookProps();
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      result.current.handleActionMetamagicSkip();
    });

    expect(result.current.pendingActionMetamagic).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
    expect(executeSpellCast).not.toHaveBeenCalled();
  });

  it('calls the pending action with empty metaCtx on skip', async () => {
    const spell = makeSpell();
    const props = makeHookProps({
      playerStats: {
        name: 'TestSorcerer',
        class: { name: 'Sorcerer' },
        level: 5,
        spellAbilities: { spells: [spell] },
      },
    });
    const { executeSpellCast } = await import(
      '../../services/rules/spells/spellCastService.js'
    );
    const { isPsionicSpell, hasPsionicSorcery } = await import(
      '../../services/rules/spells/metamagicRules.js'
    );

    isPsionicSpell.mockReturnValue(false);
    hasPsionicSorcery.mockReturnValue(false);
    executeSpellCast.mockResolvedValue(null);

    const attack = makeAttack({ name: 'Fireball', spellLevel: 3, castingTime: '1 Action' });

    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    const pendingBefore = result.current.pendingActionMetamagic;

    await act(async () => {
      result.current.handleActionMetamagicSkip();
    });

    expect(executeSpellCast).toHaveBeenCalled();
    const metaCtx = executeSpellCast.mock.calls[0][1];
    expect(metaCtx).toEqual({});
    expect(result.current.pendingActionMetamagic).toBeNull();
    expect(result.current.pendingActionMetamagic).not.toBe(pendingBefore);
  });

  it('logs correct castingTime from pending action on skip', async () => {
    const spell = makeSpell({
      name: 'Hypnotic Pattern',
      level: 3,
      casting_time: '1 Action',
    });
    const props = makeHookProps({
      playerStats: {
        name: 'TestSorcerer',
        class: { name: 'Sorcerer' },
        level: 5,
        spellAbilities: { spells: [spell] },
      },
    });
    const { addEntry } = await import('../../services/ui/logService.js');
    const { executeSpellCast } = await import(
      '../../services/rules/spells/spellCastService.js'
    );
    const { isPsionicSpell, hasPsionicSorcery } = await import(
      '../../services/rules/spells/metamagicRules.js'
    );

    isPsionicSpell.mockReturnValue(false);
    hasPsionicSorcery.mockReturnValue(false);
    executeSpellCast.mockResolvedValue(null);

    const attack = makeAttack({
      name: 'Hypnotic Pattern',
      spellLevel: 3,
      castingTime: '1 Action',
    });

    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    await act(async () => {
      result.current.handleActionMetamagicSkip();
    });

    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        spellName: 'Hypnotic Pattern',
        castingTime: '1 Action',
      }),
    );
  });

  it('logs default castingTime "Action" when pending lacks castingTime', async () => {
    const spell = makeSpell({ name: 'Silent Image', level: 1, casting_time: undefined });
    const props = makeHookProps({
      playerStats: {
        name: 'TestSorcerer',
        class: { name: 'Sorcerer' },
        level: 5,
        spellAbilities: { spells: [spell] },
      },
    });
    const { addEntry } = await import('../../services/ui/logService.js');
    const { executeSpellCast } = await import(
      '../../services/rules/spells/spellCastService.js'
    );
    const { isPsionicSpell, hasPsionicSorcery } = await import(
      '../../services/rules/spells/metamagicRules.js'
    );

    isPsionicSpell.mockReturnValue(false);
    hasPsionicSorcery.mockReturnValue(false);
    executeSpellCast.mockResolvedValue(null);

    const attack = { name: 'Silent Image', spellLevel: 1, castingTime: undefined };

    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    await act(async () => {
      result.current.handleActionMetamagicSkip();
    });

    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        castingTime: 'Action',
      }),
    );
  });

  it('logs correct spellLevel from pending action on skip', async () => {
    const spell = makeSpell({ name: 'Major Image', level: 2, casting_time: '1 Action' });
    const props = makeHookProps({
      playerStats: {
        name: 'TestSorcerer',
        class: { name: 'Sorcerer' },
        level: 5,
        spellAbilities: { spells: [spell] },
      },
    });
    const { addEntry } = await import('../../services/ui/logService.js');
    const { executeSpellCast } = await import(
      '../../services/rules/spells/spellCastService.js'
    );
    const { isPsionicSpell, hasPsionicSorcery } = await import(
      '../../services/rules/spells/metamagicRules.js'
    );

    isPsionicSpell.mockReturnValue(false);
    hasPsionicSorcery.mockReturnValue(false);
    executeSpellCast.mockResolvedValue(null);

    const attack = makeAttack({ name: 'Major Image', spellLevel: 2 });

    const { result } = renderHook(() => useActionSpellMetamagic(props));

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    await act(async () => {
      result.current.handleActionMetamagicSkip();
    });

    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        spellName: 'Major Image',
        spellLevel: 2,
      }),
    );
  });
});
