/**
 * ClairvoyantCombatantModal — EDGE CASES lane (non-empty-store behavior only).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .test.jsx       — info-screen text (incl. pact-variant copy), custom action name, Cancel → onClose
 * - .confirm.jsx    — button gating it.each, exact te + ONE merged write on EMPTY stores
 *                     (same-object identity, exact key sets), createSaveListener args, ability_use
 *                     payload, listener lifecycle incl. foreign promptId + detach, Pact Magic,
 *                     addEntry rejection
 * - .expiration.jsx — armed-clock queue depth/shape (rounds=10, anchorless, trio) + cancel-to-empty
 * - .result.jsx     — result-screen UI, Done/overlay clicks, save_result log content
 * This lane owns behavior when the stores are NON-EMPTY: preservation of foreign campaign
 * targetEffects at arm, triple-specific te filtering on save-success (foreign-source and
 * foreign-target survive), foreign activeBuffs preservation at arm, buff filtering by
 * effect+target (same-effect foreign-target survives), and unrelated expiration-queue entries
 * preserved through the arm→cancel cycle.
 *
 * Confirm-lane flag dispositions (checked here, deferred deliberately):
 * - inline style :212 — cannot be pinned without a style-attribute selector (forbidden in this
 *   lane); product fix should swap to a CSS class instead of pinning the bad inline value.
 * - unguarded setRuntimeValue/createSaveListener (render-null escape) — a test asserting "modal
 *   renders null forever on rejection" would lock in the defect; needs the component try/catch
 *   first. Deferred with the flag.
 * - no Cancel button on unusable screen — confirm lane already pins inertness (no roll button,
 *   zero writes); asserting the missing Cancel would be a failing test. Deferred, flagged.
 * - listener never detached on unmount — stale listeners can post store writes after the modal
 *   closes; pinning current behavior locks in the leak. Deferred, flagged. Mitigation adopted
 *   from confirm lane: unique promptId per test + direct listener dispatch, never window
 *   dispatch, so leaked listeners can never hijack this lane.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
import { KEY } from '../../../services/rules/effects/expirations.js';

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

// Exact shapes the component commits at confirm (write contract mirrors .confirm lane).
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
const exactBuff = {
  name: FEATURE,
  effect: 'clairvoyant_combatant',
  duration: '1_minute',
  target: TARGET,
};

// Foreign entries this lane must see survive.
const foreignSourceEffect = { target: TARGET, source: 'Aura of Fear', effect: 'clairvoyant_combatant' };
const foreignTargetEffect = { target: 'Ogre2', source: FEATURE, effect: 'clairvoyant_combatant' };
const blessBuff = { name: 'Blessing', effect: 'blessing', target: TARGET };
const staleClaBuffOgre = { name: FEATURE, effect: 'clairvoyant_combatant', duration: '1_minute', target: 'Ogre2' };
const blessClock = {
  target: PLAYER,
  effects: [{ type: 'remove_active_buff', buffName: 'Blessing' }],
  appliedRound: 1,
  expiryRounds: 5,
  expireOnCreatureName: null,
};

// Unique promptId per test so stale window listeners from earlier tests (the component never
// removes listeners on unmount) can never hijack anything in this lane.
let promptCounter = 0;

// House rule: mockReset (not clearAllMocks — it keeps mockResolvedValue/impl), then re-arm
// the default implementations the component needs to function.
afterEach(() => {
  vi.restoreAllMocks();
  createSaveListener.mockReset().mockImplementation(() => ({
    promptId: `cla-edge-prompt-${++promptCounter}`,
  }));
  addEntry.mockReset().mockResolvedValue(undefined);
  runtime.getRuntimeValue.mockReset().mockReturnValue(null);
  runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
  runtime.setRuntimeObject.mockReset();
});

// Render, click confirm, wait for the listener to be armed (no timers), and hand back a
// dispatcher bound to THIS test's captured listener + promptId — never window.dispatchEvent,
// so leaked listeners from other tests can't fire into these assertions.
async function arm(props = {}) {
  render(<ClairvoyantCombatantModal {...makeProps(props)} />);
  const addSpy = vi.spyOn(window, 'addEventListener');
  fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));
  await waitFor(() => {
    expect(addSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
  });
  const [, listener] = addSpy.mock.calls.filter(([type]) => type === 'save-result')[0];
  const promptId = createSaveListener.mock.results[0].value.promptId;
  return {
    dispatchSuccess: () => listener(new CustomEvent('save-result', {
      detail: { promptId, roll: 10, total: 15, success: true },
    })),
  };
}

// ── Edge cases ──

describe('ClairvoyantCombatantModal - edge cases', () => {
  // ── campaign targetEffects ──

  it('preserves foreign targetEffects at arm: exact appended write, foreign entries same-object', async () => {
    runtime.getRuntimeValue.mockImplementation((key, prop) =>
      (key === 'campaign' && prop === 'targetEffects'
        ? [foreignSourceEffect, foreignTargetEffect]
        : null));
    await arm();

    await waitFor(() => {
      expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(1);
    });
    expect(runtime.setRuntimeValue.mock.calls[0]).toEqual([
      'campaign',
      'targetEffects',
      [foreignSourceEffect, foreignTargetEffect, exactTargetEffect],
      CAMPAIGN,
    ]);
    // Spread preserves object identity — foreign entries are not cloned or rewritten.
    const written = runtime.setRuntimeValue.mock.calls[0][2];
    expect(written[0]).toBe(foreignSourceEffect);
    expect(written[1]).toBe(foreignTargetEffect);
  });

  it('save-success removes only the exact target+source+effect triple — foreign-source and foreign-target survive', async () => {
    // Live store: the success filter must run against what arm actually wrote,
    // not a backfilled fixture (anti-vacuous).
    let teStore = [foreignSourceEffect, foreignTargetEffect];
    runtime.getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') return teStore;
      return null;
    });
    runtime.setRuntimeValue.mockImplementation((key, prop, value) => {
      if (key === 'campaign' && prop === 'targetEffects') teStore = value;
      return Promise.resolve();
    });
    const { dispatchSuccess } = await arm();

    dispatchSuccess();
    await screen.findByText(/succeeded on Wisdom save/);

    // Exactly two te writes: arm append, then success filter — no stray writes.
    expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(runtime.setRuntimeValue.mock.calls[1]).toEqual([
      'campaign',
      'targetEffects',
      [foreignSourceEffect, foreignTargetEffect],
      CAMPAIGN,
    ]);
    expect(teStore).toHaveLength(2);
    expect(teStore[0]).toBe(foreignSourceEffect); // same target+effect, foreign source — survives
    expect(teStore[1]).toBe(foreignTargetEffect); // same source+effect, foreign target — survives
  });

  // ── player activeBuffs ──

  it('preserves foreign activeBuffs in the ONE merged arm write (exact array, same-object)', async () => {
    runtime.getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') return [];
      if (key === PLAYER && prop === 'activeBuffs') return [blessBuff];
      return null;
    });
    await arm();

    await waitFor(() => {
      expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    });
    const [playerName, payload, campaign] = runtime.setRuntimeObject.mock.calls[0];
    expect(playerName).toBe(PLAYER);
    expect(campaign).toBe(CAMPAIGN);
    expect(payload.activeBuffs).toEqual([blessBuff, exactBuff]);
    expect(payload.activeBuffs[0]).toBe(blessBuff);
  });

  it('save-success filters buffs by effect+target — same-effect foreign-target and foreign-effect buffs survive', async () => {
    // Live store so the arm append is visible to the success filter (anti-vacuous).
    let buffs = [staleClaBuffOgre, blessBuff];
    runtime.getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') return [];
      if (key === PLAYER && prop === 'activeBuffs') return buffs;
      return null;
    });
    runtime.setRuntimeObject.mockImplementation((player, obj) => {
      if (player === PLAYER && Array.isArray(obj.activeBuffs)) buffs = obj.activeBuffs;
    });
    const { dispatchSuccess } = await arm();

    dispatchSuccess();
    await screen.findByText(/succeeded on Wisdom save/);

    // arm write + success write, one each.
    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(2);
    // This run's buff (effect+target match) removed; stale same-effect/foreign-target survives.
    expect(buffs).toEqual([staleClaBuffOgre, blessBuff]);
    expect(runtime.setRuntimeObject.mock.calls[1][1].activeBuffs[0]).toBe(staleClaBuffOgre);
    expect(runtime.setRuntimeObject.mock.calls[1][1].activeBuffs[1]).toBe(blessBuff);
  });

  // ── expiration queue through the full arm→cancel cycle ──

  it('unrelated expiration queue entries are preserved at arm and survive the success cancel', async () => {
    // Live queue: arm appends the cla clock onto blessClock; success must trim ONLY cla.
    let queue = [blessClock];
    runtime.getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') return [];
      if (key === PLAYER && prop === KEY) return queue;
      return null;
    });
    runtime.setRuntimeObject.mockImplementation((player, obj) => {
      if (player === PLAYER && Array.isArray(obj[KEY])) queue = obj[KEY];
    });
    const { dispatchSuccess } = await arm();

    // Arm: unrelated clock kept in place, cla clock appended after it.
    await waitFor(() => {
      expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    });
    const armedQueue = runtime.setRuntimeObject.mock.calls[0][1][KEY];
    expect(armedQueue).toHaveLength(2);
    expect(armedQueue[0]).toBe(blessClock);
    expect(armedQueue[1]).toEqual(expect.objectContaining({ target: PLAYER, expiryRounds: 10 }));

    dispatchSuccess();
    await screen.findByText(/succeeded on Wisdom save/);

    // Cancel trims only the cla entry — Blessing's clock rides the success write untouched.
    const successPayload = runtime.setRuntimeObject.mock.calls[1][1];
    expect(successPayload[KEY]).toEqual([blessClock]);
    expect(successPayload[KEY][0]).toBe(blessClock);
  });
});
