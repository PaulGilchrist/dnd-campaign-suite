// @maintained-by-ai
// CharActionModals host-wiring tests for the Reckless Attack modal.
// RecklessAttackHost (in CharActionModals.SecondaryModals.jsx) routes the
// modal's callbacks by mode and injects state the modal itself does not
// emit: riderName from modalState, and — CLA-044 — the attack object in
// brutalOnly mode (the modal emits only the choice there; dropping the
// attack swallowed the roll and left _brutalStrikeActive sticky for the
// NEXT attack).
//
// Coverage split with siblings:
// - RecklessAttackModal internals (selection UI, emit payloads per mode):
//   modals/shared/RecklessAttackModal.test.jsx
// - mode default rendering at this seam: CharActionModals.helper-modals.test.jsx
// - handler implementations (toggleBuff, latch, arming-attack roll):
//   useCharActionsAttackHandlers*.test.js
// - opening the modal from the feature chip: CharActions.recklessAttack.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// The mock mirrors the real modal's emit contract:
// full mode emits (attack, choice); brutalOnly emits (choice) only.
vi.mock('./modals/shared/RecklessAttackModal.jsx', () => ({
  default: function RecklessAttackModalMock({ attack, mode = 'full', onConfirm, onCancel }) {
    const choice = { useBrutalStrike: true, effectChoices: ['Forceful Blow'] };
    return (
      <div data-testid="reckless-attack-modal">
        <button
          data-testid="reckless-confirm"
          onClick={() => (mode === 'brutalOnly' ? onConfirm(choice) : onConfirm(attack, choice))}
        >
          Confirm
        </button>
        <button
          data-testid="reckless-cancel"
          onClick={() => (mode === 'brutalOnly' ? onCancel({ useBrutalStrike: false, effectChoices: [] }) : onCancel(attack))}
        >
          Cancel
        </button>
      </div>
    );
  },
}));

// Service mocks: keep mount effects off the network/store.
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

const attack = { name: 'Longsword' };

function makeHandlers() {
  return {
    handleRecklessAttackConfirm: vi.fn(),
    handleRecklessAttackCancel: vi.fn(),
    handleBrutalStrikeConfirm: vi.fn(),
    handleBrutalStrikeCancel: vi.fn(),
  };
}

function renderReckless(handlers, rm) {
  render(<CharActionModals
    {...createBaseProps(handlers)}
    modalState={{ recklessAttackModal: rm }}
    setModalState={vi.fn()}
  />);
}

describe('CharActionModals — Reckless Attack modal wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('full mode: confirm calls handleRecklessAttackConfirm with the attack and riderName injected into the choice', () => {
    const h = makeHandlers();
    renderReckless(h, { attack, mode: 'full', hasBrutalStrike: false, riderName: 'Improved Brutal Strike' });
    fireEvent.click(screen.getByTestId('reckless-confirm'));
    expect(h.handleRecklessAttackConfirm).toHaveBeenCalledWith(attack, {
      useBrutalStrike: true,
      effectChoices: ['Forceful Blow'],
      riderName: 'Improved Brutal Strike',
    });
    expect(h.handleBrutalStrikeConfirm).not.toHaveBeenCalled();
  });

  it('full mode: cancel calls handleRecklessAttackCancel with the attack', () => {
    const h = makeHandlers();
    renderReckless(h, { attack, mode: 'full', hasBrutalStrike: false });
    fireEvent.click(screen.getByTestId('reckless-cancel'));
    expect(h.handleRecklessAttackCancel).toHaveBeenCalledWith(attack);
    expect(h.handleBrutalStrikeCancel).not.toHaveBeenCalled();
  });

  it('CLA-044 brutalOnly mode: confirm calls handleBrutalStrikeConfirm forwarding the modal-state attack and riderName', () => {
    const h = makeHandlers();
    renderReckless(h, { attack, mode: 'brutalOnly', hasBrutalStrike: true, brutalStrikeOptions: [{ name: 'Forceful Blow' }], riderName: 'Brutal Strike' });
    fireEvent.click(screen.getByTestId('reckless-confirm'));
    // The modal emits the choice only — the host must supply attack and riderName.
    expect(h.handleBrutalStrikeConfirm).toHaveBeenCalledWith({
      useBrutalStrike: true,
      effectChoices: ['Forceful Blow'],
      riderName: 'Brutal Strike',
    }, attack);
    expect(h.handleRecklessAttackConfirm).not.toHaveBeenCalled();
  });

  it('brutalOnly mode: cancel calls handleBrutalStrikeCancel with the attack (choice args from the modal are ignored)', () => {
    const h = makeHandlers();
    renderReckless(h, { attack, mode: 'brutalOnly', hasBrutalStrike: true });
    fireEvent.click(screen.getByTestId('reckless-cancel'));
    expect(h.handleBrutalStrikeCancel).toHaveBeenCalledWith(attack);
    expect(h.handleRecklessAttackCancel).not.toHaveBeenCalled();
  });
});
