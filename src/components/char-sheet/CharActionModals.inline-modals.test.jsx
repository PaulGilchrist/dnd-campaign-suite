// @maintained-by-ai
// CharActionModals inline-modal wiring tests — behaviors NOT covered elsewhere:
// - BastionOfLaw confirm → handleApply payload flows into setPopupHtml, then
//   modal closes. (Arg routing → secondary-targets.test.jsx; close-on-onClose →
//   same file. This is the only lane asserting the payload→popup display path.)
// - moonlightStepFallbackModal full contract: metadata render + "Yes, Consume
//   Slot" → confirmTeleport args, popup payload, modal cleared.
// - attackRiderOptionsModal full contract: header/options/hint render, option
//   click dispatches handleAttackRiderOptionSelect with untouched modal data,
//   Skip clears only this modal.
// - naturesSanctuaryCreaturesModal isMove title/note/confirmLabel ternary
//   mapping through HealingModals. (Confirm dispatch →
//   target-selection-handlers.test.jsx; skip close → mass-healing-skips.test.jsx.)
// - clockworkCavalcadeRepairModal Repair-confirm click (canonical keeper;
//   title + Cancel-close live in full-rendering.test.jsx).
//
// Consolidated: moonlightStepFallback render+flow and attackRiderOptions
// render+dispatch each merged into one test per mounted tree; naturesSanctuary
// isMove variants parameterized. NaturesSanctuary confirm-click removed —
// byte-identical path to target-selection-handlers.test.jsx.
//
// Mocks follow the lane convention: only the modals actually mounted by these
// tests, plus the minimal service set the CharActionModals tree needs at mount.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks (all inline due to vi.mock hoisting) ──

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({ getCombatContext: vi.fn().mockResolvedValue(null) }));

vi.mock('./modals/divine/BastionOfLawModal.jsx', () => ({
  default: ({ onClose, onConfirm }) => (
    <div data-testid="bastion-of-law-modal">
      <button data-testid="bastion-confirm" onClick={() => onConfirm(5, 'target')}>Confirm</button>
      <button data-testid="bastion-close" onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock('../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(undefined),
  handleClearWard: vi.fn().mockResolvedValue(undefined),
  handleSpendDice: vi.fn().mockResolvedValue(undefined),
  handleApply: vi.fn().mockResolvedValue({ payload: '<b>Bastion of Law</b><br/>Applied' }),
}));
vi.mock('../../services/automation/handlers/class-warlock/tempTeleportHandler.js', () => ({
  confirmTeleport: vi.fn().mockResolvedValue({ type: 'popup', payload: { name: 'Moonlight Step', description: 'Teleported' } }),
}));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: ({ title, note, targets, confirmLabel, onConfirm, onSkip }) => (
    <div data-testid="creature-selection-modal">
      <div data-testid="creature-title">{title}</div>
      {note && <div data-testid="creature-note">{note}</div>}
      {targets.map((t, i) => <label key={i} data-testid={`creature-target-${t.name}`} onClick={() => onConfirm([t.name])}>{t.name}</label>)}
      <button data-testid="creature-confirm" onClick={() => onConfirm(targets.map(t => t.name))}>{confirmLabel}</button>
      <button data-testid="creature-skip" onClick={onSkip}>Skip</button>
    </div>
  ),
}));

// ── Tests ──

