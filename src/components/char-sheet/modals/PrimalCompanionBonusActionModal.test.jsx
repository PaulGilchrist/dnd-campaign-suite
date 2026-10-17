// @maintained-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PrimalCompanionBonusActionModal from './PrimalCompanionBonusActionModal.jsx';

vi.mock('../../../services/automation/handlers/class-ranger/primalCompanionHandler.js', () => ({
  applyBonusActionCommand: vi.fn(() => Promise.resolve({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Primal Companion',
      automationType: 'bonus_action',
      // HTML so the apply-flow test can pin rich-text rendering of the result.
      description: '<b>Commanded Wolf</b> to take a Dash action as a Bonus Action.',
      automation: { type: 'bonus_action' },
    },
  })),
}));

import * as primalCompanionHandler from '../../../services/automation/handlers/class-ranger/primalCompanionHandler.js';

const baseProps = {
  action: {
    name: 'Primal Companion',
    automation: { type: 'bonus_action' },
  },
  playerStats: { name: 'Ranger1', level: 5 },
  campaignName: 'test-campaign',
  companionType: 'Wolf',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function withAutomation(automationOverrides, overrides) {
  return makeProps({
    action: { name: 'Primal Companion', automation: { type: 'bonus_action', ...automationOverrides } },
    ...(overrides || {}),
  });
}

describe('PrimalCompanionBonusActionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the header, four command options with descriptions, unchecked radios, and a disabled submit', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(screen.getByText('Primal Companion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    // All four commands with their rules text, each an unchecked radio.
    const cases = [
      ['Dash', 'Double movement speed this turn'],
      ['Disengage', "Movement doesn't trigger opportunity attacks"],
      ['Dodge', 'Attackers have disadvantage against the companion'],
      ['Help', 'Next ally attack against a target has advantage'],
    ];
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(cases.length);
    cases.forEach(([command, description], i) => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain(command);
      expect(body.textContent).toContain(description);
      expect(radios[i].name).toBe('primalCompanionBonusAction');
      expect(radios[i].checked).toBe(false);
    });

    // Submit is inert until a command is chosen.
    expect(screen.getByRole('button', { name: /Command Companion/ })).toBeDisabled();
  });

  it('selects a command when clicked, enabling the Command button without closing', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    const submitBtn = screen.getByRole('button', { name: /Command Companion/ });
    fireEvent.click(screen.getByText('Dash'));
    expect(screen.getByRole('radio', { name: /^Dash/ })).toBeChecked();
    expect(submitBtn).toBeEnabled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking the overlay — Cancel or Command must be chosen', () => {
    const onClose = vi.fn();
    render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('closes on Cancel button click', () => {
    const onClose = vi.fn();
    render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: 'shown and unchecked', automation: { forceDamageOption: true }, present: true },
    { label: 'hidden when flag false', automation: { forceDamageOption: false }, present: false },
    { label: 'hidden when flag absent', automation: {}, present: false },
  ])('force damage checkbox is $label', ({ automation, present }) => {
    render(<PrimalCompanionBonusActionModal {...withAutomation(automation)} />);
    const checkbox = screen.queryByLabelText(/Deal Force damage/);
    if (present) {
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    } else {
      expect(checkbox).not.toBeInTheDocument();
    }
  });

  it.each([
    { command: 'Help', force: false, expectedForce: false },
    { command: 'Dash', force: true, expectedForce: true },
  ])('commands $command with useForceDamage=$expectedForce', async ({ command, force, expectedForce }) => {
    render(<PrimalCompanionBonusActionModal {...withAutomation({ forceDamageOption: true })} />);
    await act(async () => { fireEvent.click(screen.getByText(command)); });
    if (force) {
      await act(async () => { fireEvent.click(screen.getByLabelText(/Deal Force damage/)); });
    }
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    expect(primalCompanionHandler.applyBonusActionCommand).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Primal Companion' }),
      expect.objectContaining({ name: 'Ranger1' }),
      'test-campaign',
      command,
      expectedForce,
    );
  });

  it('shows the result screen with the HTML description after applying and closes on Done', async () => {
    const onClose = vi.fn();
    render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
    await act(async () => { fireEvent.click(screen.getByText('Dash')); });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('Commanded Wolf to take a Dash action');
    // Description is rendered as HTML, not escaped text.
    expect(body.querySelector('b')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
