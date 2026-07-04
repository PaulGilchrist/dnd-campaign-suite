// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WeaponMasteryChoiceModal from './WeaponMasteryChoiceModal.jsx';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponMasteryChoice: vi.fn(),
}));

import * as automation from '../../../services/automation/index.js';

const baseProps = {
  playerStats: { name: 'Fighter1', level: 5 },
  campaignName: 'test-campaign',
  masteryProperties: ['Piercing', 'Slashing', 'Heavy'],
  onClose: vi.fn(),
  onConfirm: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

describe('WeaponMasteryChoiceModal', () => {
  // ── Initial render ──

  it('renders the modal overlay, header, body, and action buttons', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders the header icon and title', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    expect(document.querySelector('.fa-crosshairs')).toBeInTheDocument();
    expect(screen.getByText('Weapon Master — Choose Mastery')).toBeInTheDocument();
  });

  it('displays the instruction paragraph', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    expect(screen.getByText(/Choose a mastery property to activate/)).toBeInTheDocument();
  });

  it('renders all mastery properties as labeled radio options', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    expect(screen.getByText('Piercing')).toBeInTheDocument();
    expect(screen.getByText('Slashing')).toBeInTheDocument();
    expect(screen.getByText('Heavy')).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(3);
  });

  it('shares the same name attribute across all radio buttons', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="weaponMasteryChoice"]');
    expect(radios).toHaveLength(3);
  });

  it('renders no radio buttons when masteryProperties is empty', () => {
    render(<WeaponMasteryChoiceModal {...makeProps({ masteryProperties: [] })} />);
    expect(screen.getByText(/Choose a mastery property/)).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
  });

  it('renders the Select button disabled and the Skip button enabled by default', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const selectBtn = screen.getByRole('button', { name: 'Select' });
    const skipBtn = screen.getByRole('button', { name: 'Skip' });
    expect(selectBtn).toBeDisabled();
    expect(skipBtn).toBeEnabled();
  });

  it('renders a Font Awesome check icon inside the Select button', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const selectBtn = screen.getByRole('button', { name: 'Select' });
    expect(selectBtn.querySelector('.fa-check')).toBeInTheDocument();
  });

  // ── Selection behavior ──

  it('has no radio button checked by default', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => expect(radio).not.toBeChecked());
  });

  it('enables the Select button after a mastery option is clicked', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Piercing'));
    expect(screen.getByRole('button', { name: 'Select' })).not.toBeDisabled();
  });

  it('switches selection when a different mastery option is clicked', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Piercing'));
    expect(document.querySelectorAll('input[type="radio"]')[0]).toBeChecked();

    fireEvent.click(screen.getByText('Heavy'));
    expect(document.querySelectorAll('input[type="radio"]')[2]).toBeChecked();
  });

  it('highlights the selected mastery label with a non-transparent border', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Slashing'));
    const labels = document.querySelectorAll('label');
    const slashingLabel = Array.from(labels).find(l => l.textContent.includes('Slashing'));
    expect(slashingLabel.style.border).not.toBe('1px solid transparent');
  });

  // ── Skip button ──

  it('calls onClose and not onConfirm when Skip is clicked', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose, onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Select button — no selection ──

  it('does not call applyWeaponMasteryChoice or onConfirm when Select is clicked without a selection', async () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    expect(automation.applyWeaponMasteryChoice).not.toHaveBeenCalled();
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });

  // ── Select button — with selection ──

  it('calls applyWeaponMasteryChoice with the selected mastery, playerStats, and campaignName', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Piercing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    expect(automation.applyWeaponMasteryChoice).toHaveBeenCalledWith(
      'Piercing',
      baseProps.playerStats,
      baseProps.campaignName
    );
  });

  it('calls onConfirm with the selected mastery after applyWeaponMasteryChoice', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Slashing.' },
    });
    const onConfirm = vi.fn();
    render(<WeaponMasteryChoiceModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Slashing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    expect(onConfirm).toHaveBeenCalledWith('Slashing');
  });

  it('passes custom playerStats and campaignName to applyWeaponMasteryChoice', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Test' },
    });
    const customPlayerStats = { name: 'Rogue2', level: 10 };
    render(
      <WeaponMasteryChoiceModal
        {...makeProps({ playerStats: customPlayerStats, campaignName: 'my-campaign' })}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    expect(automation.applyWeaponMasteryChoice).toHaveBeenCalledWith(
      'Piercing',
      customPlayerStats,
      'my-campaign'
    );
  });

  it('renders the result state with the correct header and body content', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Piercing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Weapon Master')).toBeInTheDocument();
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Piercing');
    });
  });

  it('hides the choice options, Select, and Skip buttons after selection', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Heavy.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Heavy'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Choose a mastery property/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    });
  });

  it('renders a crosshairs icon and Done button in the result state', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Piercing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      const icon = document.querySelector('.fa-crosshairs');
      const doneBtn = screen.getByRole('button', { name: 'Done' });
      expect(icon).toBeInTheDocument();
      expect(doneBtn).toBeInTheDocument();
    });
  });

  it('renders HTML content via dangerouslySetInnerHTML in the result body', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: '<p>Mastery property set to: Piercing.</p>' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.querySelector('p')).toBeInTheDocument();
    });
  });

  // ── Done button in result state ──

  it('calls onClose when Done is clicked after a selection', async () => {
    const onClose = vi.fn();
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Piercing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm with the selected mastery and then closes via Done', async () => {
    const onClose = vi.fn();
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Piercing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(baseProps.onConfirm).toHaveBeenCalledWith('Piercing');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the result modal', async () => {
    const onClose = vi.fn();
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Piercing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking the result overlay background', async () => {
    const onClose = vi.fn();
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Piercing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Edge cases ──

  it('renders with a single mastery property', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <WeaponMasteryChoiceModal
        playerStats={baseProps.playerStats}
        campaignName={baseProps.campaignName}
        masteryProperties={['Piercing']}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByText('Piercing')).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(1);
  });

  it('does not throw when onClose and onConfirm are undefined', () => {
    const { container } = render(
      <WeaponMasteryChoiceModal
        playerStats={baseProps.playerStats}
        campaignName={baseProps.campaignName}
        masteryProperties={baseProps.masteryProperties}
      />
    );
    expect(container).toBeInTheDocument();
  });
});
