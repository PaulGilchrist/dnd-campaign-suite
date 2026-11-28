// @maintained-by-ai 2026-11-27
/**
 * ClairvoyantCombatantModal — EDGE CASES lane (NON-EMPTY / malformed stores only).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .test.jsx        — info-screen text (incl. pact-variant copy), custom action name, Cancel → onClose,
 *                      mount purity (zero service calls, no listener armed)
 * - .confirm.jsx     — 9 tests (re-verified 2026-11-27 after sweep #1951): button gating it.each, the full
 *                      dispatch census on EMPTY stores (exact te + ONE merged write, same-object identity,
 *                      exact key sets), the confirm-latch (roll affordance gone after click),
 *                      createSaveListener args, ability_use payload, listener lifecycle incl. foreign
 *                      promptId + detach, Pact Magic, addEntry rejection
 * - .expiration.jsx  — pendingExpirations shape faces: armed-entry byte shape (rounds=10, anchorless,
 *                      ordered trio), queue presence contract of the merged writes, cancel-to-empty,
 *                      foreign-target clock trim (flagged), non-array queue at cancel
 * - .result.jsx      — result-screen UI copy, Done/overlay clicks, save_result log content
 * - .save-dismissed.jsx — dismissed un-strand, mismatch guard, trailing-dismiss inertness
 * This lane owns ONLY store-content edges: foreign entries in ALL three written channels
 * (campaign targetEffects, player activeBuffs, player expiration queue) preserved with object
 * identity through the arm dispatch, and save-success stripping EXACTLY this grant from all
 * three (triple-specific te filter, effect+target buff filter, effectKey+source queue trim)
 * while foreign neighbors survive — verified against live stores so the success filters run
 * on what arm actually wrote (anti-vacuous). Plus the malformed-store edge: a truthy non-array
 * activeBuffs store is replaced by this grant alone (the Array.isArray guards at jsx:89/:134),
 * never string-spread. The arm tests pin queue entries only by identity + minimal marker
 * (target/expiryRounds); full clock byte-shape census stays in .expiration.
 *
 * Confirm-lane handoff (#1951) honored: this lane does NOT own confirm-latch/button-absence,
 * the empty-store dispatch census, or gating it.each. Phantom mock keys getCombatSummary,
 * loadCombatSummary, clearRuntimeState purged (component imports at jsx:2-7 are exactly
 * createSaveListener, logSaveDismissed, addEntry, KEY, getCurrentCombatRound, getRuntimeValue,
 * setRuntimeValue, setRuntimeObject; useOverlayEntranceFocus is React-only, unmocked family-wide).
 *
 * Defect dispositions (family context from #1951; NOT laundered here):
 * - :64/:99 unguarded awaits park the modal result-less — no test in this lane rejects those
 *   outlets; inventing a null-render pin would lock the defect in. Flagged in .confirm.
 * - :238-244 unusable info screen lacks Cancel — this lane never renders that screen (all
 *   fixtures use usable props); the confirm lane pins gating via button query, never a forced
 *   click on a disabled control (#1920).
 * - :202-203 listeners uncleaned on unmount — mitigation adopted family-wide: unique promptId
 *   per mint + captured-listener direct dispatch, NEVER window.dispatchEvent, so leaked
 *   listeners from any test can never fire into these assertions. Pinning the leak itself is
 *   deferred until the component gains a cleanup effect.
 * - inline style :239 — flagged in .confirm; not pinnable without a style-attribute selector.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// ── Mocked modules (keys = exactly what the component imports) ──

// Unique promptId per mint: the component never removes listeners on unmount, so leaked
// listeners from earlier tests can never hijack anything in this lane.
let promptCounter = 0;

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  logSaveDismissed: vi.fn(() => Promise.resolve()),
  createSaveListener: vi.fn(() => ({ promptId: `cla-edge-prompt-${++promptCounter}` })),
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
import { getCurrentCombatRound } from '../../../services/encounters/combatData.js';
import { KEY } from '../../../services/rules/effects/expirations.js';

// ── Fixtures ──

const PLAYER = 'Paladin1';
const TARGET = 'Goblin1';
const CAMPAIGN = 'test-campaign';
const FEATURE = 'Clairvoyant Combatant';

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

// Exact shapes the component commits at arm (write contract mirrors .confirm lane).
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

// Foreign neighbors this lane must see survive every write.
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

// House rule: mockReset (not clearAllMocks — it keeps mockResolvedValue/impl), then re-baseline
// the default implementations the component needs to function.
afterEach(() => {
  vi.restoreAllMocks();
  createSaveListener.mockReset().mockImplementation(() => ({
    promptId: `cla-edge-prompt-${++promptCounter}`,
  }));
  getCurrentCombatRound.mockReset().mockReturnValue(1);
  runtime.getRuntimeValue.mockReset().mockReturnValue(null);
  runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
  runtime.setRuntimeObject.mockReset();
});

// Render with the given store fake, click confirm, wait for the save-result listener to be
// armed (no timers), and hand back a dispatcher bound to THIS test's captured listener +
// promptId — never window.dispatchEvent, so leaked listeners can't fire into assertions.
async function arm(getValue) {
  runtime.getRuntimeValue.mockImplementation(getValue);
  render(<ClairvoyantCombatantModal {...makeProps()} />);
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

// Base store: every channel answers; `extra` overrides per-key (e.g. live-store mirrors).
const baseStore = (overrides = {}) => (key, prop) => {
  const hit = Object.entries(overrides).find(([k]) => k === `${key}.${prop}`);
  if (hit) return hit[1];
  if (key === 'campaign' && prop === 'targetEffects') return [foreignSourceEffect, foreignTargetEffect];
  if (key === PLAYER && prop === 'activeBuffs') return [blessBuff];
  if (key === PLAYER && prop === KEY) return [blessClock];
  return null;
};

// ── Edge cases ──

describe('ClairvoyantCombatantModal - edge cases', () => {
  it('arm against fully populated stores preserves foreign entries in all three channels (exact appends, same-object identity, one write per channel)', async () => {
    await arm(baseStore());

    // Campaign channel: ONE setRuntimeValue, foreign rows untouched ahead of this grant.
    // (arm's listener-attach gate already proves the arm writes committed — no extra waitFor.)
    expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(runtime.setRuntimeValue.mock.calls[0]).toEqual([
      'campaign',
      'targetEffects',
      [foreignSourceEffect, foreignTargetEffect, exactTargetEffect],
      CAMPAIGN,
    ]);
    const writtenEffects = runtime.setRuntimeValue.mock.calls[0][2];
    expect(writtenEffects[0]).toBe(foreignSourceEffect); // spread preserves identity — not cloned
    expect(writtenEffects[1]).toBe(foreignTargetEffect);

    // Player channel: ONE merged setRuntimeObject carrying preserved buffs and queue.
    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    const [playerName, payload, campaign] = runtime.setRuntimeObject.mock.calls[0];
    expect(playerName).toBe(PLAYER);
    expect(campaign).toBe(CAMPAIGN);
    expect(payload.activeBuffs).toEqual([blessBuff, exactBuff]);
    expect(payload.activeBuffs[0]).toBe(blessBuff);
    const armedQueue = payload[KEY];
    expect(armedQueue).toHaveLength(2);
    expect(armedQueue[0]).toBe(blessClock); // unrelated clock kept in place...
    // ...cla clock appended after it (minimal marker only — byte-shape census lives in .expiration).
    expect(armedQueue[1]).toEqual(expect.objectContaining({ target: PLAYER, expiryRounds: 10 }));
  });

  it('save-success strips exactly this grant from all three live stores — foreign-source/target te, same-effect foreign-target and foreign-effect buffs, and unrelated clocks all survive', async () => {
    // Live store mirrors: the success filters must run against what arm actually wrote,
    // not a backfilled fixture (anti-vacuous).
    let teStore, buffs, queue;
    const store = (key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') return teStore;
      if (key === PLAYER && prop === 'activeBuffs') return buffs;
      if (key === PLAYER && prop === KEY) return queue;
      return null;
    };
    const getValue = store;
    runtime.setRuntimeValue.mockImplementation((key, prop, value) => {
      if (key === 'campaign' && prop === 'targetEffects') teStore = value;
      return Promise.resolve();
    });
    runtime.setRuntimeObject.mockImplementation((player, obj) => {
      if (player !== PLAYER) return;
      if (Array.isArray(obj.activeBuffs)) buffs = obj.activeBuffs;
      if (Array.isArray(obj[KEY])) queue = obj[KEY];
    });
    teStore = [foreignSourceEffect, foreignTargetEffect];
    buffs = [staleClaBuffOgre, blessBuff];
    queue = [blessClock];
    const { dispatchSuccess } = await arm(getValue);

    // Arm wrote each channel exactly once.
    expect(teStore).toEqual([foreignSourceEffect, foreignTargetEffect, exactTargetEffect]);
    expect(queue).toHaveLength(2);
    expect(queue[0]).toBe(blessClock);

    dispatchSuccess();
    await screen.findByText(/Goblin1 succeeded on Wisdom save/);

    // te: exactly arm + success writes, no strays; success trims ONLY the exact
    // target+source+effect triple — foreign-source and foreign-target survive.
    expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(runtime.setRuntimeValue.mock.calls[1]).toEqual([
      'campaign',
      'targetEffects',
      [foreignSourceEffect, foreignTargetEffect],
      CAMPAIGN,
    ]);
    expect(teStore[0]).toBe(foreignSourceEffect);
    expect(teStore[1]).toBe(foreignTargetEffect);

    // buffs + queue + target ride the second merged write: this run's buff (effect+target
    // match) removed, same-effect foreign-target and foreign-effect buffs survive; Blessing's
    // clock rides untouched; the active target is cleared.
    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(2);
    const successPayload = runtime.setRuntimeObject.mock.calls[1][1];
    expect(successPayload.clairvoyantCombatantTarget).toBe(null);
    expect(successPayload.activeBuffs).toEqual([staleClaBuffOgre, blessBuff]);
    expect(successPayload.activeBuffs[0]).toBe(staleClaBuffOgre);
    expect(successPayload.activeBuffs[1]).toBe(blessBuff);
    expect(successPayload[KEY]).toEqual([blessClock]);
    expect(successPayload[KEY][0]).toBe(blessClock);
    expect(queue).toEqual([blessClock]);
  });

  it('truthy non-array activeBuffs store is replaced by this grant alone — never string-spread — and success filters the restored list to empty', async () => {
    // Malformed-store edge: jsx:89/:134 Array.isArray guards. Without them, [...'CORRUPT', buff]
    // would scatter characters into the store. (Non-array QUEUE faces are .expiration's lane.)
    let buffs = 'CORRUPT';
    runtime.setRuntimeObject.mockImplementation((player, obj) => {
      if (player === PLAYER && Array.isArray(obj.activeBuffs)) buffs = obj.activeBuffs;
    });
    const { dispatchSuccess } = await arm((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') return [];
      if (key === PLAYER && prop === 'activeBuffs') return buffs;
      return null;
    });

    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    expect(runtime.setRuntimeObject.mock.calls[0][1].activeBuffs).toEqual([exactBuff]);
    expect(buffs).toEqual([exactBuff]);

    dispatchSuccess();
    await screen.findByText(/Goblin1 succeeded on Wisdom save/);

    // The corrupted store never reaches the success filter — restored list filters to empty.
    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(2);
    expect(runtime.setRuntimeObject.mock.calls[1][1].activeBuffs).toEqual([]);
    expect(buffs).toEqual([]);
  });
});
