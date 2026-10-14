// Tests for modal rendering and close behavior in CharActionModals.jsx.
//
// Scope — only behaviors NOT covered elsewhere:
// - bendFateModal rendering and close
//
// Already covered in other files:
// - wildMagicSurgeModal rendering → rendering.test.jsx (parameterized, line 355)
// - wildMagicSurgeModal close → modal-closes-3.test.jsx
// - openHandFromFlurry rendering/handlers → modal-closes.test.jsx + modal-closes-2.test.jsx
// - starryForm/twinklingConstellationModal rendering → rendering.test.jsx + handlers.test.jsx
// - moonlightStepFallbackModal buttons/handlers → inline-modals.test.jsx
// - clockworkCavalcadeRepairModal → inline-modals.test.jsx + inline-choice-modals.test.jsx
//
// NOTE: vi.mock() is hoisted to the top of the file by Vitest, so all mock
// factories must be defined inline (no references to top-level variables).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Minimal mocks — only the modals actually rendered by these tests ──

vi.mock('./modals/BendFateModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return (
      <div data-testid="bend-fate-modal">
        <button data-testid="bend-fate-close" onClick={onClose}>Close</button>
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

describe('CharActionModals — modal rendering tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bendFateModal', () => {
    it('renders when modalState has a truthy bendFateModal', () => {
      render(
        <CharActionModals
          {...createBaseProps()}
          modalState={{ bendFateModal: { action: { lastAttack: { d20: 15, bonus: 5 } } } }}
          setModalState={vi.fn()}
        />
      );
      expect(screen.getByTestId('bend-fate-modal')).toBeInTheDocument();
    });

    it('clears modalState on close', () => {
      const setModalState = vi.fn();
      render(
        <CharActionModals
          {...createBaseProps({ setModalState })}
          modalState={{ bendFateModal: { action: { lastAttack: { d20: 15, bonus: 5 } } } }}
          setModalState={setModalState}
        />
      );
      fireEvent.click(screen.getByTestId('bend-fate-close'));
      expect(setModalState).toHaveBeenCalledWith({ bendFateModal: null });
    });
  });
});
