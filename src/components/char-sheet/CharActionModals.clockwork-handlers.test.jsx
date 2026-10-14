// @maintained-by-ai
// Clockwork Cavalcade choice routing (handleClockworkCavalcadeChoice in CharActionModals)
// and the confirm wiring of its sub-modals to their handler props.
// Covered elsewhere:
//   - repair-confirm button click: CharActionModals.inline-modals.test.jsx
//   - skip handlers: CharActionModals.mass-healing-skips.test.jsx
//   - close behavior: CharActionModals.modal-closes.test.jsx / modal-closes-3.test.jsx
//   - confirm handler logic (delegate, clear, popup): useCharActionsModalHandlers.healing.test.js
//   - rendering: CharActionModals.rendering.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks (only modals actually mounted by these tests + infrastructure) ──

vi.mock('./modals/divine/ClockworkCavalcadeModal.jsx', () => ({
  default: function TestModal({ onChoose, onClose }) {
    return (
      <div data-testid="clockwork-cavalcade-modal">
        <button data-testid="clockwork-choose-heal" onClick={() => onChoose('heal')}>Heal</button>
        <button data-testid="clockwork-choose-dispel" onClick={() => onChoose('dispel')}>Dispel</button>
        <button data-testid="clockwork-choose-repair" onClick={() => onChoose('repair')}>Repair</button>
        <button data-testid="clockwork-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));
vi.mock('./modals/MassHealModal.jsx', () => ({
  default: function TestModal({ onConfirm, onSkip }) {
    return (
      <div data-testid="mass-heal-modal">
        <button data-testid="mass-heal-confirm" onClick={() => onConfirm(['Target1'])}>Confirm</button>
        <button data-testid="mass-heal-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ targets, onConfirm, onSkip, confirmLabel }) {
    return (
      <div data-testid="creature-selection-modal">
        {targets.map((target) => (
          <span key={target.name}>{target.name}</span>
        ))}
        <button data-testid="creature-confirm" onClick={() => onConfirm(targets.map(t => t.name))}>{confirmLabel}</button>
        <button data-testid="creature-skip" onClick={onSkip}>Skip</button>
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

describe('CharActionModals — clockwork cavalcade routing and confirm wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears the parent modal and opens the matching sub-modal for each choice', () => {
    const setModalState = vi.fn();
    const modalData = { creatureTargets: [{ name: 'Goblin' }], campaignName: 'test' };
    render(
      <CharActionModals
        {...createBaseProps()}
        modalState={{ clockworkCavalcadeModal: modalData }}
        setModalState={setModalState}
      />
    );

    fireEvent.click(screen.getByTestId('clockwork-choose-heal'));
    fireEvent.click(screen.getByTestId('clockwork-choose-dispel'));
    fireEvent.click(screen.getByTestId('clockwork-choose-repair'));

    // Each choice clears the parent first, then reopens the same payload
    // under the sub-modal key for the chosen action — nothing else.
    expect(setModalState.mock.calls).toEqual([
      [{ clockworkCavalcadeModal: null }],
      [{ clockworkCavalcadeHealModal: modalData }],
      [{ clockworkCavalcadeModal: null }],
      [{ clockworkCavalcadeDispelModal: modalData }],
      [{ clockworkCavalcadeModal: null }],
      [{ clockworkCavalcadeRepairModal: modalData }],
    ]);
  });

  it('wires heal and dispel sub-modal confirms to their handler props', () => {
    const healHandler = vi.fn();
    render(
      <CharActionModals
        {...createBaseProps({ handleClockworkCavalcadeHealConfirm: healHandler })}
        modalState={{
          clockworkCavalcadeHealModal: {
            creatureTargets: [{ name: 'Ally1' }],
            maxHeal: 100,
            campaignName: 'test',
            combatSummary: {},
          },
        }}
        setModalState={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('mass-heal-confirm'));
    expect(healHandler).toHaveBeenCalledWith(['Target1']);
    cleanup();

    const dispelHandler = vi.fn();
    render(
      <CharActionModals
        {...createBaseProps({ handleClockworkCavalcadeDispelConfirm: dispelHandler })}
        modalState={{ clockworkCavalcadeDispelModal: { creatureTargets: [{ name: 'Goblin' }] } }}
        setModalState={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('creature-confirm'));
    expect(dispelHandler).toHaveBeenCalledWith(['Goblin']);
  });
});
