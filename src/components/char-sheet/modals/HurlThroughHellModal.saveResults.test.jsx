// @maintained-by-ai
/**
 * HurlThroughHellModal — save-resolution behavior lane.
 *
 * Owns the three save outcomes as observable behavior (subset assertions, robust to copy
 * tweaks): state writes, damage routing by monsterType, both log rows, popup, result screen.
 * The exact addExpiration payload (:160-162) is pinned ONLY here — never re-pin elsewhere.
 * Byte-exact ledgers, popup key shapes, flag pins, guards and listener lifecycle live in
 * HurlThroughHellModal-branches.test.jsx; info-screen render and close behavior in
 * HurlThroughHellModal.test.jsx.
 *
 * Negative assertions run AFTER the result screen renders (setResult at :211 is the last
 * thing the handler does), so "nothing happened" claims have real teeth.
 */
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HurlThroughHellModal from './HurlThroughHellModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
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

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin1', type: 'npc' },
      { name: 'Orc Warrior', type: 'npc', monsterType: 'fiend' },
      { name: 'Elf Mage', type: 'player' },
    ],
  })),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 22, rolls: [15, 7] })),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as logService from '../../../services/ui/logService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
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

// Macrotask flushes: the pre-dispatch tick lets handleConfirm's promise chain finish and
// register the 'save-result' listener; the post tick drains the handler's awaited logging.
const dispatchSaveResult = (detail) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 15));
    window.dispatchEvent(new CustomEvent('save-result', { detail }));
    await new Promise((r) => setTimeout(r, 0));
  });

const dispatchFail = () => dispatchSaveResult({ promptId: PROMPT_ID, roll: 8, total: 10, success: false });
const dispatchSuccess = () => dispatchSaveResult({ promptId: PROMPT_ID, roll: 15, total: 17, success: true });

async function confirmThenResolve(props, dispatch) {
  render(<HurlThroughHellModal {...makeProps(props)} />);
  fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));
  await dispatch();
  // setResult() renders the result screen only after ALL handler work has completed —
  // asserting after this point makes the mock assertions below terminal, not racy.
  await waitFor(() => {
    expect(screen.getByText(/(failed|succeeded).*save/)).toBeInTheDocument();
  });
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
    // Rolled damage flows through the damage engine with ONLY players in the roster.
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object),
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
    // Owned pin: the return-to-space teleport expires at the end of the caster's next turn.
    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: 'Throg',
      targetName: 'Goblin1',
      effects: [{ type: 'hurl_through_hell_return', target: 'Goblin1', source: 'Hurl Through Hell' }],
      campaignName: CAMPAIGN,
      rounds: 2,
    });

    expect(popups).toHaveLength(1);
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
    expect(expirations.addExpiration).toHaveBeenCalledWith(expect.objectContaining({
      targetName: 'Orc Warrior',
      campaignName: CAMPAIGN,
    }));

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
