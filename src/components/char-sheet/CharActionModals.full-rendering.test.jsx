// @maintained-by-ai
// CharActionModals integration-rendering gaps covered nowhere else:
//   - inline Clockwork Cavalcade repair overlay (InlineChoiceModals): the
//     repair-confirm click lives in inline-modals.test.jsx; the title and
//     Cancel-close behavior are asserted only here.
//   - Clockwork Cavalcade dispel title/label wiring through HealingModals →
//     CreatureSelectionModal (confirm/skip wiring is covered by
//     clockwork-handlers.test.jsx and mass-healing-skips.test.jsx).
//
// Removed as covered elsewhere:
//   - openHandFromFlurry rendering → CharActionModals.modal-closes.test.jsx
//     (close/confirm wiring) — the old render assertion only checked a
//     mocked testid, proving nothing about target/currentIndex props.
//   - oceanicGiftTargetModal title variants (doubleEmanation true/false) →
//     modals/SecondaryTargetModals.oceanicVariant.test.jsx (stronger, with
//     toggle behavior); CharActionModals pass-through mount is covered by
//     CharActionModals.target-selection-handlers.test.jsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks (only components mounted by these tests + infrastructure) ──

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ title, confirmLabel }) {
    return (
      <div data-testid="creature-selection-modal">
        <div data-testid="creature-title">{title}</div>
        <button data-testid="creature-confirm">{confirmLabel}</button>
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

// ── Tests ──

describe('CharActionModals — Clockwork Cavalcade sub-modal rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('shows the inline repair overlay with its title and closes it via Cancel', () => {
    const setModalState = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleClockworkCavalcadeRepairConfirm: vi.fn() })}
      modalState={{ clockworkCavalcadeRepairModal: {} }}
      setModalState={setModalState}
    />);
    expect(screen.getByText('Clockwork Cavalcade: Repair')).toBeInTheDocument();
    expect(screen.getByText('Repair')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(setModalState).toHaveBeenCalledWith({ clockworkCavalcadeRepairModal: null });
  });

  it('mounts the dispel creature selection with Cavalcade-specific title and confirm label', () => {
    render(<CharActionModals
      {...createBaseProps()}
      modalState={{ clockworkCavalcadeDispelModal: { creatureTargets: [{ name: 'Goblin' }] } }}
      setModalState={vi.fn()}
    />);
    expect(screen.getByTestId('creature-title')).toHaveTextContent('Clockwork Cavalcade: Dispel');
    expect(screen.getByTestId('creature-confirm')).toHaveTextContent('Dispel');
  });
});
