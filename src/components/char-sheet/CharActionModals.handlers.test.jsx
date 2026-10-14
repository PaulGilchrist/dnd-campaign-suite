// @maintained-by-ai
// Handler callback tests for CharActionModals — modal button → handler wiring.
//
// Scope — unique behaviors tested here:
// - Constellation Selection modal confirm (starryForm + twinkling): routes the
//   modal's data + selected option to handleConstellationSelect. The handler's
//   internal implementation is covered in useModalHandlers-features.test.js.
// - WeaponKindMasteryModal close: routes to the dedicated handleWeaponKindMasteryClose
//   rather than calling setModalState directly.
//
// Covered elsewhere — do not duplicate here:
// - AttackRiderManeuverPrompt skip/use → CharActionModals.secondary-targets.test.jsx
// - Weapon Mastery Choice confirm → CharActionModals.handler-callbacks.test.jsx
// - Weapon Mastery Choice close → CharActionModals.modal-closes.test.jsx
// - Modal rendering → CharActionModals.rendering.test.jsx
// - Close behavior for other modals → CharActionModals.modal-closes*.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocked modules ──
// Only the modals actually rendered by these tests plus the runtime-store
// service the component tree touches on mount. Each test file must declare
// its own vi.mock() calls for proper Vitest hoisting.

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  const store = new Map();
  return {
    getStore: vi.fn(() => store),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((character, key, campaign) => store.get(`${character}:${key}:${campaign}`) ?? null),
    setRuntimeValue: vi.fn(async (character, key, value, campaign) => {
      store.set(`${character}:${key}:${campaign}`, value);
      return value;
    }),
  };
});
vi.mock('./modals/WeaponKindMasteryModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="weapon-kind-mastery-modal"><button data-testid="weapon-kind-mastery-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/ConstellationSelectionModal.jsx', () => ({
  default: function TestModal({ onConfirm, onClose }) {
    return (
      <div data-testid="constellation-selection-modal">
        <button data-testid="const-confirm" onClick={() => onConfirm('test-option')}>Confirm</button>
        <button data-testid="const-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));

// ── Tests ──

describe('CharActionModals handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe.each([
    ['starryFormConstellationModal'],
    ['twinklingConstellationModal'],
  ])('%s confirm handler', (modalProp) => {
    it(`routes modal data and selected option to handleConstellationSelect when confirming ${modalProp}`, () => {
      const handleConstellationSelect = vi.fn();
      const modalData = { action: {}, playerStats: {}, campaignName: 'test' };
      render(<CharActionModals
        {...createBaseProps({ handleConstellationSelect })}
        modalState={{ [modalProp]: modalData }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('const-confirm'));
      expect(handleConstellationSelect).toHaveBeenCalledWith(modalData, 'test-option');
    });
  });

  it('routes WeaponKindMasteryModal close to handleWeaponKindMasteryClose instead of setModalState', () => {
    const handleWeaponKindMasteryClose = vi.fn();
    const setModalState = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleWeaponKindMasteryClose })}
      modalState={{ weaponKindMasteryModal: {} }}
      setModalState={setModalState}
    />);
    fireEvent.click(screen.getByTestId('weapon-kind-mastery-close'));
    expect(handleWeaponKindMasteryClose).toHaveBeenCalledTimes(1);
    expect(setModalState).not.toHaveBeenCalled();
  });
});
