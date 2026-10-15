// @maintained-by-ai: 2026-10-15
// useSpellMetamagicFlow lane — ONLY the ownerless gateMetamagic branches.
// Ownership map of gateMetamagic (useSpellMetamagicGates.js / spellGates.js):
//   - Sorcerer queue + resolveCantripAutoLevel tables/threshold → .gate-sorcerer
//   - registry breadth incl. Beacon of Hope & Aura of Vitality open → .gate
//   - non-Sorcerer cantrip material-consume + no-damage fallthrough → .special-paths
//   - Maze / Warding Bond refusals, Power Word modals → dedicated gates lanes
// This file keeps what none of them pin:
//   1. gateBeaconOfHope characters-list fallback when combat summary is empty
//   2. gateAuraOfVitality metaCtx.freeCastUsed → isFreeCast stamp
//   3. handleNonSorcererCast auto-level lane (highest-applicable pick + baseLevel
//      stamp reaching onExecute — sorcerer lane never executes directly)
//   4. handleNonSorcererCast oldConcentrationSpell branch (cast the ORIGINAL spell
//      without a prepareSpellCast slot payment)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';

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
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  // Fired by the gated confirm lane's rider seam in useConfirmableFlow — inert here.
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
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
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks(); // factory implementations survive clear — defaults hold
});

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 Action',
    range: '150 ft.',
    ...overrides,
  };
}

// Render the flow for a class and run one gateMetamagic, returning the hook
// result plus the onExecute spy.
function gateAs(class_, statsOverrides = {}, spell, metaCtx = {}, hookOverrides = {}) {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: { name: class_ === 'Sorcerer' ? 'TestSorcerer' : 'TestWizard', class: { name: class_ }, level: 5, ...statsOverrides },
      campaignName: 'TestCampaign',
      onExecute,
      ...hookOverrides,
    })
  );
  act(() => {
    result.current.gateMetamagic(spell, metaCtx);
  });
  return { result, onExecute };
}

// ── 1. Beacon of Hope: creatureTargets fallback to characters list ─────────────

describe('useSpellMetamagicFlow — Beacon of Hope creatureTargets fallback', () => {
  it('falls back to the characters roster when combat summary has no creatures', async () => {
    const { getCombatSummary } = await import('../../services/encounters/combatData.js');
    getCombatSummary.mockReturnValueOnce({ creatures: [] });

    const { result } = gateAs(
      'Sorcerer',
      {},
      makeSpell({ name: 'Beacon of Hope', level: 3 }),
      {},
      { setSecondaryTargetModal: null, characters: [{ name: 'Character A' }, { name: 'Character B' }] }
    );

    expect(result.current.pendingBeaconOfHope).not.toBeNull();
    expect(result.current.pendingBeaconOfHope.creatureTargets).toEqual(['Character A', 'Character B']);
  });
});

// ── 2. Aura of Vitality: freeCastUsed stamp ─────────────────────────────────────

describe('useSpellMetamagicFlow — Aura of Vitality freeCastUsed stamp', () => {
  it('stamps isFreeCast from metaCtx.freeCastUsed onto pendingAuraOfVitality', () => {
    const { result } = gateAs(
      'Sorcerer',
      {},
      makeSpell({ name: 'Aura of Vitality', level: 3 }),
      { freeCastUsed: true }
    );

    expect(result.current.pendingAuraOfVitality).not.toBeNull();
    expect(result.current.pendingAuraOfVitality.isFreeCast).toBe(true);
  });

  it('omits isFreeCast when metaCtx.freeCastUsed is falsy', () => {
    const { result } = gateAs('Sorcerer', {}, makeSpell({ name: 'Aura of Vitality', level: 3 }));

    expect(result.current.pendingAuraOfVitality).not.toBeNull();
    expect(result.current.pendingAuraOfVitality).not.toHaveProperty('isFreeCast');
  });
});

// ── 3+4. Non-Sorcerer auto-level lane + concentration-preserving cast ───────────

describe('useSpellMetamagicFlow — non-Sorcerer cast lane', () => {
  it('auto-levels a damage cantrip to the highest applicable level and executes directly', () => {
    const { result, onExecute } = gateAs(
      'Wizard',
      { level: 17 },
      makeSpell({ name: 'Firebolt', level: 0, damage: { damage_at_character_level: { 5: '1d10', 11: '2d10', 17: '3d10' } } })
    );

    expect(onExecute).toHaveBeenCalledTimes(1);
    const [preparedSpell] = onExecute.mock.calls[0];
    expect(preparedSpell.name).toBe('Firebolt');
    expect(preparedSpell.level).toBe(17);
    expect(preparedSpell.baseLevel).toBe(0);
    // Non-Sorcerer bypasses the metamagic UI for auto-leveled cantrips
    expect(result.current.pendingMetamagic).toBeNull();
  });

  it('executes the ORIGINAL spell unpaid via the oldConcentrationSpell branch', () => {
    const { result, onExecute } = gateAs(
      'Wizard',
      {},
      makeSpell({ name: 'Fireball', level: 3 }),
      { oldConcentrationSpell: 'OldSpell' }
    );

    expect(onExecute).toHaveBeenCalledTimes(1);
    // Raw spell passes through — the prepareSpellCast mock yields modifiedSpell {},
    // so a name here proves the concentration-preserving branch skipped the re-prepare.
    const [executedSpell] = onExecute.mock.calls[0];
    expect(executedSpell.name).toBe('Fireball');
    expect(result.current.pendingMetamagic).toBeNull();
  });
});
