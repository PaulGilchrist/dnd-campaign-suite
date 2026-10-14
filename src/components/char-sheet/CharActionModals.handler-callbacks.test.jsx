// @maintained-by-ai
// Handler-callback contract tests for CharActionModals.jsx:
// - handleStarryChaliceConfirm: full contract (clear, invoke, popup) on target select
// - SecondaryModals DivineInterventionModal wiring: cast → handler prop, close → clear
// - openHandTechniqueModal close: clear + target-effects/combat-summary refresh events
//
// Covered elsewhere (do not duplicate here):
//   - starry chalice skip clears modal: CharActionModals.helper-modals.test.jsx
//   - openHandFromFlurry close/confirm: CharActionModals.modal-closes.test.jsx
//   - clockwork routing + sub-modal confirm wiring: CharActionModals.clockwork-handlers.test.jsx
//   - epitome/destructiveStride/inline modal paths: async-confirm-handlers,
//     choice-handlers, inline-modals, target-selection-handlers, internal-handlers

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks (only modals actually mounted by these tests + infrastructure) ──

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestModal({ title, targets, onTargetSelected, onSkip, confirmLabel }) {
    return (
      <div data-testid="secondary-target-modal">
        <div data-testid="secondary-title">{title}</div>
        {targets.map((target, i) => {
          const key = target.value || target.name;
          return (
            <label key={i} data-testid={`secondary-target-${key}`} onClick={() => onTargetSelected(key)}>
              {target.label || target.name}
            </label>
          );
        })}
        <button data-testid="secondary-confirm" onClick={() => onTargetSelected(targets[0]?.value || targets[0]?.name)}>{confirmLabel}</button>
        <button data-testid="secondary-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/divine/DivineInterventionModal.jsx', () => ({
  default: function TestModal({ onClose, onSelect }) {
    return (
      <div data-testid="divine-intervention-modal">
        <button data-testid="divine-intervention-close" onClick={onClose}>Close</button>
        {onSelect && <button data-testid="divine-intervention-cast" onClick={() => onSelect('cast')}>Cast</button>}
      </div>
    );
  },
}));
vi.mock('./modals/OpenHandTechniqueModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return (
      <div data-testid="open-hand-technique-modal">
        <button data-testid="open-hand-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/rules/spells/postCastHealService.js', () => ({
  applyStarryChaliceHeal: vi.fn().mockResolvedValue(null),
}));

// ── Tests ──

describe('CharActionModals — handler callback tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Starry Chalice confirm handler (full contract) ──

  it('Starry Chalice: selecting a target clears the modal, heals, and shows the heal popup', async () => {
    const setModalState = vi.fn();
    const setPopupHtml = vi.fn();
    const { applyStarryChaliceHeal } = await import('../../services/rules/spells/postCastHealService.js');
    applyStarryChaliceHeal.mockResolvedValue({ targetName: 'Ally1', actualHeal: 5 });

    render(<CharActionModals
      {...createBaseProps({ setModalState, setPopupHtml, campaignName: 'test-campaign' })}
      modalState={{ starryChaliceHealModal: { targetNames: ['Ally1'], amount: 10 } }}
      campaignName="test-campaign"
    />);

    fireEvent.click(screen.getByTestId('secondary-target-Ally1'));

    await waitFor(() => {
      // Modal is dismissed immediately, heal is applied to the chosen target,
      // and the popup reports the chosen amount with the actual healed total.
      expect(setModalState).toHaveBeenCalledWith({ starryChaliceHealModal: null });
      expect(applyStarryChaliceHeal).toHaveBeenCalledWith('Ally1', 'test-campaign');
      expect(setPopupHtml).toHaveBeenCalledWith({
        type: 'heal',
        name: 'Starry Form: Chalice',
        formula: '10 HP',
        rolls: [],
        total: 10,
        targetName: 'Ally1',
        finalHeal: 5,
      });
    });
  });

  // ── Divine Intervention modal wiring (SecondaryModals) ──

  it('Divine Intervention: cast routes to handleDivineInterventionCast, close clears both state keys', () => {
    const handleDivineInterventionCast = vi.fn();
    const setModalState = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleDivineInterventionCast })}
      modalState={{ divineInterventionModal: { action: {}, playerStats: {}, campaignName: 'test' } }}
      setModalState={setModalState}
    />);

    fireEvent.click(screen.getByTestId('divine-intervention-cast'));
    expect(handleDivineInterventionCast).toHaveBeenCalledWith('cast');

    fireEvent.click(screen.getByTestId('divine-intervention-close'));
    expect(setModalState).toHaveBeenCalledWith({ divineInterventionModal: null, divineInterventionAction: null });
  });

  // ── Open Hand Technique modal close handler ──
  // The OpenHandTechniqueModal is rendered with only an onClose prop;
  // confirming a maneuver is internal to the modal component.

  it('Open Hand Technique: closing clears the modal and refreshes target effects and combat summary', () => {
    const setModalState = vi.fn();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<CharActionModals
      {...createBaseProps({ setModalState })}
      modalState={{ openHandTechniqueModal: { action: {}, playerStats: {}, campaignName: 'test' } }}
      setModalState={setModalState}
    />);

    fireEvent.click(screen.getByTestId('open-hand-close'));

    expect(setModalState).toHaveBeenCalledWith({ openHandTechniqueModal: null });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'target-effects-updated' }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));

    dispatchSpy.mockRestore();
  });
});
