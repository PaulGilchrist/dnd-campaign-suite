// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import { makeHookProps, makePlayerStats, setupBeforeEach } from './useActionSpellMetamagic.test-utils.js';

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

describe('useActionSpellMetamagic - handleActionSpellDamageClick - area of effect', () => {
  setupBeforeEach();

  // ── Modal structure ──────────────────────────────────────────────────────

  it('sets modalState for area of effect attacks with shape', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      spellLevel: 3,
      castingTime: '1 Action',
      area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
      saveDc: 15,
      saveSuccess: 0.5,
      damage: '8d6',
      damageType: 'fire',
      saveType: 'DEX',
      range: '150 feet',
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    const modal = setModalState.mock.calls[0][0].saveAttackAoeModal;
    expect(modal.shape).toBe('sphere');
    expect(modal.range).toBe(150);
    expect(modal.damage).toBe('8d6');
    expect(modal.damageType).toBe('fire');
    expect(modal.saveType).toBe('DEX');
    expect(modal.saveDc).toBe(15);
    expect(modal.dcSuccess).toBe('half');
    expect(modal.action.name).toBe('Fireball');
    expect(modal.action.automation).toEqual({});
  });

  it('includes playerStats and campaignName in the modal object', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    const modalArg = setModalState.mock.calls[0][0].saveAttackAoeModal;
    expect(modalArg.playerStats).toEqual(props.playerStats);
    expect(modalArg.campaignName).toBe('test-campaign');
  });

  // ── Range extraction ─────────────────────────────────────────────────────

  it('extracts range number from range string with unit suffix', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'cone', size: '30-foot' },
      range: '30 feet',
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ range: 30 }),
      }),
    );
  });

  it('extracts range from string without space between number and unit', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
      range: '60ft',
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ range: 60 }),
      }),
    );
  });

  it('handles Self range as 0', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
      range: 'Self',
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ range: 0 }),
      }),
    );
  });

  it('extracts number from Self with extra text', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
      range: 'Self (10-foot radius)',
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ range: 10 }),
      }),
    );
  });

  it('handles numeric range directly', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
      range: 60,
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ range: 60 }),
      }),
    );
  });

  it('falls back to 15 when range is missing', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ range: 15 }),
      }),
    );
  });

  // ── Save DC and success ──────────────────────────────────────────────────

  it('falls back to playerStats.spellAbilities.saveDc when attack.saveDc is missing', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({
      setModalState,
      playerStats: makePlayerStats({ spellAbilities: { saveDc: 17 } }),
    });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ saveDc: 17 }),
      }),
    );
  });

  it('handles saveSuccess 0 as none', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
      saveSuccess: 0,
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ dcSuccess: 'none' }),
      }),
    );
  });

  it('handles saveSuccess 0.5 as half (default)', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
      saveSuccess: 0.5,
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ dcSuccess: 'half' }),
      }),
    );
  });

  it('handles saveSuccess 1 as full', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
      saveSuccess: 1,
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ dcSuccess: 1 }),
      }),
    );
  });

  it('passes through undefined saveSuccess as undefined', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ dcSuccess: undefined }),
      }),
    );
  });

  // ── Damage and save type defaults ────────────────────────────────────────

  it('defaults damage to "0" when missing', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ damage: '0' }),
      }),
    );
  });

  it('defaults damageType to empty string when missing', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ damageType: '' }),
      }),
    );
  });

  it('defaults saveType to DEX when missing', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { shape: 'sphere' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ saveType: 'DEX' }),
      }),
    );
  });

  // ── Shape detection ──────────────────────────────────────────────────────

  it('handles all recognized area shapes', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const shapes = ['emanation','cone','line','sphere','cube','cylinder','square','circle','wall','cage','floor','area'];

    for (const shape of shapes) {
      setModalState.mockClear();
      const attack = {
        name: 'Fireball',
        area_of_effect: { shape },
      };

      await act(async () => {
        result.current.handleActionSpellDamageClick(attack);
      });

      expect(setModalState).toHaveBeenCalledWith(
        expect.objectContaining({
          saveAttackAoeModal: expect.objectContaining({ shape }),
        }),
      );
    }
  });

  it('detects shape via aoe.type when aoe.shape is missing', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      area_of_effect: { type: 'cone', size: '30-foot' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).toHaveBeenCalledWith(
      expect.objectContaining({
        saveAttackAoeModal: expect.objectContaining({ shape: 'cone' }),
      }),
    );
  });

  it('treats non-area shapes as area attacks when shape is unrecognized', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'TestSpell',
      area_of_effect: { shape: 'unknown_shape' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).not.toHaveBeenCalled();
  });

  it('handles aoe.shape as a number by converting to string', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'TestSpell',
      area_of_effect: { shape: 1 },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).not.toHaveBeenCalled();
  });

  // ── Non-area and null guards ─────────────────────────────────────────────

  it('does not set modalState for null area_of_effect', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Magic Missile',
      spellLevel: 1,
      area_of_effect: null,
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).not.toHaveBeenCalled();
  });

  it('does not set modalState for undefined area_of_effect', async () => {
    const setModalState = vi.fn();
    const props = makeHookProps({ setModalState });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Magic Missile',
      spellLevel: 1,
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(setModalState).not.toHaveBeenCalled();
  });

  it('does not set modalState when setModalState prop is null', async () => {
    const props = makeHookProps({ setModalState: null });
    const { result } = renderHook(() => useActionSpellMetamagic(props));

    const attack = {
      name: 'Fireball',
      spellLevel: 3,
      area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
    };

    await act(async () => {
      result.current.handleActionSpellDamageClick(attack);
    });

    expect(result.current.pendingActionMetamagic).toBeNull();
  });
});
