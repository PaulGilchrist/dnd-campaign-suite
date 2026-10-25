// @maintained-by-ai
// LANE: BonusActionChoiceModal economy CHARGE (bug-action-economy-chooser-modal-never-charges).
// The chooser is a deferred lane: useCharActionsAutomation gates the row at click
// ('modal' results defer their L5-002 charge to the apply seam, plan §7.2), and this
// modal's handleApply is that seam. Pin HERE: the confirm charges the bonusAction slot
// exactly once with exact args, AFTER the handler resolves (charge-on-resolve); Cancel
// and background clicks spend nothing (off-switch zero-write guarantee is owned by
// chargeEconomy.test.js — here chargeSlot is mocked, only ITS call sites are pinned).
// Selection-gating / logging / grant shapes are owned by BonusActionChoiceModal.test.jsx
// and bonusActionChoiceHandler.test.js — not duplicated here.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BonusActionChoiceModal from './BonusActionChoiceModal.jsx';

vi.mock('../../../../services/automation/handlers/combat/bonusActionChoiceHandler.js', () => ({
  applyBonusActionChoice: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/combat/chargeEconomy.js', () => ({
  chargeSlot: vi.fn(() => true),
}));

import * as bonusActionHandler from '../../../../services/automation/handlers/combat/bonusActionChoiceHandler.js';
import { chargeSlot } from '../../../../services/combat/chargeEconomy.js';

const callOrder = [];

const cunningAction = {
  name: 'Cunning Action',
  automation: {
    type: 'bonus_action_choice',
    casting_time: '1 bonus action',
    options: [
      { name: 'Dash', description: 'Double your movement speed until the end of the turn' },
      { name: 'Disengage', description: 'Your movement doesn\'t provoke opportunity attacks until the end of the turn' },
    ],
  },
};

const baseProps = {
  action: cunningAction,
  playerStats: { name: 'AasimarTest', level: 20 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function popupResult(description) {
  return {
    type: 'popup',
    payload: { type: 'automation_info', name: cunningAction.name, description, automation: cunningAction.automation },
  };
}

async function applyDash() {
  fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
  fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
}

describe('BonusActionChoiceModal economy charge (L5-002 deferred lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    bonusActionHandler.applyBonusActionChoice.mockImplementation(async () => {
      callOrder.push('apply');
      return popupResult('Dash selected: You take the Dash bonus action.');
    });
    chargeSlot.mockImplementation(() => {
      callOrder.push('charge');
      return true;
    });
  });

  it('charges the bonusAction slot exactly once with exact args on confirm', async () => {
    render(<BonusActionChoiceModal {...baseProps} />);
    await applyDash();

    expect(chargeSlot).toHaveBeenCalledTimes(1);
    expect(chargeSlot).toHaveBeenCalledWith({
      creatureName: 'AasimarTest',
      bucket: 'bonusAction',
      campaignName: 'test-campaign',
    });
  });

  it('charges only AFTER the handler resolves (charge-on-resolve, not charge-on-open)', async () => {
    render(<BonusActionChoiceModal {...baseProps} />);
    // Modal open + option selected: nothing charged yet.
    fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
    expect(chargeSlot).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
    expect(callOrder).toEqual(['apply', 'charge']);
  });

  it('charges once per confirm across repeated chooser opens — no double-charge, no missed charge', async () => {
    const onClose = vi.fn();
    const view = render(<BonusActionChoiceModal {...baseProps} onClose={onClose} />);
    await applyDash();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(chargeSlot).toHaveBeenCalledTimes(1);

    // The parent remounts a fresh chooser per open (modal state nulled on close):
    // a second resolved execution must charge again — the lane never double-charges
    // one confirm, and one spent slot per execution is what the assertCanAct gate
    // reads to refuse the next click.
    view.unmount();
    render(<BonusActionChoiceModal {...baseProps} onClose={onClose} />);
    await applyDash();
    expect(chargeSlot).toHaveBeenCalledTimes(2);
    expect(chargeSlot).toHaveBeenLastCalledWith({
      creatureName: 'AasimarTest',
      bucket: 'bonusAction',
      campaignName: 'test-campaign',
    });
  });

  it('no-result apply charges nothing (chooser stays open for retry)', async () => {
    bonusActionHandler.applyBonusActionChoice.mockResolvedValue(null);
    render(<BonusActionChoiceModal {...baseProps} />);
    fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalled();
    });
    expect(chargeSlot).not.toHaveBeenCalled();
  });

  it('Cancel spends nothing — no charge without confirm', () => {
    const onClose = vi.fn();
    render(<BonusActionChoiceModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(chargeSlot).not.toHaveBeenCalled();
    expect(bonusActionHandler.applyBonusActionChoice).not.toHaveBeenCalled();
  });

  it('overlay and modal-body clicks never charge', () => {
    render(<BonusActionChoiceModal {...baseProps} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(chargeSlot).not.toHaveBeenCalled();
    expect(bonusActionHandler.applyBonusActionChoice).not.toHaveBeenCalled();
  });

  it('disabled Apply with no selection charges nothing', () => {
    render(<BonusActionChoiceModal {...baseProps} />);
    const apply = screen.getByRole('button', { name: /Use Bonus Action/ });
    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(chargeSlot).not.toHaveBeenCalled();
  });
});
