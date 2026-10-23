// @maintained-by-ai
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

function selectRadio(index) {
  fireEvent.click(document.querySelectorAll('input[type="radio"]')[index]);
}

describe('CombatStanceModal', () => {
  beforeEach(() => {
    combatStanceHandler.applyStanceOption.mockReset();
  });

  it('renders action name, instruction, and one radio per option with its effect text', () => {
    render(<CombatStanceModal {...makeProps()} />);

    expect(screen.getByText('Rage')).toBeInTheDocument();
    expect(screen.getByText(/Choose a primal aspect of your Rage/)).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(6);

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

    expect(screen.getAllByRole('radio')).toHaveLength(1);
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
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Activate Rage/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('enables Activate only after a selection, enforces single selection, and never applies without one', async () => {
    render(<CombatStanceModal {...makeProps()} />);
    const activate = screen.getByRole('button', { name: /Activate Rage/ });

    fireEvent.click(activate);
    expect(combatStanceHandler.applyStanceOption).not.toHaveBeenCalled();

    selectRadio(0);
    expect(activate).toBeEnabled();
    selectRadio(1);
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
  });

  it('submits the selection, replaces the picker with an HTML result screen, and Done closes', async () => {
    const onClose = vi.fn();
    combatStanceHandler.applyStanceOption.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Rage', description: '<strong>Bear</strong> chosen.' },
    });

    render(<CombatStanceModal {...makeProps({ onClose })} />);
    selectRadio(0);
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

  it('shows an error and stays in selection mode when applying fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    combatStanceHandler.applyStanceOption.mockRejectedValue(new Error('Failed to apply stance'));

    render(<CombatStanceModal {...makeProps()} />);
    selectRadio(0);
    fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

    await waitFor(() => {
      expect(screen.getByText('Failed to apply Rage: Failed to apply stance')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    // Recovery path: the user can retry from the same modal.
    expect(screen.getByRole('button', { name: /Activate Rage/ })).toBeEnabled();
    consoleError.mockRestore();
  });

  it('stays in selection mode when the handler returns no description', async () => {
    combatStanceHandler.applyStanceOption.mockResolvedValue(null);

    render(<CombatStanceModal {...makeProps()} />);
    selectRadio(0);
    fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

    await waitFor(() => {
      expect(combatStanceHandler.applyStanceOption).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
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

  it('styles via scoped classes, keeping only dynamic selection colors inline (no-inline-styles convention)', () => {
    const { container } = render(<CombatStanceModal {...makeProps()} />);

    // Static containers/inputs/descriptions: zero inline style attributes — the
    // rules live in CombatStanceModal.css (exact-value migration, fix#313 recipe).
    for (const sel of ['.combat-stance-options', '.combat-stance-input', '.combat-stance-desc']) {
      const els = container.querySelectorAll(sel);
      expect(els.length).toBeGreaterThan(0);
      for (const el of els) expect(el.getAttribute('style')).toBeNull();
    }

    // Option rows: static decoration lives in the class; the inline style attr
    // carries ONLY the isSelected-derived background/border (dynamic exception).
    const rows = container.querySelectorAll('.combat-stance-option');
    expect(rows).toHaveLength(RAGE_OPTIONS.length);
    for (const row of rows) {
      const inline = row.getAttribute('style') || '';
      expect(inline).toMatch(/background/i);
      expect(inline).toMatch(/border/i);
      expect(inline).not.toMatch(/display|padding|margin|cursor|border-radius|opacity/i);
    }

    // Census sweep: the ONLY inline-styled elements in the body are the dynamic
    // option labels — every former static site is now style-free.
    expect(container.querySelectorAll('.sp-body [style]')).toHaveLength(RAGE_OPTIONS.length);

    // Selecting a stance flips only its dynamic inline values (link-colored
    // border on the chosen row; every other row stays transparent).
    fireEvent.click(screen.getByText('Bear'));
    const selectedStyle = screen.getByText('Bear').closest('.combat-stance-option').getAttribute('style') || '';
    expect(selectedStyle).toMatch(/var\(--color-link\)/);
    const unselectedStyle = screen.getByText('Wolf').closest('.combat-stance-option').getAttribute('style') || '';
    expect(unselectedStyle).toMatch(/transparent/);
  });
});
