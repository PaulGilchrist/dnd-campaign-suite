// @maintained-by-ai
// Close-handler coverage for CharActionModals.jsx modal keys NOT covered by
// modal-closes.test.jsx or modal-closes-2.test.jsx:
// healingPoolModal, saveAttackHealModal, elementalAffinityModal,
// fiendishResilienceModal (renders SingleResistanceSelectionModal),
// dragonCompanionModal, wildMagicSurgeModal, breathWeaponShapeModal.
//
// Every close handler here is a plain unmount: setModalState({ key: null }).
// wildMagicSurgeModal is the exception — it also clears spellModalState.
//
// Already covered elsewhere (NOT duplicated):
// - vitalityOfTheTreeTarget onSkip → CharActionModals.target-selection-handlers.test.jsx
// - mass-healing modal skips → CharActionModals.mass-healing-skips.test.jsx
// - blindnessDeafnessModal, celestialRevelationModal, fiendishLegacyModal,
//   hypnoticPatternShakeModal, clockworkCavalcadeModal → modal-closes.test.jsx
// - shieldBashModal, quiveringPalmModal, openHandFromFlurry, celestialResilienceModal → modal-closes-2.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Minimal mocks — only the modals these tests click, plus required services ──

vi.mock('./modals/divine/HealingPoolModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="healing-pool-modal"><button data-testid="healing-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/shared/SaveAttackHealModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="save-attack-heal-modal"><button data-testid="save-attack-heal-modal-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/ElementalAffinityModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="elemental-affinity-modal"><button data-testid="elemental-affinity-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/SingleResistanceSelectionModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="single-resistance-selection-modal"><button data-testid="single-resistance-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/DragonCompanionModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="dragon-companion-modal"><button data-testid="dragon-companion-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/WildMagicSurgeModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="wild-magic-surge-modal"><button data-testid="wild-magic-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/racial/BreathWeaponShapeModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="breath-weapon-shape-modal"><button data-testid="breath-close" onClick={onClose}>Close</button></div>;
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

const closeCases = [
  { key: 'healingPoolModal', testId: 'healing-close', payload: { name: 'Test Pool', pool: 10 } },
  { key: 'saveAttackHealModal', testId: 'save-attack-heal-modal-close', payload: { action: {} } },
  { key: 'elementalAffinityModal', testId: 'elemental-affinity-close', payload: { action: {} } },
  { key: 'fiendishResilienceModal', testId: 'single-resistance-close', payload: { action: {} } },
  { key: 'dragonCompanionModal', testId: 'dragon-companion-close', payload: { action: {} } },
  { key: 'breathWeaponShapeModal', testId: 'breath-close', payload: { action: {} } },
];

describe('CharActionModals — modal close handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(closeCases)(
    'clicking $key close clears only that modal key exactly once',
    ({ key, testId, payload }) => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ [key]: payload }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId(testId));
      expect(setModalState).toHaveBeenCalledTimes(1);
      expect(setModalState).toHaveBeenCalledWith({ [key]: null });
    },
  );

  it('wildMagicSurgeModal close clears both modalState and spellModalState', () => {
    const setModalState = vi.fn();
    const setSpellModalState = vi.fn();
    render(<CharActionModals
      {...createBaseProps({})}
      modalState={{ wildMagicSurgeModal: { surgeTable: [], mode: 'roll' } }}
      setModalState={setModalState}
      setSpellModalState={setSpellModalState}
    />);
    fireEvent.click(screen.getByTestId('wild-magic-close'));
    expect(setModalState).toHaveBeenCalledTimes(1);
    expect(setModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: null });
    expect(setSpellModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: null });
  });
});
