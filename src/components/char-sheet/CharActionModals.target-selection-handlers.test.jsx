// @maintained-by-ai
// Handler wiring tests for target-selection modals routed through CharActionModals.
// Each test pins one modalKey → mounted modal → handler-prop line: clicking the
// modal's confirm invokes the feature handler with the selection flowing through
// from the modalState payload; clicking skip closes the modal (or delegates to the
// handler with null) without re-invoking confirm.
//
// Owned elsewhere (NOT duplicated here):
//   - Modal rendering / props mapping: CharActionModals.rendering.test.jsx
//   - Mass-healing modal skips (incl. naturesSanctuaryCreaturesModal skip):
//     CharActionModals.mass-healing-skips.test.jsx
//   - Celestial Resilience skip → handleCelestialResilienceSkip:
//     CharActionModals.modal-closes-2.test.jsx
//   - Oceanic Gift modal internals (variant toggle, dispatch):
//     modals/SecondaryTargetModals.oceanicVariant.test.jsx
//   - Multi-target confirmations (Bulwark, Radiance, Mantle) and single-target
//     SecondaryTargetModal skip-with-null pattern:
//     CharActionModals.secondary-targets.test.jsx
//   - Handler internals: useCharActionsModalHandlers.*.test.js
//
// Canonical ownership (siblings dropped their copies):
//   - vitalityOfTheTreeTarget skip (dropped by modal-closes-3.test.jsx)
//   - naturesSanctuaryCreaturesModal confirm click (dropped by helper-modals.test.jsx)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks — minimal stubs that echo their target props back through the callback ──

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
vi.mock('./modals/CelestialResilienceModal.jsx', () => ({
  default: function TestModal({ creatureTargets, onConfirm }) {
    return (
      <button data-testid="celestial-confirm" onClick={() => onConfirm(creatureTargets.map(t => t.name))}>Confirm</button>
    );
  },
}));
vi.mock('./modals/VitalityOfTheTreeModal.jsx', () => ({
  default: function TestModal({ creatureTargets, onConfirm, onSkip }) {
    return (
      <div data-testid="vitality-of-the-tree-modal">
        <button data-testid="vitality-confirm" onClick={() => onConfirm(creatureTargets.map(t => t.name))}>Confirm</button>
        <button data-testid="vitality-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/InspiringSmiteModal.jsx', () => ({
  default: function TestModal({ creatureTargets, onConfirm, onSkip }) {
    return (
      <div data-testid="inspiring-smite-modal">
        <button data-testid="inspiring-smite-confirm" onClick={() => onConfirm(creatureTargets.map(t => t.name))}>Confirm</button>
        <button data-testid="inspiring-smite-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/ZealousPresenceModal.jsx', () => ({
  // NOTE: routed as targets={modalState.creatureTargets} in SecondaryModals.jsx
  default: function TestModal({ targets, onConfirm, onSkip }) {
    return (
      <div data-testid="zealous-presence-modal">
        <button data-testid="zealous-confirm" onClick={() => onConfirm(targets.map(t => t.name))}>Confirm</button>
        <button data-testid="zealous-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./popups/FlurryOfBlowsTargetPopup.jsx', () => ({
  default: function TestModal({ currentTargetName, onConfirm, onSkip }) {
    return (
      <div data-testid="flurry-of-blows-popup">
        <button data-testid="flurry-confirm" onClick={() => onConfirm([currentTargetName])}>Confirm</button>
        <button data-testid="flurry-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ targets, onConfirm }) {
    return (
      <button data-testid="creature-confirm" onClick={() => onConfirm(targets.map(t => t.name))}>Confirm</button>
    );
  },
}));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestModal({ targets, onTargetSelected, onSkip }) {
    return (
      <div data-testid="secondary-target-modal">
        {targets.map((target) => (
          <label key={target.name} data-testid={`secondary-target-${target.name}`} onClick={() => onTargetSelected(target.name)}>
            {target.name}
          </label>
        ))}
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

  // Self-contained confirm+skip modals: confirm routes to the feature handler with
  // the selection; skip clears exactly its own modalState key and never confirms.
  const confirmSkipCases = [
    {
      name: 'Vitality of the Tree',
      modalKey: 'vitalityOfTheTreeTarget',
      modalData: { creatureTargets: [{ name: 'Ally1' }], tempHp: 5, maxTargets: 3 },
      handlerProp: 'handleVitalityOfTheTreeConfirm',
      confirmTestId: 'vitality-confirm',
      skipTestId: 'vitality-skip',
    },
    {
      name: 'Inspiring Smite',
      modalKey: 'inspiringSmiteModal',
      modalData: { creatureTargets: [{ name: 'Goblin' }], tempHp: 5, roll: 3 },
      handlerProp: 'handleInspiringSmiteConfirm',
      confirmTestId: 'inspiring-smite-confirm',
      skipTestId: 'inspiring-smite-skip',
    },
    {
      name: 'Zealous Presence',
      modalKey: 'zealousPresenceModal',
      modalData: { creatureTargets: [{ name: 'Ally1' }], maxTargets: 5 },
      handlerProp: 'handleZealousPresenceConfirm',
      confirmTestId: 'zealous-confirm',
      skipTestId: 'zealous-skip',
    },
    {
      name: 'Flurry of Blows',
      modalKey: 'flurryOfBlowsModal',
      modalData: { numAttacks: 3, creatureTargets: [{ name: 'Goblin' }], currentTargetName: 'Goblin' },
      handlerProp: 'handleFlurryOfBlowsConfirm',
      confirmTestId: 'flurry-confirm',
      skipTestId: 'flurry-skip',
    },
  ];

  it.each(confirmSkipCases)(
    '$name: confirm invokes $handlerProp with the selection; skip closes without confirming',
    ({ modalKey, modalData, handlerProp, confirmTestId, skipTestId }) => {
      const handler = vi.fn();
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ [handlerProp]: handler })}
        modalState={{ [modalKey]: modalData }}
        setModalState={setModalState}
      />);

      fireEvent.click(screen.getByTestId(confirmTestId));
      const selectedNames = (modalData.creatureTargets || []).map(t => t.name);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(selectedNames);

      fireEvent.click(screen.getByTestId(skipTestId));
      expect(setModalState).toHaveBeenCalledWith({ [modalKey]: null });
      expect(handler).toHaveBeenCalledTimes(1);
    },
  );

  it('Celestial Resilience: confirm invokes handleCelestialResilienceConfirm with the selection once', () => {
    // Skip lane (handleCelestialResilienceSkip) owned by modal-closes-2.test.jsx.
    const handler = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleCelestialResilienceConfirm: handler })}
      modalState={{ celestialResilienceModal: { creatureTargets: [{ name: 'Ally1' }], allyTempHp: 5, selfTempHp: 10, maxTargets: 3 } }}
      setModalState={vi.fn()}
    />);
    fireEvent.click(screen.getByTestId('celestial-confirm'));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(['Ally1']);
  });

  it("Natures Sanctuary: confirm invokes handleNaturesSanctuaryConfirm with the selected creature names", () => {
    // Skip lane owned by mass-healing-skips.test.jsx.
    const handler = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleNaturesSanctuaryConfirm: handler })}
      modalState={{ naturesSanctuaryCreaturesModal: { creatureTargets: [{ name: 'Goblin' }], defaultSelected: [] } }}
      setModalState={vi.fn()}
    />);
    fireEvent.click(screen.getByTestId('creature-confirm'));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(['Goblin']);
  });

  it('Oceanic Gift: target click invokes handleOceanicGiftConfirm(name, doubleEmanation); skip delegates null', () => {
    // Modal internals (variant toggle, titles) owned by
    // modals/SecondaryTargetModals.oceanicVariant.test.jsx — this pins the
    // CharActionModals-level routing only.
    const handler = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleOceanicGiftConfirm: handler })}
      modalState={{ oceanicGiftTargetModal: { creatureTargets: [{ name: 'Ally1' }], doubleEmanation: false } }}
      setModalState={vi.fn()}
    />);
    fireEvent.click(screen.getByTestId('secondary-target-Ally1'));
    expect(handler).toHaveBeenCalledWith('Ally1', false);

    fireEvent.click(screen.getByTestId('secondary-skip'));
    expect(handler).toHaveBeenNthCalledWith(2, null);
  });
});
