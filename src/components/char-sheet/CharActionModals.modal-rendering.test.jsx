// @maintained-by-ai
// Host-wiring coverage for bendFateModal in CharActionModals → SecondaryModals.
//
// Scope — behavior NOT covered elsewhere:
// - bendFateModal mount on this host: modalState spread-through to the modal
//   and close clearing the correct key. This is the only place the
//   CharActionModals host wires bendFateModal (CharReactions.jsx hosts its
//   own copy, covered separately).
//
// A separate "renders when truthy" test was removed: a bare mocked-testid
// render assertion tests React's conditional rendering, not app behavior
// (same rationale as the 44-test prune documented in rendering.test.jsx),
// and rendering is now asserted inside the single close-wiring test below.
//
// Already covered in other files:
// - wildMagicSurgeModal close + spellModalState clear → modal-closes-3.test.jsx
//   (its parameterized rendering was pruned from rendering.test.jsx)
// - openHandFromFlurry rendering/close/confirm → modal-closes.test.jsx
// - starryForm/twinklingConstellationModal confirm routing → handlers.test.jsx
// - moonlightStepFallbackModal full contract → inline-modals.test.jsx
// - clockworkCavalcadeRepairModal Repair click → inline-modals.test.jsx;
//   title/Cancel close → full-rendering.test.jsx
//
// NOTE: vi.mock() is hoisted to the top of the file by Vitest, so all mock
// factories must be defined inline (no references to top-level variables).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Minimal mocks — only the modal actually rendered by this test + infrastructure ──

vi.mock('./modals/BendFateModal.jsx', () => ({
  default: function TestModal({ action, onClose }) {
    return (
      <div data-testid="bend-fate-modal">
        <span data-testid="bend-fate-d20">{action?.lastAttack?.d20}</span>
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

describe('CharActionModals — bendFateModal host wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts bendFateModal with its modalState payload and clears the key on close', () => {
    const setModalState = vi.fn();
    render(
      <CharActionModals
        {...createBaseProps({ setModalState })}
        modalState={{ bendFateModal: { action: { lastAttack: { d20: 15, bonus: 5 } } } }}
        setModalState={setModalState}
      />
    );
    // Mounts, with the modalState payload spread through to the modal.
    expect(screen.getByTestId('bend-fate-modal')).toBeInTheDocument();
    expect(screen.getByTestId('bend-fate-d20')).toHaveTextContent('15');

    fireEvent.click(screen.getByTestId('bend-fate-close'));
    expect(setModalState).toHaveBeenCalledWith({ bendFateModal: null });
  });
});
