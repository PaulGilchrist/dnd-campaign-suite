// Regression tests for CLA-188: closing the Cunning Strike rider modal in
// CharActionModals must resume the paused attack damage pipeline.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';

vi.mock('./CharActionModals.SecondaryModals.jsx', () => ({
  default: function SecondaryModalsStub() { return null; },
}));

vi.mock('./modals/shared/AttackRiderModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="attack-rider-modal"><button data-testid="attack-rider-close" onClick={onClose}>Done</button></div>;
  },
}));

vi.mock('./modals/divine/HealingPoolModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/shared/HandOfHealingModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/FontOfMagicModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/ResourcePoolModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/WildCompanionModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/shared/SetConditionModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/BlindnessDeafnessModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/EyebiteEffectModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/OpenHandTechniqueModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/ShieldBashChoiceModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/QuiveringPalmModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/WeaponMasteryModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/WeaponKindMasteryModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/divine/BastionOfLawModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/shared/CombatStanceModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/TeleportModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/RevelationInFleshModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/MoonlightStepResourceModal.jsx', () => ({ default: () => null }));

vi.mock('../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js', () => ({
  handleApply: vi.fn(),
}));
vi.mock('../../services/automation/handlers/combat/elementalEpitomeHandler.js', () => ({
  applyResistanceChoice: vi.fn(),
}));
vi.mock('../../services/automation/handlers/combat/destructiveStrideHandler.js', () => ({
  applyDamageTypeChoice: vi.fn(),
  applyTargetChoice: vi.fn(),
  skipTargetChoice: vi.fn(),
}));
vi.mock('../../services/rules/spells/postCastHealService.js', () => ({
  applyStarryChaliceHeal: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
  setSkipFlag: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

function makeProps(overrides = {}) {
  const modalState = {};
  return {
    playerStats: { name: 'AasimarTest' },
    campaignName: 'test-campaign',
    characters: [],
    modalState,
    spellModalState: {},
    setModalState: vi.fn((updates) => Object.assign(modalState, updates)),
    setSpellModalState: vi.fn(),
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleAttackRiderManeuverUse: vi.fn(),
    handleAttackRiderManeuverSkip: vi.fn(),
    handleAttackRiderOptionSelect: vi.fn(),
    pendingDamage: null,
    resumeAttackPipeline: vi.fn(() => Promise.resolve()),
    buildCtx: vi.fn(() => Promise.resolve({})),
    buildCtxSync: vi.fn(() => Promise.resolve({})),
    rollDamage: vi.fn(),
    setPopupHtml: vi.fn(),
    mapName: null,
    ...overrides,
  };
}

describe('CharActionModals — Cunning Strike rider close resumes pipeline (CLA-188)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  ['Cunning Strike', 'Improved Cunning Strike', 'Devious Strikes'].forEach((featureName) => {
    it(`resumes the pipeline when the ${featureName} rider modal closes`, async () => {
      const resumeAttackPipeline = vi.fn(() => Promise.resolve());
      const props = makeProps({ resumeAttackPipeline });
      props.modalState.attackRiderModal = {
        action: { name: featureName },
        playerStats: props.playerStats,
        campaignName: 'test-campaign',
        targetName: 'Animated Rug of Smothering 1',
      };
      render(<CharActionModals {...props} />);
      fireEvent.click(screen.getByTestId('attack-rider-close'));
      expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
      expect(resumeAttackPipeline).toHaveBeenCalledTimes(1);
    });
  });

  it('does not resume the pipeline for non-pausing rider modals', () => {
    const resumeAttackPipeline = vi.fn();
    const props = makeProps({ resumeAttackPipeline });
    props.modalState.attackRiderModal = {
      // 'Hamstring' is opened via the manual attack_rider row flow, not by a
      // featureRiders pipeline pause — closing it must not touch the pipeline.
      // Stalker's Flurry and Cunning Strike DO pause featureRiders and resume
      // on close (CLA-326 / CLA-188).
      action: { name: 'Hamstring' },
      playerStats: props.playerStats,
      campaignName: 'test-campaign',
      targetName: 'Goblin',
    };
    render(<CharActionModals {...props} />);
    fireEvent.click(screen.getByTestId('attack-rider-close'));
    expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
    expect(resumeAttackPipeline).not.toHaveBeenCalled();
  });

  it('does not call rollDamage directly on rider modal close (pipeline owns damage)', () => {
    const props = makeProps();
    props.modalState.attackRiderModal = {
      action: { name: 'Improved Cunning Strike' },
      playerStats: props.playerStats,
      campaignName: 'test-campaign',
      targetName: 'Animated Rug of Smothering 1',
    };
    render(<CharActionModals {...props} />);
    fireEvent.click(screen.getByTestId('attack-rider-close'));
    expect(props.rollDamage).not.toHaveBeenCalled();
  });
});
