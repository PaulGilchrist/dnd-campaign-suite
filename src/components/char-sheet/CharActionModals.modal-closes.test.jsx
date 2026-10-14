// @maintained-by-ai
// Tests for CharActionModals.jsx close/confirm wiring:
// - attackRiderModal generic close (clears modal, refreshes target effects,
//   does NOT resume the attack pipeline for non-resuming actions)
// - openHandFromFlurry renders the current flurry target and its close/confirm
//   handlers (skip vs confirm + refresh events)
//
// Covered elsewhere (NOT duplicated here):
// - shieldBashModal, quiveringPalmModal close → modal-closes-2.test.jsx
// - openHandTechniqueModal close → CharActionModals.handler-callbacks.test.jsx
// - Stalker's Flurry / Charger / Cunning Strike resume-on-close → *-resume.test.jsx
// - useCharActionModals flurry handler logic → useModalHandlers-flurry.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Minimal mocks — only the modals actually rendered by these tests ──

vi.mock('./modals/shared/AttackRiderModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return (
      <div data-testid="attack-rider-modal">
        <button data-testid="attack-rider-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));
vi.mock('./modals/OpenHandTechniqueModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm, targetName, saveDc }) {
    return (
      <div data-testid="open-hand-technique-modal">
        <span data-testid="open-hand-target">{targetName}</span>
        <span data-testid="open-hand-save-dc">{saveDc}</span>
        <button data-testid="open-hand-close" onClick={onClose}>Close</button>
        <button data-testid="open-hand-confirm" onClick={() => onConfirm('grappled')}>Grapple</button>
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
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Tests ──

describe('CharActionModals — modal close handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes attackRiderModal, refreshes target effects, and does not resume the pipeline for a plain action', () => {
    const setModalState = vi.fn();
    const resumeAttackPipeline = vi.fn();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(
      <CharActionModals
        {...createBaseProps({ resumeAttackPipeline })}
        modalState={{ attackRiderModal: { action: { name: 'Test Attack' } } }}
        setModalState={setModalState}
      />
    );
    fireEvent.click(screen.getByTestId('attack-rider-close'));
    expect(setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'target-effects-updated' }));
    // Only resume-capable riders (Stalker's Flurry, Charger, Cunning Strike)
    // resume on close — a plain action must leave the pipeline paused state alone.
    expect(resumeAttackPipeline).not.toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });

  it('openHandFromFlurry shows the current target; close skips, confirm confirms — both refresh effects and combat summary', () => {
    const handleSkip = vi.fn();
    const handleConfirm = vi.fn();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(
      <CharActionModals
        {...createBaseProps({
          handleOpenHandFromFlurrySkip: handleSkip,
          handleOpenHandFromFlurryConfirm: handleConfirm,
        })}
        modalState={{
          openHandFromFlurry: {
            targets: [
              { action: {}, playerStats: {}, campaignName: 'test-campaign', targetName: 'Decoy', saveDc: 11 },
              { action: {}, playerStats: {}, campaignName: 'test-campaign', targetName: 'Goblin', saveDc: 15 },
            ],
            currentIndex: 1,
            saveDc: 15,
          },
        }}
        setModalState={vi.fn()}
      />
    );

    // Modal shows the target at currentIndex, not the first target.
    expect(screen.getByTestId('open-hand-target')).toHaveTextContent('Goblin');
    expect(screen.getByTestId('open-hand-save-dc')).toHaveTextContent('15');

    // Confirm passes the chosen technique option through to the handler.
    fireEvent.click(screen.getByTestId('open-hand-confirm'));
    expect(handleConfirm).toHaveBeenCalledWith({ optionName: 'grappled' });
    expect(handleSkip).not.toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'target-effects-updated' }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));

    // Close declines via the skip handler.
    dispatchSpy.mockClear();
    fireEvent.click(screen.getByTestId('open-hand-close'));
    expect(handleSkip).toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'target-effects-updated' }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    dispatchSpy.mockRestore();
  });
});
