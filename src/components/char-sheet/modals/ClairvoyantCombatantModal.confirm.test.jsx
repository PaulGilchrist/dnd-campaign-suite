/**
 * ClairvoyantCombatantModal — CONFIRM seam lane.
 *
 * Ownership map (siblings, do not duplicate here):
 * - .test.jsx        — info-screen text, custom action name render, Cancel → onClose
 * - .edgeCases.jsx   — targetEffects/activeBuffs preservation + success-save filtering
 * - .expiration.jsx  — armed-clock queue depth/shape (rounds=10, anchorless, trio) + cancel
 * - .result.jsx      — result-screen UI, Done/overlay clicks, save_result log content
 * This lane owns ONLY what fires at confirm: button gating, the exact targetEffects
 * write contract, the ONE merged player-store write (CLA-053/§39, same-object identity),
 * createSaveListener args, ability_use log payload, save-result listener lifecycle,
 * Pact Magic expenditure, and addEntry rejection resilience (only real .catch sites).
 *
 * FLAG (component, not fixed here):
 * - ClairvoyantCombatantModal.jsx:212 — inline style on the "no uses" note.
 * - setRuntimeValue / createSaveListener in handleConfirm have NO try/catch: a reject
 *   there leaves the modal stuck rendering null (no retry, no close). Not tested —
 *   never invent a catch. Only addEntry's real .catch(e => console.error) is covered.
 * - The unusable info screen renders no Cancel button (no way out without closing tab).
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'factory-default' })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  KEY: 'pendingExpirations',
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  getCombatSummary: vi.fn(() => null),
  loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  clearRuntimeState: vi.fn(),
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

function getConfirmButton() {
  return screen.getByRole('button', { name: /Clairvoyant Combatant/ });
}

function clickConfirm() {
  fireEvent.click(getConfirmButton());
}

// Exact buff/newEffect shape the component commits at confirm (write contract).
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

// Unique promptId per test so stale window listeners from earlier tests
// (the component never removes listeners on unmount) can never hijack
// dispatched save-result events in later tests.
let promptCounter = 0;

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

  // ── Exact write contract: campaign targetEffects ──

  it('writes the exact clairvoyant_combatant targetEffect to the campaign store (exactly one te write)', async () => {
    renderModal();
    clickConfirm();

    await waitFor(() => {
      expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(1);
    });
    const [scope, key, value, campaign] = runtime.setRuntimeValue.mock.calls[0];
    expect(scope).toBe('campaign');
    expect(key).toBe('targetEffects');
    expect(campaign).toBe(CAMPAIGN);
    expect(value).toEqual([exactTargetEffect]);
  });

  // ── Exact write contract: ONE merged player-store write (§39) ──

  it('applies ONE merged player-store write with the exact confirm payload (same-object identity)', async () => {
    renderModal();
    clickConfirm();

    await waitFor(() => {
      expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    });
    const [playerName, payload, campaign] = runtime.setRuntimeObject.mock.calls[0];
    expect(playerName).toBe(PLAYER);
    expect(campaign).toBe(CAMPAIGN);
    // All player keys ride this single object — exact key set, no orphan writes.
    expect(Object.keys(payload).sort()).toEqual(
      ['activeBuffs', 'clairvoyantCombatantTarget', 'clairvoyantCombatantUses', 'pendingExpirations'],
    );
    // Same-object identity: every value asserted on the ONE captured payload.
    expect(payload.clairvoyantCombatantUses).toBe(2); // currentUses 1 + 1
    expect(payload.clairvoyantCombatantTarget).toBe(TARGET);
    expect(payload.activeBuffs).toEqual([exactBuff]);
    // Clock queue must ride the same write; depth/shape owned by .expiration.test.jsx
    expect(payload.pendingExpirations).toHaveLength(1);
  });

  // ── Save prompt + ability_use log: exact payloads, promptId wired from mock result ──

  it('creates the save prompt once and logs one exact ability_use entry wired to the returned promptId', async () => {
    renderModal();
    clickConfirm();

    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledTimes(1); // hasUse path logs exactly once
    });
    expect(createSaveListener).toHaveBeenCalledTimes(1);
    expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, {
      targetName: TARGET,
      saveType: 'Wisdom',
      saveDc: 13,
    });
    const promptId = createSaveListener.mock.results[0].value.promptId;
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use',
      characterName: PLAYER,
      abilityName: FEATURE,
      description: `${FEATURE} triggered against ${TARGET} (via Awakened Mind) — ${TARGET} must make Wisdom save (DC 13) or suffer combat disadvantage.`,
      targetName: TARGET,
      promptId,
      timestamp: expect.any(Number),
    });
  });

  // ── Props flow through every confirm-side service (anti fixture-echo) ──

  it.each([
    { targetName: 'Orc Chieftain', saveType: 'Charisma', saveDc: 17, action: { name: FEATURE } },
    { targetName: 'Shadow', saveType: 'Constitution', saveDc: 15, action: { name: 'Spectral Sight' } },
  ])('props flow through te write, save prompt, and log ($targetName / $action.name)', async (t) => {
    renderModal({ targetName: t.targetName, saveType: t.saveType, saveDc: t.saveDc, action: t.action });
    clickConfirm();

    await waitFor(() => {
      expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    });
    const [, , teValue] = runtime.setRuntimeValue.mock.calls[0];
    expect(teValue).toEqual([
      {
        target: t.targetName,
        source: t.action.name,
        effect: 'clairvoyant_combatant',
        duration: '1_minute',
        saveType: t.saveType,
        saveDc: t.saveDc,
        attackerAdvantage: true,
        defenderDisadvantage: true,
      },
    ]);
    expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, {
      targetName: t.targetName,
      saveType: t.saveType,
      saveDc: t.saveDc,
    });
    const promptId = createSaveListener.mock.results[0].value.promptId;
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use',
      characterName: PLAYER,
      abilityName: t.action.name,
      description: `${t.action.name} triggered against ${t.targetName} (via Awakened Mind) — ${t.targetName} must make ${t.saveType} save (DC ${t.saveDc}) or suffer combat disadvantage.`,
      targetName: t.targetName,
      promptId,
      timestamp: expect.any(Number),
    });
    expect(runtime.setRuntimeObject.mock.calls[0][1].clairvoyantCombatantTarget).toBe(t.targetName);
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
    const [playerName, payload] = runtime.setRuntimeObject.mock.calls[0];
    expect(playerName).toBe(PLAYER);
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
    const promptId = createSaveListener.mock.results[0].value.promptId;
    const mainEntry = {
      type: 'ability_use',
      characterName: PLAYER,
      abilityName: FEATURE,
      description: `${FEATURE} triggered against ${TARGET} (via Awakened Mind) — ${TARGET} must make Wisdom save (DC 13) or suffer combat disadvantage.`,
      targetName: TARGET,
      promptId,
      timestamp: expect.any(Number),
    };
    expect(addEntry.mock.calls).toEqual([
      [CAMPAIGN, pactEntry],
      [CAMPAIGN, mainEntry],
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

    // Own promptId, failed save → exactly one save_result log, listener detached.
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId, roll: 5, total: 12, success: false },
    }));
    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith('save-result', saveListener);
    });
    expect(addEntry.mock.calls.filter(([, e]) => e.type === 'save_result')).toHaveLength(1);

    // Duplicate dispatch after detach → inert (save_result content owned by .result lane).
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId, roll: 5, total: 12, success: false },
    }));
    await act(async () => {});
    expect(addEntry.mock.calls.filter(([, e]) => e.type === 'save_result')).toHaveLength(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
