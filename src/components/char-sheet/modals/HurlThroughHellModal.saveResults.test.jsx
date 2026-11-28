// @maintained-by-ai 2026-11-27
/**
 * HurlThroughHellModal — save-resolution behavior lane.
 *
 * Component line cites re-verified against CURRENT HurlThroughHellModal.jsx bytes.
 *
 * Owns the three save arms as observable behavior (subset assertions, robust to copy
 * tweaks): store writes, damage routing by monsterType, the save_result/roll ledger
 * fields, popup detail fields, and the EXACT addExpiration payload (jsx :164-166) —
 * never re-pin that payload elsewhere. The full ledger rows live in
 * HurlThroughHellModal-branches.test.jsx (18 blocks / 28 cases); result-screen copy
 * and Done in HurlThroughHellModal.resultScreen.test.jsx (2 cases, 2 arms); dismissed
 * arm copy in HurlThroughHellModal.save-dismissed.test.jsx; info-screen render and
 * close in HurlThroughHellModal.test.jsx.
 *
 * Negative assertions run AFTER the handler's terminal setResult (jsx :216) has
 * rendered the result screen, so "nothing happened" claims have real teeth.
 *
 * Method (#1956 canon, owed-fix pass 2026-11-27): the old 15ms pre-dispatch sleep is
 * GONE — handleConfirm and handleSaveResult chains are pure microtasks (every awaited
 * service returns an already-resolved promise), so bounded `act(async ...)` flushes
 * replace sleeps and the terminal waitFor alike. ZERO timers remain in this file.
 * window.dispatchEvent is the correct dispatch face here: the component registers its
 * own window listeners at :233-234, not through the mocked createSaveListener
 * (resultScreen/save-dismissed dispatch the same way). Listener DETACH (:214-215),
 * promptId mismatch (:170) and the unmount leak + duplicate-resolve face are
 * -branches-exclusive (its flags 4/pinned) — cross-cited here, not restated; this
 * lane's popups toHaveLength(1) is a cheap in-tree duplicate-firing tripwire.
 *
 * WRITE-side arity: setRuntimeValue is a plain vi.fn (NOT -branches' live-cells mock),
 * so it does not swallow campaignName — the 4-arg CAMPAIGN pins below land directly
 * (#1878). getRuntimeValue is genuinely 2-arg in the store (useRuntimeState.js:63),
 * so the source's :148 two-arg targetEffects read is correct, not a defect.
 *
 * Mock-key audit (vs the component's 11 imports): every vi.mock key is imported by the
 * component (savePrompt {createSaveListener, logSaveDismissed}, logService {addEntry},
 * useRuntimeState {getRuntimeValue, setRuntimeValue}, applyDamage {applyDamageToTarget},
 * combatData {getCombatSummary, getCurrentCombatRound}, diceRoller {rollExpression},
 * expirations {addExpiration}) — no phantom exports; only useOverlayEntranceFocus
 * imports unmocked (pure DOM focus hook, jsdom-safe). Nothing is re-armed per test
 * (no per-test overrides), so clearAllMocks keeping factory implementations is safe.
 */
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HurlThroughHellModal from './HurlThroughHellModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  // save-dismissed sweep (2026-11-05): components under test may now import the shared dismissal log helper.
  logSaveDismissed: vi.fn(() => Promise.resolve()),
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id-123' })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 22 })),
}));

vi.mock('../../../services/encounters/combatData.js', () => {
  // Stable object: getCombatSummary hands back the SAME summary every call, so the
  // damage-engine pin asserts against that live fixture rather than expect.any().
  const summary = {
    creatures: [
      { name: 'Goblin1', type: 'npc' },
      { name: 'Orc Warrior', type: 'npc', monsterType: 'fiend' },
      { name: 'Elf Mage', type: 'player' },
    ],
  };
  return {
    getCurrentCombatRound: vi.fn(() => 5),
    getCombatSummary: vi.fn(() => summary),
  };
});

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 22, rolls: [15, 7] })),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as logService from '../../../services/ui/logService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as applyDamage from '../../../services/rules/combat/applyDamage.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as expirations from '../../../services/rules/effects/expirations.js';

// ── Fixtures & helpers ──

const CAMPAIGN = 'test-campaign';
const PROMPT_ID = 'test-prompt-id-123';
const makeProps = (overrides = {}) => ({
  action: { name: 'Hurl Through Hell' },
  playerStats: { name: 'Throg', level: 15 },
  campaignName: CAMPAIGN,
  targetName: 'Goblin1',
  saveType: 'WIS',
  saveDc: 16,
  damageType: 'Psychic',
  damageExpression: '4d10',
  damageTotal: 22,
  currentUses: 0,
  maxUses: 3,
  pactMagicRecharge: false,
  pactSlotLevel: 0,
  pactSlotsAvailable: 0,
  onClose: vi.fn(),
  ...overrides,
});

// Capture popups once per test (survives mid-test failure without leaking into siblings).
let popups = [];
const onPopup = (e) => popups.push(e.detail);

// Bounded microtask flushes — every chain here is microtask-only (no timers).
// The pre-dispatch flush lets handleConfirm finish (writes, ability_use ledger,
// listener registration at :233-234); the post flush drains handleSaveResult to
// its terminal removeEventListener + setResult (:214-216).
const flush = () => act(async () => { await Promise.resolve(); });

