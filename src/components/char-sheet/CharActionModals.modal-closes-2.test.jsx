// @maintained-by-ai
// Tests for modal close handlers in CharActionModals.jsx:
// - shieldBashModal / quiveringPalmModal close (setModalState null + dispatch refresh events)
// - CelestialResilienceModal onSkip wiring
//
// Already covered elsewhere (NOT duplicated):
// - attackRiderModal, openHandFromFlurry → modal-closes.test.jsx
// - other closes → modal-closes-3.test.jsx, inline-choice-closes.test.jsx
// - shieldBash pipeline resume → shieldBash-resume.test.jsx
// - celestialResilienceModal confirm → target-selection-handlers.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Minimal mocks — only the modals actually rendered by these tests ──

vi.mock('./modals/ShieldBashChoiceModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="shield-bash-modal"><button data-testid="shield-bash-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/QuiveringPalmModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="quivering-palm-modal"><button data-testid="quivering-palm-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/CelestialResilienceModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="celestial-resilience-modal">
        <button data-testid="celestial-resilience-skip" onClick={onSkip}>Skip</button>
        <button data-testid="celestial-resilience-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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

  it.each([
    ['shieldBashModal', 'shield-bash-close'],
    ['quiveringPalmModal', 'quivering-palm-close'],
  ])('closing %s clears it from modalState and dispatches refresh events', (modalKey, closeTestId) => {
    const setModalState = vi.fn();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const view = render(
      <CharActionModals
        {...createBaseProps()}
        modalState={{ [modalKey]: { action: { name: 'Test Action' } } }}
        setModalState={setModalState}
      />
    );
    fireEvent.click(screen.getByTestId(closeTestId));
    expect(setModalState).toHaveBeenCalledWith({ [modalKey]: null });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'target-effects-updated' }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    // Close is the app-wide signal that target effects/combat summary changed —
    // exactly one of each, so downstream listeners don't double-refresh.
    const refreshes = dispatchSpy.mock.calls
      .map(([event]) => event.type)
      .filter(type => type === 'target-effects-updated' || type === 'combat-summary-updated');
    expect(refreshes).toHaveLength(2);
    dispatchSpy.mockRestore();

    // Reacting to the state update (as the real owner does) unmounts the modal.
    const modalTestId = closeTestId.replace('-close', '');
    view.rerender(
      <CharActionModals
        {...createBaseProps()}
        modalState={{ [modalKey]: null }}
        setModalState={setModalState}
      />
    );
    expect(screen.queryByTestId(modalTestId)).not.toBeInTheDocument();
  });

  describe('CelestialResilienceModal onSkip handler', () => {
    it('delegates skip to handleCelestialResilienceSkip without triggering confirm', () => {
      const handleCelestialResilienceSkip = vi.fn();
      const handleCelestialResilienceConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCelestialResilienceSkip, handleCelestialResilienceConfirm })}
        modalState={{ celestialResilienceModal: { creatureTargets: [{ name: 'Goblin' }], allyTempHp: 5, selfTempHp: 10, maxTargets: 5 } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('celestial-resilience-skip'));
      expect(handleCelestialResilienceSkip).toHaveBeenCalledTimes(1);
      expect(handleCelestialResilienceConfirm).not.toHaveBeenCalled();
    });
  });
});