describe('CharActionModals — inline modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the BastionOfLaw handleApply payload as popup html, then closes the modal', async () => {
    const setModalState = vi.fn();
    const setPopupHtml = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ setPopupHtml })}
      modalState={{ bastionOfLawModal: { featureName: 'Bastion', auto: {} } }}
      setModalState={setModalState}
    />);
    fireEvent.click(screen.getByTestId('bastion-confirm'));
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith('<b>Bastion of Law</b><br/>Applied');
    });
    expect(setModalState).toHaveBeenCalledWith({ bastionOfLawModal: null });
  });

  it('moonlightStepFallbackModal: renders slot-fallback prompt and consumes a slot via confirmTeleport on Yes', async () => {
    const { confirmTeleport } = await import('../../services/automation/handlers/class-warlock/tempTeleportHandler.js');
    const setModalState = vi.fn();
    const setPopupHtml = vi.fn();
    const modalData = { action: { name: 'Moonlight Step' }, playerStats: {}, campaignName: 'test-campaign', slotLevel: 1 };
    render(<CharActionModals
      {...createBaseProps({ setPopupHtml })}
      modalState={{ moonlightStepFallbackModal: modalData }}
      setModalState={setModalState}
    />);

    expect(screen.getByText(/No Moonlight Step uses remaining/)).toBeInTheDocument();
    expect(screen.getByText('Yes, Consume Slot')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Yes, Consume Slot'));

    expect(confirmTeleport).toHaveBeenCalledWith(modalData.action, {}, 'test-campaign', false, 1);
    expect(setModalState).toHaveBeenCalledWith({ moonlightStepFallbackModal: null });
    await waitFor(() => {
      const html = setPopupHtml.mock.calls[0]?.[0] ?? '';
      expect(html).toContain('Moonlight Step');
      expect(html).toContain('Teleported');
    });
  });

  it('attackRiderOptionsModal: renders maneuver options with effect hints, dispatches selection with untouched modal data, and Skip closes only this modal', () => {
    const handler = vi.fn();
    const setModalState = vi.fn();
    const modalData = { maneuver: { name: 'Test Maneuver' }, riderOptions: [{ name: 'Option A', effect: 'push_15ft' }] };
    render(<CharActionModals
      {...createBaseProps({ handleAttackRiderOptionSelect: handler })}
      modalState={{ attackRiderOptionsModal: modalData }}
      setModalState={setModalState}
    />);

    expect(screen.getByText(/Test Maneuver.*Choose Effect/)).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText(/Push target 15 feet/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Option A'));
    expect(handler).toHaveBeenCalledWith('Option A', modalData);

    fireEvent.click(screen.getByText('Skip'));
    expect(setModalState).toHaveBeenCalledWith({ attackRiderOptionsModal: null });
  });

  describe.each([
    {
      isMove: false,
      expectedTitle: "Nature's Sanctuary — Choose Creatures",
      expectedNote: 'Expend 1 Wild Shape use to create the sanctuary.',
      expectedConfirmLabel: 'Create Sanctuary',
    },
    {
      isMove: true,
      expectedTitle: "Nature's Sanctuary (Move) — Choose Creatures",
      expectedNote: 'Existing creatures are pre-selected. Toggle to add or remove creatures.',
      expectedConfirmLabel: 'Move Sanctuary',
    },
  ])('naturesSanctuaryCreaturesModal (isMove: $isMove)', ({ isMove, expectedTitle, expectedNote, expectedConfirmLabel }) => {
    it('maps the isMove ternary to title, note, and confirm label through HealingModals', () => {
      render(<CharActionModals
        {...createBaseProps({ handleNaturesSanctuaryConfirm: vi.fn() })}
        modalState={{ naturesSanctuaryCreaturesModal: { creatureTargets: [{ name: 'Goblin' }], isMove } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('creature-title').textContent).toBe(expectedTitle);
      expect(screen.getByTestId('creature-note').textContent).toBe(expectedNote);
      expect(screen.getByTestId('creature-confirm').textContent).toBe(expectedConfirmLabel);
    });
  });

  it('clockworkCavalcadeRepairModal: Repair click invokes handleClockworkCavalcadeRepairConfirm', () => {
    const handler = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleClockworkCavalcadeRepairConfirm: handler })}
      modalState={{ clockworkCavalcadeRepairModal: {} }}
      setModalState={vi.fn()}
    />);
    fireEvent.click(screen.getByText('Repair'));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
