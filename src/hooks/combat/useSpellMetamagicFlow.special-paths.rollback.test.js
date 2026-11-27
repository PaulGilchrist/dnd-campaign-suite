// @maintained-by-ai 2026-11-26
// SPECIAL-PATH MONEY CELLS — custom lanes OUTSIDE the skip.test.js authority table.
// Three cells, each a branch no sibling owns:
//  - Protection from Poison (SP-095) SKIP: the custom lane bypasses
//    createSkipHandler (useCustomHandlers.js). The gate arms UNPAID (pay lives at
//    confirm in consumeProtectionFromPoisonSlot), so skip is a ZERO-WRITE dismiss
//    — the 2026-11-15 pay-state gate (bug-revivify-chooser-skip-rollback-inflates-
//    unspent-slot) retired the old logged-but-unpaid third shape.
//  - Protection from Poison CONFIRM guard: `result?.[0]` check runs BEFORE the
//    log and BEFORE the pay seam — an empty popup payload moves no money and
//    leaves no entry, yet still clears pending (cfClearPending precedes the guard).
//  - Revivify confirm with no targetName: the INVERSE ordering of the PfP guard.
//    createConfirmHandler pays (prepareSpellCast seam) and the deferred cast row
//    still stamps — the targetName guard in runRevivify returns WITHOUT stamping
//    pending.castRefused, so audit-honesty deferral lets the row through with the
//    fallback picker targets (the payment was real) — while the spell never applies
//    and NOTHING is refunded (a mid-machine abort after payment must not write
//    slot bytes). Pinned against revivifyRefusal.test.js (refusal → refund, row
//    suppressed) and skip.test.js (unpaid skip clear).
// Owned elsewhere and removed as duplicates here: Stone Skin unpaid skip (the
// useCustomHandlers.stoneSkin.test.js pre-confirm zero-write cell runs the REAL
// prepareSpellCast against a store-backed ledger with a dust+slot+row census),
// two-stage initial stages + Enhance Ability guard (gate-two-stage.test.js,
// useTwoStageHandlers.enhanceAbility.test.js), Sanctuary / Sleet Storm confirm +
// skip dispatch (simple-handlers.test.js SPELL_ROWS), un-armed handler guards
// (handler-guards.test.js), pay-at-confirm 'clear' lane (skip.test.js), upcast
// refunds (cla086 lane), PAID-refund unit pairs (useConfirmableFlow.skip-paid-gate),
// PfP confirm success bytes (useCustomHandlers.protectionFromPoison.test.js).
// Levels/casting times verified against public/data/spells.json + public/data/2024/spells.json 2026-10-15.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';
import { applyProtectionFromPoisonHandler } from '../../services/automation/index.js';
import { prepareSpellCast, incrementFreeCastResource } from '../../services/rules/spells/spellPreparationService.js';
import { triggerRevivify } from '../../services/rules/features/revivifyService.js';

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
  // CLA-033/CLA-037: fired by the confirm lane's rider seam in useConfirmableFlow.
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

// Goblin C is dead so the SP-100 Revivify dead-target gate arms pending.
vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C', type: 'monster', currentHp: 0 },
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

// Runtime slot mock: available = 3 at every level → a refund lands as
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

const CAMPAIGN = 'TestCampaign';
const CASTER = 'TestSorcerer';

function renderFlow(onExecute = vi.fn()) {
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: { name: CASTER, class: { name: 'Sorcerer' }, level: 5 },
      campaignName: CAMPAIGN,
      onExecute,
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml: vi.fn(),
    })
  );
  return { result, onExecute };
}

async function gateSpell(result, spell) {
  await act(async () => {
    await result.current.gateMetamagic(spell);
  });
}

const slotWrites = () => setRuntimeValue.mock.calls.filter(c => String(c[1]).includes('spell_slots'));

describe('useSpellMetamagicFlow — custom-lane skip money semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Protection from Poison skip: UNPAID dismiss — zero writes across every rollback channel, pending cleared (SP-095 pay-at-confirm)', async () => {
    const { result } = renderFlow();
    // spells.json: lv2, 1 action, Touch. The gate never spends the slot —
    // consumeProtectionFromPoisonSlot pays it at confirm. 2026-11-15 pay-state
    // gate (bug-revivify-chooser-skip-rollback-inflates-unspent-slot): the skip's
    // old phantom cast row is dead too — an unpaid dismiss is a ZERO-WRITE lane.
    // The census is exhaustive: rollbackSpellSlot's only write channels are
    // setRuntimeValue (slot ledger) + incrementFreeCastResource (free-cast).
    const spell = { name: 'Protection from Poison', level: 2, casting_time: '1 action', range: 'Touch' };
    await gateSpell(result, spell);
    expect(result.current.pendingProtectionFromPoison).not.toBeNull();

    act(() => {
      result.current.handleProtectionFromPoisonSkip();
    });

    expect(result.current.pendingProtectionFromPoison).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(incrementFreeCastResource).not.toHaveBeenCalled();
    // The pay seam never runs on the unpaid lane — nothing to refund.
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(applyProtectionFromPoisonHandler).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — confirm guards on empty payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Protection from Poison confirm with []: guard runs BEFORE log AND pay seam — no money, no entry, pending cleared', async () => {
    const { result, onExecute } = renderFlow();
    // The popup sends the selection as an array; the source guard is
    // `result?.[0]` (useCustomHandlers.js), so an empty array is the one
    // realistic empty payload — a {} object hits the identical branch.
    await gateSpell(result, { name: 'Protection from Poison', level: 2, casting_time: '1 action', range: 'Touch' });

    await act(async () => {
      await result.current.handleProtectionFromPoisonConfirm([]);
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    // Guard sits BEFORE the pay seam: no slot payment, no ledger/free-cast bytes.
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(incrementFreeCastResource).not.toHaveBeenCalled();
    expect(applyProtectionFromPoisonHandler).not.toHaveBeenCalled();
    // cfClearPending runs BEFORE the guard — the dismiss never leaves a stuck chooser.
    expect(result.current.pendingProtectionFromPoison).toBeNull();
  });

  it('Revivify confirm with no targetName: slot IS paid and the deferred row STILL stamps at the fallback picker list, but the spell never applies and nothing is refunded', async () => {
    const { result, onExecute } = renderFlow();
    // spells.json: lv3, 1 action, Touch. The inverse ordering of the PfP guard:
    // createConfirmHandler clears pending, pays via prepareSpellCast, and because
    // runRevivify's targetName guard returns WITHOUT stamping pending.castRefused,
    // the deferCastLog lane stamps the cast row after applyFn (targets fall back
    // to the dead picker list) — the payment was real. A refund here would inflate
    // the ledger above max, so the pin is: row + payment YES, spell + refund NO.
    await gateSpell(result, { name: 'Revivify', level: 3, casting_time: '1 action', range: 'Touch' });
    expect(result.current.pendingRevivify).not.toBeNull();

    await act(async () => {
      await result.current.handleRevivifyConfirm({});
    });

    // The pay seam ran exactly once before the inner guard aborted the spell.
    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(triggerRevivify).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    // Exactly one row, at the fallback dead-target, and ZERO refund bytes.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenLastCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: CASTER,
      targetName: 'Goblin C',
      targets: ['Goblin C'],
      spellName: 'Revivify',
      spellLevel: 3,
    }));
    expect(slotWrites()).toHaveLength(0);
    expect(result.current.pendingRevivify).toBeNull();
  });
});
