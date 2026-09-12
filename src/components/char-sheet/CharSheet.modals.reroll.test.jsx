// CLA-195 regression: renderPopup must wire popupHandlers.onReroll into the
// AttackResultPopup (DiceRollResult) so sheet save rerolls consume resources.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { renderPopup } from './CharSheet.modals.jsx';

describe('renderPopup — Indomitable reroll wiring (CLA-195)', () => {
  it('passes onReroll through so the reroll button fires popupHandlers.onReroll', () => {
    const onReroll = vi.fn();
    const popupHandlers = {
      onWildShapeConfirm: vi.fn(),
      onPolymorphConfirm: vi.fn(),
      onShapechangeConfirm: vi.fn(),
      onAnimalShapesBeastConfirm: vi.fn(),
      onTruePolymorphConfirm: vi.fn(),
      onObjectTransformConfirm: vi.fn(),
      onSuperiorityManeuver: vi.fn(),
      onTacticalMind: vi.fn(),
      onDarkOnesLuck: vi.fn(),
      onPsiBolsteredKnack: vi.fn(),
      onBardicInspiration: vi.fn(),
      onBardicInspirationOffense: vi.fn(),
      onEmpoweredSpell: vi.fn(),
      onPuncture: vi.fn(),
      onSavageAttacker: vi.fn(),
      onBiDefenseCombatSummary: vi.fn(),
      onStrokeOfLuck: vi.fn(),
      onReroll,
    };
    const popupHtml = {
      type: 'd20',
      rollType: 'save',
      name: 'Wisdom',
      rolls: [3],
      bonus: 5,
      autoReroll: true,
      autoRerollBonus: 18,
      autoRerollCondition: '',
    };

    render(
      <div>
        {renderPopup({ popupHtml, setPopupHtml: vi.fn(), isLocalhost: true, playerStats: { name: 'EvasiveFighter', level: 18 }, campaignName: 'test-campaign', characters: [], popupHandlers })}
      </div>
    );

    const rerollBtn = screen.getByRole('button', { name: /Reroll \(\+18\)/ });
    fireEvent.click(rerollBtn);

    expect(onReroll).toHaveBeenCalledTimes(1);
    expect(onReroll.mock.calls[0][0]).toMatchObject({
      roll: expect.any(Number),
      total: expect.any(Number),
    });
    expect(onReroll.mock.calls[0][0].total).toBe(onReroll.mock.calls[0][0].roll + 5 + 18);
  });

  it('does not offer a reroll when popupHtml.autoReroll is not set', () => {
    const popupHandlers = {
      onWildShapeConfirm: vi.fn(),
      onPolymorphConfirm: vi.fn(),
      onShapechangeConfirm: vi.fn(),
      onAnimalShapesBeastConfirm: vi.fn(),
      onTruePolymorphConfirm: vi.fn(),
      onObjectTransformConfirm: vi.fn(),
      onSuperiorityManeuver: vi.fn(),
      onTacticalMind: vi.fn(),
      onDarkOnesLuck: vi.fn(),
      onPsiBolsteredKnack: vi.fn(),
      onBardicInspiration: vi.fn(),
      onBardicInspirationOffense: vi.fn(),
      onEmpoweredSpell: vi.fn(),
      onPuncture: vi.fn(),
      onSavageAttacker: vi.fn(),
      onBiDefenseCombatSummary: vi.fn(),
      onStrokeOfLuck: vi.fn(),
      onReroll: vi.fn(),
    };
    const popupHtml = {
      type: 'd20',
      rollType: 'save',
      name: 'Wisdom',
      rolls: [3],
      bonus: 5,
    };

    render(
      <div>
        {renderPopup({ popupHtml, setPopupHtml: vi.fn(), isLocalhost: true, playerStats: { name: 'EvasiveFighter', level: 18 }, campaignName: 'test-campaign', characters: [], popupHandlers })}
      </div>
    );

    expect(screen.queryByRole('button', { name: /Reroll/ })).not.toBeInTheDocument();
    expect(popupHandlers.onReroll).not.toHaveBeenCalled();
  });
});
