// @maintained-by-ai: 2026-10-15
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';

// ── Minimal mocks for the Sorcerer gate lane ───────────────────────────────────
// This file owns the Sorcerer branch of gateMetamagic (queueSorceryMetamagic in
// useSpellMetamagicGates.js): cantrip auto-leveling, SP/psionic stamping, and
// metaCtx.slotLevel propagation into the pendingMetamagic payload.
//   - useMetamagic.js — SP values read by the sorcerer queue
//   - metamagicRules.js — psionic checks read by the sorcerer queue
//   - materialComponents.js / spellPreparationService.js — inert here (the
//     material-block and slot-payment lanes run BEFORE the sorcerer split;
//     consumed-material coverage lives in the dedicated .gate-material lane)
//   - postCastRiderService.js / logService.js / combatData.js /
//     useRuntimeState.js / useAllySelection.js — module-level imports of
//     useConfirmableFlow / spellGates that must resolve without network I/O
// window.dispatchEvent is native in jsdom and never fires on this gate path.

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
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
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

// ── Helpers ──────────────────────────────────────────────────────────────────────

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 Action',
    range: '150 ft.',
    ...overrides,
  };
}

function renderSorcererFlow(statsOverrides = {}) {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: { name: 'TestSorcerer', class: { name: 'Sorcerer' }, level: 5, ...statsOverrides },
      campaignName: 'test-campaign',
      onExecute,
    })
  );
  return { result, onExecute };
}

beforeEach(() => {
  vi.clearAllMocks(); // factory implementations survive clear — null defaults hold
});

// ── Sorcerer gate: cantrip auto-leveling ────────────────────────────────────────
// Non-Sorcerer cantrip behavior is covered in the other-paths lane.

describe('useSpellMetamagicFlow — Sorcerer cantrip auto-leveling', () => {
  it('auto-levels a damage cantrip from damage_at_character_level', () => {
    const { result, onExecute } = renderSorcererFlow();

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

  it('falls back to damage_at_slot_level when damage_at_character_level is absent', () => {
    const { result, onExecute } = renderSorcererFlow();

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Firebolt',
        level: 0,
        damage: { damage_at_slot_level: { 1: '1d10', 5: '2d10' } },
      }));
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic.spell.level).toBe(5);
    expect(result.current.pendingMetamagic.spell.baseLevel).toBe(0);
  });

  it('does not auto-level cantrip without damage (queues at original level)', () => {
    const { result, onExecute } = renderSorcererFlow();

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Friends', level: 0 }));
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spell.level).toBe(0);
  });

  it('does not auto-level when character level is below all damage levels', () => {
    const { result, onExecute } = renderSorcererFlow({ level: 4 });

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

// ── Sorcerer gate: pendingMetamagic payload stamping ─────────────────────────────

describe('useSpellMetamagicFlow — Sorcerer pendingMetamagic payload', () => {
  it('stores current SP, psionic flags, and the spell level as default spellLevel', () => {
    const { result, onExecute } = renderSorcererFlow();

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic._currentSP).toBe(5);
    expect(result.current.pendingMetamagic.isPsionic).toBe(false);
    expect(result.current.pendingMetamagic.psionicCost).toBe(0);
    expect(result.current.pendingMetamagic.spellLevel).toBe(3);
  });

  it('uses metaCtx.slotLevel over the spell level for spellLevel', () => {
    const { result, onExecute } = renderSorcererFlow();

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }), { slotLevel: 5 });
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellLevel).toBe(5);
  });
});
