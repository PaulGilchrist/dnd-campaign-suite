// @maintained-by-ai
// Regression tests (FT-022/023): closing the Charger (Charge Attack) rider
// modal in CharActionModals must resume the paused attack damage pipeline,
// and must latch the once-per-round skip flag only when the player declined
// the option.
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

import { setSkipFlag } from '../../services/automation/common/oncePerTurn.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

// Opens the Charger rider modal, renders CharActionModals, clicks the
// modal's close button, and returns the props so each test asserts on the
// observable close behavior. `runtimeOptions` maps runtime-store keys to the
// values getRuntimeValue should return (empty = player declined).
function renderAndCloseChargerModal(runtimeOptions = {}) {
  getRuntimeValue.mockImplementation((_name, key) => runtimeOptions[key] ?? null);
  const props = makeProps();
  props.modalState.attackRiderModal = {
    action: {
      name: 'Charge Attack',
      trigger: 'melee_hit_after_10ft_charge',
      chooseOne: true,
      oncePerTurn: true,
    },
    playerStats: props.playerStats,
    campaignName: 'test-campaign',
    targetName: 'Goblin',
  };
  render(<CharActionModals {...props} />);
  fireEvent.click(screen.getByTestId('attack-rider-close'));
  return props;
}

describe('CharActionModals — Charger rider close resumes pipeline (FT-022/023)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applied option: closes the modal and resumes the pipeline without latching the skip flag', async () => {
    const props = renderAndCloseChargerModal({ '_Charge_Attack_option': 'Push 10 ft' });

    await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
    expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
    expect(setSkipFlag).not.toHaveBeenCalled();
  });

  it('declined option: closes the modal, latches the skip flag, and resumes the pipeline', async () => {
    const props = renderAndCloseChargerModal();

    await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
    expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
    expect(setSkipFlag).toHaveBeenCalledTimes(1);
    expect(setSkipFlag).toHaveBeenCalledWith(
      '_Charge_Attack_skippedRound',
      props.playerStats,
      'test-campaign',
    );
  });
});
