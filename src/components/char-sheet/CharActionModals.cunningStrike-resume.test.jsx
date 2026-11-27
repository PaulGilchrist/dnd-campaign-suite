// @maintained-by-ai 2026-11-26
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
// - Generic (non-pausing) rider close, event dispatch, no resume → CharActionModals.modal-closes.test.jsx
// - isCunningStrikeFeatureName name list → cunningStrikeUtils.test.js
// - Pipeline resume/damage math → useAttackDamageResolution.cunningStrikeResume.test.js
// - Rider-step suppression/clear → steps/attackRollRiders.test.js
//
// This lane: the handler WIRING for the Cunning Strike family — every authored
// variant routes through closeCunningStrikeRider, which resumes the pipeline
// exactly once and rolls no damage itself (the pipeline owns damage). Cancel
// latches the skip unless `_CunningStrike_usedRound` proves an Apply this
// round (markOncePerTurn stamp); a stale stamp from an earlier round counts
// as unused. The un-mocked combatData cache is empty in tests, so
// getCurrentCombatRound pins round 1.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// Minimal mock set — mirrors CharActionModals.modal-closes.test.jsx: only the
// modules this lane touches, plus ones with load-time side effects. Unopened
// modals render nothing and load safely unmocked. isCunningStrikeFeatureName
// and resolveRoundStamp (cunningStrikeUtils) stay REAL — this lane tests the
// handler's use of them.
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

describe('CharActionModals — Cunning Strike rider close (CLA-188 + decline latch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  ['Cunning Strike', 'Improved Cunning Strike', 'Devious Strikes'].forEach((featureName) => {
    it(`declined ${featureName} close clears the modal, resumes the pipeline exactly once, and latches the round skip`, async () => {
      // No `_CunningStrike_usedRound` stamp → the Apply path never ran, so
      // the Cancel must mirror the Charger/Stalker's Flurry decline latch.
      const props = renderAndCloseRiderModal(featureName, 'Animated Rug of Smothering 1');

      await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
      expect(props.setModalState).toHaveBeenCalledWith({ attackRiderModal: null });
      // The close handler must not short-circuit the pipeline by rolling
      // damage itself — proceedToDamage runs downstream via resume.
      expect(props.rollDamage).not.toHaveBeenCalled();
      expect(setSkipFlag).toHaveBeenCalledTimes(1);
      expect(setSkipFlag).toHaveBeenCalledWith(
        '_cunningStrikeSkippedRound',
        props.playerStats,
        'test-campaign',
      );
    });
  });

  it('applied close (usedRound stamped this round) resumes but never stacks a skip', async () => {
    // applyRiderOption's markOncePerTurn stamp (setSkipFlag sibling shape)
    // proves an option was applied — the used-latch owns that lane. The
    // round comparison is name-independent, so one variant suffices.
    const props = renderAndCloseRiderModal('Cunning Strike', 'Animated Rug of Smothering 1', {
      '_CunningStrike_usedRound': { round: 1, activeCreature: 'Cunning Strike' },
    });

    await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
    expect(setSkipFlag).not.toHaveBeenCalled();
  });

  it('stale usedRound stamp (earlier round) counts as unused — Cancel still latches the skip', async () => {
    // Latches persist across combats; a round-3 stamp while the current
    // round is 1 must NOT suppress this round's decline latch.
    const props = renderAndCloseRiderModal('Cunning Strike', 'Animated Rug of Smothering 1', {
      '_CunningStrike_usedRound': { round: 3, activeCreature: 'Cunning Strike' },
    });

    await waitFor(() => expect(props.resumeAttackPipeline).toHaveBeenCalledTimes(1));
    expect(setSkipFlag).toHaveBeenCalledTimes(1);
    expect(setSkipFlag).toHaveBeenCalledWith(
      '_cunningStrikeSkippedRound',
      props.playerStats,
      'test-campaign',
    );
  });
});
