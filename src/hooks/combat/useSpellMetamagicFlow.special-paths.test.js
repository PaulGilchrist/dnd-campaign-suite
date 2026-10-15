// @maintained-by-ai: 2026-10-15
//
// SPECIAL PATHS — gate-lane branches with no owner in the sibling lanes.
// Owns:
//  - Greater Restoration skip-with-no-effects: the ONLY happy-path coverage of
//    handleGreaterRestorationNoEffects (refund current+1 at the exact slot key,
//    cancelled-cast log with targetName:null / targets:[], no onExecute).
//    Guards (no pending ⇒ no-op) are owned by handler-guards.test.js:288.
//  - Non-Sorcerer lane MATERIAL side: consumeMaterial on the auto-level cantrip
//    branch and prepareSpellCast routing of a non-damage cantrip. The auto-level
//    value + oldConcentrationSpell branches are owned by other-paths.test.js.
//  - Power Word second-target flow (useSpellMetamagicGates.js openPowerWordTargetModal):
//    modal shape, select ⇒ onExecute(spell, {multiTarget}), skip ⇒ onExecute(spell, {}),
//    and the pendingMultiTarget fallback when no setSecondaryTargetModal is wired.
// Verified against useSpellMetamagicGates.js handleNonSorcererCast +
// refundGreaterRestorationNoEffects (useSimpleSpellHandlers.js) and
// public/data/spells.json / public/data/2024/spells.json (PWH lv9, GR lv5) 2026-10-15.
// Mock set mirrors special-paths.rollback.test.js (the barrel's true import graph).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';
import { consumeMaterial, getConsumedMaterial } from '../../services/rules/spells/materialComponents.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';

// ── Mocking strategy ──────────────────────────────────────────────────────────
// Only mock the modules actually exercised by the behavior under test.
// Mirrors special-paths.rollback.test.js — the same barrel import graph.

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
    ],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
  executeHandler: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

// Runtime slot mock: available = 3 at every level → the GR refund lands as
// setRuntimeValue(name, 'spell_slots_level_N', 4, campaign).
vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ creatures: [] }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';

function makePlayerStats(overrides = {}) {
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

// Renders the hook and gates one spell, returning the hook result plus the
// onExecute spy so callers can inspect what the lane executed (or didn't).
async function renderAndGate(spell, playerStatsOverride = {}, hookProps = {}) {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: makePlayerStats(playerStatsOverride),
      campaignName: CAMPAIGN,
      onExecute,
      ...hookProps,
    })
  );
  await act(async () => {
    await result.current.gateMetamagic(spell);
  });
  return { result, onExecute };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMultiTargetSpreadForSpell.mockReturnValue(null);
  getConsumedMaterial.mockReturnValue(null);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — initial state', () => {
  it('has no pending metamagic on mount', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: CAMPAIGN, onExecute: vi.fn() })
    );

    expect(result.current.pendingMetamagic).toBeNull();
  });
});

describe('useSpellMetamagicFlow — greater restoration skip with no effects', () => {
  it('refunds the spell slot and logs the cancelled cast', async () => {
    const { result, onExecute } = await renderAndGate(makeSpell({ name: 'Greater Restoration', level: 5 }));

    // Greater Restoration has a spell gate, so pendingGreaterRestoration is set
    expect(result.current.pendingGreaterRestoration).not.toBeNull();

    await act(async () => {
      result.current.handleGreaterRestorationNoEffects();
    });

    // Slot refunded: getRuntimeValue mock returns 3 → 3 + 1 = 4
    expect(setRuntimeValue).toHaveBeenCalledWith('TestSorcerer', 'spell_slots_level_5', 4, CAMPAIGN);

    // A log entry records the cancelled cast with no targets
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: null,
      targets: [],
      spellName: 'Greater Restoration',
      spellLevel: 5,
      castingTime: '1 Action',
    }));

    // The spell was cancelled, not cast
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingGreaterRestoration).toBeNull();
  });
});

describe('useSpellMetamagicFlow — non-Sorcerer cantrip lane materials', () => {
  const wizard = { name: 'TestWizard', class: { name: 'Wizard' }, level: 5 };

  it('consumes the consumed-material and executes the auto-leveled cantrip', async () => {
    getConsumedMaterial.mockReturnValue({ itemName: 'Some Material' });

    const { onExecute } = await renderAndGate(
      makeSpell({ name: 'Firebolt', level: 0, damage: { damage_at_character_level: { 5: '1d10' } } }),
      wizard
    );

    // handleNonSorcererCast cantripAutoLevel branch: level 5 at character lv5
    expect(onExecute).toHaveBeenCalledTimes(1);
    const [executedSpell] = onExecute.mock.calls[0];
    expect(executedSpell.level).toBe(5);

    expect(consumeMaterial).toHaveBeenCalledWith(expect.any(Object), 'Some Material', CAMPAIGN);
  });

  it('routes a non-damage cantrip through prepareSpellCast', async () => {
    const { onExecute } = await renderAndGate(makeSpell({ name: 'Minor Illusion', level: 0 }), wizard);

    // No damage entry ⇒ no auto-level: the generic prepareSpellCast lane runs
    // (its mock yields modifiedSpell {}), and with no consumed material nothing is spent.
    expect(onExecute).toHaveBeenCalledTimes(1);
    const [executedSpell] = onExecute.mock.calls[0];
    expect(executedSpell).toEqual({});
    expect(consumeMaterial).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — Power Word second-target modal', () => {
  // Gates Power Word Heal with the second-target modal wired; returns the
  // captured modal so callers can drive onTargetSelected / onSkip directly.
  async function renderPowerWord() {
    const setSecondaryTargetModal = vi.fn();
    const { result, onExecute } = await renderAndGate(
      makeSpell({ name: 'Power Word Heal', level: 9 }),
      {},
      { setSecondaryTargetModal, characters: [], setPopupHtml: vi.fn() }
    );
    expect(setSecondaryTargetModal).toHaveBeenCalledTimes(1);
    return { result, onExecute, setSecondaryTargetModal, modal: setSecondaryTargetModal.mock.calls[0][0].secondaryTargetModal };
  }

  it('opens the Words-of-Creation modal and executes with multiTarget on selection', async () => {
    const { onExecute, setSecondaryTargetModal, modal } = await renderPowerWord();

    expect(modal.title).toBe('Words of Creation — Choose Second Target');
    expect(modal.targets).toHaveLength(3);
    expect(onExecute).not.toHaveBeenCalled();

    await act(async () => {
      await modal.onTargetSelected('Goblin A');
    });

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][1].multiTarget).toBe('Goblin A');
    expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
  });

  it('executes with empty metaCtx when the second target is skipped', async () => {
    const { onExecute, setSecondaryTargetModal, modal } = await renderPowerWord();

    await act(async () => {
      await modal.onSkip();
    });

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][1]).toEqual({});
    expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
  });

  it('falls back to pendingMultiTarget when no modal setter is wired', async () => {
    const { result } = await renderAndGate(makeSpell({ name: 'Power Word Heal', level: 9 }));

    expect(result.current.pendingMultiTarget).not.toBeNull();
    expect(result.current.pendingMultiTarget.spellName).toBe('Power Word Heal');
  });
});
