// @maintained-by-ai 2026-11-27
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

const COMMANDS = [
  ['Dash', 'Double movement speed this turn'],
  ['Disengage', "Movement doesn't trigger opportunity attacks"],
  ['Dodge', 'Attackers have disadvantage against the companion'],
  ['Help', 'Next ally attack against a target has advantage'],
];

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

  it('renders the header, four unchecked command radios with rules text, and a disabled submit', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(screen.getByText('Primal Companion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(COMMANDS.length);
    COMMANDS.forEach(([command, description]) => {
      const radio = screen.getByRole('radio', { name: new RegExp(`${command}.*${description}`) });
      expect(radio.checked).toBe(false);
    });

    // Submit is inert until a command is chosen.
    expect(screen.getByRole('button', { name: /Command Companion/ })).toBeDisabled();
  });

  it('selecting a command checks its radio, enables submit, highlights its row, and keeps the modal open', () => {
    const onClose = vi.fn();
    render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('radio', { name: /^Dash/ }));

    expect(screen.getByRole('radio', { name: /^Dash/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Help/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Command Companion/ })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();

    // The chosen row gets distinct selected styling; unselected rows do not.
    const rowStyle = (text) => screen.getByRole('radio', { name: new RegExp(`^${text}`) })
      .closest('.primal-companion-bonus-option').getAttribute('style') || '';
    expect(rowStyle('Dash')).not.toBe(rowStyle('Help'));
  });

  it('only Cancel closes the modal — an overlay click must not dismiss it', () => {
    const onClose = vi.fn();
    render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();

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
  ])('commanding "$command" (force damage: $expectedForce) applies, shows the rich-text result, and Done closes', async ({ command, force, expectedForce }) => {
    const onClose = vi.fn();
    render(<PrimalCompanionBonusActionModal {...withAutomation({ forceDamageOption: true }, { onClose })} />);
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${command}`) })); });
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

    // Result screen renders the handler's description as HTML (not escaped).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('Commanded Wolf to take a Dash action');
    expect(body.querySelector('b')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
