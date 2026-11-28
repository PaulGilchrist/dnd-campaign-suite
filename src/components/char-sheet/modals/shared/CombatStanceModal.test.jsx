// @maintained-by-ai 2026-11-27
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CombatStanceModal from './CombatStanceModal.jsx';

vi.mock('../../../../services/automation/handlers/combat/combatStanceHandler.js', () => ({
  applyStanceOption: vi.fn(),
}));

import * as combatStanceHandler from '../../../../services/automation/handlers/combat/combatStanceHandler.js';

const mockPlayerStats = { name: 'Throg', level: 12, class: { name: 'Barbarian' } };
const mockCampaignName = 'test-campaign';

const RAGE_OPTIONS = [
  { name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] },
  { name: 'Eagle' },
  { name: 'Wolf' },
  { name: 'Falcon', flySpeed: 40, noArmor: true },
  { name: 'Lion' },
  { name: 'Ram' },
];

function makeProps(overrides = {}) {
  return {
    action: { name: 'Rage', automation: { type: 'stance', options: RAGE_OPTIONS } },
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('CombatStanceModal', () => {
  beforeEach(() => {
    combatStanceHandler.applyStanceOption.mockReset();
  });
  const radios = () => screen.queryAllByRole('radio');

  it('renders action name, instruction, and one radio per option with its effect text', () => {
    render(<CombatStanceModal {...makeProps()} />);

    expect(screen.getByText('Rage')).toBeInTheDocument();
    expect(screen.getByText(/Choose a primal aspect of your Rage/)).toBeInTheDocument();
    expect(radios()).toHaveLength(6);

    // Each stance shows the rules text players need to choose between them.
    expect(screen.getByText(/Resistance to all damage except Force, Necrotic, Psychic, Radiant/)).toBeInTheDocument();
    expect(screen.getByText(/Disengage and Dash as part of the bonus action/)).toBeInTheDocument();
    expect(screen.getByText(/Allies have Advantage on attack rolls against enemies within 5 ft/)).toBeInTheDocument();
    expect(screen.getByText(/Fly Speed equal to your Speed while raging/)).toBeInTheDocument();
    expect(screen.getByText(/Enemies within 5 ft have Disadvantage on attacks against targets other than you/)).toBeInTheDocument();
    expect(screen.getByText(/Melee hits cause Large or smaller creatures to have the Prone condition/)).toBeInTheDocument();
  });

  it('lists a custom stance option without effect text', () => {
    render(<CombatStanceModal {...makeProps({
      action: { name: 'Rage', automation: { type: 'stance', options: [{ name: 'Custom' }] } },
    })} />);

    expect(radios()).toHaveLength(1);
    expect(screen.getByText('Custom')).toBeInTheDocument();
    // Unknown stances render no effect line rather than a stale/bogus one.
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('uses elemental wording and activate label for non-Rage actions', () => {
    render(<CombatStanceModal {...makeProps({
      action: { name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Cold' }] } },
    })} />);

    expect(screen.getByText(/Choose an elemental movement type/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activate ElementalStride/ })).toBeInTheDocument();
    expect(screen.getByText(/Ice Walk: Walk across icy\/water surfaces without checks; ignore ice\/snow difficult terrain/)).toBeInTheDocument();
  });

  it('computes dynamic effect text from option overrides and defaults', () => {
    render(<CombatStanceModal {...makeProps({
      action: {
        name: 'ElementalStride',
        automation: {
          type: 'stance',
          options: [
            { name: 'Fire', speedBonus: 15 },
            { name: 'Fire' },
            { name: 'Thunder', teleportDistance: '60 ft' },
            { name: 'Thunder' },
            { name: 'Lightning' },
          ],
        },
      },
    })} />);

    expect(screen.getByText(/Speed Boost: \+15 feet to Speed/)).toBeInTheDocument();
    expect(screen.getByText(/Speed Boost: \+10 feet to Speed/)).toBeInTheDocument();
    expect(screen.getByText(/Teleport up to 60 ft to an unoccupied space you can see/)).toBeInTheDocument();
    expect(screen.getByText(/Teleport up to 30 ft to an unoccupied space you can see/)).toBeInTheDocument();
    expect(screen.getByText(/Fly Speed equal to your Speed for 1 round/)).toBeInTheDocument();
  });

  it('keeps the modal usable but has nothing to select when automation is missing', () => {
    render(<CombatStanceModal {...makeProps({ action: { name: 'Rage' } })} />);

    expect(screen.getByText('Rage')).toBeInTheDocument();
    expect(radios()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Activate Rage/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('enables Activate only after a selection, enforces single selection, and never applies without one', () => {
    render(<CombatStanceModal {...makeProps()} />);
    const activate = screen.getByRole('button', { name: /Activate Rage/ });
    expect(activate).toBeDisabled();

    fireEvent.click(activate);
    expect(combatStanceHandler.applyStanceOption).not.toHaveBeenCalled();

    fireEvent.click(radios()[0]);
    expect(activate).toBeEnabled();
    expect(radios()[0]).toBeChecked();

    fireEvent.click(radios()[1]);
    expect(radios()[0]).not.toBeChecked();
    expect(radios()[1]).toBeChecked();
  });

  it('submits the selection, replaces the picker with an HTML result screen, and Done closes', async () => {
    const onClose = vi.fn();
    combatStanceHandler.applyStanceOption.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Rage', description: '<strong>Bear</strong> chosen.' },
    });

    render(<CombatStanceModal {...makeProps({ onClose })} />);
    fireEvent.click(radios()[0]);
    fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
    expect(combatStanceHandler.applyStanceOption).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Rage' }),
      mockPlayerStats,
      mockCampaignName,
      'Bear'
    );

    // Result screen: selection UI and Cancel are gone, description is rendered as HTML.
    expect(screen.queryByText(/Choose a primal aspect/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate Rage/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    const strongEl = document.querySelector('.sp-body strong');
    expect(strongEl).toBeInTheDocument();
    expect(strongEl.textContent).toBe('Bear');

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays in selection mode when applying fails or yields no description', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    combatStanceHandler.applyStanceOption.mockRejectedValue(new Error('Failed to apply stance'));

    render(<CombatStanceModal {...makeProps()} />);
    fireEvent.click(radios()[0]);
    fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

    await waitFor(() => {
      expect(screen.getByText('Failed to apply Rage: Failed to apply stance')).toBeInTheDocument();
    });
    // No success screen; the user can retry from the same modal.
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activate Rage/ })).toBeEnabled();

    // A handler result without a description must not render a blank success screen.
    combatStanceHandler.applyStanceOption.mockResolvedValue(null);
    fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

    await waitFor(() => {
      expect(combatStanceHandler.applyStanceOption).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('closes only via Cancel — overlay and modal shell clicks are ignored', () => {
    const onClose = vi.fn();
    render(<CombatStanceModal {...makeProps({ onClose })} />);

    fireEvent.click(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
