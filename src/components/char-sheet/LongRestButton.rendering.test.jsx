// @maintained-by-ai
/**
 * LongRestButton.rendering.test.jsx — owns the DOM CONTRACT lane.
 *
 * Lane ownership for LongRestButton tests:
 *  - LongRestButton.clickHandlers.test.jsx: clicking the button dispatches
 *    through handleLongRest to applyLongRest with exact args, and the modal
 *    props at the seam.
 *  - LongRestButton.modalInteractions.test.jsx: everything AFTER the modal
 *    opens (confirm/skip flows, setTempHp per ally, log payloads).
 *  - This file: what the rendered root looks like BEFORE any interaction —
 *    the button's exact accessible name and title attribute for both Trance
 *    variants, its enabled state, and that no modal exists on initial render.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocks ──
// Kept hermetic: initial-render assertions must not exercise real rest,
// temp-HP, logging, or modal machinery.

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(),
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

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function MockModal() {
    return <div data-testid="creature-selection-modal" />;
  },
}));

// ── Re-import mocks ──

import * as tranceRules from '../../services/rules/effects/tranceRules.js';

// ── Fixtures ──

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
  hitPoints: 45,
  class: { name: 'Cleric' },
};

const trancePlayerStats = {
  ...basePlayerStats,
  race: { traits: [{ name: 'Trance' }] },
};

const mockCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    playerStats: basePlayerStats,
    campaignName: mockCampaignName,
    onLongRest: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('LongRestButton rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      label: 'without the Trance trait',
      playerStats: basePlayerStats,
      hasTrance: false,
      expectedName: 'Long Rest',
      expectedTitle: 'Long Rest: restore all HP, spell slots, hit dice, and class resources',
    },
    {
      label: 'with the Trance trait',
      playerStats: trancePlayerStats,
      hasTrance: true,
      expectedName: 'Long Rest (4 hours)',
      expectedTitle: 'Long Rest (4 hours): restore all HP, spell slots, hit dice, and class resources',
    },
  ])(
    'renders an enabled button named "$expectedName" $label with the exact tooltip',
    ({ playerStats, hasTrance, expectedName, expectedTitle }) => {
      tranceRules.hasTranceTrait.mockReturnValue(hasTrance);
      render(<LongRestButton {...makeProps({ playerStats })} />);

      // Exact accessible name (from visible text content), not a substring.
      const button = screen.getByRole('button', { name: expectedName });
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute('title', expectedTitle);
      // The Celestial Resilience modal only exists after a click (owned by
      // the clickHandlers lane) — never on initial render.
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    },
  );
});
