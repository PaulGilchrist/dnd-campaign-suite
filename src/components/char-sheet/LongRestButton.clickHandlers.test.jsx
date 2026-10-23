// @maintained-by-ai
/**
 * LongRestButton.clickHandlers.test.jsx — owns the CLICK-DISPATCH seam.
 *
 * Lane ownership for LongRestButton tests:
 *  - This file: clicking the button dispatches through handleLongRest with
 *    exact args to applyLongRest, and branches correctly — falsy celestial
 *    payload completes the rest immediately (zero-arg onLongRest, no modal,
 *    no game-state writes); truthy payload opens the Celestial Resilience
 *    modal with the full merged payload and defers everything else.
 *  - LongRestButton.modalInteractions.test.jsx: everything AFTER the modal
 *    opens (confirm/skip flows, setTempHp per ally, log payloads).
 *  - LongRestButton.rendering.test.jsx: DOM contract (button text, title,
 *    trance suffix).
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocks ──

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(() => false),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  applyLongRest: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Capture the props LongRestButton passes at the modal seam so tests can
// assert the click handler's exact dispatch payload.
const captured = vi.hoisted(() => ({ props: null }));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function MockModal(props) {
    captured.props = props;
    return <div data-testid="creature-selection-modal" />;
  },
}));

// ── Re-import mocks ──

import * as restRules from '../../services/rules/effects/restRules.js';
import * as tempHpService from '../../services/automation/handlers/buffs/tempHpService.js';
import * as logService from '../../services/ui/logService.js';

// ── Fixtures ──

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
  hitPoints: 45,
  class: { name: 'Cleric' },
};

const mockCampaignName = 'test-campaign';

const celestialData = {
  creatureTargets: [
    { name: 'Ally1', type: 'player' },
    { name: 'Ally2', type: 'npc' },
  ],
  allyTempHp: 10,
  selfTempHp: 5,
  maxTargets: 5,
};

function makeProps(overrides) {
  return {
    playerStats: basePlayerStats,
    campaignName: mockCampaignName,
    onLongRest: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('LongRestButton - click dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.props = null;
    // Deterministic default: a plain long rest with no celestial allies.
    restRules.applyLongRest.mockResolvedValue({});
  });

  describe.each([
    ['null', { celestialResilienceAllies: null }],
    ['undefined', { celestialResilienceAllies: undefined }],
    ['a missing key', {}],
  ])('when applyLongRest resolves with %s celestial ally payload', (_label, result) => {
    it('completes the rest directly without a modal or game-state writes', async () => {
      restRules.applyLongRest.mockResolvedValue(result);
      const onLongRest = vi.fn();

      render(<LongRestButton {...makeProps({ onLongRest })} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(restRules.applyLongRest).toHaveBeenCalledWith(basePlayerStats, mockCampaignName);
      // Exactly one invocation, with zero arguments.
      await waitFor(() => {
        expect(onLongRest.mock.calls).toEqual([[]]);
      });
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  it('opens the Celestial Resilience modal with the full payload and defers the rest', async () => {
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });
    const onLongRest = vi.fn();

    render(<LongRestButton {...makeProps({ onLongRest })} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    // The click handler forwards the rules targets to the modal; the temp
    // HP values ride along in the note text and are consumed by the
    // confirm/skip callbacks held on this seam.
    expect(captured.props).toEqual(expect.objectContaining({
      targets: celestialData.creatureTargets,
      maxTargets: celestialData.maxTargets,
      onConfirm: expect.any(Function),
      onSkip: expect.any(Function),
    }));
    expect(captured.props.note).toMatch(/\b5 temporary hit points/);
    expect(captured.props.note).toMatch(/\b10 temporary hit points/);

    // Coupling pin (fix#158/fix#164 law): the number in the description is
    // the SAME celestialResilienceModal.maxTargets forwarded to the picker
    // at LongRestButton.jsx:67/:68 — never a retyped literal. The default 5
    // is producer-owned: celestialResilienceHandler.js:70 (auto.maxAllies
    // || 5) mapped through restRules-longRest.js:392 into this payload.
    expect(captured.props.description).toBe(`Choose up to ${celestialData.maxTargets} allies to gain temporary hit points from your Celestial Resilience.`);
    expect(Number(captured.props.description.match(/up to (\d+)/)[1])).toBe(captured.props.maxTargets);

    // The rest is deferred until the player decides — nothing applied yet
    // (confirm/skip behaviour is covered in modalInteractions).
    expect(onLongRest).not.toHaveBeenCalled();
    expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  // Drift arms (fix#164 recipe): non-default caps from the rest grant must
  // flow into the copy verbatim; 5 is the producer-default intact arm.
  it.each([3, 5])(
    'description interpolates maxTargets=%i from the grant, matching the picker cap it advertises',
    async (maxTargets) => {
      restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: { ...celestialData, maxTargets } });

      render(<LongRestButton {...makeProps({ onLongRest: vi.fn() })} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      await screen.findByTestId('creature-selection-modal');

      // Copy number extracted from prose EQUALS the value passed to the picker.
      expect(captured.props.maxTargets).toBe(maxTargets);
      expect(captured.props.description).toBe(`Choose up to ${maxTargets} allies to gain temporary hit points from your Celestial Resilience.`);
      expect(Number(captured.props.description.match(/up to (\d+)/)[1])).toBe(captured.props.maxTargets);
    }
  );
});
