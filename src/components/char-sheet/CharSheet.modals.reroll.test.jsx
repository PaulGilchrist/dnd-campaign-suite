// @maintained-by-ai
// CLA-195 regression: renderPopup must wire popupHandlers.onReroll into the
// AttackResultPopup (DiceRollResult) when popupHtml.autoReroll is set, so
// sheet save rerolls consume resources. Seam unique to this file: the
// renderPopup → popupHandlers dispatch. Reroll button display/behavior is
// covered by DiceRollResult tests; handleReroll's body lives in
// CharSheet.actionHandlers — don't duplicate those here.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { renderPopup } from './CharSheet.modals.jsx';

function renderD20SavePopup(popupHtmlOverrides) {
  const popupHandlers = { onReroll: vi.fn() };
  render(
    <div>
      {renderPopup({
        popupHtml: {
          type: 'd20',
          rollType: 'save',
          name: 'Wisdom',
          rolls: [3],
          bonus: 5,
          ...popupHtmlOverrides,
        },
        setPopupHtml: vi.fn(),
        playerStats: { name: 'EvasiveFighter', level: 18 },
        campaignName: 'test-campaign',
        characters: [],
        popupHandlers,
      })}
    </div>
  );
  return popupHandlers;
}

describe('renderPopup — autoReroll wiring (CLA-195)', () => {
  it('routes a reroll click to popupHandlers.onReroll with a fresh d20 and the reroll bonus in the total', () => {
    const popupHandlers = renderD20SavePopup({
      autoReroll: true,
      autoRerollBonus: 18,
      autoRerollCondition: '',
    });

    fireEvent.click(screen.getByRole('button', { name: /Reroll \(\+18\)/ }));

    expect(popupHandlers.onReroll).toHaveBeenCalledTimes(1);
    const [[{ roll, total }]] = popupHandlers.onReroll.mock.calls;
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(20);
    expect(total).toBe(roll + 5 + 18); // save bonus + Indomitable reroll bonus
  });

  it('shows the result popup but offers no reroll when autoReroll is not set', () => {
    const popupHandlers = renderD20SavePopup({});

    // Non-vacuous: the popup itself renders, only the reroll offer is absent.
    expect(screen.getByText('Wisdom')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reroll/ })).not.toBeInTheDocument();
    expect(popupHandlers.onReroll).not.toHaveBeenCalled();
  });
});
