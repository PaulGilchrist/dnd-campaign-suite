// @maintained-by-ai
// Regression tests for CLA-188: closing the Cunning Strike rider modal in
// CharActionModals must resume the paused attack damage pipeline.
//
// Lane map for the shared handleAttackRiderClose handler (do not duplicate here):
// - Charger + skip-flag latch → CharActionModals.charger-resume.test.jsx
// - Stalker's Flurry + skip-flag latch → CharActionModals.stalkersFlurry-resume.test.jsx
// - Shield Bash resume → CharActionModals.shieldBash-resume.test.jsx
// - Generic close/unmount + event dispatch → CharActionModals.modal-closes.test.jsx
// - Pipeline resume/damage math → useAttackDamageResolution.cunningStrikeResume.test.js
//
// This lane: the Cunning Strike variants resume the pipeline exactly once,
// roll no damage themselves (the pipeline owns damage), and never latch a
// skip flag (oncePerTurn is stamped by applyRiderOption, not on close).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// Minimal mock set — mirrors CharActionModals.modal-closes.test.jsx: only the
// modules this lane touches, plus ones with load-time side effects. Unopened
// modals render nothing and load safely unmocked.
vi.mock('./modals/shared/AttackRiderModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="attack-rider-modal"><button data-testid="attack-rider-close" onClick={onClose}>Done</button></div>;
  },
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
  setSkipFlag: vi.fn(() => Promise.resolve()),
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

import { setSkipFlag } from '../../services/automation/common/oncePerTurn.js';

// Opens the given rider modal, renders CharActionModals, clicks the stub
// modal's close button, and returns the props for close-behavior assertions.
// The Cunning Strike resume branch is fire-and-forget (not awaited), so
// synchronous assertions after fireEvent are deterministic.
function renderAndCloseRiderModal(actionName, targetName) {
  const props = createBaseProps({
    resumeAttackPipeline: vi.fn(),
    rollDamage: vi.fn(),
  });
  props.modalState.attackRiderModal = {
    action: { name: actionName },
    playerStats: props.playerStats,
    campaignName: 'test-campaign',
    targetName,
  };
  render(<CharActionModals {...props} />);
  fireEvent.click(screen.getByTestId('attack-rider-close'));
  return props;
}

describe('CharActionModals — Cunning Strike rider close resumes pipeline (CLA-188)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  ['Cunning Strike', 'Improved Cunning Strike', 'Devious Strikes'].forEach((featureName) => {
    it(`closes the ${featureName} modal and resumes the pipeline exactly once`, () => {
      const props = renderAndCloseRiderModal(featureName, 'Animated Rug of Smothering 1');

      expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
      expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1);
      // The close handler must not short-circuit the pipeline by rolling
      // damage itself — proceedToDamage runs downstream via resume.
      expect(props.rollDamage).not.toHaveBeenCalled();
      // Lane guard: latching a once-per-round skip flag on close is
      // Charger/Stalker's Flurry behavior; Cunning Strike never does it.
      expect(setSkipFlag).not.toHaveBeenCalled();
    });
  });

  it('closes a manual (non-pausing) rider modal without touching the pipeline', () => {
    // 'Hamstring' is opened via the manual attack_rider row flow, not by a
    // featureRiders pipeline pause — closing it must not resume anything.
    const props = renderAndCloseRiderModal('Hamstring', 'Goblin');

    expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
    expect(props.resumeAttackPipeline).not.toHaveBeenCalled();
    expect(setSkipFlag).not.toHaveBeenCalled();
  });
});
