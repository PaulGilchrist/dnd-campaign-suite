// Regression tests for CLA-326: closing the Stalker's Flurry choice modal in
// CharActionModals must resume the pipeline paused at featureRiders, so the
// triggering attack's weapon damage always resolves. Cancel (no option chosen)
// sets the skip flag AND still resumes; Apply (option chosen via applyRiderOption)
// resumes without stamping the skip flag.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setSkipFlag } from '../../services/automation/common/oncePerTurn.js';

const sfAction = {
  name: "Stalker's Flurry",
  type: 'attack_rider',
  options: [
    { name: 'Sudden Strike', effect: 'sudden_strike' },
    { name: 'Mass Fear', effect: 'mass_fear' },
  ],
};

function makeProps(overrides = {}) {
  const modalState = {};
  return {
    playerStats: { name: 'FeyRanger' },
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

function armModal(props) {
  props.modalState.attackRiderModal = {
    action: sfAction,
    playerStats: props.playerStats,
    campaignName: 'test-campaign',
    targetName: 'Thug 1',
  };
}

describe('CharActionModals — Stalker\'s Flurry modal close resumes pipeline (CLA-326)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
  });

  it('resumes the attack pipeline when the modal closes without an option (Cancel)', async () => {
    const resumeAttackPipeline = vi.fn(() => Promise.resolve());
    const props = makeProps({ resumeAttackPipeline });
    armModal(props);
    render(<CharActionModals {...props} />);
    fireEvent.click(screen.getByTestId('attack-rider-close'));

    expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
    expect(setSkipFlag).toHaveBeenCalledWith("_Stalker's_Flurry_skippedRound", props.playerStats, 'test-campaign');
    // resume follows the awaited skip-flag write — flush the async close handler
    await waitFor(() => expect(resumeAttackPipeline).toHaveBeenCalledTimes(1));
  });

  it('resumes the pipeline after an option was applied without stamping the skip flag', async () => {
    const resumeAttackPipeline = vi.fn(() => Promise.resolve());
    const props = makeProps({ resumeAttackPipeline });
    armModal(props);
    getRuntimeValue.mockImplementation((name, key) => (key === "_Stalker's_Flurry_option" ? 'Mass Fear' : null));
    render(<CharActionModals {...props} />);
    fireEvent.click(screen.getByTestId('attack-rider-close'));

    expect(resumeAttackPipeline).toHaveBeenCalledTimes(1);
    expect(setSkipFlag).not.toHaveBeenCalled();
  });

  it('tolerates a missing resumeAttackPipeline prop', () => {
    const props = makeProps({ resumeAttackPipeline: undefined });
    armModal(props);
    render(<CharActionModals {...props} />);
    fireEvent.click(screen.getByTestId('attack-rider-close'));
    expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
  });
});
