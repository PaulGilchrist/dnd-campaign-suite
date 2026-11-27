// @maintained-by-ai 2026-11-26
//
// SPECIAL PATHS — gate-lane branches with no owner in the sibling lanes.
// Ownership map (defer to siblings):
//  - Greater Restoration skip-with-no-effects: the ONLY happy-path coverage of
//    handleGreaterRestorationNoEffects (2026-11-15 pay-state gate: the picker
//    dismisses UNPAID ⇒ zero refund, zero log, pending cleared) — owned here.
//    Guards (no pending ⇒ no-op) are owned by handler-guards.test.js:288.
//  - Non-Sorcerer cantrip lane MATERIAL side (delegated by other-paths header):
//    consumeMaterial on the auto-level branch + prepareSpellCast routing of a
//    no-damage cantrip. The auto-level VALUE pick (level/baseLevel stamp) and
//    oldConcentrationSpell branch are owned by other-paths.test.js.
//  - Power Word chooser: modal shape, both chooser outcomes' slot payment, and
//    the skip-arm empty metaCtx are owned by useSpellMetamagicGates.
//    powerWordSlots.test.js (SP-088). This file keeps only what it cannot see:
//    the hook forwarding setSecondaryTargetModal into the gate (multiTarget
//    reaching onExecute via the hook surface) and the pendingMultiTarget
//    fallback when no modal setter is wired (Power Word forces the second-
//    target lane even with no post-cast-rider spread).
//  - Hook initial-shape census is owned by returnValue.test.js.
// Verified against useSpellMetamagicGates.js handleNonSorcererCast +
// refundGreaterRestorationNoEffects (useSimpleSpellHandlers.js) and
// public/data/spells.json / public/data/2024/spells.json (PWH lv9, GR lv5).
// Mock set mirrors special-paths.rollback.test.js (the barrel's true import graph).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';
import { consumeMaterial, getConsumedMaterial } from '../../services/rules/spells/materialComponents.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';

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

// Runtime slot mock: available = 3 at every level. The GR unpaid dismiss must
// never touch it (zero refund is the pin).
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

describe('useSpellMetamagicFlow — greater restoration skip with no effects', () => {
  it('UNPAID no-effects dismiss: no refund, no log, pending cleared', async () => {
    const { result, onExecute } = await renderAndGate(makeSpell({ name: 'Greater Restoration', level: 5 }));

    // Greater Restoration has a spell gate, so pendingGreaterRestoration is set
    // — and UNPAID: the slot is only consumed by createConfirmHandler at effect
    // selection. 2026-11-15 pay-state gate (bug-revivify-chooser-skip-rollback-
    // inflates-unspent-slot) inverted this pin's old refund+log: the NoEffects
    // dismiss was crediting a slot that was never spent.
    expect(result.current.pendingGreaterRestoration).not.toBeNull();

    await act(async () => {
      result.current.handleGreaterRestorationNoEffects();
    });

    // Zero money movement, zero rows.
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();

    // The spell was cancelled, not cast
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingGreaterRestoration).toBeNull();
  });
});

describe('useSpellMetamagicFlow — non-Sorcerer cantrip lane materials', () => {
  const wizard = { name: 'TestWizard', class: { name: 'Wizard' }, level: 5 };

  it('consumes the consumed-material on the auto-leveled-cantrip branch', async () => {
    getConsumedMaterial.mockReturnValue({ itemName: 'Some Material' });

    const { onExecute } = await renderAndGate(
      makeSpell({ name: 'Firebolt', level: 0, damage: { damage_at_character_level: { 5: '1d10' } } }),
      wizard
    );

    // handleNonSorcererCast cantripAutoLevel branch. The level-5 stamp on the
    // executed spell is the branch discriminator (the generic else branch would
    // hand back the mocked modifiedSpell {}); the VALUE-pick breadth is owned by
    // other-paths.test.js — the cell here is that this branch spends material.
    expect(onExecute).toHaveBeenCalledTimes(1);
    const [executedSpell] = onExecute.mock.calls[0];
    expect(executedSpell.name).toBe('Firebolt');
    expect(executedSpell.level).toBe(5);

    expect(consumeMaterial).toHaveBeenCalledTimes(1);
    expect(consumeMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TestWizard' }),
      'Some Material',
      CAMPAIGN,
    );
  });

  it('routes a no-damage cantrip through prepareSpellCast with nothing spent', async () => {
    const { onExecute } = await renderAndGate(makeSpell({ name: 'Minor Illusion', level: 0 }), wizard);

    // No damage entry ⇒ resolveCantripAutoLevel finds nothing ⇒ the generic
    // payment lane runs (material-refused.test.js owns this lane for a LEVELED
    // spell; the cantrip fall-through discrimination is the cell here).
    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Minor Illusion', level: 0 }),
      {},
      expect.objectContaining({ playerName: 'TestWizard', campaignName: CAMPAIGN }),
    );
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(consumeMaterial).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — Power Word second-target modal', () => {
  // Gates Power Word Heal with the second-target modal wired; returns the
  // captured modal so callers can drive onTargetSelected directly.
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

  it('hook forwards the chooser and executes with multiTarget on selection', async () => {
    // SP-088 (powerWordSlots.test.js) owns the chooser payload shape, both
    // outcome arms' lv9 slot payment, and the skip arm. The hook-surface cells
    // pinned here: useSpellMetamagicFlow/index.js forwards setSecondaryTargetModal
    // into the gate, and a selection threads multiTarget to onExecute + closes
    // the modal.
    const { onExecute, setSecondaryTargetModal, modal } = await renderPowerWord();

    await act(async () => {
      await modal.onTargetSelected('Goblin A');
    });

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Power Word Heal' }),
      { multiTarget: 'Goblin A' },
    );
    expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
  });

  it('falls back to the pending chooser when no modal setter is wired', async () => {
    // The gate forces the second-target lane for Power Words even when the
    // post-cast-rider spread mock says none; without a modal setter it must
    // degrade to the generic pendingMultiTarget queue, never cast silently.
    const { result, onExecute } = await renderAndGate(makeSpell({ name: 'Power Word Heal', level: 9 }));

    expect(result.current.pendingMultiTarget).not.toBeNull();
    expect(result.current.pendingMultiTarget.spellName).toBe('Power Word Heal');
    expect(result.current.pendingMultiTarget.range).toBe('10 ft');
    expect(onExecute).not.toHaveBeenCalled();
  });
});
