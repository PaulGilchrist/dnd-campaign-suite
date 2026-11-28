// @maintained-by-ai 2026-11-27
/**
 * HurlThroughHellModal — base lane: the info screen's four ternary arms (each a
 * DISTINCT branch: hasUse, needsPactSlot, then the recharge/non-recharge sub-arms),
 * each with its exact note bytes and every other arm's note provably absent; the
 * overlay/Cancel/Done close contract as zero-action witnesses (close fires exactly
 * once, writers never touched); and the confirm→result transition (round-latch +
 * uses stamps with the 4-arg write-side campaign pins, trigger-row promptId link,
 * info affordances gone then result affordance appears).
 *
 * Sibling ownership (do not duplicate here):
 * - .saveResults.test.jsx (3 cases) — save-resolution side effects: ledger subsets,
 *   damage routing, popup detail, the EXACT addExpiration payload (both arms).
 *   Never re-pinned here.
 * - .resultScreen.test.jsx (2 arms) — result-screen exact copy + Done-on-result
 *   click contract. This lane pins only that the Done AFFORDANCE appears after the
 *   save resolves (structure swap), never its copy or click payload.
 * - -branches.test.jsx (18 blocks / 28 cases) — byte-exact ledgers, needsPactSlot
 *   conjunct falsifiers (:21 — this lane only ever confirms with hasUse=true; the
 *   pact-slot consumption ledger is theirs), null-interim stage, promptId guard,
 *   listener lifecycle, roll-vs-prop fallbacks. Its header's two saveResults
 *   recommendations were superseded by that lane's own 2026-11-27 pass (cited here
 *   for the record only; branches' file cannot be edited from this lane).
 * - .save-dismissed.test.jsx — dismissed-arm copy + dismiss hygiene.
 * The exact arm-note bytes are pinned ONLY here.
 *
 * Split compliance (#1958 handoff): info-arm legs and the confirm test close via
 * Cancel/Done/never — no Done-on-result click here. The save-result dispatch is
 * window.dispatchEvent: the component registers its own window listeners at
 * :233-234, not through the mocked createSaveListener (resultScreen/save-dismissed/
 * saveResults dispatch the same way). It resolves with success:true so no damage or
 * incapacitation face is entered — those rows belong to saveResults/branches.
 * No Date.now freeze needed: no outlet pinned here stamps (the stamped outlets
 * :47/:70/:88/:102/:129/:200 are -branches' — verified by that lane).
 * Zero timers: every chain is microtask-only (mocked services return resolved
 * promises), so bounded act(async) flushes replace the old polling waitFor.
 * Mock-key audit (vs the component's imports): all 7 mocked modules are imported by
 * HurlThroughHellModal.jsx and every exported key is consumed (savePrompt
 * {createSaveListener, logSaveDismissed}, logService {addEntry}, useRuntimeState
 * {getRuntimeValue, setRuntimeValue}, applyDamage {applyDamageToTarget}, combatData
 * {getCombatSummary, getCurrentCombatRound}, diceRoller {rollExpression},
 * expirations {addExpiration}) — no phantoms; useOverlayEntranceFocus imports
 * unmocked (pure DOM focus hook, jsdom-safe). beforeEach clearAllMocks + re-baseline
 * of the single getCurrentCombatRound override.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// The confirm test overrides the live round; re-baseline the default every test so
// call censuses and the not-called witnesses start clean (clearAllMocks keeps the
// factory implementations but a mockReturnValue override would persist).
beforeEach(() => {
  vi.clearAllMocks();
  combatData.getCurrentCombatRound.mockReturnValue(5);
});

// ── Tests ──

const LONG_NOTE = 'No uses remaining. Recharges on a Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.';
const ARM_NOTES = [
  'Uses available: 2 / 3 (Long Rest).',
  'Cost: Expend a Pact Magic spell slot (level 2) to restore a use.',
  LONG_NOTE,
  'No uses remaining. Recharges on a Long Rest.',
];

describe('HurlThroughHellModal', () => {
  // ── Info screen: every ternary arm renders its exact note, every other arm's note
  // is provably absent, and the right close button closes exactly once WITHOUT any
  // side effects (zero-action witness: writers untouched) ──

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
  ])('$case: rules copy, exact note, $actionable arm buttons, close once, no side effects', ({ props: overrides, note, actionable }) => {
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

    // Arm-specific note — every other arm's note must be provably absent
    // (falsifies branch swaps in either direction).
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
    // Closing is a pure close: no latch stamp, no uses increment, no log row.
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  // ── Overlay ──

  it('clicking the overlay does not close the modal', () => {
    const props = makeProps();
    const { container } = render(<HurlThroughHellModal {...props} />);
    fireEvent.click(container.querySelector('.sp-overlay'));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Confirm: the structure swap from info screen to result screen ──

  it('confirm unmounts the info screen, stamps the round latch and uses (4-arg writes), logs the trigger row, then swaps in the result affordance when the save resolves', async () => {
    combatData.getCurrentCombatRound.mockReturnValue(7); // distinct from baseline 5 — the latch must read the live round
    const props = makeProps({ currentUses: 1, maxUses: 3 });
    render(<HurlThroughHellModal {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));
    });

    // Info screen is gone synchronously — the CTA cannot double-fire (-branches flag 10).
    expect(screen.queryByText(/disappears and hurtles through a nightmare landscape/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hurl Through Hell/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    // 4-arg write-side campaign pins (#1878).
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Throg', 'hurlThroughHellTurnUsed', 7, 'test-campaign');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Throg', 'hurlThroughHellUses', 2, 'test-campaign');
    // Trigger row links the minted prompt to the log.
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use',
      characterName: 'Throg',
      abilityName: 'Hurl Through Hell',
      targetName: 'Goblin1',
      promptId: 'test-prompt-id-123',
    }));

    // The modal does NOT close on confirm — it stays open until the player dismisses.
    expect(props.onClose).not.toHaveBeenCalled();

    // Resolve the save (success arm: pure structure witness, no damage/condition face —
    // those ledgers are saveResults'/branches'). setResult renders synchronously.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id-123', roll: 3, total: 10, success: true },
      }));
    });

    // Structure swap complete: the result affordance (Done) exists; the info
    // affordances stay gone; nothing has closed (Done-on-result is resultScreen's).
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
