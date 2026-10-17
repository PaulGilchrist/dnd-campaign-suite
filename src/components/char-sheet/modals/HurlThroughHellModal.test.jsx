// @maintained-by-ai
/**
 * HurlThroughHellModal — base lane: info-screen rendering (all three ternary arms with
 * their exact notes), overlay/Cancel/Done close contract, and confirm side effects
 * (round latch, uses increment, trigger log row).
 *
 * Sibling ownership (do not duplicate here):
 * - .saveResults.test.jsx — save resolution (conditions, damage routing, addExpiration, popups)
 * - .resultScreen.test.jsx — result-screen copy + Done-on-result contract
 * - -branches.test.jsx — byte-exact ledgers, needsPactSlot conjunct matrix, inline-style
 *   flag, promptId guard, listener lifecycle, roll-vs-prop fallbacks
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin1', type: 'npc' },
      { name: 'Orc Warrior', type: 'npc', monsterType: 'fiend' },
      { name: 'Elf Mage', type: 'player' },
    ],
  })),
  getCurrentCombatRound: vi.fn(() => 5),
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
import * as combatData from '../../../services/encounters/combatData.js';

// ── Fixtures ──

function makeProps(overrides = {}) {
  return {
    action: { name: 'Hurl Through Hell' },
    playerStats: { name: 'Throg', level: 15 },
    campaignName: 'test-campaign',
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
  };
}

// ── Tests ──

const LONG_NOTE = 'No uses remaining. Recharges on a Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.';
const ARM_NOTES = [
  'Uses available: 2 / 3 (Long Rest).',
  'Cost: Expend a Pact Magic spell slot (level 2) to restore a use.',
  LONG_NOTE,
  'No uses remaining. Recharges on a Long Rest.',
];

describe('HurlThroughHellModal', () => {
  // ── Info screen: every ternary arm renders its exact note, the wrong-note arm's
  // absence, and the right close button — which then closes exactly once ──

  it.each([
    {
      case: 'uses available',
      props: { currentUses: 1, maxUses: 3 },
      note: 'Uses available: 2 / 3 (Long Rest).',
      actionable: true,
    },
    {
      case: 'no uses, Pact slot available',
      props: { currentUses: 3, maxUses: 3, pactMagicRecharge: true, pactSlotLevel: 2, pactSlotsAvailable: true },
      note: 'Cost: Expend a Pact Magic spell slot (level 2) to restore a use.',
      actionable: true,
    },
    {
      case: 'exhausted, recharge feature but no Pact slots',
      props: { currentUses: 3, maxUses: 3, pactMagicRecharge: true, pactSlotsAvailable: false },
      note: LONG_NOTE,
      actionable: false,
    },
    {
      case: 'exhausted, non-recharge feature',
      props: { currentUses: 3, maxUses: 3, pactMagicRecharge: false },
      note: 'No uses remaining. Recharges on a Long Rest.',
      actionable: false,
    },
  ])('$case: rules copy, exact note, $actionable arm buttons, close once', ({ props: overrides, note, actionable }) => {
    const props = makeProps(overrides);
    render(<HurlThroughHellModal {...props} />);

    // Shared rules copy — present on every arm.
    expect(screen.getByText(/disappears and hurtles through a nightmare landscape/)).toBeInTheDocument();
    expect(screen.getByText(/At the end of your next turn.*returns/)).toBeInTheDocument();
    expect(screen.getByText('Goblin1')).toBeInTheDocument();
    expect(screen.getByText('WIS')).toBeInTheDocument();
    expect(screen.getByText(/DC 16/)).toBeInTheDocument();
    expect(screen.getByText('22 Psychic damage')).toBeInTheDocument();
    expect(screen.getByText('Incapacitated')).toBeInTheDocument();

    // Arm-specific note — every other arm's note must be provably absent.
    ARM_NOTES.forEach((armNote) => {
      expect(!!screen.queryByText(armNote)).toBe(armNote === note);
    });

    const rollBtn = screen.queryByRole('button', { name: /Hurl Through Hell/ });
    const cancelBtn = screen.queryByRole('button', { name: 'Cancel' });
    const doneBtn = screen.queryByRole('button', { name: 'Done' });
    expect(!!rollBtn).toBe(actionable);
    expect(!!cancelBtn).toBe(actionable);
    expect(!!doneBtn).toBe(!actionable);

    fireEvent.click(actionable ? cancelBtn : doneBtn);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  // ── Overlay ──

  it('clicking the overlay does not close the modal', () => {
    const props = makeProps();
    render(<HurlThroughHellModal {...props} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Confirm: seam between info screen and save prompt ──

  it('confirm unmounts the info screen, stamps the round latch, increments uses, and logs the trigger row', async () => {
    combatData.getCurrentCombatRound.mockReturnValue(7); // distinct from default 5 — the latch must read the live round
    const props = makeProps({ currentUses: 1, maxUses: 3 });
    render(<HurlThroughHellModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));

    // Info screen is gone synchronously — CTA cannot double-fire (own-result stage pending).
    expect(screen.queryByText(/disappears and hurtles through a nightmare landscape/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hurl Through Hell/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Throg', 'hurlThroughHellTurnUsed', 7, 'test-campaign');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Throg', 'hurlThroughHellUses', 2, 'test-campaign');
      expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'ability_use',
        characterName: 'Throg',
        abilityName: 'Hurl Through Hell',
        targetName: 'Goblin1',
        promptId: 'test-prompt-id-123',
      }));
    });

    // Modal stays open until the player dismisses the result — nothing closed it yet.
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
