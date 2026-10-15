// @maintained-by-ai: 2026-10-14
// Lane: handleActionSpellDamageClick (spell-damage cast click) in
// useActionSpellMetamagic — the authority for the showCastPopup result
// handler (popup vs. CLA-389 modal routing) and the cast paths reached
// from a damage click: non-sorcerer immediate cast (known spell and
// unknown attack), sorcerer metamagic queue population, and the queued
// cast executed at confirm.
//
// Covered by sibling lanes here (NOT re-tested): AoE modal population and
// guards (aoeClick), confirm payment/metaCtx semantics (confirm), skip
// logging (skip), spell-attack-click dispatch and forcedMode (attackClick),
// no-pending no-ops and dispatch basics (useActionSpellMetamagic.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionSpellMetamagic } from './useActionSpellMetamagic.js';
import {
  makeHookProps,
  makeAttack,
  makeSpell,
  makeNonSorcererStats,
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

// ── Helpers ──────────────────────────────────────────────────────────────────

async function services() {
  const prepare = await import('../../services/rules/spells/spellPreparationService.js');
  const cast = await import('../../services/rules/spells/spellCastService.js');
  const rules = await import('../../services/rules/spells/metamagicRules.js');
  return { prepareSpellCast: prepare.prepareSpellCast, executeSpellCast: cast.executeSpellCast, rules };
}

// Seeds the mocked psionic detectors so each test declares its own truth table
// (setupBeforeEach's clearAllMocks keeps mockReturnValue, so reset explicitly).
async function setPsionic(isPsionic, hasSorcery) {
  const { isPsionicSpell, hasPsionicSorcery } = await import('../../services/rules/spells/metamagicRules.js');
  isPsionicSpell.mockReturnValue(isPsionic);
  hasPsionicSorcery.mockReturnValue(hasSorcery);
}

// Renders the hook and clicks the spell-damage lane once.
async function clickDamage(propsOverrides = {}, attackOverrides = {}) {
  const props = makeHookProps(propsOverrides);
  const { result } = renderHook(() => useActionSpellMetamagic(props));
  const attack = makeAttack(attackOverrides);
  await act(async () => {
    await result.current.handleActionSpellDamageClick(attack);
  });
  return { props, result, attack };
}

describe('useActionSpellMetamagic - castClick (handleActionSpellDamageClick)', () => {
  setupBeforeEach();
  beforeEach(async () => setPsionic(false, false));

  // ── Non-sorcerer: immediate cast ─────────────────────────────────────────

  it('casts immediately for a non-sorcerer, with a known spell or an unknown attack', async () => {
    const { prepareSpellCast, executeSpellCast } = await services();

    for (const spells of [[makeSpell()], []]) {
      prepareSpellCast.mockClear();
      executeSpellCast.mockClear();
      const { result } = await clickDamage({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells } }),
      });

      expect(prepareSpellCast).toHaveBeenCalled();
      expect(executeSpellCast).toHaveBeenCalled();
      // Immediate cast never queues metamagic for non-sorcerers.
      expect(result.current.pendingActionMetamagic).toBeNull();
    }
  });

  // ── showCastPopup: popup vs. modal routing (CLA-389) ─────────────────────

  it('shows an automationPopup payload of type popup via setPopupHtml', async () => {
    const { executeSpellCast } = await services();
    executeSpellCast.mockResolvedValue({
      automationPopup: { type: 'popup', payload: '<div>Spell cast!</div>' },
    });
    const setPopupHtml = vi.fn();

    await clickDamage({
      setPopupHtml,
      playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
    });

    expect(setPopupHtml).toHaveBeenCalledWith('<div>Spell cast!</div>');
  });

  it('routes a modal-type cast result into setModalState, never as a popup', async () => {
    // wildMagicSurge is a real key in the shared MODAL_STATE_KEYS map —
    // an unknown modalName is discarded with console.error by routeCastModal.
    const { executeSpellCast } = await services();
    const payload = { featureName: 'Wild Magic Surge', mode: 'roll' };
    executeSpellCast.mockResolvedValue({
      automationPopup: { type: 'modal', modalName: 'wildMagicSurge', payload },
    });
    const setPopupHtml = vi.fn();
    const setModalState = vi.fn();

    await clickDamage({
      setPopupHtml,
      setModalState,
      playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
    });

    expect(setModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: payload });
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  // ── Target-info threading (buildCtx → getTargetInfo) ─────────────────────

  it('threads buildCtx targetName into executeSpellCast getTargetInfo, null when absent', async () => {
    const { executeSpellCast } = await services();

    for (const [targetName, expected] of [['Orc B', { name: 'Orc B' }], [undefined, null]]) {
      executeSpellCast.mockClear();
      const buildCtx = vi.fn(async () => (targetName ? { targetName } : {}));

      await clickDamage({
        playerStats: makeNonSorcererStats({ spellAbilities: { spells: [] } }),
        buildCtx,
      });

      const ctx = executeSpellCast.mock.calls[0][2];
      expect(await ctx.getTargetInfo()).toEqual(expected);
    }
  });

  // ── Sorcerer: queue population from the damage click ──────────────────────

  it('queues pendingActionMetamagic for a sorcerer, flagging psionic only when spell and sorcery agree', async () => {
    // Truth table for isPsionicSpell × hasPsionicSorcery; psionicCost is the
    // spell level when both are true (CLA-271 popup flags the checkbox later).
    const cases = [
      { psionic: false, sorcery: false, isPsionic: false, cost: 0 },
      { psionic: true, sorcery: true, isPsionic: true, cost: 3 },
      { psionic: true, sorcery: false, isPsionic: false, cost: 0 },
      { psionic: false, sorcery: true, isPsionic: false, cost: 0 },
    ];

    for (const c of cases) {
      await setPsionic(c.psionic, c.sorcery);
      const { result } = await clickDamage({
        playerStats: makePlayerStats({ spellAbilities: { spells: [makeSpell()] } }),
      });

      const pending = result.current.pendingActionMetamagic;
      expect(pending, `psionic=${c.psionic} sorcery=${c.sorcery}`).not.toBeNull();
      expect(pending.spellName).toBe('Fireball');
      expect(pending.spellLevel).toBe(3);
      expect(pending.castingTime).toBe('1 Action');
      expect(pending.isPsionic).toBe(c.isPsionic);
      expect(pending.psionicCost).toBe(c.cost);
    }
  });

  // ── Sorcerer: queued cast executed at confirm ─────────────────────────────

  it('executes the queued cast on confirm with target info, shows its popup, and clears pending', async () => {
    const { executeSpellCast } = await services();
    executeSpellCast.mockResolvedValue({
      automationPopup: { type: 'popup', payload: '<div>Cast result!</div>' },
    });
    const setPopupHtml = vi.fn();
    const buildCtx = vi.fn(async () => ({ targetName: 'Dragon D' }));

    const { result } = await clickDamage({
      setPopupHtml,
      buildCtx,
      playerStats: makePlayerStats({ spellAbilities: { spells: [makeSpell()] } }),
    });
    expect(result.current.pendingActionMetamagic).not.toBeNull();

    await act(async () => {
      result.current.handleActionMetamagicConfirm({ totalCost: 0, options: [] });
    });

    expect(executeSpellCast).toHaveBeenCalled();
    const ctx = executeSpellCast.mock.calls[0][2];
    expect(await ctx.getTargetInfo()).toEqual({ name: 'Dragon D' });
    expect(setPopupHtml).toHaveBeenCalledWith('<div>Cast result!</div>');
    expect(result.current.pendingActionMetamagic).toBeNull();
  });
});
