// @maintained-by-ai 2026-10-14
// Regression tests for CLA-188 + the IJ 2026-11-18 decline-latch alignment:
// closing the Cunning Strike rider modal in CharActionModals must resume the
// paused attack damage pipeline, and a Cancel with no option applied must
// latch `_cunningStrikeSkippedRound` for the round (mirroring the Charger /
// Stalker's Flurry decline branches) so same-round repeat hits stop
// re-offering the chooser.
//
// Lane map for the shared handleAttackRiderClose handler (do not duplicate here):
// - Charger + skip-flag latch → CharActionModals.charger-resume.test.jsx
// - Stalker's Flurry + skip-flag latch → CharActionModals.stalkersFlurry-resume.test.jsx
// - Shield Bash resume → CharActionModals.shieldBash-resume.test.jsx
// - Generic close/unmount + event dispatch → CharActionModals.modal-closes.test.jsx
// - Pipeline resume/damage math → useAttackDamageResolution.cunningStrikeResume.test.js
// - Rider-step suppression/clear → steps/attackRollRiders.test.js
//
// This lane: the Cunning Strike variants resume the pipeline exactly once and
// roll no damage themselves (the pipeline owns damage); Cancel latches the
// skip, while an Apply (which stamped `_CunningStrike_usedRound` for the
// current round via markOncePerTurn) never stacks a skip. The un-mocked
// combatData cache is empty in tests, so getCurrentCombatRound pins round 1.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// Opens the given rider modal, renders CharActionModals, clicks the stub
// modal's close button, and returns the props for close-behavior assertions.
// `runtimeOptions` maps runtime-store keys to the values getRuntimeValue
// should return (empty = chooser Cancelled with nothing applied).
function renderAndCloseRiderModal(actionName, targetName, runtimeOptions = {}) {
  getRuntimeValue.mockImplementation((_name, key) => runtimeOptions[key] ?? null);
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
    it(`closes the ${featureName} modal and resumes the pipeline exactly once`, async () => {
      const props = renderAndCloseRiderModal(featureName, 'Animated Rug of Smothering 1');

      await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
      expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
      // The close handler must not short-circuit the pipeline by rolling
      // damage itself — proceedToDamage runs downstream via resume.
      expect(props.rollDamage).not.toHaveBeenCalled();
    });

    it(`declined (no option applied) ${featureName} close latches the round skip flag`, async () => {
      // No `_CunningStrike_usedRound` stamp for the current round (round 1
      // from the empty combatData cache) → the Apply path never ran → the
      // Cancel must mirror the Charger/Stalker's Flurry decline latch.
      const props = renderAndCloseRiderModal(featureName, 'Animated Rug of Smothering 1');

      await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
      expect(setSkipFlag).toHaveBeenCalledTimes(1);
      expect(setSkipFlag).toHaveBeenCalledWith(
        '_cunningStrikeSkippedRound',
        props.playerStats,
        'test-campaign',
      );
    });

    it(`applied ${featureName} close (usedRound stamped this round) never stacks a skip`, async () => {
      // applyRiderOption's markOncePerTurn stamp (setSkipFlag sibling shape)
      // proves an option was applied — the used-latch owns that lane.
      const props = renderAndCloseRiderModal(featureName, 'Animated Rug of Smothering 1', {
        '_CunningStrike_usedRound': { round: 1, activeCreature: featureName },
      });

      await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
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
