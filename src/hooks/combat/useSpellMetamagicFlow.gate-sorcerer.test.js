// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';

// ── Minimal mocks for Sorcerer gate path ────────────────────────────────────────
// The Sorcerer gate path in gateMetamagic only reads from these modules:
//   - useMetamagic.js (SP values)
//   - metamagicRules.js (psionic checks)
//   - materialComponents.js (consumed material check)
//   - postCastRiderService.js (multi-target spread for Power Word spells)
// All other mocks are unnecessary noise that obscures what the Sorcerer gate
// actually depends on.

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSorcererStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 Action',
    range: '150 ft.',
    ...overrides,
  };
}

// ── Sorcerer gate: cantrip auto-leveling ───────────────────────────────────────
// These tests verify the Sorcerer-specific cantrip auto-level path.
// Non-Sorcerer cantrip behavior is covered in other-paths.test.js.

describe('useSpellMetamagicFlow — Sorcerer cantrip auto-leveling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('sets pendingMetamagic with auto-leveled damage cantrip', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Firebolt',
        level: 0,
        damage: { damage_at_character_level: { 5: '1d10', 11: '2d10' } },
      }));
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellName).toBe('Firebolt');
    expect(result.current.pendingMetamagic.spell.level).toBe(5);
    expect(result.current.pendingMetamagic.spell.baseLevel).toBe(0);
  });

  it('auto-levels using damage_at_slot_level when damage_at_character_level is absent', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Firebolt',
        level: 0,
        damage: { damage_at_slot_level: { 1: '1d10', 5: '2d10' } },
      }));
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spell.level).toBe(5);
  });

  it('does not auto-level cantrip without damage (sets pending with original level)', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Friends', level: 0 }));
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spell.level).toBe(0);
  });

  it('does not auto-level when character level is below all damage levels', () => {
    const lowLevelStats = makeSorcererStats({ level: 4 });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: lowLevelStats, campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Firebolt',
        level: 0,
        damage: { damage_at_character_level: { 5: '1d10', 11: '2d10' } },
      }));
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spell.level).toBe(0);
  });
});

// ── Sorcerer gate: SP tracking in pendingMetamagic ─────────────────────────────

describe('useSpellMetamagicFlow — Sorcerer SP tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('stores current SP and psionic flags in pendingMetamagic payload', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic._currentSP).toBe(5);
    expect(result.current.pendingMetamagic.isPsionic).toBe(false);
    expect(result.current.pendingMetamagic.psionicCost).toBe(0);
    expect(result.current.pendingMetamagic.spellLevel).toBe(3);
    expect(onExecute).not.toHaveBeenCalled();
  });
});

// ── Sorcerer gate: consumed material blocks before metamagic pending ───────────

describe('useSpellMetamagicFlow — Sorcerer consumed material blocking', () => {
  let materialModule;

  beforeEach(async () => {
    materialModule = await import('../../services/rules/spells/materialComponents.js');
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
    materialModule.getConsumedMaterial.mockReturnValue(null);
    materialModule.hasMaterial.mockReturnValue(true);
  });

  it('blocks Sorcerer gate when consumed material is missing', async () => {
    materialModule.getConsumedMaterial.mockReturnValue({ itemName: 'Diamond Dust (100 gp)' });
    materialModule.hasMaterial.mockReturnValue(false);
    materialModule.getMaterialRequirementMessage.mockReturnValue('Requires diamond dust.');

    const setPopupHtml = vi.fn();
    const onExecute = vi.fn();

    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
    );

    await act(async () => {
      result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration', level: 5 }));
    });

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      automationType: 'material_required',
      name: 'Greater Restoration',
    }));
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).toBeNull();
  });

  it('proceeds to metamagic pending when material is present', async () => {
    materialModule.getConsumedMaterial.mockReturnValue({ itemName: 'Diamond Dust (100 gp)' });
    materialModule.hasMaterial.mockReturnValue(true);

    const setPopupHtml = vi.fn();
    const onExecute = vi.fn();

    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
    );

    await act(async () => {
      result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration', level: 5 }));
    });

    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellName).toBe('Greater Restoration');
    expect(onExecute).not.toHaveBeenCalled();
  });
});

// ── Sorcerer gate: metaCtx.slotLevel propagation ───────────────────────────────

describe('useSpellMetamagicFlow — Sorcerer slotLevel in pending payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('uses metaCtx.slotLevel when provided for spellLevel in pendingMetamagic', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }), { slotLevel: 5 });
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellLevel).toBe(5);
  });

  it('uses spell level when metaCtx.slotLevel is absent', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellLevel).toBe(3);
  });
});
