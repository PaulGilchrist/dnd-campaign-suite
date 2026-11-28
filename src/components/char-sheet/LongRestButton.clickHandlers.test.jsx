// @maintained-by-ai 2026-11-27
/**
 * LongRestButton.clickHandlers.test.jsx — owns the CLICK-DISPATCH seam.
 *
 * Lane ownership for LongRestButton tests:
 *  - This file: clicking the button dispatches through handleLongRest with
 *    exact args to applyLongRest, and branches correctly — falsy celestial
 *    payload completes the rest immediately (single zero-arg onLongRest, no
 *    modal, no game-state writes); truthy payload opens the Celestial
 *    Resilience modal with the FULL prop set (prose interpolated from the
 *    grant's own maxTargets/tempHp data, fix#164) and defers everything
 *    else. Also pins in-flight double-click behavior (no latch).
 *  - LongRestButton.modalInteractions.test.jsx: everything AFTER the modal
 *    opens (confirm/skip flows, setTempHp per ally, log payloads).
 *  - LongRestButton.rendering.test.jsx: DOM contract (button text, title,
 *    trance suffix).
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
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
    // Re-baseline every test: a plain long rest with no celestial allies.
    restRules.applyLongRest.mockResolvedValue({});
  });

  // Two falsy arms kill the whole guard-mutant family for
  // `result?.celestialResilienceAllies`: the null-valued arm fails
  // `!== undefined`-style and `in`-style checks; the missing-key arm fails
  // `!== null`-style and `in`-style checks. A third undefined-valued arm
  // would kill no mutant these two do not already kill (same-branch trim).
  describe.each([
    ['null', { celestialResilienceAllies: null }],
    ['a missing key', {}],
  ])('when applyLongRest resolves with %s celestial ally payload', (_label, result) => {
    it('completes the rest directly without a modal or game-state writes', async () => {
      restRules.applyLongRest.mockResolvedValue(result);
      const onLongRest = vi.fn();

      render(<LongRestButton {...makeProps({ onLongRest })} />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      // Exactly one dispatch, exact args, same stats instance by reference.
      expect(restRules.applyLongRest.mock.calls).toEqual([[basePlayerStats, mockCampaignName]]);
      expect(restRules.applyLongRest.mock.calls[0][0]).toBe(basePlayerStats);
      // Async act has already flushed the handler's continuation: the rest
      // completed exactly once, with zero arguments (no waitFor needed).
      expect(onLongRest.mock.calls).toEqual([[]]);
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
      // Zero-silence negative legs: nothing was applied behind the scenes.
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  // Non-default data (maxTargets 3 ≠ the producer's default 5, distinct
  // self/ally temp HP) so hardcoded prose or swapped values cannot pass:
  // every number in the modal copy must be interpolated from this grant.
  it('opens the Celestial Resilience modal with the full payload and defers the rest', async () => {
    const grant = { ...celestialData, maxTargets: 3 };
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: grant });
    const onLongRest = vi.fn();

    render(<LongRestButton {...makeProps({ onLongRest })} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await screen.findByTestId('creature-selection-modal');

    // Full-shape census of every prop forwarded at the seam — extra or
    // missing props fail here, not just the ones we happened to list.
    expect(captured.props).toEqual({
      title: 'Celestial Resilience',
      icon: 'fa-shield-heart',
      targets: grant.creatureTargets,
      maxTargets: 3,
      description: 'Choose up to 3 allies to gain temporary hit points from your Celestial Resilience.',
      note: 'You gain 5 temporary hit points. Each selected ally gains 10 temporary hit points.',
      confirmLabel: 'Grant Resilience',
      confirmIcon: 'fa-shield-heart',
      onConfirm: expect.any(Function),
      onSkip: expect.any(Function),
    });
    // The rules' target array rides through by reference — not cloned/rebuilt.
    expect(captured.props.targets).toBe(celestialData.creatureTargets);

    // Coupling pin (fix#164 law, re-verified against current bytes): the
    // count in the description is interpolated from the SAME maxTargets
    // forwarded to the picker (LongRestButton.jsx) — never a retyped "5"
    // literal. The default 5 is producer-owned:
    // celestialResilienceHandler.js `auto.maxAllies || 5` mapped through
    // restRules-longRest.js into this payload.
    expect(Number(captured.props.description.match(/up to (\d+)/)[1])).toBe(captured.props.maxTargets);

    // The rest is deferred until the player decides — nothing applied yet
    // (confirm/skip behaviour is covered in modalInteractions).
    expect(onLongRest).not.toHaveBeenCalled();
    expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  // Double-fire detector: the button has NO in-flight latch, so a rapid
  // second click dispatches a SECOND full rest — double resource refund is
  // the current honest behavior and is pinned here. If source ever adds a
  // guard, this pin must flip to a single dispatch.
  it('dispatches a second rest when clicked again while the first is in flight (no latch)', async () => {
    let resolveFirst;
    let resolveSecond;
    restRules.applyLongRest
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const onLongRest = vi.fn();

    render(<LongRestButton {...makeProps({ onLongRest })} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);

    // Both clicks passed through with full args while nothing had resolved.
    expect(restRules.applyLongRest.mock.calls).toEqual([
      [basePlayerStats, mockCampaignName],
      [basePlayerStats, mockCampaignName],
    ]);
    expect(onLongRest).not.toHaveBeenCalled();

    await act(async () => {
      resolveFirst({});
      resolveSecond({});
    });

    // Both rests completed: two zero-arg onLongRest calls, and still no
    // modal and no game-state writes beyond the double completion.
    expect(onLongRest.mock.calls).toEqual([[], []]);
    expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
