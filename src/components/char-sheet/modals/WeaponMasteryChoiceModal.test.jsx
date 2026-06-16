import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WeaponMasteryChoiceModal from './WeaponMasteryChoiceModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponMasteryChoice: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import * as automation from '../../../services/automation/index.js';

// ── Test fixtures ──

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

// ── Tests ──

describe('WeaponMasteryChoiceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal with proper CSS classes', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders header with crosshairs icon and title', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const icon = document.querySelector('.fa-crosshairs');
    expect(icon).toBeInTheDocument();
    expect(screen.getByText('Weapon Master — Choose Mastery')).toBeInTheDocument();
  });

  it('displays the instruction text', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    expect(screen.getByText(/Choose a mastery property to activate/)).toBeInTheDocument();
  });

  it('renders all mastery properties as radio options', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    expect(screen.getByText('Piercing')).toBeInTheDocument();
    expect(screen.getByText('Slashing')).toBeInTheDocument();
    expect(screen.getByText('Heavy')).toBeInTheDocument();
  });

  it('renders radio inputs for each mastery property', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(3);
  });

  it('renders Select button disabled by default', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const selectBtn = screen.getByRole('button', { name: 'Select' });
    expect(selectBtn).toBeDisabled();
  });

  it('renders Skip button', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('renders Font Awesome check icon on Select button', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const icon = document.querySelector('.fa-check');
    expect(icon).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Skip button ──

  it('calls onClose when Skip button is clicked', () => {
    const onClose = vi.fn();
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onConfirm when Skip is clicked', () => {
    const onConfirm = vi.fn();
    render(<WeaponMasteryChoiceModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Selection behavior ──

  it('does not select any mastery by default', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => expect(radio).not.toBeChecked());
  });

  it('selects a mastery property when its radio is clicked', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Piercing'));
    const selectBtn = screen.getByRole('button', { name: 'Select' });
    expect(selectBtn).not.toBeDisabled();
  });

  it('highlights the selected mastery property', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Slashing'));
    const labels = document.querySelectorAll('label');
    const slashingLabel = Array.from(labels).find(l => l.textContent.includes('Slashing'));
    expect(slashingLabel.style.border).not.toBe('1px solid transparent');
  });

  it('deselects previous selection when another option is clicked', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Piercing'));
    const firstRadio = document.querySelectorAll('input[type="radio"]')[0];
    expect(firstRadio).toBeChecked();

    fireEvent.click(screen.getByText('Heavy'));
    const thirdRadio = document.querySelectorAll('input[type="radio"]')[2];
    expect(thirdRadio).toBeChecked();
  });

  it('enables Select button after choosing a mastery', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Heavy'));
    const selectBtn = screen.getByRole('button', { name: 'Select' });
    expect(selectBtn).not.toBeDisabled();
  });

  // ── Select button / confirmation flow ──

  it('does not call applyWeaponMasteryChoice when Select is clicked without selection', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({ type: 'popup', payload: {} });
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    expect(automation.applyWeaponMasteryChoice).not.toHaveBeenCalled();
  });

  it('calls applyWeaponMasteryChoice with selected mastery when Select is clicked', async () => {
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

  it('calls onConfirm with selected mastery after applyWeaponMasteryChoice', async () => {
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

  it('does not call onConfirm when no selection is made', async () => {
    const onConfirm = vi.fn();
    automation.applyWeaponMasteryChoice.mockResolvedValue(null);
    render(<WeaponMasteryChoiceModal {...makeProps({ onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Result state after selection ──

  it('shows result state after successful selection', async () => {
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
  });

  it('displays mastery description in result body', async () => {
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
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Piercing');
    });
  });

  it('hides mastery options after selection', async () => {
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
    });
  });

  it('hides Select and Skip buttons after selection', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Slashing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Slashing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    });
  });

  it('shows Done button after selection', async () => {
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
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('renders crosshairs icon in result header', async () => {
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
      expect(icon).toBeInTheDocument();
    });
  });

  // ── Done button in result state ──

  it('calls onClose when Done button is clicked after selection', async () => {
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

  it('does not close when clicking inside result modal', async () => {
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

  it('calls onClose when clicking result overlay background', async () => {
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

  it('renders with empty mastery properties array', () => {
    render(<WeaponMasteryChoiceModal {...makeProps({ masteryProperties: [] })} />);
    expect(screen.getByText(/Choose a mastery property/)).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
  });

  it('renders with single mastery property', () => {
    render(<WeaponMasteryChoiceModal {...makeProps({ masteryProperties: ['Piercing'] })} />);
    expect(screen.getByText('Piercing')).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(1);
  });

  it('renders Select button with Font Awesome icon', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const icon = screen.getByRole('button', { name: 'Select' }).querySelector('.fa-check');
    expect(icon).toBeInTheDocument();
  });

  it('passes correct arguments to applyWeaponMasteryChoice', async () => {
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

  it('renders result with dangerouslySetInnerHTML content', async () => {
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

  it('selects second mastery property from list', async () => {
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Slashing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Slashing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Slashing');
    });
  });

  it('selects third mastery property from list', async () => {
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
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Heavy');
    });
  });

  it('select button has correct aria role and name', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const selectBtn = screen.getByRole('button', { name: 'Select' });
    expect(selectBtn).toBeInTheDocument();
    expect(selectBtn).toBeDisabled();
  });

  it('skip button has correct aria role and name', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const skipBtn = screen.getByRole('button', { name: 'Skip' });
    expect(skipBtn).toBeInTheDocument();
  });

  it('done button has correct aria role and name in result state', async () => {
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
      const doneBtn = screen.getByRole('button', { name: 'Done' });
      expect(doneBtn).toBeInTheDocument();
    });
  });

  it('radio buttons share the same name attribute', () => {
    render(<WeaponMasteryChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="weaponMasteryChoice"]');
    expect(radios).toHaveLength(3);
  });

  it('onClose is called when selecting and then closing via Done', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    automation.applyWeaponMasteryChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Mastery property set to: Piercing.' },
    });
    render(<WeaponMasteryChoiceModal {...makeProps({ onClose, onConfirm })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Piercing'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onConfirm).toHaveBeenCalledWith('Piercing');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
