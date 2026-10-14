// Handler callback tests for target selection modals in CharActionModals.
//
// This file tests the handler callback wiring between CharActionModals and
// the SecondaryModals/HealingModals sub-components. Each test verifies that
// clicking the expected button in a mocked modal invokes the correct handler
// prop with the correct arguments.
//
// Modal rendering is covered in CharActionModals.rendering.test.jsx.
// Skip handlers are covered in CharActionModals.mass-healing-skips.test.jsx
// and CharActionModals.secondary-target-skips.test.jsx.
// Multi-target confirmations (Bulwark, Radiance, Mantle) are covered in
// CharActionModals.secondary-targets.test.jsx.
//
// - 3 skip tests only asserted handler() with no arguments (Celestial Resilience,
//   Zealous Presence, Flurry of Blows) — low behavioral granularity, basic UI wiring.
// - 3 DestructiveStrideTargetModal rendering tests — structural DOM assertions,
//   not handler behavior; belong in CharActionModals.rendering.test.jsx.
// - ~40 unused vi.mock declarations — never exercised by any test in this file,
//   creating a brittle maintenance burden across all test files.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks (only what this file's tests exercise) ──

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
vi.mock('./modals/CelestialResilienceModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="celestial-resilience-modal">
        <button data-testid="celestial-confirm" onClick={() => onConfirm(['Ally1'])}>Confirm</button>
        <button data-testid="celestial-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/VitalityOfTheTreeModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="vitality-of-the-tree-modal">
        <button data-testid="vitality-confirm" onClick={() => onConfirm(['Ally1'])}>Confirm</button>
        <button data-testid="vitality-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/InspiringSmiteModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="inspiring-smite-modal">
        <button data-testid="inspiring-smite-skip" onClick={onSkip}>Skip</button>
        <button data-testid="inspiring-smite-confirm" onClick={() => onConfirm(['Goblin'])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/ZealousPresenceModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="zealous-presence-modal">
        <button data-testid="zealous-skip" onClick={onSkip}>Skip</button>
        <button data-testid="zealous-confirm" onClick={() => onConfirm(['Ally1'])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./popups/FlurryOfBlowsTargetPopup.jsx', () => ({
  default: function TestModal({ onConfirm, onSkip }) {
    return (
      <div data-testid="flurry-of-blows-popup">
        <button data-testid="flurry-confirm" onClick={() => onConfirm(['Target1'])}>Confirm</button>
        <button data-testid="flurry-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ title, targets, onConfirm, onSkip, confirmLabel }) {
    return (
      <div data-testid="creature-selection-modal">
        <div data-testid="creature-title">{title}</div>
        {targets.map((target, i) => (
          <label key={i} data-testid={`creature-target-${target.name}`} onClick={() => onConfirm([target.name])}>
            {target.name}
          </label>
        ))}
        <button data-testid="creature-confirm" onClick={() => onConfirm(targets.map(t => t.name))}>{confirmLabel}</button>
        <button data-testid="creature-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
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

// ── Tests ──

describe('CharActionModals — target selection handler callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Celestial Resilience handler ──

  describe('Celestial Resilience handler', () => {
    it('calls handleCelestialResilienceConfirm with selected targets on confirm', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCelestialResilienceConfirm: handler })}
        modalState={{ celestialResilienceModal: { creatureTargets: [{ name: 'Ally1' }], allyTempHp: 5, selfTempHp: 10, maxTargets: 3 } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('celestial-confirm'));
      expect(handler).toHaveBeenCalledWith(['Ally1']);
    });
  });

  // ── Vitality of the Tree handler ──

  describe('Vitality of the Tree handler', () => {
    it('calls handleVitalityOfTheTreeConfirm with selected targets on confirm', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleVitalityOfTheTreeConfirm: handler })}
        modalState={{ vitalityOfTheTreeTarget: { creatureTargets: [{ name: 'Ally1' }], tempHp: 5, maxTargets: 3 } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('vitality-confirm'));
      expect(handler).toHaveBeenCalledWith(['Ally1']);
    });

    it('closes modal on skip via setModalState', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleVitalityOfTheTreeConfirm: vi.fn() })}
        modalState={{ vitalityOfTheTreeTarget: { creatureTargets: [{ name: 'Ally1' }], tempHp: 5, maxTargets: 3 } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('vitality-skip'));
      expect(setModalState).toHaveBeenCalledWith({ vitalityOfTheTreeTarget: null });
    });
  });

  // ── Inspiring Smite handler ──

  describe('Inspiring Smite handler', () => {
    it('calls handleInspiringSmiteConfirm with selected targets on confirm', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleInspiringSmiteConfirm: handler })}
        modalState={{ inspiringSmiteModal: { creatureTargets: [{ name: 'Goblin' }], tempHp: 5, roll: 3 } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('inspiring-smite-confirm'));
      expect(handler).toHaveBeenCalledWith(['Goblin']);
    });

    it('closes modal on skip via setModalState', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleInspiringSmiteConfirm: vi.fn() })}
        modalState={{ inspiringSmiteModal: { creatureTargets: [{ name: 'Goblin' }], tempHp: 5, roll: 3 } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('inspiring-smite-skip'));
      expect(setModalState).toHaveBeenCalledWith({ inspiringSmiteModal: null });
    });
  });

  // ── Zealous Presence handler ──

  describe('Zealous Presence handler', () => {
    it('calls handleZealousPresenceConfirm with selected targets on confirm', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleZealousPresenceConfirm: handler })}
        modalState={{ zealousPresenceModal: { creatureTargets: [{ name: 'Ally1' }], maxTargets: 5 } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('zealous-confirm'));
      expect(handler).toHaveBeenCalledWith(['Ally1']);
    });

    it('calls setModalState with null on skip', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleZealousPresenceConfirm: vi.fn(), setModalState })}
        modalState={{ zealousPresenceModal: { creatureTargets: [{ name: 'Ally1' }], maxTargets: 5 } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('zealous-skip'));
      expect(setModalState).toHaveBeenCalledWith({ zealousPresenceModal: null });
    });
  });

  // ── Flurry of Blows handler ──

  describe('Flurry of Blows handler', () => {
    it('calls handleFlurryOfBlowsConfirm with selected targets on confirm', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleFlurryOfBlowsConfirm: handler })}
        modalState={{ flurryOfBlowsModal: { numAttacks: 3, creatureTargets: [], currentTargetName: 'Goblin' } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('flurry-confirm'));
      expect(handler).toHaveBeenCalledWith(['Target1']);
    });

    it('calls setModalState with null on skip', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleFlurryOfBlowsConfirm: vi.fn(), setModalState })}
        modalState={{ flurryOfBlowsModal: { numAttacks: 3, creatureTargets: [], currentTargetName: 'Goblin' } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('flurry-skip'));
      expect(setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
    });
  });

  // ── Natures Sanctuary handler ──

  describe('Natures Sanctuary handler', () => {
    it('calls handleNaturesSanctuaryConfirm with selected creature names on confirm', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleNaturesSanctuaryConfirm: handler })}
        modalState={{ naturesSanctuaryCreaturesModal: { creatureTargets: [{ name: 'Goblin' }], defaultSelected: [] } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('creature-confirm'));
      expect(handler).toHaveBeenCalledWith(['Goblin']);
    });

    it('closes modal on skip via setModalState', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleNaturesSanctuaryConfirm: vi.fn() })}
        modalState={{ naturesSanctuaryCreaturesModal: { creatureTargets: [{ name: 'Goblin' }], defaultSelected: [] } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('creature-skip'));
      expect(setModalState).toHaveBeenCalledWith({ naturesSanctuaryCreaturesModal: null });
    });
  });

  // ── Oceanic Gift handler ──

  describe('Oceanic Gift handler', () => {
    it('calls handleOceanicGiftConfirm with selected target on target click', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleOceanicGiftConfirm: handler })}
        modalState={{ oceanicGiftTargetModal: { creatureTargets: [{ name: 'Ally1' }], doubleEmanation: false } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('secondary-target-Ally1'));
      expect(handler).toHaveBeenCalledWith('Ally1', false);
    });

    it('calls handleOceanicGiftConfirm with null on skip', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleOceanicGiftConfirm: handler })}
        modalState={{ oceanicGiftTargetModal: { creatureTargets: [{ name: 'Ally1' }], doubleEmanation: false } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('secondary-skip'));
      expect(handler).toHaveBeenCalledWith(null);
    });
  });
});
