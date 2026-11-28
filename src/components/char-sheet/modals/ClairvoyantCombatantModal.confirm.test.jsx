// @maintained-by-ai 2026-11-27
/**
 * ClairvoyantCombatantModal — CONFIRM seam lane.
 *
 * Ownership map (siblings, do not duplicate here):
 * - .test.jsx        — info-screen text, custom action name render, Cancel → onClose
 * - .edgeCases.jsx   — targetEffects/activeBuffs preservation + success-save filtering
 * - .expiration.jsx  — armed-clock queue depth/shape (rounds=10, anchorless, trio) + cancel
 * - .result.jsx      — result-screen UI, Done/overlay clicks, save_result log content
 * This lane owns ONLY what fires at confirm: button gating, the ONE full-dispatch
 * contract on empty stores (exact campaign targetEffects write + ONE merged
 * player-store write with exact key set per CLA-053/§39 + single createSaveListener
 * mint + single exact ability_use row wired to its promptId + the confirm-latch:
 * the roll affordance is gone after the click, so no second-commit lane exists),
 * prop flow-through into every confirm-side outlet, Pact Magic expenditure
 * (exact slot decrement + ordered log pair), save-result listener lifecycle,
 * and addEntry rejection resilience (only real .catch sites).
 *
 * FLAG (component, not fixed here):
 * - ClairvoyantCombatantModal.jsx:239 — inline style on the "no uses" note.
 * - setRuntimeValue (jsx:64) / createSaveListener (jsx:99) in handleConfirm have NO
 *   try/catch: a reject there leaves the modal stuck rendering null (no retry, no
 *   close). Not tested — never invent a catch. Only addEntry's real
 *   .catch(e => console.error) is covered.
 * - The unusable info screen renders no Cancel button (no way out without closing tab).
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// ── Mocked modules (keys = exactly what the component imports; the whole
// import graph is mock-replaced except React-only useOverlayEntranceFocus) ──

let promptCounter = 0;

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  // save-dismissed sweep (2026-11-05): the component imports the shared dismissal
  // log helper too. Unique promptId per mint — the component never removes
  // listeners on unmount, so leaked listeners from earlier tests can never
  // hijack window-dispatched save-result events in later tests.
  logSaveDismissed: vi.fn(() => Promise.resolve()),
  createSaveListener: vi.fn(() => ({ promptId: `cla-confirm-prompt-${++promptCounter}` })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  KEY: 'pendingExpirations', // matches disk: turnStartEffects.js const KEY
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  setRuntimeObject: vi.fn(),
}));

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';

// ── Fixtures ──

const PLAYER = 'Paladin1';
const TARGET = 'Goblin1';
const CAMPAIGN = 'test-campaign';
const FEATURE = 'Clairvoyant Combatant';

// Fresh onClose per call (house rule: no shared module-level vi.fn).
function makeProps(overrides = {}) {
  return {
    action: { name: FEATURE },
    playerStats: { name: PLAYER, level: 5 },
    campaignName: CAMPAIGN,
    targetName: TARGET,
    saveType: 'Wisdom',
    saveDc: 13,
    currentUses: 1,
    maxUses: 3,
    pactSlotLevel: 0,
    pactSlotsAvailable: false,
    pactMagicRecharge: false,
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderModal(props = {}) {
  return render(<ClairvoyantCombatantModal {...makeProps(props)} />);
}

function clickConfirm() {
  fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));
}

// Exact shapes the component commits at confirm on default props (write contract).
const exactBuff = {
  name: FEATURE,
  effect: 'clairvoyant_combatant',
  duration: '1_minute',
  target: TARGET,
};
const exactTargetEffect = {
  target: TARGET,
  source: FEATURE,
  effect: 'clairvoyant_combatant',
  duration: '1_minute',
  saveType: 'Wisdom',
  saveDc: 13,
  attackerAdvantage: true,
  defenderDisadvantage: true,
};
const exactAbilityUseEntry = (featureName, targetName, saveType, saveDc, promptId) => ({
  type: 'ability_use',
  characterName: PLAYER,
  abilityName: featureName,
  description: `${featureName} triggered against ${targetName} (via Awakened Mind) — ${targetName} must make ${saveType} save (DC ${saveDc}) or suffer combat disadvantage.`,
  targetName,
  promptId,
  timestamp: expect.any(Number),
});

// House rule: mockReset (not clearAllMocks — it keeps mockResolvedValue/impl),
// then re-arm the default implementations the component needs to function.
afterEach(() => {
  createSaveListener.mockReset().mockImplementation(() => ({
    promptId: `cla-confirm-prompt-${++promptCounter}`,
  }));
  addEntry.mockReset().mockResolvedValue(undefined);
  runtime.getRuntimeValue.mockReset().mockReturnValue(null);
  runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
  runtime.setRuntimeObject.mockReset();
});

// ── Confirm lane ──

describe('ClairvoyantCombatantModal - confirm seam', () => {
  // ── Gating: no valid resource → no confirm affordance, fully inert ──

  it.each([
    { label: 'no uses, no Pact Magic recharge', currentUses: 3, maxUses: 3, pactMagicRecharge: false, pactSlotLevel: 0, pactSlotsAvailable: false },
    { label: 'no uses, recharge on but no slots', currentUses: 3, maxUses: 3, pactMagicRecharge: true, pactSlotLevel: 2, pactSlotsAvailable: false },
    { label: 'no uses, recharge on, slot level 0', currentUses: 3, maxUses: 3, pactMagicRecharge: true, pactSlotLevel: 0, pactSlotsAvailable: true },
  ])('gates confirm when unusable ($label): no button, zero writes', (testCase) => {
    renderModal(testCase);
    expect(screen.queryByRole('button', { name: /Clairvoyant Combatant/ })).not.toBeInTheDocument();
    expect(runtime.setRuntimeObject).not.toHaveBeenCalled();
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(createSaveListener).not.toHaveBeenCalled();
  });

  // ── Full dispatch contract on empty stores: ONE click, every outlet exactly
  //    once, exact payloads, and the latch that makes a second commit impossible ──

  it('confirm dispatches the exact full contract once and removes the roll affordance (no double-commit lane)', async () => {
    renderModal();
    clickConfirm();

    // The merged player write is the last synchronous step of the dispatch
    // continuation — everything before it (te write) and after it
    // (createSaveListener, addEntry call) has already run when it lands.
    await waitFor(() => {
      expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    });

    // Campaign lane: exactly ONE targetEffects write, exact payload + campaign arg.
    expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [exactTargetEffect], CAMPAIGN);

    // Player lane: ALL keys ride the ONE merged write (§39) — exact key set,
    // no orphan per-key writes. Clock queue byte shape owned by .expiration lane;
    // only its presence on this write is pinned here.
    const [playerName, payload, campaign] = runtime.setRuntimeObject.mock.calls[0];
    expect(playerName).toBe(PLAYER);
    expect(campaign).toBe(CAMPAIGN);
    expect(Object.keys(payload).sort()).toEqual(
      ['activeBuffs', 'clairvoyantCombatantTarget', 'clairvoyantCombatantUses', 'pendingExpirations'],
    );
    expect(payload.clairvoyantCombatantUses).toBe(2); // currentUses 1 + 1
    expect(payload.clairvoyantCombatantTarget).toBe(TARGET);
    expect(payload.activeBuffs).toEqual([exactBuff]);
    expect(payload.pendingExpirations).toHaveLength(1);

    // Prompt + log: single mint, single exact ability_use row wired to ITS promptId.
    expect(createSaveListener).toHaveBeenCalledTimes(1);
    expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, {
      targetName: TARGET,
      saveType: 'Wisdom',
      saveDc: 13,
    });
    expect(addEntry).toHaveBeenCalledTimes(1); // hasUse path logs exactly once
    expect(addEntry).toHaveBeenCalledWith(
      CAMPAIGN,
      exactAbilityUseEntry(FEATURE, TARGET, 'Wisdom', 13, createSaveListener.mock.results[0].value.promptId),
    );

    // Confirm latch AT THE SEAM: the step flips to 'result' (renders nothing
    // until the save resolves), so the roll button is gone — a confirm-then-
    // click-again double dispatch is structurally impossible.
    expect(screen.queryByRole('button', { name: /Clairvoyant Combatant/ })).not.toBeInTheDocument();
  });

  // ── Props flow through every confirm-side outlet (anti fixture-echo;
  //    custom feature name varies simultaneously — source/abilityName/description
  //    must all follow action.name, not the default) ──

  it('flows custom target/save/feature-name props through te write, save prompt, log, and merged write', async () => {
    const targetName = 'Orc Chieftain';
    const featureName = 'Spectral Sight';
    renderModal({ targetName, saveType: 'Charisma', saveDc: 17, action: { name: featureName } });
    clickConfirm();

    await waitFor(() => {
      expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    });
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
      target: targetName,
      source: featureName,
      effect: 'clairvoyant_combatant',
      duration: '1_minute',
      saveType: 'Charisma',
      saveDc: 17,
      attackerAdvantage: true,
      defenderDisadvantage: true,
    }], CAMPAIGN);
    expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, {
      targetName,
      saveType: 'Charisma',
      saveDc: 17,
    });
    expect(addEntry).toHaveBeenCalledWith(
      CAMPAIGN,
      exactAbilityUseEntry(featureName, targetName, 'Charisma', 17, createSaveListener.mock.results[0].value.promptId),
    );
    const payload = runtime.setRuntimeObject.mock.calls[0][1];
    expect(payload.clairvoyantCombatantTarget).toBe(targetName);
    expect(payload.activeBuffs[0].name).toBe(featureName);
  });

  // ── Pact Magic expenditure: exact slot decrement + ordered log pair ──

  it.each([
    { label: 'runtime store slot', runtimeSlots: 3, spellAbilities: undefined, expected: 2 },
    { label: 'playerStats.spellAbilities fallback', runtimeSlots: null, spellAbilities: { spell_slots_level_2: 4 }, expected: 3 },
  ])('Pact Magic expenditure ($label): decrements spell_slots_level_2 to $expected, consumes no use, logs pact + ability_use in order', async (t) => {
    runtime.getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') return [];
      if (key === PLAYER && prop === 'spell_slots_level_2') return t.runtimeSlots;
      return null;
    });
    renderModal({
      playerStats: { name: PLAYER, level: 5, ...(t.spellAbilities ? { spellAbilities: t.spellAbilities } : {}) },
      currentUses: 3,
      maxUses: 3,
      pactMagicRecharge: true,
      pactSlotLevel: 2,
      pactSlotsAvailable: true,
    });
    clickConfirm();

    await waitFor(() => {
      expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    });
    const [playerName, payload, campaign] = runtime.setRuntimeObject.mock.calls[0];
    expect(playerName).toBe(PLAYER);
    expect(campaign).toBe(CAMPAIGN);
    // Exact key set: slot key rides the merged write, uses are NOT incremented.
    expect(Object.keys(payload).sort()).toEqual(
      ['activeBuffs', 'clairvoyantCombatantTarget', 'pendingExpirations', 'spell_slots_level_2'],
    );
    expect(payload.spell_slots_level_2).toBe(t.expected);
    expect(payload.activeBuffs).toEqual([exactBuff]);

    // Exactly two log entries, in order: pact expenditure first, prompt log last.
    const pactEntry = {
      type: 'ability_use',
      characterName: PLAYER,
      abilityName: FEATURE,
      description: `${PLAYER} expended a Pact Magic spell slot (level 2) to restore a use of ${FEATURE}.`,
      timestamp: expect.any(Number),
    };
    expect(addEntry.mock.calls).toEqual([
      [CAMPAIGN, pactEntry],
      [CAMPAIGN, exactAbilityUseEntry(FEATURE, TARGET, 'Wisdom', 13, createSaveListener.mock.results[0].value.promptId)],
    ]);
  });

  // ── addEntry rejection: only real .catch site (component logs, flow completes) ──

  it('survives an addEntry rejection: console.error logs it, te + merged writes still land, listener still attaches', async () => {
    const err = new Error('log service down');
    addEntry.mockRejectedValueOnce(err);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderModal();
    clickConfirm();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[clairvoyantCombatant] Error:', err);
    });
    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(1); // te write once, no invented retry
    expect(addSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
    consoleSpy.mockRestore();
    addSpy.mockRestore();
  });

  // ── save-result listener lifecycle: armed once, promptId-gated, detaches ──

  it('arms the save-result listener once, ignores foreign promptIds, resolves once, detaches on same identity', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    renderModal();
    clickConfirm();

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
    });
    expect(addSpy.mock.calls.filter(([type]) => type === 'save-result')).toHaveLength(1);
    const saveListener = addSpy.mock.calls.find(([type]) => type === 'save-result')[1];
    const promptId = createSaveListener.mock.results[0].value.promptId;

    // Foreign promptId → ignored: listener stays armed, no save_result log.
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'someone-elses-prompt', roll: 5, total: 12, success: false },
    }));
    await act(async () => {});
    expect(addEntry.mock.calls.filter(([, e]) => e.type === 'save_result')).toHaveLength(0);
    expect(removeSpy).not.toHaveBeenCalled();

    // Own promptId, failed save → exactly one save_result log, listener detached
    // on the SAME function identity (save_result content owned by .result lane).
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId, roll: 5, total: 12, success: false },
    }));
    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith('save-result', saveListener);
    });
    expect(addEntry.mock.calls.filter(([, e]) => e.type === 'save_result')).toHaveLength(1);

    // Duplicate dispatch after detach → inert.
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId, roll: 5, total: 12, success: false },
    }));
    await act(async () => {});
    expect(addEntry.mock.calls.filter(([, e]) => e.type === 'save_result')).toHaveLength(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
