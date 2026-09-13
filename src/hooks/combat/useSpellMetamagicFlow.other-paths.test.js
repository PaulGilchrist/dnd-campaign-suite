// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';

// ── Minimal mocks ──────────────────────────────────────────────────────────────
// This test file exercises the gateMetamagic branching logic (non-Sorcerer
// cantrip auto-leveling, Beacon of Hope fallback, Aura of Vitality freeCast).
// We only mock the modules those specific code paths read from.

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
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
    ],
  })),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
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

// ── Factories ──────────────────────────────────────────────────────────────────

function makeSorcererStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

function makeNonSorcererStats(overrides = {}) {
  return {
    name: 'TestWizard',
    class: { name: 'Wizard' },
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

// ── Beacon of Hope: creatureTargets fallback to characters list ────────────────

describe('useSpellMetamagicFlow — Beacon of Hope creatureTargets fallback', () => {
  let combatDataModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
    combatDataModule = await import('../../services/encounters/combatData.js');
    combatDataModule.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin A' },
        { name: 'Goblin B' },
      ],
    });
  });

  it('uses characters list as creatureTargets when combat summary has no creatures', async () => {
    combatDataModule.getCombatSummary.mockReturnValue({ creatures: [] });

    const characters = [
      { name: 'Character A' },
      { name: 'Character B' },
    ];
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: characters })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Beacon of Hope', level: 3 }));
    });

    expect(result.current.pendingBeaconOfHope).not.toBeNull();
    expect(result.current.pendingBeaconOfHope.creatureTargets).toEqual(['Character A', 'Character B']);
  });

  it('uses combat summary creatures as creatureTargets when available', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Beacon of Hope', level: 3 }));
    });

    expect(result.current.pendingBeaconOfHope).not.toBeNull();
    expect(result.current.pendingBeaconOfHope.creatureTargets).toEqual(['Goblin A', 'Goblin B']);
  });
});

// ── Aura of Vitality: freeCastUsed metadata ────────────────────────────────────

describe('useSpellMetamagicFlow — Aura of Vitality freeCastUsed metadata', () => {
  let combatDataModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
    combatDataModule = await import('../../services/encounters/combatData.js');
    combatDataModule.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin A' },
        { name: 'Goblin B' },
      ],
    });
  });

  it('passes freeCastUsed from metaCtx into pendingAuraOfVitality', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Aura of Vitality', level: 3 }), { freeCastUsed: true });
    });

    expect(result.current.pendingAuraOfVitality).not.toBeNull();
    expect(result.current.pendingAuraOfVitality.isFreeCast).toBe(true);
  });

  it('omits isFreeCast when metaCtx.freeCastUsed is falsy', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeSorcererStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Aura of Vitality', level: 3 }));
    });

    expect(result.current.pendingAuraOfVitality).not.toBeNull();
    expect(result.current.pendingAuraOfVitality.isFreeCast).toBeUndefined();
  });
});

// ── Non-Sorcerer cantrip auto-leveling ──────────────────────────────────────────

describe('useSpellMetamagicFlow — non-Sorcerer cantrip auto-leveling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('auto-levels cantrip with damage_at_character_level and calls onExecute', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeNonSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Firebolt',
        level: 0,
        damage: { damage_at_character_level: { 5: '1d10', 11: '2d10' } },
      }));
    });

    expect(onExecute).toHaveBeenCalledTimes(1);
    const [preparedSpell] = onExecute.mock.calls[0];
    expect(preparedSpell.level).toBe(5);
    expect(preparedSpell.baseLevel).toBe(0);
    expect(preparedSpell.name).toBe('Firebolt');
    // No pendingMetamagic — non-Sorcerer bypasses metamagic UI for auto-leveled cantrips
    expect(result.current.pendingMetamagic).toBeNull();
  });

  it('auto-levels cantrip with damage_at_slot_level and calls onExecute', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeNonSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Firebolt',
        level: 0,
        damage: { damage_at_slot_level: { 1: '1d10', 5: '2d10' } },
      }));
    });

    expect(onExecute).toHaveBeenCalledTimes(1);
    const [preparedSpell] = onExecute.mock.calls[0];
    // Level 5 character: both slot levels 1 and 5 are applicable, picks max
    expect(preparedSpell.level).toBe(5);
    expect(preparedSpell.baseLevel).toBe(0);
  });

  it('auto-levels to the highest applicable character level', () => {
    const highLevelStats = makeNonSorcererStats({ level: 17 });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: highLevelStats, campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Firebolt',
        level: 0,
        damage: { damage_at_character_level: { 5: '1d10', 11: '2d10', 17: '3d10' } },
      }));
    });

    expect(onExecute).toHaveBeenCalledTimes(1);
    const [preparedSpell] = onExecute.mock.calls[0];
    expect(preparedSpell.level).toBe(17);
  });

  it('falls through to prepareSpellCast for cantrip without any damage property', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeNonSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    await act(async () => {
      result.current.gateMetamagic(makeSpell({ name: 'Friends', level: 0 }));
    });

    // No damage → falls through to prepareSpellCast → onExecute is called
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(result.current.pendingMetamagic).toBeNull();
  });

  it('uses oldConcentrationSpell path for non-cantrip with oldConcentrationSpell', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makeNonSorcererStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }), { oldConcentrationSpell: 'OldSpell' });
    });

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(result.current.pendingMetamagic).toBeNull();
  });

  it('falls through to prepareSpellCast when character level is below all damage levels', async () => {
    const lowLevelStats = makeNonSorcererStats({ level: 4 });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: lowLevelStats, campaignName: 'TestCampaign', onExecute: onExecute })
    );

    await act(async () => {
      result.current.gateMetamagic(makeSpell({
        name: 'Firebolt',
        level: 0,
        damage: { damage_at_character_level: { 5: '1d10', 11: '2d10' } },
      }));
    });

    // No applicable damage levels → falls through to prepareSpellCast
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(result.current.pendingMetamagic).toBeNull();
  });
});
