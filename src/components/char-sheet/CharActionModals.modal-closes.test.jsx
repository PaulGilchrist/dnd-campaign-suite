// Tests for modal close handlers in CharActionModals.jsx:
// - attackRiderModal close (dispatches events)
// - openHandFromFlurry close (calls handler + dispatches events)
// - openHandFromFlurry confirm (calls handler + dispatches events)
//
// Already covered elsewhere (NOT duplicated):
// - shieldBashModal, quiveringPalmModal → modal-closes-2.test.jsx

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
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="open-hand-technique-modal">
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

  describe('AttackRiderModal close handler', () => {
    it('sets modalState to null and dispatches target-effects-updated on close', () => {
      const setModalState = vi.fn();
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      render(
        <CharActionModals
          {...createBaseProps()}
          modalState={{ attackRiderModal: { action: { name: 'Test Attack' } } }}
          setModalState={setModalState}
        />
      );
      fireEvent.click(screen.getByTestId('attack-rider-close'));
      expect(setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'target-effects-updated' }));
      dispatchSpy.mockRestore();
    });
  });

  describe('openHandFromFlurry modal', () => {
    it('calls handleOpenHandFromFlurrySkip on close and dispatches events', () => {
      const handler = vi.fn();
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      render(
        <CharActionModals
          {...createBaseProps({ handleOpenHandFromFlurrySkip: handler })}
          modalState={{
            openHandFromFlurry: {
              targets: [{ action: {}, playerStats: {}, campaignName: 'test-campaign', targetName: 'Goblin' }],
              currentIndex: 0,
              saveDc: 15,
            },
          }}
          setModalState={vi.fn()}
        />
      );
      fireEvent.click(screen.getByTestId('open-hand-close'));
      expect(handler).toHaveBeenCalled();
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'target-effects-updated' }));
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
      dispatchSpy.mockRestore();
    });

    it('calls handleOpenHandFromFlurryConfirm with optionName and dispatches events on confirm', () => {
      const handler = vi.fn();
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      render(
        <CharActionModals
          {...createBaseProps({ handleOpenHandFromFlurryConfirm: handler })}
          modalState={{
            openHandFromFlurry: {
              targets: [{ action: {}, playerStats: {}, campaignName: 'test-campaign', targetName: 'Goblin' }],
              currentIndex: 0,
              saveDc: 15,
            },
          }}
          setModalState={vi.fn()}
        />
      );
      fireEvent.click(screen.getByTestId('open-hand-confirm'));
      expect(handler).toHaveBeenCalledWith({ optionName: 'grappled' });
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'target-effects-updated' }));
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
      dispatchSpy.mockRestore();
    });
  });
});