const dispatchSaveResult = async (detail) => {
  await flush();
  await act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail }));
    await Promise.resolve();
  });
  await flush();
};

const dispatchFail = () => dispatchSaveResult({ promptId: PROMPT_ID, roll: 8, total: 10, success: false });
const dispatchSuccess = () => dispatchSaveResult({ promptId: PROMPT_ID, roll: 15, total: 17, success: true });

async function confirmThenResolve(props, dispatch) {
  render(<HurlThroughHellModal {...makeProps(props)} />);
  fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));
  await dispatch();
  // setResult (:216) rendered the result screen inside the flush above — this loose
  // terminal-state signal (copy itself owned by .resultScreen.test.jsx) makes the
  // mock assertions below terminal, not racy.
  expect(screen.getByText(/(failed|succeeded).*save/)).toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks(); // keeps factory implementations — nothing needs re-arming
  popups = [];
  window.addEventListener('damage-popup', onPopup);
});

afterEach(() => {
  cleanup();
  window.removeEventListener('damage-popup', onPopup);
});

// ── Tests ──

describe('HurlThroughHellModal save resolution', () => {
  it('failed save (non-fiend): incapacitates, hurls, applies Psychic damage, logs both rows, queues return, pops up', async () => {
    await confirmThenResolve({}, dispatchFail);

    expect(diceRoller.rollExpression).toHaveBeenCalledWith('4d10');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin1',
      'activeConditions',
      expect.arrayContaining(['incapacitated']),
      CAMPAIGN
    );
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Goblin1',
          source: 'Hurl Through Hell',
          effect: 'incapacitated',
          condition: 'incapacitated',
          duration: 'until_end_of_next_turn',
          saveType: 'WIS',
          saveDc: 16,
          teleport: true,
          returnToSpace: true,
        }),
      ]),
      CAMPAIGN
    );
    // Rolled damage flows through the engine against the live combat summary
    // (stable fixture — a swapped/rebuilt roster fails the pin) with ONLY players
    // in the characters option.
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      combatData.getCombatSummary(CAMPAIGN),
      'Goblin1',
      22,
      ['Psychic'],
      { campaignName: CAMPAIGN, characters: [{ name: 'Elf Mage', type: 'player' }], ignoreResistance: false, attackerName: 'Throg' }
    );
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'save_result',
      characterName: 'Throg',
      targetName: 'Goblin1',
      saveType: 'WIS',
      saveDc: 16,
      success: false,
      saveRoll: 8,
      saveTotal: 10,
    }));
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'roll',
      characterName: 'Throg',
      rollType: 'damage',
      targetName: 'Goblin1',
      damageType: 'Psychic',
      formula: '4d10',
      total: 22,
    }));
    // Owned pin (:229): the return-to-space teleport expires at the end of the
    // caster's next turn (2 rounds) with this exact full-shape payload.
    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Throg',
      targetName: 'Goblin1',
      effects: [{ type: 'hurl_through_hell_return', target: 'Goblin1', source: 'Hurl Through Hell' }],
      campaignName: CAMPAIGN,
      rounds: 2,
    });

    expect(popups).toHaveLength(1); // in-tree duplicate-fire tripwire (leak face: -branches flag 4)
    expect(popups[0]).toEqual(expect.objectContaining({
      targetName: 'Goblin1',
      sourceName: 'Throg',
      spellName: 'Hurl Through Hell',
      damageType: 'Psychic',
      rolls: [15, 7],
      formula: '4d10',
      popupText: expect.stringContaining('failed WIS save'),
    }));
    expect(popups[0].popupText).toContain('22 Psychic damage');
  });

  it('failed save (fiend): still incapacitated, hurled, and scheduled to return — but never damaged', async () => {
    // 'Orc Warrior' is the monsterType:'fiend' creature in the combat summary fixture.
    await confirmThenResolve({ targetName: 'Orc Warrior' }, dispatchFail);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Orc Warrior',
      'activeConditions',
      expect.arrayContaining(['incapacitated']),
      CAMPAIGN
    );
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({ target: 'Orc Warrior', effect: 'incapacitated', teleport: true, returnToSpace: true }),
      ]),
      CAMPAIGN
    );
    // Fiend arm must still queue the return — full shape with the target interpolated
    // into BOTH the top-level name and the effect entry (this lane owns the payload).
    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Throg',
      targetName: 'Orc Warrior',
      effects: [{ type: 'hurl_through_hell_return', target: 'Orc Warrior', source: 'Hurl Through Hell' }],
      campaignName: CAMPAIGN,
      rounds: 2,
    });

    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ type: 'roll' }));
    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'save_result',
      targetName: 'Orc Warrior',
      success: false,
      description: expect.stringContaining('(Fiend)'),
    }));

    expect(popups).toHaveLength(1);
    expect(popups[0].popupText).toContain('no Psychic damage');
  });

  it('successful save: fully inert — no conditions, effects, damage, or expiration; logs success and pops up', async () => {
    await confirmThenResolve({}, dispatchSuccess);

    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('Goblin1', 'activeConditions', expect.any(Array), CAMPAIGN);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), CAMPAIGN);
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ type: 'roll' }));

    expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'save_result',
      characterName: 'Throg',
      targetName: 'Goblin1',
      success: true,
      saveRoll: 15,
      saveTotal: 17,
    }));

    expect(popups).toHaveLength(1);
    expect(popups[0].popupText).toContain('succeeded on WIS save');
  });
});
